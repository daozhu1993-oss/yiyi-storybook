import {readingSession,readingEvents,canReadBook,requestReadingFeature,remindAfterFinish,waitForReadingProgress} from "./reading-session.js";
import {readingStore} from "./reading-store.js";
import {assetUrl, downloadProgress, loadPublicAssets } from "./assets.js";
import {isFreeBook} from "./book-access.js";
/* Storylight — Otto and the Shy Moon
   A 3D pop-up picture book: the book lies open on a bedside table, each spread pops a
   diorama up from the right page, the words sit on a big flat reading card, the narrator reads
   with word-by-word highlighting, and everything in the scene reacts to the reader's hand. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Book } from "./book.js";
import { buildScene } from "./scenes.js";
import { Reading } from "./reading.js";
import { Narrator, cleanWord } from "./narration.js";
import { SoundKit } from "./audio.js";
import { UI, loadSettings, saveSettings } from "./ui.js";
import * as P from "./props.js";
import { Sparkles } from "./sparkles.js";
import { makePinBadge } from "./pin.js";
import { t, setLanguage } from "./i18n.js";
import { NightSky } from "./nightsky.js";
import { Comets } from "./comets.js";
import { makeShelf, BOOK_H, PER_PAGE } from "./shelf.js";
import { Quiz } from "./quiz.js";
import { Souvenirs, PIN_POINTS } from "./souvenirs.js";
import { normalizeSouvenirs } from "./souvenir-state.js";
import { Profiles, MAX_PROFILES } from "./profiles.js";
import { makeBookmark, readPercent } from "./bookmark.js";
import { vocabKey } from "./reading.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");
let BOOK_ID = document.body.dataset.book || params.get("book") || "";
let BOOK_BASE = "";
let library = { books: [] };   // books/index.json
let sceneBuilders = null;
let quiz = null;                 // the end-of-story picture quiz (src/quiz.js)
let souvenirs = null;            // pins, points and the souvenir board (src/souvenirs.js)
let profiles = null;             // who is reading: up to three children (src/profiles.js)

const state = {
  page: -1,
  mode: "listen",
  reading: "idle",
  look: false,
  opened: false,
  diorama: null,
  pick: 0,          // which picking of a book is current: "Back to the shelf" during a load moves it on
  prepared: null,   // the next page's scene, built ahead so it compiles and warms during the turn
  warm: [],         // textures to send to the GPU, one a frame, before their page pops in
  popTween: null,
  hover: null,
  drag: null,
  autoTimer: null,
  time: 0,
  focus: null,
  transitioning: false,
  view: "loading",   // loading | shelf | picking | book
  selected: null,
};

const PROGRESS_KEY = "storylight-progress";
/** The reading child's progress key (src/profiles.js); the plain key before profiles exist. */
function progressKey() { return profiles ? profiles.keys(profiles.active.id).progress : PROGRESS_KEY; }
function loadProgress() {
  try { return JSON.parse(readingStore.getItem(progressKey()) || "{}") || {}; } catch (error) { return {}; }
}
function saveProgress() {
  try { readingStore.setItem(progressKey(), JSON.stringify(state.progress)); } catch (error) { /* private mode */ }
}

const settings = loadSettings();
const canvas = document.getElementById("gl");

let story, ui, renderer, composer, bloom, scene, camera, book, reading, narrator, sound, audioContext, shelf;
const textures = { art: {} };
const pointer = { ndc: new THREE.Vector2(-2, -2), x: 0, y: 0, down: false, moved: 0, world: new THREE.Vector3() };
const raycaster = new THREE.Raycaster();
const cameraRig = { pos: new THREE.Vector3(), target: new THREE.Vector3(), current: new THREE.Vector3(), currentTarget: new THREE.Vector3() };

const viewport = () => ({ w: window.innerWidth || 1280, h: window.innerHeight || 720 });

/* ---------- loading ---------- */

THREE.DefaultLoadingManager.setURLModifier(assetUrl);
const loader = new THREE.TextureLoader();
const imageLoader = new THREE.ImageLoader();
const load = (url) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
const loadImage = (url) => new Promise((resolve, reject) => imageLoader.load(url, resolve, undefined, reject));
const optional = async (url) => { try { return await load(url); } catch (error) { return null; } };
const findSkinned = (root) => { let found = null; root.traverse((o) => { if (!found && o.isSkinnedMesh) found = o; }); return found; };

/** Everything that belongs to the table, not to a book: paper, wood, cloth, the toys, the fonts. */
async function loadShared(progress = (p, copy) => ui.setLoading(p, copy)) {
  const steps = 7;
  let done = 0;
  const tick = (copy) => { done++; progress(done / steps, copy); };
  textures.paperImage = await loadImage("public/textures/paper.jpg"); tick(t("loadPaper"));
  textures.wood = await load("public/textures/wood.jpg"); tick(t("loadTable"));
  textures.town = await load("public/textures/town-strip.png"); tick(t("loadWindows"));
  textures.cloth = await optional("public/textures/cloth-neutral.jpg"); // a mid-grey weave, tinted per book
  textures.edges = await optional("public/textures/page-edges.jpg");
  textures.paperNormal = await optional("public/textures/paper-normal.jpg");
  tick(t("loadBinding"));
  textures.town.colorSpace = THREE.SRGBColorSpace;
  textures.wood.colorSpace = THREE.SRGBColorSpace;
  textures.wood.wrapS = textures.wood.wrapT = THREE.RepeatWrapping;
  // the shelf's painted planks and the nursery wallpaper behind it
  textures.woodPlanks = await optional("public/textures/wood-planks.jpg");
  if (textures.woodPlanks) { textures.woodPlanks.colorSpace = THREE.SRGBColorSpace; textures.woodPlanks.anisotropy = 8; }
  textures.woodPlanksNormal = await optional("public/textures/wood-planks-normal.jpg");
  if (textures.woodPlanksNormal) textures.woodPlanksNormal.colorSpace = THREE.NoColorSpace;
  // the nursery wall: a default wallpaper, and one per book that fades in when a book is picked
  textures.walls = {};
  textures.wall = await wallTexture("default") || await optional("public/textures/wall-nursery.jpg");
  if (textures.wall) prepWall(textures.wall);
  textures.wood.repeat.set(4, 3);
  textures.wood.anisotropy = 8;
  // generated toys for the table (procedural ones stand in when a model is missing)
  textures.toys = {};
  // the story toys (public/models/toys): which book owns which, and how tall they stand
  try { textures.toyManifest = await (await fetch("public/models/toys/manifest.json")).json(); } catch (error) { textures.toyManifest = {}; }
  textures.toyFor = loadToy;
  // no toy model is fetched before the shelf shows: the lamp, the train, the magnifier and the
  // crayons are procedural for a moment and swap for their models once the shelf is up
  textures.toyModelFor = loadToyModel;
  try { textures.lockModel = (await new GLTFLoader().loadAsync("public/models/lock.glb")).scene; } catch (error) { textures.lockModel = null; }
  tick(t("loadTidy"));
  // covers: the first row's before the shelf shows, the other rows in the background (the shelf
  // wears a printed placeholder until each arrives and swaps it in)
  textures.covers = {};
  // the shelf wears covers at shelf size (art/cover-shelf.webp, a tenth of the full painting);
  // the full cover comes with the book when it is opened
  const shelfCover = (file) => file.replace(/cover(\.[a-z]{2})?\.jpg$/, "cover-shelf$1.webp");
  const coverOf = async (meta) => {
    const t = meta.cover ? (await optional(`books/${meta.id}/${shelfCover(meta.cover)}`) || await optional(`books/${meta.id}/${meta.cover}`)) : null;
    if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; textures.covers[meta.id] = t; (textures.coversBase = textures.coversBase || {})[meta.id] = t; }
    return t;
  };
  await Promise.all(library.books.slice(0, PER_PAGE).map(coverOf));
  textures.loadLaterCovers = async () => { for (const meta of library.books.slice(PER_PAGE)) { if (textures.covers[meta.id]) continue; const t = await coverOf(meta); if (t && shelf && shelf.setCover) shelf.setCover(meta.id, t); } };
  try { await document.fonts.ready; } catch (error) { /* fine */ }
  // recorded effects shared by every book: fetched once the shelf is up (synthesized sounds stand in until then)
  textures.loadSfx = async () => {
    try {
      const sfx = await (await fetch("public/audio/sfx/manifest.json")).json();
      const entries = {};
      for (const [name, entry] of Object.entries(sfx.samples || {})) entries[name] = `public/audio/sfx/${entry.file}`;
      await sound.loadSamples(entries);
    } catch (error) { /* synthesized sounds stand in */ }
  };
  tick(t("loadVoice"));
  await narrator.checkServer();
  tick(t("ready"));
}

/** Load one book: its story, painted cards, word cards, hero model and clips, cover and spreads. */
async function loadBook(id, progress = (p, copy) => ui.setLoading(p, copy)) {
  // "Back to the shelf" during the load moves state.pick on; the load stops at its next step
  const pick = state.pick;
  const check = () => { if (pick !== state.pick) { const error = new Error("The book was put back."); error.cancelled = true; throw error; } };
  if (!isFreeBook(id)) {
    if(!readingSession.authorizeBook)throw new Error("Sign in to open this book.");
    await readingSession.authorizeBook(id);
  }
  if(isFreeBook(id))await loadPublicAssets({scope:'book',book:id,language:settings.language||'en'});
  BOOK_ID = id;document.body.dataset.currentBook=id;
  BOOK_BASE = `books/${id}`;
  state.wallBook = id;
  setWall(id);
  showBookToys(id);
  story = await (await fetch(assetUrl(`${BOOK_BASE}/story.json`))).json();
  story.id = story.id || id;
  story.base = { title: story.title, blurb: story.blurb, subtitle: story.subtitle, logo: story.logo, cover: story.cover, pages: story.pages, end: story.end, magic: story.magic, quiz: story.quiz, vocab: story.vocab, folder: (story.narrator && story.narrator.bundled && story.narrator.bundled.folder) || "voice" };
  await applyLanguage(settings.language || "en", { announce: false });
  document.title = `${story.title} · StoryComet`;
  let artList = [];
  try {
    const manifest = await (await fetch(assetUrl(`${BOOK_BASE}/art/manifest.json`))).json();
    artList = manifest.cards || [];
  } catch (error) { artList = []; }
  const hero = story.hero || {};
  const clipNames = hero.clips || [];
  const steps = 4 + artList.length + clipNames.length;
  let done = 0;
  const tick = (copy) => { check(); done++; progress(done / steps, copy); };
  for (const entry of Object.values(textures.art)) if (entry.texture) entry.texture.dispose();
  textures.art = {};
  textures.cover = (await optional(`${BOOK_BASE}/${story.cover || "art/cover.jpg"}`)) || (textures.covers && textures.covers[id]) || null; tick(t("loadCover"));
  for (const card of artList) {
    const t = await optional(`${BOOK_BASE}/art/${card.file}`);
    if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; textures.art[card.id] = { texture: t, ...card }; }
    tick(card.copy || "Painting the pictures…");
  }
  try {
    const words = await (await fetch(assetUrl(`${BOOK_BASE}/words/manifest.json`))).json();
    textures.wordCards = new Set(words.cards || []);
    textures.wordCardFolder = `${BOOK_BASE}/${words.folder || "words/cards"}`;
    textures.wordCardFormat = words.format || "jpg";
  } catch (error) { textures.wordCards = new Set(); }
  // the souvenir pins hidden in this book's scenes
  textures.pins = {};
  for (const pin of story.pins || []) {
    const t = await optional(`${BOOK_BASE}/pins/${pin.id}.png`);
    if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textures.pins[pin.id] = t; }
  }
  // the hero: a rigged model plus animation clips that come as tiny proxy rigs and are retargeted onto it
  textures.heroGltf = null;
  textures.heroClips = {};
  if (hero.model) {
    try { textures.heroGltf = await new GLTFLoader().loadAsync(`${BOOK_BASE}/${hero.model}`); }
    catch (error) { console.warn(`${hero.name || "hero"} model missing, using the felt figure`, error); }
  }
  tick(t("loadHero", { name: hero.name || t("theHero") }));
  if (textures.heroGltf) {
    // retarget() poses the target skeleton it is given (positions, scales), so work on a throwaway
    // clone and keep the master pristine for the scenes to clone from
    const scratch = SkeletonUtils.clone(textures.heroGltf.scene);
    scratch.updateMatrixWorld(true);
    const target = findSkinned(scratch);
    for (const name of clipNames) {
      try {
        const g = await new GLTFLoader().loadAsync(`${BOOK_BASE}/models/anim/${name}.glb`);
        const source = findSkinned(g.scene);
        if (target && source && g.animations[0]) {
          // the proxy rigs come at whatever height the service picked (some 2.5x the hero's), and
          // retarget copies the hip position verbatim: scale it by the ratio of the two rigs' bind
          // hip heights so the hero neither floats nor sinks
          const bindHipY = (skinned) => { const i = skinned.skeleton.bones.findIndex((b) => b.name === "Hips"); if (i < 0) return 1; return Math.abs(new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(skinned.skeleton.boneInverses[i]).invert()).y) || 1; };
          const scale = bindHipY(target) / bindHipY(source);
          // retarget() only maps bones it can name: without getBoneName every bone is skipped and the clip freezes
          const clip = SkeletonUtils.retargetClip(target, source, g.animations[0], { hip: "Hips", scale, getBoneName: (bone) => bone.name, preserveBonePositions: true, useFirstFramePosition: false, fps: 30, localOffsets: bindOffsets(target, source) });
          // retargetClip names tracks ".bones[Name]" relative to the skinned mesh; bind by node name instead
          for (const track of clip.tracks) track.name = track.name.replace(/^\.bones\[([^\]]+)\]/, "$1");
          clip.name = name;
          textures.heroClips[name] = clip;
        }
      } catch (error) { console.warn(`${hero.name || "hero"} clip ${name} unavailable`, error); }
      tick(t("loadMoves", { name: hero.name || t("theHero") }));
    }
    alignClipFacing(scratch, [textures.heroGltf.animations[0], ...Object.values(textures.heroClips)], { idle: textures.heroGltf.animations[0] });
  } else {
    for (const name of clipNames) tick("");
  }
  // the book's music and ambience (the music-box lullaby stands in when a book has none)
  const audio = story.audio || {};
  sound.setMusicTrack(audio.music ? await sound.decode(`${BOOK_BASE}/${audio.music}`) : null);
  sound.setAmbience(audio.ambience ? await sound.decode(`${BOOK_BASE}/${audio.ambience}`) : null, audio.ambienceVolume ?? 0.3);
  // the spreads
  const sceneModuleUrl = new URL(`../${BOOK_BASE}/${story.scenes || "scenes.js"}`, import.meta.url);
  const module = await import(sceneModuleUrl.href);
  sceneBuilders = module.default || module.builders;
  tick(t("loadPopups"));
  createBook();
  narrator.prepare(0).catch(() => {});
  tick(t("ready"));
  return story;
}

/** The book on the table, bound with the current story's cover and page count. */
function createBook() {
  if (book) { scene.remove(book.group); if (book.bookmark) scene.remove(book.bookmark); book = null; }
  const colors = story.colors || {};
  book = new Book({
    story,
    artTextures: textures.art,
    coverTexture: textures.cover,
    paperImage: textures.paperImage,
    clothTexture: textures.cloth,
    edgesTexture: textures.edges,
    paperNormal: textures.paperNormal,
    sheets: story.pages.length + 1,
    clothColor: colors.cloth || 0x1b2450,
    endpaper: colors.endpaper || {}
  });
  scene.add(book.group);
  book.setOpen(0);
  // the progress bookmark lies on the table beside the open book (the right side is the one the
  // reading card never covers), turned a little so its tassel points at the reader
  book.bookmark = makeBookmark(0.16, 0.82);
  book.bookmark.geometry.rotateX(-Math.PI / 2);
  book.bookmark.position.set(1.2, 0.004, -0.3);
  book.bookmark.rotation.y = -0.2;
  book.bookmark.receiveShadow = true;
  book.bookmark.setEnabled(false);
  scene.add(book.bookmark);
  // the real book waits out of sight until its caller shows it (the shelf's copy lies on the table)
  book.group.visible = false;
}

/* ---------- scene setup ---------- */

function setupRenderer() {
  const { w, h } = viewport();
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "default" });
  renderer.setPixelRatio(power.dpr());
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // the loop decides when the shadow map is redrawn
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10142b);
  scene.fog = new THREE.Fog(0x10142b, 5, 11);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.38;
  pmrem.dispose();

  camera = new THREE.PerspectiveCamera(33, w / h, 0.1, 30);
  applyCameraPreset(false, true);

  // the sparkles get a transparent canvas of their own in the top layer (a manual popover), so the
  // cursor's trail and its bursts keep flying above the settings folio and every dialog
  const sparkCanvas = document.createElement("canvas");
  sparkCanvas.id = "sparkles";
  sparkCanvas.setAttribute("popover", "manual");
  document.body.appendChild(sparkCanvas);
  sparkRenderer = new THREE.WebGLRenderer({ canvas: sparkCanvas, alpha: true, antialias: false });
  sparkRenderer.setClearColor(0x000000, 0);
  sparkRenderer.setPixelRatio(power.sparkDpr());
  sparkRenderer.setSize(w, h, false);
  const raiseSparkles = () => { try { if (sparkCanvas.matches(":popover-open")) sparkCanvas.hidePopover(); sparkCanvas.showPopover(); } catch (error) { /* no popover support: it stays a plain overlay */ } };
  raiseSparkles();
  // a dialog that opens later lands above the popover; lift the sparkles back over it
  new MutationObserver((changes) => { if (changes.some((c) => c.target.open)) raiseSparkles(); }).observe(document.body, { attributes: true, attributeFilter: ["open"], subtree: true });
  sparks = new Sparkles(sparkRenderer);
  sparks.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(Math.ceil(w / 2), Math.ceil(h / 2)), 0.18, 0.5, 0.93);
  // a single NaN pixel in the scene would be smeared by the bloom blur into a large black block;
  // drop NaN/Inf texels at the high-pass stage so they can never spread
  const hp = bloom.materialHighPassFilter;
  hp.fragmentShader = hp.fragmentShader.replace("vec4 texel = texture2D( tDiffuse, vUv );", "vec4 texel = texture2D( tDiffuse, vUv );\n\t\t\tif ( any( isnan( texel ) ) || any( isinf( texel ) ) ) texel = vec4( 0.0 );");
  hp.needsUpdate = true;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Lighting: a large soft key from the upper left (blurred VSM shadows), cool sky fill,
  // a warm bounce from the room, cool moonlight from behind, and the practical lamp on the table.
  scene.add(new THREE.HemisphereLight(0x8ea2e0, 0x5a3c22, 0.5));
  const key = new THREE.DirectionalLight(0xffe3bf, 2.4);
  key.position.set(-2.6, 3.6, 2.2);
  key.target.position.set(0.2, 0, -0.2);
  key.castShadow = true;
  key.shadow.mapSize.set(power.touch ? 2048 : 4096, power.touch ? 2048 : 4096);
  const sc = key.shadow.camera;
  // wide enough to take in the whole wall behind the shelf: a tighter box ends in a hard slanted
  // edge across the wallpaper where the plank's shadow simply stops (the box's side, not a shadow)
  sc.left = -4.4; sc.right = 4.4; sc.top = 3.6; sc.bottom = -3.4; sc.near = 1; sc.far = 14;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.015;
  scene.add(key, key.target);
  state.keyLight = key;
  const moonlight = new THREE.DirectionalLight(0x8fb0ff, 0.75);
  moonlight.position.set(2.6, 2.6, -2.4);
  scene.add(moonlight);
  const bounce = new THREE.PointLight(0xffd6ae, 1.6, 5, 2);
  bounce.position.set(1.6, 0.9, 1.7);
  scene.add(bounce);
  // the souvenir pins' light: one for the whole scene, parked at zero until a badge picks it up
  state.pinLight = new THREE.PointLight(0xffd79a, 0, 0.55, 2);
  scene.add(state.pinLight);

  const table = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshStandardMaterial({ map: textures.wood, color: 0xd9c4a4, roughness: 0.6, metalness: 0.02, roughnessMap: textures.wood, envMapIntensity: 0.6 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.002;
  table.receiveShadow = true;
  scene.add(table);

  // table decorations: a lamp, toys, a magnifier, a stack of books
  state.decor = [];
  const place = (api, x, z, ry = 0, scale = 1, name = "") => {
    api.group.position.set(x, 0, z);
    api.group.rotation.y = ry;
    api.group.scale.setScalar(scale);
    api.name = name;
    api.group.traverse((o) => { if (o.isMesh) o.userData.decor = api; });
    scene.add(api.group);
    state.decor.push(api);
    return api;
  };
  const toys = textures.toys || {};
  const lamp = place(toys.lamp ? P.makeLamp(toys.lamp) : P.makeLamp(), -1.5, -1.3, 0, 2.6, "lamp");
  lamp.aim(new THREE.Vector3(0.35, 0.1, 0.1));
  state.tableLamp = lamp;
  const blocks = place(P.makeBlocks(["O", "T", "T"]), 1.55, -0.95, -0.5, 1.9, "blocks");
  state.tableBlocks = blocks;
  // the train, the magnifier and the crayons: procedural stand-ins now, their models once the shelf
  // is up (upgradeTableToys), so the first screen is not waiting on five megabytes of toys
  const tableToys = {
    train: { spot: [0.7, -1.4, -0.55], model: (m) => P.makeModelToy(m, { length: 0.46, keep: true, kind: "train" }), stand: () => P.makeTrain(), standScale: 1.9 },
    magnifier: { spot: [1.28, 0.55, 0.55], model: (m) => P.makeModelToy(m, { length: 0.36, flat: true, kind: "magnifier" }), stand: () => P.makeMagnifier(), standScale: 1 },
    crayons: { spot: [-1.42, 0.62, 0], model: (m) => P.makeModelToy(m, { height: 0.22, kind: "crayons" }), stand: () => P.makeCrayonCup(), standScale: 1.3 },
  };
  for (const [name, spec] of Object.entries(tableToys)) {
    const [x, z, ry] = spec.spot;
    place(toys[name] ? spec.model(toys[name]) : spec.stand(), x, z, ry, toys[name] ? 1 : spec.standScale, name);
  }
  state.upgradeTableToys = async () => {
    // the lamp first (it lights the room): the model takes the procedural lamp's place, aimed the same way
    if (!toys.lamp && textures.toyModelFor) {
      const model = await textures.toyModelFor("lamp");
      if (model && state.tableLamp) {
        const old = state.tableLamp;
        const fresh = place(P.makeLamp(model), -1.5, -1.3, 0, 2.6, "lamp");
        fresh.aim(new THREE.Vector3(0.35, 0.1, 0.1));
        if (old.state && fresh.set) fresh.set(old.state.on !== false);
        scene.remove(old.group);
        state.decor.splice(state.decor.indexOf(old), 1);
        state.tableLamp = fresh;
      }
    }
    for (const [name, spec] of Object.entries(tableToys)) {
      if (toys[name] || !textures.toyModelFor) continue;
      const model = await textures.toyModelFor(name);
      if (!model) continue;
      const old = state.decor.find((d) => d.name === name);
      if (old) { scene.remove(old.group); state.decor.splice(state.decor.indexOf(old), 1); }
      const [x, z, ry] = spec.spot;
      const api = place(spec.model(model), x, z, ry, 1, name);
      // a little pop as the real toy takes its place
      api.group.scale.setScalar(0.001);
      const t0 = performance.now();
      const grow = () => { const k = Math.min(1, (performance.now() - t0) / 500); api.group.scale.setScalar(Math.max(0.001, P.easeOutBack(k))); if (k < 1) requestAnimationFrame(grow); };
      requestAnimationFrame(grow);
    }
  };
  place(P.makeBall(), 1.62, -0.35, 0, 1, "ball");
  place(P.makeBookStack(), -1.9, -0.25, 0.25, 1, "books");

  // the nursery wall behind the table, with a painted skirting board where it meets the wood
  const wallMat = () => new THREE.MeshStandardMaterial({ map: textures.wall || null, color: textures.wall ? 0xe6dcc8 : 0xd8c8ac, roughness: 0.94, metalness: 0, normalMap: textures.wallNormal || null, normalScale: new THREE.Vector2(0.7, 0.7) });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), wallMat());
  wall.position.set(0, 4, -2.96);
  wall.receiveShadow = true;
  scene.add(wall);
  // a second sheet in front of the wall carries the next wallpaper while it fades in
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), wallMat());
  overlay.material.transparent = true;
  overlay.material.opacity = 0;
  overlay.position.set(0, 4, -2.955);
  overlay.receiveShadow = true;
  scene.add(overlay);
  state.wall = { mesh: wall, overlay, current: "default", pending: null, fade: 0 };
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: 0xf6ead0, roughness: 0.6 }));
  skirting.position.set(0, 0.08, -2.93);
  skirting.receiveShadow = true;
  scene.add(skirting);

  // the library, on an open shelf against the wall
  // the lock on the books a guest cannot open yet (public/models/lock.glb when it exists)
  textures.locked = (id) => !canReadBook(id);
  shelf = makeShelf({ books: library.books, textures });
  // progressive loading: the row in view gets its toy models first, then the table's toys, then the neighbours
  setTimeout(() => { if (shelf.loadToysInView) shelf.loadToysInView(); }, 400);
  setTimeout(() => { if (textures.loadLaterCovers) textures.loadLaterCovers().catch(() => {}); }, 900);
  setTimeout(() => { if (textures.loadSfx) textures.loadSfx().catch(() => {}); }, 1400);
  clearInterval(state.bytesTimer);
  ui.setLoadingBytes(downloadProgress());
  setTimeout(() => { if (state.upgradeTableToys) state.upgradeTableToys().catch(() => {}); }, 2500);
  shelf.group.position.set(0, 0, -2.72);
  scene.add(shelf.group);
  // the covers of the saved language (the shelf is built with the English ones)
  if ((settings.language || "en") !== "en") refreshCovers();
}

/** How far the shelf moves in the room for one pixel of pointer travel (its width fills the view). */
function shelfWorldPerPixel() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const dist = camera.position.distanceTo(new THREE.Vector3(0, 0.7, -2.62));
  const worldWidth = 2 * dist * Math.tan(vfov / 2) * camera.aspect;
  return worldWidth / viewport().w;
}

/** Mouse wheel and trackpad: slide the shelf, then settle on a row once the wheel stops. */
function onWheel(event) {
  if (state.view !== "shelf" || !shelf) return;
  event.preventDefault();
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  shelf.dragBy(-delta * 0.0045);
  clearTimeout(state.wheelTimer);
  state.wheelTimer = setTimeout(() => {
    const before = shelf.page;
    const page = shelf.settle(0);
    if (page !== before) { sound.whoosh(page > before); ui.setShelfPage(page, shelf.pages); }
  }, 140);
}

/* ---------- the story toys ---------- */

const toyCache = new Map();
/** A fresh copy of a modelled toy (cached per file); null when the model is missing. */
/** A toy without a model yet stands on the plank as a painted cut-out (public/models/toys/cards/<name>.webp,
    painted in the shelf toys' own style, no plinth), upright the way the pop-up figures stand, lit by the
    room like the modelled toys (the painting doubles as a bump map so the key light shapes it); a model,
    when it arrives from Higgsfield, wins. */
async function cutoutToy(name) {
  let texture;
  try { texture = await new THREE.TextureLoader().loadAsync(`public/models/toys/cards/${name}.webp`); } catch (error) { return null; }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const aspect = texture.image && texture.image.height ? texture.image.width / texture.image.height : 1;
  const group = new THREE.Group();
  const h = 1, w = h * aspect;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: 0.012, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.62, metalness: 0, envMapIntensity: 0.9 }));
  card.position.y = h / 2;
  card.castShadow = card.receiveShadow = true;
  group.add(card);
  group.userData.cutout = true;
  return group;
}
/** The modelled toy (cached per file), or null when there is no model. Nothing asks for it until the
    toy is in view: the shelf shows the card first (progressive loading, see loadToy). */
const toyModelCache = new Map();
function loadToyModel(name) {
  if (!toyModelCache.has(name)) toyModelCache.set(name, new GLTFLoader().loadAsync(`public/models/toys/${name}.glb`).then((g) => g.scene).catch(() => null));
  return toyModelCache.get(name).then((scene) => (scene ? scene.clone(true) : null));
}
/** What a toy looks like right away: its painted card (a render of the model, or the painting that
    stands in for a model still to come), a few dozen kilobytes instead of a megabyte or two. The
    shelf swaps the model in when the toy's row comes into view (textures.toyModelFor). A toy with
    no card at all falls back to its model. */
function loadToy(name) {
  if (!toyCache.has(name)) toyCache.set(name, cutoutToy(name).then((card) => card || loadToyModel(name)));
  return toyCache.get(name).then((scene) => (scene ? scene.clone(true) : null));
}

/** The chosen book's own toys come down to the table beside it (and leave when it closes). */
function showBookToys(id) {
  clearBookToys();
  const manifest = textures.toyManifest || {};
  const names = ((manifest.books || {})[id] || []).slice(0, 2);
  const heights = manifest.heights || {};
  // a few candidate spots beside the open book's back corners; each toy takes the first one that is
  // clear of the table's decorations (lamp, blocks, train, ball, magnifier, crayons, books), of
  // the open book and of the other toy, so nothing ever lands on top of anything
  const candidates = [
    [[-1.35, -0.6, 0.55], [-0.55, -1.4, 0.5], [-1.0, -1.15, 0.5], [-0.95, -0.05, 0.6], [-1.9, -0.9, 0.5], [-2.2, -0.4, 0.5], [-1.15, 0.25, 0.6]],
    [[1.42, -0.95, -0.5], [0.15, -1.5, -0.4], [1.05, -1.25, -0.45], [1.9, -0.6, -0.55], [2.2, -1.0, -0.5], [1.0, -0.15, -0.5], [2.3, 0.1, -0.55]],
  ];
  const obstacles = (state.decor || []).map((d) => { const box = new THREE.Box3().setFromObject(d.group); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3()); return { x: c.x, y: c.y, z: c.z, r: Math.max(size.x, size.y, size.z) / 2 }; });
  // the open book: flat, so a rectangle on the floor plan (not a sphere, which would cover the screen)
  const bookRect = { x0: -1.0, x1: 1.0, z0: -0.75, z1: 0.55 };
  // seen from the book view's camera, a toy must not sit in front of or behind anything either:
  // the clearance is checked on the floor plan and on the screen
  const eye = camera.clone();
  eye.position.copy(cameraRig.pos); eye.lookAt(cameraRig.target); eye.updateMatrixWorld(true);
  const onScreen = (o) => {
    const p = new THREE.Vector3(o.x, o.y, o.z);
    const dist = p.distanceTo(eye.position);
    const px = p.clone().project(eye);
    const scale = (viewport().h / 2) / (dist * Math.tan(THREE.MathUtils.degToRad(eye.fov) / 2));
    return { sx: px.x * viewport().w / 2, sy: px.y * viewport().h / 2, sr: o.r * scale };
  };
  const offBook = (c) => c.x + c.r < bookRect.x0 || c.x - c.r > bookRect.x1 || c.z + c.r < bookRect.z0 || c.z - c.r > bookRect.z1;
  const clear = (a, b) => {
    if (Math.hypot(a.x - b.x, a.z - b.z) <= a.r + b.r + 0.06) return false;
    const A = onScreen(a), B = onScreen(b);
    return Math.hypot(A.sx - B.sx, A.sy - B.sy) > A.sr + B.sr + 10;
  };
  // and it must be on screen: a spot past the edge is no use to anyone
  const visible = (o) => { const S = onScreen(o); return Math.abs(S.sx) + S.sr < viewport().w / 2 * 0.96 && Math.abs(S.sy) + S.sr < viewport().h / 2 * 0.96; };
  const taken = [];
  const spotFor = (k, r) => {
    const list = candidates[k] || candidates[0];
    const spots = list.map(([x, z, ry]) => ({ x, y: r, z, r, ry }));
    const free = spots.find((c) => visible(c) && offBook(c) && [...obstacles, ...taken].every((o) => clear(o, c))) || spots.find((c) => visible(c) && offBook(c)) || spots[0];
    taken.push(free);
    return [free.x, free.z, free.ry];
  };
  const token = (state.toyToken = (state.toyToken || 0) + 1);
  names.forEach((name, k) => {
    // (the callback's parameter must not be called `scene`: that shadowed the room's scene once
    // and the toy was added inside itself, which sent updateMatrixWorld into an endless loop)
    loadToy(name).then((model) => {
      if (!model || state.toyToken !== token) return;
      const holder = new THREE.Group();
      const object = P.fitModel(model, { height: (heights[name] || 0.26) * 1.25, keep: true });
      object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      holder.add(object);
      const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
      const spot = spotFor(k, Math.max(size.x, size.z) / 2);
      holder.position.set(spot[0], 0, spot[1]);
      holder.rotation.y = spot[2];
      holder.scale.setScalar(0.001);
      holder.userData.pop = 0;
      holder.userData.decorName = name;
      scene.add(holder);
      state.bookToys.push(holder);
    });
  });
}

function clearBookToys() {
  for (const h of state.bookToys || []) scene.remove(h);
  state.bookToys = [];
}

function updateBookToys(dt) {
  for (const h of state.bookToys || []) {
    if (h.userData.pop >= 1) continue;
    h.userData.pop = Math.min(1, h.userData.pop + dt * 1.6);
    h.scale.setScalar(Math.max(0.001, P.easeOutBack(h.userData.pop)));
  }
}

/* ---------- the wall ---------- */

function prepWall(t) {
  t.colorSpace = THREE.SRGBColorSpace;
  // the painted wallpapers are not perfectly tileable: mirror them so the seams disappear
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.repeat.set(7, 2.6);
  t.anisotropy = 8;
  return t;
}

/** The wallpaper for a book (public/textures/walls/<id>.jpg, with a normal map beside it), cached. */
async function wallTexture(id) {
  if (textures.walls && textures.walls[id] !== undefined) return textures.walls[id];
  const t = await optional(`public/textures/walls/${id}.jpg`);
  if (t) {
    prepWall(t);
    const n = await optional(`public/textures/walls/${id}-normal.jpg`);
    if (n) { n.colorSpace = THREE.NoColorSpace; n.wrapS = n.wrapT = THREE.MirroredRepeatWrapping; n.repeat.copy(t.repeat); n.anisotropy = 8; }
    t.userData.normal = n || null;
    if (id === "default") textures.wallNormal = n || null;
  }
  if (textures.walls) textures.walls[id] = t || null;
  return t || null;
}

/** Fade the wall over to a book's wallpaper (or back to the default). */
async function setWall(id) {
  const w = state.wall;
  if (!w) return;
  const want = id || "default";
  if (w.current === want || w.pending === want) return;
  w.pending = want;
  let t = await wallTexture(want);
  if (!t && want !== "default") { t = await wallTexture("default"); }
  if (w.pending !== want) return;   // something newer was asked for while loading
  if (!t) { w.pending = null; return; }
  w.overlay.material.map = t;
  w.overlay.material.normalMap = t.userData.normal || null;
  w.overlay.material.needsUpdate = true;
  w.overlay.material.opacity = 0;
  w.fade = 0.001;
  w.next = want;
}

function updateWall(dt) {
  const w = state.wall;
  if (!w || !w.fade) return;
  w.fade = Math.min(1, w.fade + dt * 1.4);
  w.overlay.material.opacity = w.fade;
  if (w.fade >= 1) {
    w.mesh.material.map = w.overlay.material.map;
    w.mesh.material.normalMap = w.overlay.material.normalMap;
    w.mesh.material.needsUpdate = true;
    w.overlay.material.opacity = 0;
    w.current = w.next;
    w.pending = null;
    w.fade = 0;
  }
}

/** Where a shelf book lands on the table: the pose of the closed Book, in shelf-group space. */
function landingPose() {
  return { position: new THREE.Vector3(0.01, 0.07, 0).sub(shelf.group.position), rotation: new THREE.Euler(-Math.PI / 2, 0, 0), scale: 1 };
}

/** Camera for the shelf: far enough back to see every book, from a little above. */
function shelfCamera() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const distance = THREE.MathUtils.clamp((1.9 / Math.tan(hfov / 2)) * 1.0, 3.4, 8);
  const target = new THREE.Vector3(0, 0.7, -2.62);
  const dir = new THREE.Vector3(0, 0.42, 1).normalize();
  return { target, pos: target.clone().add(dir.multiplyScalar(distance)) };
}

const framing = { cx: 0.5, cy: 0.5, distance: 3.2, fw: 1, fh: 1 };

/** Measure the space left beside (or above) the reading card and aim the camera into it. */
function updateFraming() {
  const { w, h } = viewport();
  const panel = document.getElementById("text-panel");
  let free = { x: 0, y: 0, w, h };
  if (state.opened && panel && !panel.hidden) {
    const r = panel.getBoundingClientRect();
    const portrait = w < h * 1.05;
    if (portrait) free = { x: 0, y: 0, w, h: Math.max(h * 0.4, r.top - 8) };
    else free = { x: r.right + 12, y: 0, w: Math.max(w * 0.4, w - r.right - 12), h };
  }
  const topPad = 60, bottomPad = free.h === h && free.w < w ? 150 : 24;
  const cx = (free.x + free.w / 2) / w;
  const cy = (free.y + topPad + (free.h - topPad - bottomPad) / 2) / h;
  framing.cx = cx;
  framing.cy = cy;
  framing.fw = free.w / w;
  framing.fh = (free.h - topPad - bottomPad) / h;
  camera.setViewOffset(w, h, Math.round(w * (0.5 - cx)), Math.round(h * (0.5 - cy)), w, h);
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const sceneW = 1.4, sceneH = 1.2;
  const dw = sceneW / (framing.fw * 2 * Math.tan(hfov / 2));
  const dh = sceneH / (framing.fh * 2 * Math.tan(vfov / 2));
  framing.distance = THREE.MathUtils.clamp(Math.max(dw, dh) * 1.04, 1.9, 5);
  applyCameraPreset(state.look);
}

function applyCameraPreset(look, immediate = false) {
  noteActivity();
  if (state.view === "shelf" || state.view === "loading") {
    // a tall (portrait) screen keeps the strip of titles low, so the shelf rises out from under it
    const { w, h } = viewport();
    const lift = state.view === "shelf" && w < h * 1.05 ? Math.round(h * 0.13) : 0;
    camera.setViewOffset(w, h, 0, lift, w, h);
    const c = shelfCamera();
    cameraRig.pos.copy(c.pos);
    cameraRig.target.copy(c.target);
  } else if (!state.opened) {
    camera.setViewOffset(viewport().w, viewport().h, 0, 0, viewport().w, viewport().h);
    cameraRig.pos.set(0.12, 2.15, 2.95);
    cameraRig.target.set(0.05, 0.1, -0.18);
  } else {
    // aim at the middle of the pop-up on the right page, from about 32 degrees above the front
    const target = new THREE.Vector3(book ? book.pageCenterX : 0.5, 0.42, -0.1);
    const dir = new THREE.Vector3(0.06, 0.63, 1).normalize();
    const distance = framing.distance * (look ? 0.62 : 1);
    cameraRig.target.copy(target);
    cameraRig.pos.copy(target).add(dir.multiplyScalar(distance));
  }
  if (immediate) {
    cameraRig.current.copy(cameraRig.pos);
    cameraRig.currentTarget.copy(cameraRig.target);
    camera.position.copy(cameraRig.pos);
    camera.lookAt(cameraRig.target);
  }
}

/** Dolly the camera in on a point in the scene for a moment (tapping an object). */
function focusOn(world, radius = 0.25, hold = 3200, { ease = 2.2, wide = 1 } = {}) {
  // approach from the viewer's side, from about 28 degrees above, so faces stay readable
  const flat = cameraRig.current.clone().sub(world);
  flat.y = 0;
  if (flat.lengthSq() < 1e-4) flat.set(0, 0, 1);
  flat.normalize();
  const distance = Math.max(0.85, radius * 5) * (framing.fw < 0.55 ? 1.15 : 1) * wide;
  const pos = world.clone().add(flat.multiplyScalar(distance * Math.cos(0.49))).add(new THREE.Vector3(0, distance * Math.sin(0.49), 0));
  state.focus = { pos, target: world.clone(), until: performance.now() + hold, ease };
}

/** While the narrator reads, drift the camera onto the picture of each spoken word and let the
    scene act the word out, like a cut in a story film. */
function storyFocus(token) {
  const entry = state.diorama && state.diorama.objects[token.link];
  if (!entry || state.drag || reading.focused) return;
  const now = performance.now();
  if (token.action && entry.actions && entry.actions[token.action]) entry.actions[token.action]();
  if (now - (state.lastStoryFocus || 0) < 1400) return;
  state.lastStoryFocus = now;
  const world = entry.anchor ? entry.anchor() : entry.object.getWorldPosition(new THREE.Vector3());
  focusOn(world, entry.radius || 0.25, 3000, { ease: 1.15, wide: 1.35 });
}

function clearFocus() {
  state.focus = null;
}

function updateCamera(dt) {
  const parallax = settings.reducedMotion ? 0 : 1;
  const px = pointer.ndc.x > -1.5 ? pointer.ndc.x : 0;
  const py = pointer.ndc.y > -1.5 ? pointer.ndc.y : 0;
  let desired, desiredTarget;
  if (state.focus && performance.now() < state.focus.until) {
    desired = state.focus.pos.clone();
    desiredTarget = state.focus.target;
  } else {
    state.focus = null;
    desired = cameraRig.pos.clone().add(new THREE.Vector3(px * 0.12 * parallax, py * 0.06 * parallax, 0));
    desiredTarget = cameraRig.target;
  }
  if (book && book.flip) desired.y += Math.sin(book.flipProgress * Math.PI) * 0.07;
  const k = Math.min(1, dt * (state.focus ? (state.focus.ease || 2.2) : 1.6));
  cameraRig.current.lerp(desired, k);
  cameraRig.currentTarget.lerp(desiredTarget, k);
  camera.position.copy(cameraRig.current);
  camera.lookAt(cameraRig.currentTarget);
}

function resize() {
  const { w, h } = viewport();
  camera.aspect = w / h;
  camera.fov = w < h * 1.05 ? 40 : 33;
  camera.updateProjectionMatrix();
  updateFraming();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(Math.ceil(w / 2), Math.ceil(h / 2));
  if (sparks) sparks.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
  if (sparkRenderer) { sparkRenderer.setPixelRatio(power.sparkDpr()); sparkRenderer.setSize(w, h, false); }
}

/* ---------- page flow ---------- */

function sceneContext() {
  return {
    textures,
    art: textures.art,
    sound,
    story,
    makeHero: () => (textures.heroGltf && !settings.feltOtto ? P.makeOttoModel(textures.heroGltf, textures.heroClips) : P.makeOtto()),
    get makeOtto() { return this.makeHero; },
    onMagic: (what) => {
      const messages = story.magic || {};
      ui.toast(`✨ ${messages[what] || t("magic")}`);
      if (state.tableLamp && what === "sleep") state.tableLamp.set(false);
    },
  };
}

/** Build a page's scene ahead of its pop-in. Its shaders compile and its pictures go up to the
    GPU (a texture a frame) while the page turns or the cover opens, so the pop-in has nothing
    left to do but move; before this, the first frames of every scene stalled on both. */
function prepareScene(index) {
  const isEnd = index >= story.pages.length;
  const sceneName = isEnd ? "end" : story.pages[index].scene;
  const diorama = buildScene(sceneBuilders, sceneName, sceneContext());
  const maps = new Set();
  diorama.group.traverse((o) => {
    for (const m of o.material ? [].concat(o.material) : [])
      for (const key of ["map", "alphaMap", "normalMap", "emissiveMap", "roughnessMap", "metalnessMap", "aoMap", "bumpMap"]) {
        const tex = m[key];
        if (tex && tex.isTexture && tex.image && tex.image.complete !== false) maps.add(tex);
      }
  });
  state.warm = [...maps];
  let compiled = Promise.resolve();
  try { compiled = renderer.compileAsync(diorama.group, camera, scene).catch(() => {}); } catch (error) { /* older WebGL: it compiles on first draw */ }
  return { index, book: BOOK_ID, diorama, compiled };
}

function popIn(diorama) {
  state.popTween = { diorama, from: 0, to: 1, t: 0, duration: 1.45 };
  diorama.setProgress(0);
}

function popOut(diorama) {
  return new Promise((resolve) => {
    state.popTween = { diorama, from: diorama.progress, to: 0, t: 0, duration: 0.55, resolve };
  });
}

function updatePop(dt) {
  const tw = state.popTween;
  if (!tw) return;
  tw.t += dt;
  const p = Math.min(1, tw.t / tw.duration);
  tw.diorama.setProgress(THREE.MathUtils.lerp(tw.from, tw.to, tw.to > tw.from ? p : 1 - Math.pow(1 - p, 2)));
  if (p >= 1) {
    state.popTween = null;
    if (tw.resolve) tw.resolve();
  }
}

async function goTo(index, { autoRead = true } = {}) {
  noteActivity();
  const total = story.pages.length + 1;
  index = Math.max(0, Math.min(total - 1, index));
  if (!book || index === state.page || book.busy || state.transitioning) return;
  state.transitioning = true;
  clearTimeout(state.autoTimer);
  clearFocus();
  reading.toggleFocus(false);
  narrator.stop();
  setReadingState("idle");
  ui.hideWordTip();
  setHover(null);
  const dir = index > state.page ? 1 : -1;
  const previous = state.diorama;
  const marks = DEBUG ? [["start", performance.now()]] : null;
  const mark = (name) => { if (marks) marks.push([name, performance.now()]); };
  if (state.page >= 0) reading.leave();
  if (previous) {
    await popOut(previous);
    book.rightAnchor.remove(previous.group);
    previous.dispose();
    state.diorama = null;
  }
  mark("popOut");
  let prep = state.prepared;
  state.prepared = null;
  if (prep && (prep.index !== index || prep.book !== BOOK_ID)) { prep.diorama.dispose(); prep = null; }
  if (!prep) prep = prepareScene(index);
  if (state.page >= 0) {
    sound.pageTurn();
    const leftNumber = index * 2 + 1;
    await book.turn(dir, { frontNumber: dir > 0 ? state.page * 2 + 2 : leftNumber, backNumber: dir > 0 ? leftNumber : state.page * 2 });
  }
  mark("turn");
  state.page = index;
  const isEndPage = index >= story.pages.length;
  const previousProgress = state.progress[BOOK_ID] || {};
  const wasFinished = !!previousProgress.finished;
  // a page is only read once its text was heard (or read) to the end: that earns its star (earnStar),
  // and the book is finished when every page has one. Turning pages on its own earns nothing.
  state.progress[BOOK_ID] = { ...previousProgress, page: index, max: Math.max(previousProgress.max ?? -1, index), read: previousProgress.read || [], finished: wasFinished, updated: Date.now() };
  saveProgress();
  updateBookmarks();
  if (isEndPage && !wasFinished) {
    const left = story.pages.length - (previousProgress.read || []).length;
    if (left > 0) setTimeout(() => { if (state.page === index) ui.toast(t("starsToGo", { n: left }), 3400); }, 1400);
  }
  // jumps (dots, restart) turn one sheet; keep the block thickness honest for the page we landed on
  if (book.turned !== index) { book.turned = index; book.layout(); }
  const isEnd = index >= story.pages.length;
  book.setPageNumbers(index * 2 + 1, isEnd ? null : index * 2 + 2);
  mark("bookkeeping");
  const diorama = prep.diorama;
  book.rightAnchor.add(diorama.group);
  state.diorama = diorama;
  mark("buildScene");
  // the page's shaders have been compiling since the turn began; whatever is still to come
  // finishes here, off the frame, rather than on the first visible frames of the pop-in
  await prep.compiled;
  state.warm = [];   // a picture that did not get its frame goes up on its first draw
  mark("compile");
  popIn(diorama);
  placePins(diorama, index);
  mark("pins");
  reading.show(index, { direction: dir });
  mark("reading.show");
  if (state.mode === "self") offerDone(index);
  ui.setPage(index, state.progress[BOOK_ID]);
  clearTimeout(state.hintTimer);
  if (state.mode !== "listen" || !autoRead) state.hintTimer = setTimeout(() => { if (state.page === index) ui.showHint(); }, 7000);
  updateFraming();
  setTimeout(updateFraming, 800);
  if (!isEnd) ui.setReading("idle");
  state.transitioning = false;
  mark("ui");
  if (marks) { const rows = marks.slice(1).map(([name, at], i) => `${name} ${(at - marks[i][1]).toFixed(1)}ms`); console.log(`[page ${index}] ${rows.join(" · ")} · total ${(marks[marks.length - 1][1] - marks[0][1]).toFixed(0)}ms`); window.__turnMarks = marks; }
  narrator.prepare(Math.min(index + 1, total - 1)).catch(() => {});
  if (isEnd && (!autoRead || state.mode !== "listen")) setTimeout(() => {if(state.page===index && state.opened)remindAfterFinish(BOOK_ID);},1600);
  if (autoRead && state.mode === "listen") setTimeout(() => { if (state.page === index && !ui.settingsOpen && !document.querySelector("dialog[open]")) startReading(); }, 900);
}

function setReadingState(s) {
  state.reading = s;
  if (state.page < story.pages.length) ui.setReading(s);
}

async function startReading() {
  noteActivity();
  if (state.page < 0 || document.querySelector("dialog[open]")) return;
  const index = state.page;
  setReadingState("playing");
  await narrator.play(index, {
    onWord: (i) => {
      reading.setActiveWord(i);
      const token = reading.wordsFor(index)[i];
      if (token && token.link && state.diorama) { pulseObject(token.link); storyFocus(token); }
    },
    onEnd: (complete = true) => {
      if (state.page !== index) return;
      if (state.focus && state.focus.ease === 1.15) state.focus.until = Math.min(state.focus.until, performance.now() + 900);
      reading.clearActive();
      ui.showHint();
      setReadingState("idle");
      if (complete) earnStar(index);
      const isLast = index >= story.pages.length;
      if(isLast)remindAfterFinish(BOOK_ID);
      if (settings.autoTurn && !isLast && state.mode === "listen") {
        state.autoTimer = setTimeout(() => { if (state.page === index && state.reading === "idle") goTo(index + 1); }, 2800);
      }
    },
  });
  if (state.page === index && !narrator.current) setReadingState("idle");
}

function toggleReading() {
  if (state.page >= story.pages.length) { restart(); return; }
  if (state.reading === "playing") { narrator.pause(); setReadingState("paused"); return; }
  if (state.reading === "paused") { narrator.resume(); setReadingState("playing"); return; }
  startReading();
}

async function restart() {
  clearTimeout(state.autoTimer);
  narrator.stop();
  await goTo(0);
}

/* ---------- stars: one per page read to the end ---------- */

function isRead(index) {
  const p = state.progress[BOOK_ID];
  return !!(p && Array.isArray(p.read) && p.read.includes(index));
}

/** Self-read mode: the "I read it" star button waits about as long as the page takes to read. */
function offerDone(index) {
  if (!story || index < 0 || index >= story.pages.length || isRead(index)) { reading.hideDone(); return; }
  reading.offerDone(index, Math.max(4000, reading.wordsFor(index).length * 320));
}

/** The page's text was read to its last word: its star is born on the card, flies into the row
    of stars above and lights up there; a few points go to the counter. The last star finishes
    the book. Skipping ahead with the arrows or the dots never comes through here. */
function earnStar(index) {
  if (!story || index < 0 || index >= story.pages.length || isRead(index)) return;
  const p = state.progress[BOOK_ID] || (state.progress[BOOK_ID] = { page: index, max: index, read: [], finished: false });
  p.read = [...(p.read || []), index].sort((a, b) => a - b);
  p.updated = Date.now();
  const all = p.read.length >= story.pages.length;
  if (all) p.finished = true;
  saveProgress();
  updateBookmarks();
  if(!readingSession.user)return;
  const from = reading.starOrigin();
  const reward = souvenirs ? souvenirs.pageStar(BOOK_ID, index, { quiet: true }) : null;
  spawnSparkle(from.x, from.y, 16, 2);
  sound.chime(7, 0.3);
  setTimeout(() => sound.chime(11, 0.25), 140);
  ui.flyStar(from.x, from.y, index, {
    points: reward ? reward.points : 0,
    // the star lands in the row above the scene, then jumps on to the counter, which counts it as it lands
    onArrive: (x, y) => { spawnSparkle(x, y, 22, 2.5); sound.sparkle(); if (all) ui.refreshDots(state.page, p); if (souvenirs) { if (reward) souvenirs.flyStar(x, y); else souvenirs.refreshChip(false); } },
  });
  if (all && souvenirs) {
    const finish = souvenirs.finish(BOOK_ID);
    if (finish) setTimeout(() => celebrate(t("finishedBook", { points: finish.points }), finish.badges), 1700);
  }
}

function pulseObject(name) {
  const d = state.diorama;
  if (!d) return;
  const entry = d.objects[name];
  if (!entry) return;
  // only the object answers: the spoken word already carries the highlight, and lighting every
  // word linked to the same object (tall, tall, tree) read as several words being spoken at once
  if (entry.onHover) { entry.onHover(true); setTimeout(() => entry.onHover && entry.onHover(false), 600); }
}

/** World yaw (radians) of a rig's shoulders for a clip at a set of times. */
function clipYaws(root, clip, times) {
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  let L = null, R = null;
  root.traverse((o) => { if (!o.isBone) return; if (o.name === "LeftShoulder") L = o; if (o.name === "RightShoulder") R = o; });
  const out = [];
  let at = 0;
  for (const t of times) {
    mixer.update(t - at); at = t;
    root.updateMatrixWorld(true);
    if (L && R) {
      const l = L.getWorldPosition(new THREE.Vector3()), r = R.getWorldPosition(new THREE.Vector3());
      out.push(Math.atan2(-(l.z - r.z), l.x - r.x));   // forward = the character's left axis x up
    } else out.push(null);
  }
  action.stop();
  mixer.uncacheClip(clip);
  mixer.uncacheRoot(root);
  return out;
}

/** Shoulder yaw of a rig in its bind pose (the a-pose faces +z), the reference every clip must face. */
function restYaw(root) {
  root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  root.updateMatrixWorld(true);
  let L = null, R = null;
  root.traverse((o) => { if (!o.isBone) return; if (o.name === "LeftShoulder") L = o; if (o.name === "RightShoulder") R = o; });
  if (!L || !R) return null;
  const l = L.getWorldPosition(new THREE.Vector3()), r = R.getWorldPosition(new THREE.Vector3());
  return Math.atan2(-(l.z - r.z), l.x - r.x);
}

/** Every clip must face the way the rig's bind pose faces: the idle baked into a Meshy model can
    be turned 25 degrees and swing 50 more while it looks around, and a retargeted library clip
    can carry its proxy's facing. Turn each clip's hip track by its mean error (about world up,
    in the hips' parent space); the idle also has its swing damped. */
function alignClipFacing(scratch, clips, { idle = null, damp = 0.35 } = {}) {
  const ref = restYaw(scratch);
  let hips = null;
  scratch.traverse((o) => { if (o.isBone && o.name === "Hips") hips = o; });
  if (ref == null || !hips || !hips.parent) return;
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  scratch.updateMatrixWorld(true);
  const parentQ = hips.parent.getWorldQuaternion(new THREE.Quaternion());
  const parentInv = parentQ.clone().invert();
  const q = new THREE.Quaternion(), fix = new THREE.Quaternion(), yawQ = new THREE.Quaternion();
  for (const clip of clips) {
    if (!clip) continue;
    const hipTrack = clip.tracks.find((t) => /Hips\.quaternion$/.test(t.name));
    if (!hipTrack) continue;
    const isIdle = clip === idle;
    const times = isIdle ? Array.from(hipTrack.times) : Array.from({ length: 8 }, (_, k) => (clip.duration * k) / 8);
    const yaws = clipYaws(scratch, clip, times);
    if (yaws.some((y) => y == null)) continue;
    let sx = 0, sy = 0;
    for (const y of yaws) { sx += Math.cos(y); sy += Math.sin(y); }
    const mean = Math.atan2(sy, sx);
    const offset = wrap(ref - mean);
    if (!isIdle && Math.abs(offset) < THREE.MathUtils.degToRad(4)) continue;
    for (let i = 0; i < hipTrack.times.length; i++) {
      // a retargeted clip keeps its own motion and just turns by the mean error; the idle's
      // swing around its mean is damped as well
      const swing = isIdle ? wrap(yaws[i] - mean) * (damp - 1) : 0;
      yawQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), offset + swing);
      fix.copy(parentInv).multiply(yawQ).multiply(parentQ);
      q.fromArray(hipTrack.values, i * 4).premultiply(fix);
      q.toArray(hipTrack.values, i * 4);
    }
    if (DEBUG) console.info(`clip ${clip.name}: facing turned ${Math.round(THREE.MathUtils.radToDeg(offset))} degrees${isIdle ? " (idle, swing damped)" : ""}`);
  }
  scratch.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
}

/** Per-bone rotation offsets between two rigs' bind poses (same joints, different bone axes), so a
    pose copied in world space from `source` lands on `target` as the same pose. */
function bindOffsets(target, source) {
  const offsets = {};
  const pos = new THREE.Vector3(), scl = new THREE.Vector3(), qb = new THREE.Quaternion(), qo = new THREE.Quaternion(), m = new THREE.Matrix4();
  target.skeleton.bones.forEach((bone, i) => {
    const j = source.skeleton.bones.findIndex((b) => b.name === bone.name);
    if (j < 0) return;
    m.copy(target.skeleton.boneInverses[i]).invert().decompose(pos, qb, scl);
    m.copy(source.skeleton.boneInverses[j]).invert().decompose(pos, qo, scl);
    offsets[bone.name] = new THREE.Matrix4().makeRotationFromQuaternion(qo.invert().multiply(qb));
  });
  return offsets;
}

/** Picture card for a word, if the book has one (plural/inflection fallbacks included). */
function cardFor(token) {
  const cards = textures.wordCards;
  if (!cards || !cards.size) return null;
  const w = (token.clean || "").toLowerCase();
  const tries = [w, vocabKey(token.text || ""), w.replace(/s$/, ""), w.replace(/ed$/, ""), w.replace(/ing$/, ""), token.link];
  for (const t of tries) if (t && cards.has(t)) return `${textures.wordCardFolder}/${t}.${textures.wordCardFormat}`;
  return null;
}

/* ---------- interaction ---------- */

function screenPosition(world) {
  const v = world.clone().project(camera);
  const { w, h } = viewport();
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
}

function updatePointerWorld() {
  if (!state.diorama) return;
  if (pointer.ndc.x < -1.5) { state.diorama.pointer.copy(camera.position); return; }
  const center = (book ? book.rightAnchor.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0));
  const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
  raycaster.setFromCamera(pointer.ndc, camera);
  const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  if (hit) { pointer.world.copy(hit); state.diorama.pointer.copy(hit); }
}

function pick() {
  const d = state.diorama;
  if (!d || pointer.ndc.x < -1.5) return null;
  raycaster.setFromCamera(pointer.ndc, camera);
  const hits = raycaster.intersectObjects(d.group.children, true);
  for (const hit of hits) {
    const owner = hit.object.userData.owner;
    // the back card ("sky") is scenery, not a thing to tap, unless a book made it draggable (the wind)
    if (owner && d.objects[owner] && (owner !== "sky" || d.objects[owner].onDrag)) return { entry: d.objects[owner], point: hit.point };
  }
  return null;
}

/** What a scene object is called in the reading language: the book's lang file names it by
    its label, then by its name (books/<id>/lang/<code>.json "labels", tools/scene_labels.py);
    the English label otherwise. */
function labelFor(entry) {
  const map = story && story.labels;
  if (!map) return entry.label;
  return map[entry.label] || map[entry.name] || entry.label;
}

function setHover(entry) {
  if (state.hover === entry) {
    if (entry) {
      const p = screenPosition(entry.anchor ? entry.anchor() : entry.object.getWorldPosition(new THREE.Vector3()));
      ui.showWordTip(p.x, p.y - 40, labelFor(entry));
    }
    return;
  }
  if (state.hover) {
    if (state.hover.onHover) state.hover.onHover(false);
    reading.highlightObject(state.hover.name, false);
  }
  state.hover = entry;
  if (entry) {
    if (entry.onHover) entry.onHover(true);
    reading.highlightObject(entry.name, true);
    const p = screenPosition(entry.anchor ? entry.anchor() : entry.object.getWorldPosition(new THREE.Vector3()));
    ui.showWordTip(p.x, p.y - 40, labelFor(entry));
    canvas.style.cursor = entry.onDrag ? "grab" : "pointer";
  } else {
    ui.hideWordTip();
    canvas.style.cursor = "default";
  }
}

function speakLabel(entry) {
  const index = state.page;
  const words = reading.wordsFor(index);
  const label = labelFor(entry);
  // the word must match the label ("tree"), not merely link to the object ("tall" also links to the tree)
  const clean = cleanWord(label);
  const bare = (s) => String(s).replace(/[\s"'«»“”「」()（）,.!?;:…、。！？]/g, "");
  const match = clean
    ? (words.find((w) => w.clean === clean) || words.find((w) => w.link === entry.name && w.clean === clean))
    : words.find((w) => bare(w.text).startsWith(bare(label)));  // Japanese and Chinese words carry their particles
  if (match) narrator.speakWord(index, match.index, match.text);
  else if (story.lang && story.lang !== "en") narrator.say(label);
  else narrator.speakText(label);
}

function onPointerMove(event) {
  const { w, h } = viewport();
  // measure travel from the last position (movementX is 0 for touch and synthetic events)
  if (pointer.down) pointer.moved += Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.ndc.set((event.clientX / w) * 2 - 1, -(event.clientY / h) * 2 + 1);
  pointer.overCanvas = event.target === canvas;
  // the reading panel, the buttons and the shelf strip are part of the room: the trail flies over
  // them; a modal (a folio, a dialog, the souvenir board, the quiz) is paper, and the trail and the
  // cursor's halo stay off it (the sparkles read as white blots on cream)
  const closest = (sel) => !!(event.target && event.target.closest && event.target.closest(sel));
  pointer.overModal = closest("dialog, #panel, .board, .quiz");
  pointer.overUI = !pointer.overModal && closest(".text-panel, .hud, .shelf-strip");
  if (state.shelfDrag && shelf) {
    const d = state.shelfDrag;
    const dx = (event.clientX - d.lastX) * shelfWorldPerPixel();
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT) / 1000;
    d.velocity = d.velocity * 0.6 + (dx / dt) * 0.4;
    d.lastX = event.clientX; d.lastT = now;
    shelf.dragBy(dx);
    if (Math.abs(pointer.moved) > 6) { shelf.setHover(null); ui.setShelfHover(null); }
    return;
  }
  if (!settings.reducedMotion && !state.drag && (event.target === canvas || pointer.overUI)) spawnSparkle(event.clientX, event.clientY, 2, 1);
  if (state.drag) {
    raycaster.setFromCamera(pointer.ndc, camera);
    const hit = raycaster.ray.intersectPlane(state.drag.plane, new THREE.Vector3());
    if (hit && state.drag.entry.onDrag) state.drag.entry.onDrag(hit);
    spawnSparkle(event.clientX, event.clientY, 2, 2);
    return;
  }
  if (event.target === canvas || event.target === document.body) {
    const hit = pick();
    setHover(hit ? hit.entry : null);
  }
}

function onPointerDown(event) {
  if (event.target !== canvas) return;
  pointer.down = true;
  onPointerMove(event);
  pointer.moved = 0;   // travel counts from the press, not from wherever the pointer last was
  if (state.view === "shelf" && shelf) {
    // a finger (or the mouse) can slide the whole shelf sideways
    state.shelfDrag = { lastX: event.clientX, lastT: performance.now(), velocity: 0 };
    canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (state.view !== "book") return;
  const hit = pick();
  if (reading.focused) reading.toggleFocus(false);
  if (hit && hit.entry.onDrag) {
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
    state.drag = { entry: hit.entry, plane };
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
  }
}

function onPointerUp(event) {
  const wasDrag = state.drag;
  pointer.down = false;
  if (state.shelfDrag && shelf) {
    const d = state.shelfDrag;
    state.shelfDrag = null;
    if (pointer.moved > 8) {
      const before = shelf.page;
      const page = shelf.settle(d.velocity);
      if (page !== before) { sound.whoosh(page > before); ui.setShelfPage(page, shelf.pages); }
      return;
    }
    shelf.settle(0);
  }
  if (wasDrag) {
    state.drag = null;
    if (wasDrag.entry.onDragEnd) wasDrag.entry.onDragEnd();
    canvas.style.cursor = "grab";
    if (pointer.moved > 6) return;
  }
  if (event.target !== canvas) return;
  if (pointer.moved > 8) return;
  ui.closeLanguageMenu();
  if (state.view === "shelf") {
    raycaster.setFromCamera(pointer.ndc, camera);
    const id = shelf.pick(raycaster);
    const toy = id ? null : shelf.pickToy(raycaster);
    if (id) selectBook(id); else if (toy) greetToy(toy, true); else tapDecor();
    return;
  }
  if (state.view !== "book") return;
  const hit = pick();
  if (hit) handleTap(hit);
  else if (!tapDecor()) clearFocus();
}

/** A tap on something in the scene: souvenir pins are collected, everything else reacts. */
function handleTap(hit) {
  if (hit.entry.pin) collectPin(hit.entry.pin, hit.entry);
  else tapObject(hit.entry, hit.point);
}

/* ---------- the souvenir pins ---------- */

/** Stand this page's uncollected pins in the scene: thick enamel badges (src/pin.js) that float
    over the page, turn to catch the light, glow, and trail magic dust. */
function placePins(d, pageIndex) {
  if (!souvenirs || !story.pins) return;
  scene.updateMatrixWorld(true);
  for (const pin of story.pins) {
    if (pin.page !== pageIndex || souvenirs.has(BOOK_ID, pin.id)) continue;
    const tex = textures.pins && textures.pins[pin.id];
    if (!tex || !tex.image) continue;
    const badge = makePinBadge(tex, { size: pin.size || 0.13, reducedMotion: settings.reducedMotion, light: state.pinLight });
    const group = new THREE.Group();
    group.add(badge.object);
    let pos = null;
    if (pin.at) pos = new THREE.Vector3().fromArray(pin.at);
    else if (pin.near && d.objects[pin.near]) {
      const e = d.objects[pin.near];
      const world = e.anchor ? e.anchor() : e.object.getWorldPosition(new THREE.Vector3());
      pos = d.group.worldToLocal(world.clone());
      pos.y = 0;
      pos.add(new THREE.Vector3().fromArray(pin.offset || [0.14, 0, 0.08]));
    }
    if (!pos) pos = new THREE.Vector3(0.4, 0, 0.42);
    // a pin lives among the pop-up layers (a card in front of it may cover a corner), but never
    // behind the back card: its spot stays a hand's width in front of the backdrop
    const sky = d.objects.sky;
    const backZ = sky && sky.root ? sky.root.position.z : -0.55;
    pos.x = THREE.MathUtils.clamp(pos.x, -0.47, 0.47);
    pos.z = THREE.MathUtils.clamp(pos.z, Math.max(-0.5, backZ + 0.12), 0.58);
    group.position.copy(pos);
    const name = `pin:${pin.id}`;
    d.add(group, { pop: "rise", delay: 0.7, name, label: t("clickToCollect"), radius: 0.1, anchor: () => badge.anchor() });
    const entry = d.objects[name];
    entry.pin = pin;
    // the cursor's twinkling stars gather around the badge (the sparkle shader, screen space)
    const up = new THREE.Vector3();
    d.updaters.push((dt, t) => {
      badge.update(dt, t);
      if (!entry.pin || settings.reducedMotion || Math.random() > dt * 16) return;
      const a = badge.anchor();
      const p = screenPosition(a);
      const q = screenPosition(up.copy(a).setY(a.y + badge.height * 0.5));
      const r = Math.hypot(p.x - q.x, p.y - q.y) * 1.15 + 8;
      const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
      spawnSparkle(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr, 1, 1);
    });
  }
}

/** Tapped: the pin pops, flies to the counter and is remembered. */
async function collectPin(pin, entry) {
  if(!await requestReadingFeature("pin-action"))return;
  if (!souvenirs || souvenirs.has(BOOK_ID, pin.id)) return;
  const world = entry.anchor ? entry.anchor().clone() : entry.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.04, 0));
  const p = screenPosition(world);
  entry.root.visible = false;
  entry.pin = null;
  spawnSparkle(p.x, p.y, 28, 3);
  sound.sparkle();
  setTimeout(() => sound.chime(7, 0.35), 90);
  setTimeout(() => sound.chime(9, 0.3), 220);
  if (sound.cheer) setTimeout(() => sound.cheer(0, 0.3), 380);
  souvenirs.flyPin(`${BOOK_BASE}/pins/${pin.id}.png`, p.x, p.y);
  const reward = souvenirs.collect(BOOK_ID, pin.id);
  ui.toast(t("foundPin", { name: pin.name || "souvenir pin", points: PIN_POINTS }), 2800);
  const found = (story.pins || []).filter((q) => souvenirs.has(BOOK_ID, q.id)).length;
  if (found === (story.pins || []).length) setTimeout(() => celebrate(t("allPins"), []), 2600);
  if (reward && reward.badges.length) setTimeout(() => celebrate(t("badgeEarned", { badges: reward.badges.map((b) => `${b.icon} ${b.name}`).join(", ") }), []), found === (story.pins || []).length ? 5200 : 3000);
}

function celebrate(message, badges = []) {
  ui.toast(message, 3200);
  sound.sparkle();
  if (sound.cheer) setTimeout(() => sound.cheer(0, 0.4), 120);
  if (badges.length) setTimeout(() => ui.toast(t("badgeEarned", { badges: badges.map((b) => `${b.icon} ${b.name}`).join(", ") }), 3200), 3400);
}

/* ---------- profiles: who is reading ---------- */

/** Saves from before the stars counted the furthest page turned; a finished book keeps every
    star, an unfinished one keeps its place and starts collecting. */
function migrateProgress() {
  for (const meta of library.books) {
    const p = state.progress[meta.id];
    if (p && !Array.isArray(p.read)) p.read = p.finished ? Array.from({ length: meta.pages || 0 }, (_, i) => i) : [];
  }
}

/** The heroes a child can pick as an avatar: every ready book's portrait. */
function avatarList() {
  return library.books.filter((b) => b.status === "ready").map((meta) => ({ id: meta.id, name: meta.title.split(" ")[0], url: `books/${meta.id}/${meta.portrait || `art/${meta.id.split("-")[0]}-reference.jpg`}` }));
}

function avatarUrlFor(profile) {
  const list = avatarList();
  return ((list.find((a) => a.id === (profile && profile.avatar)) || list[0] || {}).url) || "";
}

function refreshProfileButton() {
  if (profiles) ui.setProfile(profiles.active, avatarUrlFor(profiles.active));
  ui.setPro(!!readingSession.membership?.active);
}

/** One child's numbers for the profiles folio: read straight from their storage keys, so the
    other children's summaries are as current as the active one's. */
function summarize(id) {
  const keys = profiles.keys(id);
  const stored = (k) => { try { return JSON.parse(readingStore.getItem(k) || "{}") || {}; } catch (error) { return {}; } };
  const isActive = id === profiles.active.id;
  const progress = isActive ? state.progress : stored(keys.progress);
  const souv = isActive && souvenirs ? souvenirs.data : normalizeSouvenirs(stored(keys.souvenirs));
  const books = library.books.filter((b) => b.status === "ready");
  const out = { points: souv.points || 0, stars: 0, pagesTotal: 0, finished: 0, books: books.length, pins: 0, pinsTotal: 0, quizRight: 0, quizTotal: 0, badges: Object.keys(souv.badges || {}).length };
  for (const b of books) {
    const p = progress[b.id];
    const pages = b.pages || 0;
    out.pagesTotal += pages;
    if (p) out.stars += Array.isArray(p.read) ? Math.min(p.read.length, pages) : (p.finished ? pages : 0);
    if (p && p.finished) out.finished++;
    const found = (souv.pins && souv.pins[b.id]) || [];
    out.pinsTotal += (b.pins || []).length;
    out.pins += found.filter((pid) => (b.pins || []).some((q) => q.id === pid)).length;
    out.quizTotal += b.quizCount || 0;
    out.quizRight += Math.min((((souv.quiz || {})[b.id]) || {}).best || 0, b.quizCount || 0);
  }
  return out;
}

function openAccount(editing = null) {
  if (!profiles) return;
  ui.openAccount({ profiles: profiles.list, activeId: profiles.active.id, avatars: avatarList(), summaries: Object.fromEntries(profiles.list.map((p) => [p.id, summarize(p.id)])), max: MAX_PROFILES, editing });
}

function openTribute() {
  const dlg = document.getElementById("tribute-dialog");
  if (!dlg) return;
  for (const open of document.querySelectorAll("dialog[open]")) if (open !== dlg) open.close();
  if (ui?.settingsOpen) ui.closeSettings();
  dlg.showModal();
}

/** Another child takes the shelf: their progress, stars, pins and points come in; the
    bookmarks, the shelf cards, the counter and the star row follow. An open book stays open. */
function switchProfile(id, { announce = true } = {}) {
  if (!profiles.setActive(id) && profiles.active.id !== id) return;
  state.progress = loadProgress();
  migrateProgress();
  souvenirs.setKey(profiles.keys(profiles.active.id).souvenirs);
  souvenirs.setLibrary(library, state.progress);
  updateBookmarks();
  refreshShelfCards();
  if (state.opened && state.page >= 0) ui.refreshDots(state.page, state.progress[BOOK_ID]);
  refreshProfileButton();
  if (announce) ui.toast(t("nowReading", { name: profiles.active.name || t("unnamed") }), 2600);
}

function saveProfile({ id, name, birthday, avatar }) {
  if (id) profiles.update(id, { name, birthday, avatar });
  else if (!profiles.add({ name, birthday, avatar })) return;
  refreshProfileButton();
}

function deleteProfile(id) {
  const wasActive = profiles.active.id === id;
  if (!profiles.remove(id)) return;
  if (wasActive) switchProfile(profiles.active.id, { announce: true });
  else refreshProfileButton();
}

function refreshShelfCards() {
  if (state.view === "shelf" && shelf) ui.showShelf(library, state.progress, { page: shelf.page, pages: shelf.pages }, souvenirs ? (bid) => souvenirs.pinsOf(bid) : null, souvenirs ? (bid) => souvenirs.quizOf(bid) : null);
}

/** Bookmarks: the ribbon in the open book and the ones on the shelf follow the saved progress. */
function updateBookmarks() {
  if (book && book.bookmark && story) book.bookmark.setProgress(BOOK_ID, readPercent(state.progress[BOOK_ID], story.pages.length), (story.colors || {}).cloth);
  if (shelf) {
    const map = {};
    for (const meta of library.books) map[meta.id] = { percent: readPercent(state.progress[meta.id], meta.pages || 10), color: meta.spine };
    shelf.setProgress(map);
  }
  if (souvenirs) souvenirs.setProgress(state.progress);
}

/* ---------- reading in another language ---------- */

/** Fetch a JSON file that may not exist. */
async function optionalJson(url) {
  try { const r = await fetch(assetUrl(url)); return r.ok ? await r.json() : null; } catch (error) { return null; }
}

/** Dress the current story in one language: translated pages, end page, quiz lines and toasts
    from books/<id>/lang/<code>.json, narration from lang/<code>/voice and quiz clips from
    lang/<code>/quiz. English (or a language the book does not have yet) uses the originals. */
let languageApplyRequest=0;
async function applyLanguage(code, { announce = true } = {}) {
  if (!story || !story.base) return false;
  const currentStory=story,request=++languageApplyRequest;
  if(!isFreeBook(story.id))await readingSession.authorizeBook(story.id);
  else await loadPublicAssets({scope:'book',book:story.id,language:code||'en'});
  if(story!==currentStory||request!==languageApplyRequest)return false;
  const base = story.base;
  const t = code && code !== "en" ? await optionalJson(`${BOOK_BASE}/lang/${code}.json`) : null;
  if(story!==currentStory||request!==languageApplyRequest)return false;
  const have = !!(t && t.pages && t.pages.length === base.pages.length);
  story.lang = have ? code : "en";
  story.title = have && t.title ? t.title : base.title;
  story.pages = base.pages.map((p, i) => (have ? { ...p, heading: t.pages[i].heading || p.heading, text: t.pages[i].text || p.text, hint: t.pages[i].hint ?? p.hint } : { ...p }));
  story.end = have && t.end ? { ...base.end, ...t.end } : { ...base.end };
  story.magic = have && t.magic ? { ...base.magic, ...t.magic } : base.magic;
  // the card's blurb follows too once a language file carries one (`blurb`, `subtitle`)
  story.blurb = have && t.blurb ? t.blurb : base.blurb;
  // the names of the things in the scenes (the tag on the bed says "lit"), by label then by object name
  story.labels = have && t.labels ? t.labels : null;
  story.subtitle = have && t.subtitle ? t.subtitle : base.subtitle;
  // localised art, when the book folder has it (art/logo.<code>.png, art/cover.<code>.jpg; see tools/i18n_assets.py)
  const meta = library && library.books.find((b) => b.id === story.id);
  const art = (have && meta && meta.art && meta.art[code]) || {};
  story.logo = art.logo || base.logo;
  story.cover = art.cover || base.cover;
  if (base.vocab) story.vocab = Object.fromEntries(Object.entries(base.vocab).map(([k, v]) => [k, { ...v, ...((have && t.vocab && t.vocab[k]) || {}) }]));
  if (base.quiz) {
    const tq = have && t.quiz && t.quiz.questions;
    story.quiz = {
      ...base.quiz,
      folder: have ? `lang/${code}/quiz` : (base.quiz.folder || "quiz"),
      questions: base.quiz.questions.map((q, i) => {
        const tr = tq && tq[i];
        if (!tr) return q;
        return { ...q, q: tr.q || q.q, right: tr.right || q.right, wrong: tr.wrong || q.wrong, options: q.options.map((o, k) => ({ ...o, label: (tr.options && tr.options[k]) || o.label || o.word })) };
      }),
    };
  }
  story.narrator = story.narrator || {};
  story.narrator.bundled = { ...(story.narrator.bundled || {}), folder: have ? `lang/${code}/voice` : base.folder, timings: true };
  ui.setStory(story, BOOK_BASE);
  narrator.setStory(story, BOOK_BASE);
  if (quiz) quiz.setStory(story, BOOK_BASE, story.lang);
  if (reading) reading.setStory(story);
  if (state.opened && state.page >= 0) {
    narrator.stop();
    setReadingState("idle");
    reading.show(state.page, { direction: 1 });
    ui.setPage(state.page);
    narrator.prepare(state.page).catch(() => {});
  }
  if (announce && code !== "en" && !have) ui.toast(t("notInLanguage"));
  return have;
}

/* ---------- the words of another language ---------- */

/** The vocabulary entry behind a token of a language book, or null. */
function vocabFor(token) {
  if (!story || !story.vocab) return null;
  const key = vocabKey(token.text);
  const entry = story.vocab[key];
  return entry ? { key, ...entry } : null;
}

let vocabAudio = null;
/** Say a word the way a native speaker does (books/<id>/words/audio/<key>.mp3). */
function playVocab(key) {
  if (vocabAudio) { try { vocabAudio.pause(); } catch (error) { /* ignore */ } }
  const a = new Audio(assetUrl(`${BOOK_BASE}/words/audio/${key}.mp3`));
  a.volume = sound.muted ? 0 : 1;
  vocabAudio = a;
  a.play().catch(() => {});
  return a;
}

/** A toy on the shelf met by the hand (a wiggle, its sound, its name) or tapped (a hop and a spin,
    sparkles, the name spoken). The sound repeats only after a breath so a sweep of the hand is
    not a racket. */
/** A toy's name in the reader's language (the manifest's English label when there is none). */
function toyName(toy) { const key = `toy_${toy.name}`; const name = t(key); return name === key ? toy.label : name; }
/** ...and said aloud: the clip made for this language first, the live voice otherwise. */
function sayToy(toy) { narrator.say(toyName(toy), { clip: `public/audio/toys/${settings.language || "en"}/${toy.name}.mp3` }); }
/** A book's title in the reader's language (books/index.json carries the translations). */
function bookTitle(meta) { const code = settings.language || "en"; return (meta.titles && meta.titles[code]) || meta.title; }

function greetToy(toy, tapped) {
  const now = performance.now();
  const p = screenPosition(shelf.toyTop(toy));
  if (tapped) shelf.toyTap(toy); else shelf.toyNudge(toy);
  if (!tapped && now - toy.lastSound < 1800) return;
  toy.lastSound = now;
  const played = toy.sfx && sound.sample && sound.sample(toy.sfx, { volume: tapped ? 0.8 : 0.55, rate: 0.94 + Math.random() * 0.12 });
  if (!played) sound.chime(tapped ? 6 : 4, 0.3);
  spawnSparkle(p.x, p.y, tapped ? 24 : 6, 3);
  // its name is only spoken on a tap (the hand passing over just gets the sound and the tag)
  if (tapped) { sound.sparkle(); ui.hideWordTip(); state.toyTagMuted = now + 1450; ui.magic(p.x, p.y, `${toyName(toy)}!`); setTimeout(() => sayToy(toy), 120); }
}

/** The shelf's covers in the reader's language: a book with art/cover.<code>.jpg shows it, the
    others keep their English cover. */
async function refreshCovers() {
  if (!shelf || !library) return;
  const code = settings.language || "en";
  for (const meta of library.books) {
    const file = code !== "en" && meta.art && meta.art[code] && meta.art[code].cover;
    let tex = textures.coversBase && textures.coversBase[meta.id];
    if (file) {
      textures.coversLang = textures.coversLang || {};
      const key = `${meta.id}:${code}`;
      if (!textures.coversLang[key]) { const loaded = (await optional(`books/${meta.id}/${file.replace(/cover(\.[a-z]{2})?\.jpg$/, "cover-shelf$1.webp")}`)) || (await optional(`books/${meta.id}/${file}`)); if (loaded) { loaded.colorSpace = THREE.SRGBColorSpace; loaded.anisotropy = 8; textures.coversLang[key] = loaded; } }
      tex = textures.coversLang[key] || tex;
    }
    if (tex && textures.covers[meta.id] !== tex) { textures.covers[meta.id] = tex; if (shelf.setCover) shelf.setCover(meta.id, tex); }
  }
}

/** The loading screen's shader sky, and the painted moon when public/ui/moon.webp exists. It
    stops itself once the loading screen has gone. */
function startNightSky() {
  const canvas = document.getElementById("loading-night");
  const sky = canvas && canvas.parentElement;
  if (!canvas || !sky) return;
  const night = new NightSky(canvas);
  if (!night.gl) return;
  if (DEBUG) window.__night = night;
  sky.classList.add("shader");
  night.setImage("bg", assetUrl("public/ui/sky.jpg"));
  night.setImage("paper", assetUrl("public/textures/paper.jpg"));
  // the shooting stars: three.js on its own canvas over the sky, on the same clock as the loading screen
  let comets = null;
  const cometCanvas = document.getElementById("loading-comets");
  if (cometCanvas && !settings.reducedMotion) { try { comets = new Comets(cometCanvas); if (!comets.renderer) comets = null; } catch (error) { comets = null; } }
  if (DEBUG && comets) window.__comets = comets;
  const moonEl = sky.querySelector(".loading-moon");
  // the moon floats on the shader's clock (no CSS animation while the shader runs)
  let floating = true;
  const float = () => { if (!floating) return; const s = (performance.now() - night.start) / 1000; moonEl.style.transform = `translateY(${(-14 * (0.5 - 0.5 * Math.cos(s * 0.9))).toFixed(1)}px) rotate(${(Math.sin(s * 0.45) * 1.2).toFixed(2)}deg)`; requestAnimationFrame(float); };
  requestAnimationFrame(float);
  const art = document.getElementById("loading-moon-art");
  if (art) {
    art.addEventListener("load", () => moonEl.classList.add("painted"));
    art.src = assetUrl("public/ui/moon.webp");
  }
  const placeMoon = () => {
    const r = moonEl.getBoundingClientRect(), s = sky.getBoundingClientRect();
    if (!s.width || !s.height) return;
    night.setMoon((r.left + r.width / 2 - s.left) / s.width, 1 - (r.top + r.height / 2 - s.top) / s.height, (r.width / 2) / s.height);
  };
  placeMoon();
  window.addEventListener("resize", placeMoon);
  night.play();
  if (comets) comets.play();
  const loading = document.getElementById("loading");
  const watch = new MutationObserver(() => {
    const gone = loading.hidden || loading.classList.contains("book");
    if (gone) { night.stop(); if (comets) comets.stop(); floating = false; } else { placeMoon(); night.play(); if (comets) comets.play(); if (!floating) { floating = true; requestAnimationFrame(float); } }
  });
  watch.observe(loading, { attributes: true, attributeFilter: ["hidden", "class"] });
}

function tapDecor() {
  if (!state.decor || pointer.ndc.x < -1.5) return false;
  raycaster.setFromCamera(pointer.ndc, camera);
  const hits = raycaster.intersectObjects(state.decor.map((d) => d.group), true);
  const hit = hits.find((h) => h.object.userData.decor);
  if (!hit) return false;
  const api = hit.object.userData.decor;
  if (api.name === "lamp") { api.toggle(); sound.lampSwitch && sound.lampSwitch(api.state.on); }
  else if (api.name === "blocks") { api.wobble(); sound.pop && sound.pop(0.8); }
  else if (api.name === "train") { api.tap(); sound.whoosh && sound.whoosh(false); }
  else if (api.name === "ball") { api.tap(); sound.pop && sound.pop(1.1); }
  else if (api.tap) api.tap();
  const p = screenPosition(hit.point);
  spawnSparkle(p.x, p.y, 14, 3);
  return true;
}

function tapObject(entry, point) {
  if (entry.onTap) entry.onTap();
  const world = entry.anchor ? entry.anchor() : (point || entry.object.getWorldPosition(new THREE.Vector3()));
  const p = screenPosition(world);
  ui.magic(p.x, p.y, `${labelFor(entry)}!`);
  speakLabel(entry);
  reading.highlightObject(entry.name, true);
  setTimeout(() => { if (state.hover !== entry) reading.highlightObject(entry.name, false); }, 900);
  spawnSparkle(p.x, p.y, 18, 3);
  focusOn(world, entry.radius || 0.25);
}

function onKey(event) {
  if(document.querySelector("dialog[open]") || event.target.closest("input,textarea,select,button,a,[role=button]"))return;
  if (souvenirs && souvenirs.isOpen) { if (event.key === "Escape") souvenirs.close(); return; }
  if (ui.settingsOpen) { if (event.key === "Escape") ui.closeSettings(); return; }
  if (state.view === "shelf") {
    if (event.key === "ArrowRight") onAction("shelf-page", 1);
    else if (event.key === "ArrowLeft") onAction("shelf-page", -1);
    return;
  }
  if (!state.opened) { if (state.view === "book" && (event.key === "Enter" || event.key === " ")) openBook(); return; }
  switch (event.key) {
    case "ArrowRight": case "PageDown": goTo(state.page + 1); break;
    case "ArrowLeft": case "PageUp": goTo(state.page - 1); break;
    case " ": event.preventDefault(); toggleReading(); break;
    case "r": case "R": toggleReading(); break;
    case "m": case "M": toggleMute(); break;
    case "l": case "L": toggleLook(); break;
    case "Escape": clearFocus(); reading.toggleFocus(false); break;
    case "Home": goTo(0); break;
    default: break;
  }
}

/* ---------- sparkles (shader overlay) ---------- */

let sparks = null;
let sparkRenderer = null;      // its own transparent renderer, in the top layer
function spawnSparkle(x, y, n = 1, kind = 1) {
  if (settings.reducedMotion || !sparks) return;
  sparks.spawn(x, y, n, kind);
}
function drawSparkles() {
  if (!sparks) return;
  // the trail keeps its own clock: it draws on every animation frame, even the ones where the
  // paced loop leaves the scene alone, so it never runs in slow motion over a dialog
  const now = performance.now();
  const dt = Math.min(0.05, (now - (power.lastSparkle || now)) / 1000);
  power.lastSparkle = now;
  if (!sparks.alive) { if (!state.sparkClear && sparkRenderer) { sparkRenderer.clear(); state.sparkClear = true; } return; }
  state.sparkClear = false;
  const overCanvas = pointer.ndc.x > -1.5 && !settings.reducedMotion && !pointer.overModal && (pointer.overCanvas || pointer.overUI);
  sparks.setCursor(pointer.x, pointer.y, overCanvas);
  sparks.update(dt);
  if (sparkRenderer) sparkRenderer.clear();
  sparks.render();
}

/* ---------- actions ---------- */

function toggleMute() {
  settings.muted = !settings.muted;
  saveSettings(settings);
  sound.setMuted(settings.muted);
  narrator.setVolume(settings.muted ? 0 : 1);
  ui.setMuted(settings.muted);
}

function toggleLook() {
  state.look = !state.look;
  clearFocus();
  applyCameraPreset(state.look);
  ui.setLook(state.look);
  sound.click();
}

let languageRequest=0;
async function applySetting(key, value) {
  if (key === "language") {
    const request=++languageRequest;
    try {
      await Promise.all(['shared','shelf'].map(scope=>loadPublicAssets({scope,language:value})));
      if(request!==languageRequest)return;
      settings.language=value;saveSettings(settings);setLanguage(value);ui.refreshLanguage();refreshProfileButton();refreshCovers();
      if(story){const have=await applyLanguage(value);if(request===languageRequest&&have&&state.opened)startReading();}
    } catch(error){if(request===languageRequest)ui.toast(error.message);}
  }
  if (key === "music") sound.setMusicVolume(value);
  if (key === "sfx") sound.setSfxVolume(value);
  if (key === "textSize") reading.setTextSize(value);
  if (key === "voice" || key === "openaiVoice") { narrator.cache.clear(); if (state.page >= 0) narrator.prepare(state.page).catch(() => {}); }
  if (key === "reducedMotion" && sparks) sparks.clear();
}

/** Show the shelf: the library's books at the back of the table. */
/** The shelf's music: only once audio may play, and only if it is not already playing. */
function startShelfMusic() {
  if (!sound || audioContext.state !== "running" || state.musicFor === "shelf") return;
  state.musicFor = "shelf";
  sound.setMusicTrack(textures.siteMusic || null);
  sound.startMusic();
}

function showShelf() {
  state.view = "shelf";
  shelf.setCastShadow(true);
  state.selected = null;
  ui.setView("shelf");
  startShelfMusic();
  ui.showShelf(library, state.progress, { page: shelf.page, pages: shelf.pages }, souvenirs ? (id) => souvenirs.pinsOf(id) : null, souvenirs ? (id) => souvenirs.quizOf(id) : null);
  updateBookmarks();
  if (souvenirs) souvenirs.setLibrary(library, state.progress);
  applyCameraPreset(false);
}

/** Take a book off the shelf: it flies down to the table while its story loads. */
async function selectBook(id) {
  if (state.view !== "shelf") return;
  const meta = library.books.find((b) => b.id === id);
  if (!meta) return;
  if(!isFreeBook(id)) {
    // guests and readers whose membership is known not to cover the book see the folio at once;
    // only a signed-in reader whose membership is still being checked asks the server first;
    // a member's signed URLs come down while the book flies to the table (loadBook asks for them)
    if(!readingSession.user || (readingSession.membership && !canReadBook(id))){showProBook();return;}
    if(!readingSession.membership){
      try{await readingSession.authorizeBook(id);}catch(error){
        if(error.status===403)showProBook();else ui.toast(error.message);return;
      }
    }
  }
  if (meta.status !== "ready") { shelf.wobble(id); sound.pop(0.7); ui.toast(t("stillPainting", { title: meta.title })); return; }
  state.view = "picking";
  state.selected = id;
  shelf.setHover(null);
  ui.setShelfHover(null);
  ui.hideShelf();
  ui.setView("book");
  ui.showBookCard(meta);
  narrator.say(bookTitle(meta), { clip: `public/audio/titles/${settings.language || "en"}/${meta.id}.mp3` });
  sound.whoosh(true);
  applyCameraPreset(false);
  const pick = ++state.pick;
  let failure = null;
  const [, loaded] = await Promise.all([shelf.flyTo(id, landingPose(), 1.15), loadBook(id).catch((error) => { if (!error.cancelled) console.error(error); failure = error; return null; })]);
  if (pick !== state.pick) return;   // put back while it loaded: cancelPick has already shown the shelf
  if (!loaded) { shelf.flyHome(id, 0.9); showShelf(); if (failure && (failure.status === 403 || failure.status === 401)) showProBook(); else ui.toast(t("wouldNotOpen")); return; }
  shelf.setVisible(id, false);
  shelf.setCastShadow(false);
  book.group.visible = true;
  state.view = "book";
  ui.showOpen();
}

/** "Back to the shelf" while a book is still loading: the load stops at its next step, the
    shelf's copy flies back up to its place, and the shelf comes back. */
function cancelPick() {
  if (state.view !== "picking") return;
  state.pick++;
  const id = state.selected;
  narrator.stop();
  ui.hideBookCard();
  clearBookToys();
  document.title = "StoryComet";
  sound.whoosh(false);
  if (id) shelf.flyHome(id, 0.9);
  showShelf();
}

/** Put the book back: close it, fly it up to its place on the shelf, show the shelf again. */
async function closeBook() {
  if (state.view !== "book" || state.transitioning) return;
  state.transitioning = true;
  clearTimeout(state.autoTimer);
  clearTimeout(state.hintTimer);
  narrator.stop();
  if (quiz) quiz.hide();
  if (book && book.bookmark) book.bookmark.setEnabled(false);
  clearBookToys();
  setReadingState("idle");
  clearFocus();
  reading.toggleFocus(false);
  ui.hideWordTip();
  setHover(null);
  ui.hideBookCard();
  sound.stopMusic();
  state.musicFor = null;
  sound.stopAmbience();
  if (state.opened) {
    reading.leave();
    if (state.diorama) { await popOut(state.diorama); book.rightAnchor.remove(state.diorama.group); state.diorama.dispose(); state.diorama = null; }
    sound.pageTurn();
    await book.close();
    state.opened = false;
    state.page = -1;
    reading.hide();
    reading.panel.hidden = true;
    ui.setView("shelf");
  }
  const id = state.selected;
  if (state.prepared) { state.prepared.diorama.dispose(); state.prepared = null; }
  state.warm = [];
  book.group.visible = false;
  shelf.setCastShadow(true);
  state.view = "picking";
  applyCameraPreset(false);
  shelf.scrollTo(shelf.pageOf(id), true);   // the shelf shows the row this book came from
  shelf.setVisible(id, true);
  const pose = landingPose();
  const item = shelf.items.find((b) => b.id === id);
  if (item) { item.mesh.position.copy(pose.position); item.mesh.rotation.copy(pose.rotation); item.mesh.scale.setScalar(pose.scale); }
  sound.whoosh(false);
  await shelf.flyHome(id, 1.0);
  state.transitioning = false;
  showShelf();
}

async function openBook() {
  if (state.opened || state.view !== "book") return;
  state.opened = true;
  if (audioContext.state === "suspended") await audioContext.resume().catch(() => {});
  ui.hideLoading();
  ui.setOpened(true);
  sound.click();
  state.musicFor = "book";
  sound.startMusic();
  sound.startAmbience();
  sound.whoosh(true);
  updateFraming();
  await waitForReadingProgress();
  const saved=state.progress[BOOK_ID];
  const first = saved && !saved.finished ? Math.min(saved.page || 0,story.pages.length-1) : 0;
  state.prepared = prepareScene(first);   // compiles and warms while the cover opens
  await book.open();
  if (book.bookmark) book.bookmark.setEnabled(true);   // the ribbon comes out onto the table once the book is open
  await goTo(first);
}

async function onAction(name, payload) {
  if(["goto","account","profile-switch","profile-save","profile-delete","quiz","souvenirs"].includes(name)) {
    if(!await requestReadingFeature("game-action"))return;
  }
  switch (name) {
    case "open": openBook(); break;
    case "read": sound.click(); toggleReading(); break;
    case "prev": sound.click(); goTo(state.page - 1); break;
    case "next": sound.click(); goTo(state.page + 1); break;
    case "goto": sound.click(); goTo(payload); break;
    case "mode":
      state.mode = payload;
      ui.setMode(payload);
      reading.setMode(payload);
      sound.click();
      if (payload === "self") { narrator.stop(); reading.clearActive(); setReadingState("idle"); ui.toast(t("tapAnyWord")); offerDone(state.page); }
      else { reading.hideDone(); if (state.reading === "idle") startReading(); }
      break;
    case "sound": toggleMute(); break;
    case "look": toggleLook(); break;
    case "settings":
      sound.click();
      if (state.reading === "playing") { narrator.pause(); setReadingState("paused"); }
      ui.openSettings({ openai: narrator.server.openai, browserVoices: ("speechSynthesis" in window ? speechSynthesis.getVoices() : []).filter((v) => v.lang && v.lang.startsWith("en")), openaiVoices: narrator.server.voices });
      break;
    case "settings-closed": break;
    case "tribute":
      sound.click();
      if (state.reading === "playing") { narrator.pause(); setReadingState("paused"); }
      openTribute();
      break;
    case "account":
      sound.click();
      if (state.reading === "playing") { narrator.pause(); setReadingState("paused"); }
      openAccount();
      break;
    case "profile-switch": sound.click(); switchProfile(payload); openAccount(); break;
    case "profile-save": sound.click(); saveProfile(payload); openAccount(); break;
    case "profile-delete": sound.click(); deleteProfile(payload); openAccount(); break;
    case "language-menu": sound.click(); ui.toggleLanguageMenu(); break;
    case "setting": applySetting(payload.key, payload.value); break;
    case "restart": restart(); break;
    case "quiz": if (quiz && quiz.available) { narrator.stop(); setReadingState("idle"); clearFocus(); quiz.start(); } break;
    case "quiz-again": goTo(0); break;
    case "quiz-shelf": closeBook(); break;
    case "quiz-close": break;
    case "quiz-right": if (souvenirs && payload) souvenirs.flyCheck(payload.x, payload.y); break;
    case "quiz-result": {
      if (!souvenirs) break;
      const reward = souvenirs.quizResult(BOOK_ID, payload.right, payload.total);
      if (quiz) quiz.showPoints(reward.points);
      if (reward.badges.length) setTimeout(() => celebrate(t("badgeEarned", { badges: reward.badges.map((b) => `${b.icon} ${b.name}`).join(", ") }), []), 2200);
      break;
    }
    case "souvenirs": if (souvenirs) souvenirs.open(); break;
    case "board-opened": if (state.reading === "playing") { narrator.pause(); setReadingState("paused"); } break;
    case "board-closed": break;
    case "board-open-book":
      if (state.view === "shelf") selectBook(payload);
      else if (state.view === "book" && payload !== BOOK_ID) closeBook().then(() => selectBook(payload));
      break;
    case "phrasebook":
      sound.click();
      if (state.reading === "playing") { narrator.pause(); setReadingState("paused"); }
      ui.openPhrasebook(story, BOOK_BASE, souvenirs ? souvenirs.heard(BOOK_ID) : [], (key) => { playVocab(key); if (souvenirs) souvenirs.hear(BOOK_ID, key); });
      break;
    case "vocab-play": playVocab(payload); break;
    case "home": if (state.view === "book") closeBook(); break;
    case "back": if (state.view === "picking") cancelPick(); else closeBook(); break;
    case "select": selectBook(payload); break;
    case "shelf-hover": if (state.view === "shelf" && shelf) { shelf.setHover(payload); ui.setShelfHover(payload); setWall(payload || state.wallBook); } break;
    case "shelf-page": if (state.view === "shelf" && shelf) { const before = shelf.page; const page = shelf.scrollBy(payload); if (page !== before) { sound.whoosh(payload > 0); ui.setShelfPage(page, shelf.pages); } else sound.pop(0.7); } break;
    default: break;
  }
}

/* ---------- loop ---------- */

let last = performance.now();

/* ---------- power: fewer pixels and fewer frames when nothing needs them ----------
   A tablet or a phone (a coarse pointer) draws at up to 1.5x pixels instead of 2x, a 2048 shadow map
   and a sparkle layer at 1x; every device skips frames when nothing has moved for a while (30 a
   second), or when a dialog, the settings or the loading screen cover the scene (12 a second), and
   re-renders the shadow map only on busy frames or every other quiet one. */
const power = {
  touch: typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches,
  lastActivity: performance.now(),
  lastRender: 0,
  shadowTurn: 0,
};
power.dpr = () => Math.min(window.devicePixelRatio || 1, power.touch ? 1.5 : 2);
power.sparkDpr = () => Math.min(window.devicePixelRatio || 1, power.touch ? 1 : 1.5);
const noteActivity = () => { power.lastActivity = performance.now(); };
function frame(now, forcedDt) {
  const dt = forcedDt != null ? forcedDt : Math.min(0.05, (now - last) / 1000);
  last = now;
  state.time += dt;
  const t = state.time;
  if (book) book.update(dt);
  updatePop(dt);
  updatePointerWorld();
  if (state.pinLight) state.pinLight.intensity = 0;   // a visible pin badge lights it again below
  if (state.diorama) state.diorama.update(dt, t);
  if (state.decor) for (const d of state.decor) if (d.update) d.update(dt, t);
  narrator.update();
  updateCamera(dt);
  if (state.view === "shelf" && pointer.overCanvas) {
    raycaster.setFromCamera(pointer.ndc, camera);
    const id = shelf.pick(raycaster);
    if (id !== shelf.hovered) { shelf.setHover(id); ui.setShelfHover(id); canvas.style.cursor = id ? "pointer" : "default"; if (id) sound.chime(3, 0.12); setWall(id || state.wallBook); }
    // the toys on the plank: a name tag, their sound and a wiggle when the hand passes over them
    const toy = id ? null : shelf.pickToy(raycaster);
    if (toy !== state.toyHover) {
      state.toyHover = toy;
      shelf.setToyHover(toy);
      if (toy) { canvas.style.cursor = "pointer"; greetToy(toy, false); } else { ui.hideWordTip(); if (!id) canvas.style.cursor = "default"; }
    }
    // the name tag steps aside while the big word is up, and comes back when it has gone
    if (toy && performance.now() > (state.toyTagMuted || 0)) { const p = screenPosition(shelf.toyTop(toy)); ui.showWordTip(p.x, p.y + 6, toyName(toy)); }
  } else if (state.toyHover) { state.toyHover = null; shelf.setToyHover(null); ui.hideWordTip(); }
  if (shelf) shelf.update(dt, t);
  updateWall(dt);
  updateBookToys(dt);
  if (state.hover && !state.drag) setHover(state.hover);
  if (state.warm.length) { try { renderer.initTexture(state.warm.shift()); } catch (error) { state.warm = []; } }
  if (!window.__noRender) {
    composer.render();
    drawSparkles();
    if (DEBUG && window.__probe) window.__probe(canvas);
  }
}

function startLoop() {
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const moving = cameraRig && cameraRig.current && cameraRig.pos && cameraRig.current.distanceToSquared(cameraRig.pos) > 1e-6;
    const busy = now - power.lastActivity < 2500 || !!narrator.current || !!state.focus || moving || !!state.drag;
    const covered = state.view === "loading" || !!document.querySelector("dialog[open]") || !!ui.settingsOpen;
    const fps = covered ? 12 : busy ? 0 : 30;   // 0: every frame the display offers
    if (fps && now - power.lastRender < 1000 / fps - 2) { drawSparkles(); return; }   // the trail alone, at full rate
    power.lastRender = now;
    renderer.shadowMap.needsUpdate = busy || covered || (power.shadowTurn++ % 2 === 0);
    frame(now);
  };
  requestAnimationFrame(loop);
  // Hidden tabs never get animation frames and their timers are throttled, so a worker
  // ticks the loop instead; rendering continues only when debugging (screenshots).
  try {
    const source = "setInterval(() => postMessage(0), 33);";
    const worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
    let lastHidden = performance.now();
    worker.onmessage = () => {
      if (document.visibilityState !== "hidden") return;
      const now = performance.now();
      if (now - lastHidden < 30) return;
      lastHidden = now;
      const skip = !DEBUG && !window.__renderHidden;
      const previous = window.__noRender;
      if (skip) window.__noRender = true;
      frame(now, 1 / 30);
      window.__noRender = previous;
    };
  } catch (error) {
    console.warn("hidden-tab pacer unavailable", error);
  }
}

/** A locked book goes straight to the membership folio (the pricing page when the app has none). */
function showProBook() {
  readingEvents.dispatchEvent(new Event('pause-reading'));
  const pricing = document.getElementById('pricing-dialog');
  if (!pricing) { location.assign('/pricing'); return; }
  for (const open of document.querySelectorAll('dialog[open]')) if (open !== pricing) open.close();
  if (!pricing.open) pricing.showModal();
}
readingEvents.addEventListener('pause-reading',()=>{
  clearTimeout(state.autoTimer);clearTimeout(state.resumeTimer);
  if(narrator && story){narrator.stop();reading?.clearActive();setReadingState('idle');}
});
readingEvents.addEventListener('sync-error',()=>ui?.toast('Your reading progress could not sync. Please check your connection.',4000));
readingEvents.addEventListener('membership-changed',()=>{
  shelf?.setLocked(id=>!canReadBook(id));
  ui?.setPro(!!readingSession.membership?.active);
  if(ui?.accountOptions)ui.openAccount(ui.accountOptions);
});
readingEvents.addEventListener('reading-account-changed',()=>{
  if(!isFreeBook(BOOK_ID) && state.view==='book')void closeBook();
});
// Long reading sessions refresh their short-lived media URLs without preloading media.
setInterval(()=>{
  if(state.view==='book' && !isFreeBook(BOOK_ID) && readingSession.authorizeBook)
    void readingSession.authorizeBook(BOOK_ID).catch(error=>{if(error.status===401 || error.status===403){void closeBook();ui.toast(error.message);}});
},60000);
readingEvents.addEventListener('profile-state-ready',()=>{
  if(!profiles || !souvenirs)return;
  profiles=new Profiles();state.progress=loadProgress();migrateProgress();
  souvenirs.close();souvenirs.setKey(profiles.keys(profiles.active.id).souvenirs);
  souvenirs.setLibrary(library,state.progress);ui.closeSettings();
  refreshProfileButton();updateBookmarks();refreshShelfCards();
  if(state.opened && state.page>=0)ui.refreshDots(state.page,state.progress[BOOK_ID]);
});
readingEvents.addEventListener('feature',event=>{
  if(!ui || !souvenirs)return;
  readingEvents.dispatchEvent(new Event('pause-reading'));
  if(event.detail==='kids')openAccount();else souvenirs.open();
});

/* ---------- boot ---------- */

async function boot() {
  await Promise.all(['shared','shelf'].map(scope=>loadPublicAssets({scope,language:settings.language||'en'})));
  try { library = await (await fetch("books/index.json")).json(); } catch (error) { library = { books: [] }; }
  const ready = library.books.filter((b) => b.status === "ready");
  if (!BOOK_ID) BOOK_ID = ready.length ? ready[0].id : "otto-shy-moon";
  ui = new UI({ story: null, settings, onAction });
  quiz = new Quiz({ root: document.getElementById("quiz"), sound, onAction });
  ui.setView("loading");
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  sound = new SoundKit(audioContext);
  sound.setMusicVolume(settings.music);
  sound.setSfxVolume(settings.sfx);
  sound.setMuted(settings.muted);
  ui.setMuted(settings.muted);
  narrator = new Narrator({ context: audioContext, story: null, bookBase: "", settings, onStatus: (m) => ui.toast(m) });
  narrator.setVolume(settings.muted ? 0 : 1);
  setLanguage(settings.language || "en");
  startNightSky();
  // the site's own music (public/audio/music.m4a when there is one, the music-box lullaby
  // otherwise) plays on the shelf and hands over to each book's track; browsers only let audio
  // start after a touch, so the shelf waits for the first one
  sound.decode("public/audio/music.m4a").then((buffer) => { textures.siteMusic = buffer || null; if (state.view === "shelf") startShelfMusic(); });
  const firstTouch = () => { window.removeEventListener("pointerdown", firstTouch); window.removeEventListener("keydown", firstTouch); audioContext.resume().then(() => { if (state.view === "shelf") startShelfMusic(); }).catch(() => {}); };
  window.addEventListener("pointerdown", firstTouch);
  window.addEventListener("keydown", firstTouch);
  ui.setLoading(0.05, t("loadToybox"));
  // the byte counter under the loading line: what has arrived of what the boot has asked for
  state.bytesTimer = setInterval(() => ui.setLoadingBytes(downloadProgress()), 250);
  await loadShared();
  setupRenderer();
  reading = new Reading({
    story: null,
    panel: document.getElementById("text-panel"),
    settings,
    handlers: {
      onWordTap: (page, wordIndex, token, span) => {
        span.classList.add("active");
        setTimeout(() => span.classList.remove("active"), 600);
        const vocab = vocabFor(token);
        if (vocab) {
          playVocab(vocab.key);
          ui.vocabCard(vocab, cardFor(token) || (textures.wordCards && textures.wordCards.has(vocab.key) ? `${textures.wordCardFolder}/${vocab.key}.${textures.wordCardFormat}` : null), story.language);
          if (souvenirs) souvenirs.hear(BOOK_ID, vocab.key);
        } else {
          narrator.speakWord(page, wordIndex, token.text);
          ui.wordZoom(token.text, cardFor(token));
        }
        sound.chime(wordIndex % 5, 0.25);
        const r = span.getBoundingClientRect();
        for (let i = 0; i < 4; i++) spawnSparkle(r.left + Math.random() * r.width, r.top + Math.random() * r.height, 3, 3);
        if (token.link) {
          pulseObject(token.link);
          const entry = state.diorama && state.diorama.objects[token.link];
          if (entry) {
            const act = token.action && entry.actions && entry.actions[token.action];
            if (act) act(); else if (entry.onTap) entry.onTap();
            focusOn(entry.anchor ? entry.anchor() : entry.object.getWorldPosition(new THREE.Vector3()), entry.radius || 0.25, 2200);
          }
        }
        if (state.reading === "playing") {
          narrator.pause();
          setReadingState("paused");
          clearTimeout(state.resumeTimer);
          state.resumeTimer = setTimeout(() => { if (state.reading === "paused" && state.page === page) { narrator.resume(); setReadingState("playing"); } }, 1700);
        }
      },
      onLinkHover: (name, on) => {
        const entry = state.diorama && state.diorama.objects[name];
        if (entry && entry.onHover) entry.onHover(on);
        if (entry && on) {
          const p = screenPosition(entry.anchor ? entry.anchor() : entry.object.getWorldPosition(new THREE.Vector3()));
          ui.showWordTip(p.x, p.y - 40, labelFor(entry));
        } else if (!on) ui.hideWordTip();
      },
      onPanelTap: (focused) => { sound.click(); if (focused) clearFocus(); },
      onDone: async (page) => { if(!await requestReadingFeature("game-action"))return; sound.click(); if (page === state.page) earnStar(page); },
    },
  });
  reading.setMode(state.mode);
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove);
  // the folios (src/pricing.js) ask for a burst of stars around a button: { x, y, n, kind }
  window.addEventListener("storycomet:sparkle", (event) => { const d = event.detail || {}; spawnSparkle(d.x, d.y, d.n || 6, d.kind || 1); });
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointerdown", onPointerDown);
  for (const type of ["pointermove", "pointerdown", "pointerup", "touchstart", "touchmove", "wheel", "keydown"]) window.addEventListener(type, noteActivity, { passive: true, capture: true });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKey);
  const tributeDlg = document.getElementById("tribute-dialog");
  if (tributeDlg) {
    tributeDlg.addEventListener("click", (e) => {
      if (e.target === tributeDlg) {
        const rect = tributeDlg.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
          tributeDlg.close();
        }
      }
    });
  }
  if ("speechSynthesis" in window) speechSynthesis.getVoices();
  await waitForReadingProgress();
  profiles = new Profiles();
  state.progress = loadProgress();
  migrateProgress();
  souvenirs = new Souvenirs({ mount: document.getElementById("interface"), board: document.getElementById("souvenirs"), sound, onAction, key: profiles.keys(profiles.active.id).souvenirs });
  souvenirs.setLibrary(library, state.progress);
  refreshProfileButton();
  updateBookmarks();
  startLoop();
  ui.hideLoading();
  window.__storylight = {
    get library() { return library; },
    get bookId() { return BOOK_ID; },
    loadBook,
    selectBook,
    closeBook,
    showShelf,
    get shelf() { return shelf; },
    get view() { return state.view; },
    state, goTo, openBook, startReading, toggleReading, sound, scene, camera, renderer, settings, focusOn, clearFocus, textures,
    get book() { return book; }, get story() { return story; }, get narrator() { return narrator; }, get reading() { return reading; },
    step: (ms = 33, n = 1) => { for (let i = 0; i < n; i++) frame(performance.now(), ms / 1000); },
    render: () => { composer.render(); },
    snap: (q = 0.7) => { composer.render(); return canvas.toDataURL("image/jpeg", q); },
    setCamera: (pos, target) => { cameraRig.pos.fromArray(pos); cameraRig.target.fromArray(target); cameraRig.current.copy(cameraRig.pos); cameraRig.currentTarget.copy(cameraRig.target); },
    framing, updateFraming,
    get sparks() { return sparks; },
    drag: (x0, y0, x1, y1, steps = 12) => {
      const ev = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      ev("pointermove", x0, y0); ev("pointerdown", x0, y0);
      for (let i = 1; i <= steps; i++) ev("pointermove", x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
      return state.drag ? state.drag.entry.name : null;
    },
    release: (x, y) => { canvas.dispatchEvent(new PointerEvent("pointerup", { clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: "mouse", isPrimary: true })); },
    pointerAt: (x, y) => { onPointerMove({ clientX: x, clientY: y, target: canvas, movementX: 0, movementY: 0 }); },
    tap: (x, y) => { onPointerMove({ clientX: x, clientY: y, target: canvas, movementX: 0, movementY: 0 }); const hit = pick(); if (hit) handleTap(hit); return hit ? hit.entry.name : null; },
    get souvenirs() { return souvenirs; },
    collectPin: (id) => { const entry = state.diorama && state.diorama.objects[`pin:${id}`]; if (entry && entry.pin) collectPin(entry.pin, entry); return !!entry; },
    playVocab,
  };
  if ((document.body.dataset.book || params.get("book")) && library.books.some(b=>b.id===BOOK_ID && b.status==="ready") && canReadBook(BOOK_ID)) {
    // deep link: straight to that book on the table. The shelf's copy of the book drops onto the
    // table right away and lies there while the story loads, so the table is never empty; the
    // real book takes its place once everything is ready (as after a click on the shelf)
    const meta = library.books.find((b) => b.id === BOOK_ID);
    state.view = "picking";
    state.selected = BOOK_ID;
    ui.setView("book");
    ui.showBookCard(meta || { title: BOOK_ID });
    applyCameraPreset(false);
    shelf.scrollTo(shelf.pageOf(BOOK_ID), true);
    const pose = landingPose();
    const item = shelf.items.find((b) => b.id === BOOK_ID);
    if (item) { item.mesh.position.copy(pose.position).setY(pose.position.y + 0.6); item.mesh.rotation.copy(pose.rotation); item.mesh.scale.setScalar(pose.scale); }
    const pick = ++state.pick;
    let failure = null;
    const [, loaded] = await Promise.all([shelf.flyTo(BOOK_ID, pose, 0.7), loadBook(BOOK_ID).then(() => true, (error) => { if (!error.cancelled) console.error(error); failure = error; return false; })]);
    if (pick !== state.pick) { /* put back while it loaded: cancelPick has shown the shelf */ }
    else if (!loaded) { shelf.flyHome(BOOK_ID, 0.9); showShelf(); if (failure && (failure.status === 403 || failure.status === 401)) showProBook(); else ui.toast(t("wouldNotOpen")); }
    else {
      shelf.setVisible(BOOK_ID, false);
      shelf.setCastShadow(false);
      book.group.visible = true;
      state.view = "book";
      ui.showOpen();
    }
  } else {
    showShelf();
    if((document.body.dataset.book || params.get("book")) && !isFreeBook(BOOK_ID))showProBook();
  }
  if (DEBUG) console.info("storylight debug hooks on window.__storylight");
}

boot().catch((error) => {
  console.error(error);
  const copy = document.getElementById("loading-copy");
  if (copy) copy.textContent = `Something went wrong while opening the book: ${error.message}`;
});

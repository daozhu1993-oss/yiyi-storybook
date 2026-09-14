/* The bookshelf on the wall behind the table: two long open planks on painted brackets, the
   library's books standing on the lower one (covers to the front) and a row of figurines on
   the upper one. Only three books are in view at a time; the whole shelf slides sideways to
   show the next three. Hovering lifts and lights a book; picking one flies it down to the
   table, where the real Book (book.js) takes over. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as P from "./props.js";
import { makeBookmark } from "./bookmark.js";

const BOOK_MARK_H = 1.3 * 0.78;   // the ribbon's length (BOOK_H * 0.78)
const MARK_REST = 0.2;            // share of the ribbon showing above the pages at rest (the label)
const MARK_LIFT = 0.08;           // a small extra lift when the book is hovered (never up to the plank above)
const MARK_SLIDE = 1.03 * 0.39;   // ... and how far it slides sideways: from 0.24 W to just past the fore-edge
                                  // (0.5 W + the ribbon's half width 0.08 W + 0.05 W so the tilted tassel clears the cover)

// the closed Book on the table (book.js): a board, the page block, a board
export const BOOK_W = 1.03, BOOK_H = 1.3, BOOK_D = 0.14;
export const SHELF_SCALE = 0.62;
export const PER_PAGE = 3;
const SPACING = 1.02;

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

/** A painted-looking stand-in cover for a book that has no art yet. */
export function placeholderCover(title, color = "#2a2f6e", note = "coming soon") {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 640;
  const g = c.getContext("2d");
  g.fillStyle = color; g.fillRect(0, 0, 512, 640);
  const vignette = g.createRadialGradient(256, 280, 60, 256, 320, 460);
  vignette.addColorStop(0, "rgba(255,255,255,0.12)"); vignette.addColorStop(1, "rgba(0,0,0,0.28)");
  g.fillStyle = vignette; g.fillRect(0, 0, 512, 640);
  g.strokeStyle = "rgba(255,240,200,0.45)"; g.lineWidth = 4; roundRect(g, 26, 26, 460, 588, 22); g.stroke();
  g.fillStyle = "#f6ecd2"; roundRect(g, 66, 200, 380, 250, 20); g.fill();
  g.fillStyle = "#2b2a3f"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "800 44px 'Baloo 2', 'Nunito', sans-serif";
  const words = title.split(" "), lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > 320 && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  const top = 325 - ((lines.length - 1) * 50) / 2;
  lines.forEach((l, i) => g.fillText(l, 256, top + i * 50));
  g.font = "700 22px 'Baloo 2', 'Nunito', sans-serif"; g.fillStyle = "#8a7550";
  g.fillText(note, 256, 520);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Scale a toy so it stands `height` tall, feet on y = 0, and return its group. */
function stand(api, height) {
  const object = api.group || api;
  object.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 1e-6) object.scale.multiplyScalar(height / size.y);
  object.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(object);
  object.position.y -= box.min.y;
  return object;
}

export function makeShelf({ books, textures }) {
  // whether the shelf's books, toys and charms cast shadows: they do on the shelf, and not while a
  // book is being read (the camera is on the table and the shelf is out of frame, but every one of
  // its meshes would still be drawn into the shadow map each frame)
  let casting = true;
  const group = new THREE.Group();     // fixed in the room: lights
  const slider = new THREE.Group();    // slides sideways: planks, brackets, figurines
  group.add(slider);

  /* ---------- wood ---------- */
  const planks = textures.woodPlanks || textures.wood;
  const woodTex = planks ? planks.clone() : null;
  if (woodTex) { woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(3.2, 1); woodTex.needsUpdate = true; }
  let normalTex = null;
  if (textures.woodPlanksNormal && textures.woodPlanks) { normalTex = textures.woodPlanksNormal.clone(); normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping; normalTex.repeat.copy(woodTex.repeat); normalTex.needsUpdate = true; }
  const wood = new THREE.MeshStandardMaterial({ map: woodTex, normalMap: normalTex, normalScale: new THREE.Vector2(0.55, 0.55), color: textures.woodPlanks ? 0xf0cfa0 : 0xc9a074, roughness: 0.52, metalness: 0.02, envMapIntensity: 0.55 });
  const endTex = woodTex ? woodTex.clone() : null;
  if (endTex) { endTex.repeat.set(0.3, 1); endTex.needsUpdate = true; }
  // the trims are the same wood, a shade darker (no painted colours on the shelf)
  const trimTex = woodTex ? woodTex.clone() : null;
  if (trimTex) { trimTex.repeat.set(3.2, 0.12); trimTex.needsUpdate = true; }
  const woodDark = new THREE.MeshStandardMaterial({ map: trimTex, color: textures.woodPlanks ? 0xb98a5a : 0x9a7048, roughness: 0.58, metalness: 0.02 });

  /* ---------- layout ---------- */
  const n = books.length;
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  const slotX = (i) => (i - (PER_PAGE - 1) / 2) * SPACING;     // page 0 is centred on x = 0
  const left = slotX(0) - 0.8, right = slotX(Math.max(n, PER_PAGE) - 1) + 0.8;
  const length = right - left, centerX = (left + right) / 2;
  const depth = 0.42, lowerY = 0.03, upperY = 1.22, upperDepth = 0.3;
  const add = (geometry, material, x, y, z, parent = slider) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = casting; m.receiveShadow = true; m.userData.caster = true;
    parent.add(m);
    return m;
  };
  // the plank the books stand on, with a darker wooden lip along the front edge
  add(new THREE.BoxGeometry(length, 0.06, depth), wood, centerX, lowerY, 0);
  add(new THREE.BoxGeometry(length, 0.036, 0.03), woodDark, centerX, lowerY + 0.012, depth / 2 - 0.004);
  // the upper plank for the figurines
  add(new THREE.BoxGeometry(length, 0.05, upperDepth), wood, centerX, upperY, -(depth - upperDepth) / 2);
  add(new THREE.BoxGeometry(length, 0.03, 0.03), woodDark, centerX, upperY + 0.01, -(depth - upperDepth) / 2 + upperDepth / 2 - 0.004);
  // little wooden brackets under both planks
  for (let x = left + 0.5; x < right - 0.2; x += SPACING * 1.5) {
    for (const [y, d, back] of [[lowerY - 0.03, depth, 0], [upperY - 0.025, upperDepth, -(depth - upperDepth) / 2]]) {
      add(new THREE.BoxGeometry(0.05, 0.24, 0.05), wood, x, y - 0.12, back - d / 2 + 0.03);
      const diag = add(new THREE.BoxGeometry(0.05, 0.05, d * 0.72), wood, x, y - 0.1, back - d / 2 + 0.03 + d * 0.3);
      diag.rotation.x = -0.72;
    }
  }
  // a soft warm fill so the covers read
  const fill = new THREE.PointLight(0xffe6c4, 1.3, 3.8, 1.8);
  fill.position.set(0, 1.0, 0.8);
  group.add(fill);

  /* ---------- the books ---------- */
  const edgeMat = new THREE.MeshStandardMaterial({ map: textures.edges || null, color: 0xf3e8cf, roughness: 0.92, metalness: 0 });
  const items = [];
  books.forEach((meta, i) => {
    const spine = new THREE.Color(meta.spine || "#2a2f6e");
    const cover = textures.covers && textures.covers[meta.id] ? textures.covers[meta.id] : placeholderCover(meta.title, meta.spine, meta.status === "ready" ? "a storylight book" : "coming soon");
    const clothMat = new THREE.MeshStandardMaterial({ map: textures.cloth || null, color: spine, roughness: 0.7, metalness: 0 });
    const coverMat = new THREE.MeshPhysicalMaterial({ map: cover, color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.5 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(BOOK_W, BOOK_H, BOOK_D), [edgeMat, clothMat, edgeMat, edgeMat, coverMat, clothMat]);
    mesh.castShadow = casting; mesh.receiveShadow = true; mesh.userData.caster = true;
    mesh.userData.shelfBook = meta.id;
    const lean = -0.1;
    const home = {
      position: new THREE.Vector3(slotX(i), lowerY + 0.03 + (BOOK_H * SHELF_SCALE) / 2 * Math.cos(lean) + 0.005, 0.02),
      rotation: new THREE.Euler(lean, 0, 0),
      scale: SHELF_SCALE,
    };
    const glow = P.glowPlane(0xffe2a8, 1.35, 0);
    glow.position.set(home.position.x, home.position.y, home.position.z - 0.1);
    group.add(glow);
    mesh.position.copy(home.position);
    mesh.rotation.copy(home.rotation);
    mesh.scale.setScalar(home.scale);
    group.add(mesh);
    items.push({ id: meta.id, meta, mesh, home, glow, hover: 0, hoverTarget: 0, flight: null, wobble: 0, page: Math.floor(i / PER_PAGE) });
  });

  /* ---------- the lock on a Pro book ---------- */
  // a small padlock floats in front of the top-right corner of every book the reader cannot open
  // yet: the painted one from public/models/lock.glb when it exists, a gold one built here until
  // then. It is a child of the book, so it stays with it; textures.locked(id) says who is locked.
  const locked = typeof textures.locked === "function" ? textures.locked : () => false;
  // the built padlock: a rounded gold body with a cream enamel face and a keyhole, a tubular steel
  // shackle, a glossy clearcoat that catches the room, and a soft halo behind it
  // the shelf's light is soft, so the metals carry a little glow of their own to read as gold and steel
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xe3a93c, emissive: 0x7a4a08, emissiveIntensity: 0.32, metalness: 0.92, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 2.2 });
  const steelMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe3ec, emissive: 0x3c4250, emissiveIntensity: 0.25, metalness: 1, roughness: 0.14, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 2.4 });
  const enamelMat = new THREE.MeshPhysicalMaterial({ color: 0xfff1c9, emissive: 0x3a2a10, emissiveIntensity: 0.12, metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  const inkMat = new THREE.MeshStandardMaterial({ color: 0x1f1a33, metalness: 0.1, roughness: 0.7 });
  class ShacklePath extends THREE.Curve {
    constructor(r, leg) { super(); this.r = r; this.leg = leg; }
    getPoint(t, target = new THREE.Vector3()) {
      // up the left leg, over the arch, down the right leg
      const { r, leg } = this;
      const legT = leg / (2 * leg + Math.PI * r);
      if (t < legT) return target.set(-r, t / legT * leg, 0);
      if (t > 1 - legT) return target.set(r, leg - (t - (1 - legT)) / legT * leg, 0);
      const a = Math.PI * (1 - (t - legT) / (1 - 2 * legT));
      return target.set(Math.cos(a) * r, leg + Math.sin(a) * r, 0);
    }
  }
  const builtLock = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.21, 0.1, 6, 0.04), goldMat);
    body.position.y = 0.105;
    // the cream face, set just into the front, with a gold rim showing around it
    const face = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.15, 0.02, 4, 0.03), enamelMat);
    face.position.set(0, 0.1, 0.045);
    // the keyhole: a round top over a little slot
    const hole = new THREE.Shape();
    hole.absarc(0, 0.018, 0.02, 0, Math.PI * 2, false);
    const slot = new THREE.Shape();
    slot.moveTo(-0.011, 0.012); slot.lineTo(0.011, 0.012); slot.lineTo(0.016, -0.03); slot.lineTo(-0.016, -0.03); slot.closePath();
    const key = new THREE.Mesh(new THREE.ExtrudeGeometry([hole, slot], { depth: 0.012, bevelEnabled: false }), inkMat);
    key.position.set(0, 0.095, 0.05);
    key.scale.setScalar(1.15);
    // the shackle: a tube along a U, its feet sunk into the body
    const shackle = new THREE.Mesh(new THREE.TubeGeometry(new ShacklePath(0.072, 0.06), 48, 0.02, 14, false), steelMat);
    shackle.position.y = 0.19;
    const footL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), steelMat), footR = footL.clone();
    footL.position.set(-0.072, 0.19, 0); footR.position.set(0.072, 0.19, 0);
    // a small gold cap on top of each leg where the shackle enters the body
    const capL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.02, 18), goldMat), capR = capL.clone();
    capL.position.set(-0.072, 0.212, 0); capR.position.set(0.072, 0.212, 0);
    // a warm halo behind, so it reads against any cover
    const halo = P.glowPlane(0xffe2a8, 0.6, 0.22);
    halo.position.set(0, 0.16, -0.06);
    g.add(body, face, key, shackle, footL, footR, capL, capR, halo);
    return g;
  };
  const locks = [];
  items.forEach((b, i) => {
    const model = textures.lockModel ? P.fitModel(textures.lockModel.clone(true), { height: 0.3, keep: true }) : builtLock();
    model.traverse((o) => { if (o.isMesh) { o.castShadow = casting; o.userData.caster = true; o.userData.lockOf = b.id; } });
    const holder = new THREE.Group();
    holder.add(model);
    // in the book's own units: past the top-right corner of the cover, floating in front of it
    holder.position.set(BOOK_W / 2 - 0.08, BOOK_H / 2 - 0.16, BOOK_D / 2 + 0.16);
    holder.rotation.y = -0.35;
    holder.scale.setScalar(0.8);
    holder.visible = locked(b.id);
    b.mesh.add(holder);
    b.lock = holder;
    locks.push({ book: b, holder, phase: i * 1.7 });
  });

  /* ---------- figurines and toys ---------- */
  // every book keeps the things from its own story on the plank above it. Each toy arrives as its
  // painted card first (a few dozen kilobytes, textures.toyFor) and pops into place; its model
  // (a megabyte or two, textures.toyModelFor) is fetched only once its row is in view, or next to
  // it, and takes the card's place with a fresh pop (loadToysInView)
  const toys = [];
  const shelfTop = upperY + 0.025, shelfBack = -(depth - upperDepth) / 2;
  const manifest = (textures.toyManifest || {});
  const heights = manifest.heights || {};
  const perBook = manifest.books || {};
  // each toy is a souvenir you can meet: hover it and it wiggles, glows and says its name (with
  // its sound); tap it and it hops and spins. The names and sounds live in the toy manifest.
  const labels = manifest.labels || {};
  const sounds = manifest.sounds || {};
  const dress = (object, rec) => object.traverse((o) => { if (o.isMesh) { o.castShadow = casting; o.userData.caster = true; o.receiveShadow = true; o.userData.toy = rec; } });
  const putModel = (scene, x, z, ry, height, name, bookId, page) => {
    const holder = new THREE.Group();
    const object = P.fitModel(scene, { height, keep: true });
    const rec = { name, bookId, page, label: labels[name] || name, sfx: sounds[name] || null, holder, object, height, base: { ry }, pop: 0, delay: Math.random() * 0.3, hover: 0, hoverTarget: 0, hop: 0, hopV: 0, spin: 0, lastSound: 0, model: scene.userData.cutout ? "card" : "model" };
    dress(object, rec);
    holder.add(object);
    const glow = P.glowPlane(0xffe2a8, height * 1.5, 0);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.004;
    glow.material.depthTest = false;   // a pool of light on the plank: never clipped by the plank's edge or the wall
    glow.renderOrder = 7;
    holder.add(glow);
    rec.glow = glow;
    holder.position.set(x, shelfTop, z);
    holder.rotation.y = ry;
    holder.scale.setScalar(0.001);
    slider.add(holder);
    toys.push(rec);
    return holder;
  };
  const spawned = new Set();
  const spawnToys = (meta, i) => {
    if (spawned.has(meta.id) || !textures.toyFor) return;
    spawned.add(meta.id);
    const names = perBook[meta.id] || [];
    const spots = [[-0.32, shelfBack + 0.03, 0.35], [0.02, shelfBack - 0.02, -0.15], [0.33, shelfBack + 0.04, -0.4]];
    names.slice(0, 3).forEach((name, k) => {
      textures.toyFor(name).then((scene) => {
        if (!scene) return;
        const [dx, z, ry] = spots[k];
        putModel(scene, slotX(i) + dx, z, ry, heights[name] || 0.26, name, meta.id, Math.floor(i / PER_PAGE));
        loadToysInView();
      }).catch(() => {});
    });
  };
  /** the cards for the row in view and the rows beside it; farther rows wait until the shelf slides there */
  const spawnToysInView = () => books.forEach((meta, i) => { if (Math.abs(Math.floor(i / PER_PAGE) - slide.page) <= 1) spawnToys(meta, i); });
  /** The models for the toys whose row is in view (then the rows beside it), two at a time; a
      loaded model takes its card's place with a fresh pop. Called whenever the shelf slides. */
  let loading = 0;
  const loadToysInView = () => {
    if (!textures.toyModelFor) return;
    while (loading < 2) {
      const next = toys.find((r) => r.model === "card" && r.page === slide.page);
      if (!next) return;
      next.model = "loading";
      loading++;
      textures.toyModelFor(next.name).then((scene) => {
        loading--;
        if (!scene) { next.model = "none"; return; }
        const object = P.fitModel(scene, { height: next.height, keep: true });
        dress(object, next);
        next.holder.remove(next.object);
        next.object = object;
        next.holder.add(object);
        next.model = "model";
        next.pop = 0.35;   // a fresh little pop as the real toy takes the card's place
        loadToysInView();
      }).catch(() => { loading--; next.model = "none"; loadToysInView(); });
    }
  };

  /* ---------- api ---------- */
  const byId = (id) => items.find((b) => b.id === id);
  let hovered = null;
  const slide = { page: 0, x: 0, target: 0 };
  spawnToysInView();
  const homePose = (b) => ({ position: b.home.position.clone().add(new THREE.Vector3(slide.x, 0, 0)), rotation: b.home.rotation.clone(), scale: b.home.scale });

  const api = {
    group,
    items,
    pages,
    get page() { return slide.page; },
    get targets() { return items.filter((b) => b.mesh.visible).map((b) => b.mesh); },
    /** id of the book under a raycaster, or null */
    pick(raycaster) {
      const hits = raycaster.intersectObjects(api.targets, false);
      return hits.length ? hits[0].object.userData.shelfBook : null;
    },
    /** the toy under a raycaster, or null (only toys that have popped in) */
    pickToy(raycaster) {
      const hits = raycaster.intersectObjects(toys.filter((r) => r.pop > 0.5).map((r) => r.object), true);
      const hit = hits.find((h) => h.object.userData.toy);
      return hit ? hit.object.userData.toy : null;
    },
    setToyHover(rec) { for (const r of toys) r.hoverTarget = r === rec ? 1 : 0; },
    /** which books wear a lock (after a sign-in or a membership change) */
    setLocked(fn) { for (const b of items) if (b.lock) b.lock.visible = !!fn(b.id); },
    /** a little bounce (the hand passing over) or a big hop and a spin (a tap) */
    toyNudge(rec) { rec.hopV = Math.max(rec.hopV, 0.9); },
    toyTap(rec) { rec.hopV = 1.8; rec.spin = 1; },
    /** the point above a toy's head, for its name tag */
    toyTop(rec) { return rec.holder.localToWorld(new THREE.Vector3(0, rec.height * 1.08, 0)); },
    /** swap a book's cover art (a language edition) */
    setCover(id, texture) { const b = byId(id); if (!b) return; const m = b.mesh.material[4]; m.map = texture; m.needsUpdate = true; },
    setHover(id) {
      hovered = id;
      for (const b of items) b.hoverTarget = b.id === id ? 1 : 0;
    },
    get hovered() { return hovered; },
    setVisible(id, visible) { const b = byId(id); if (b) { b.mesh.visible = visible; b.glow.visible = visible; } },
    setCastShadow(on) {
      if (casting === !!on) return;
      casting = !!on;
      group.traverse((o) => { if (o.isMesh && o.userData.caster) o.castShadow = casting; });
    },
    poseOf(id) { const b = byId(id); return b ? { position: b.mesh.position.clone(), rotation: b.mesh.rotation.clone(), scale: b.mesh.scale.x } : null; },
    pageOf(id) { const b = byId(id); return b ? b.page : 0; },
    /** slide the shelf to show another three books */
    scrollTo(page, immediate = false) {
      slide.page = Math.max(0, Math.min(pages - 1, page));
      slide.target = -slide.page * PER_PAGE * SPACING;
      if (immediate) slide.x = slide.target;
      spawnToysInView();
      loadToysInView();
      return slide.page;
    },
    /** fetch the models for the toys in view (the cards stand in until then) */
    loadToysInView,
    scrollBy(delta) { return api.scrollTo(slide.page + delta); },
    /** the whole span the shelf can slide across (rows of three books) */
    get minX() { return -(pages - 1) * PER_PAGE * SPACING; },
    /** slide freely under a finger or a wheel: the shelf follows, with a soft stop at the ends */
    dragBy(dx) {
      let x = slide.target + dx;
      const over = x > 0 ? x : x < api.minX ? x - api.minX : 0;
      if (over) x = (x - over) + over * 0.35;     // rubber-band past the ends
      slide.target = x;
      slide.free = true;
    },
    /** let go: settle on the nearest row */
    settle(velocity = 0) {
      const step = PER_PAGE * SPACING;
      // carry the fling a little further in the direction it was going (never more than one row)
      const aim = slide.target + Math.max(-step, Math.min(step, velocity * 0.2));
      const page = Math.round(-aim / step);
      slide.free = false;
      return api.scrollTo(page);
    },
    /** Shake a book that cannot be opened yet. */
    wobble(id) { const b = byId(id); if (b) b.wobble = 1; },
    /** Progress bookmarks tucked between the pages, poking out of the top: { id: { percent, color } }.
        The ribbon sits at the depth of the page you reached (front cover = page 1) and rises out
        of the book when it is hovered so the whole design shows. */
    setProgress(map) {
      for (const b of items) {
        const p = map[b.id];
        if (!p || !p.percent) { if (b.bookmark) b.bookmark.visible = false; continue; }
        if (!b.bookmark) {
          const bm = makeBookmark(BOOK_W * 0.16, BOOK_MARK_H);
          bm.castShadow = casting; bm.userData.caster = true;
          b.mesh.add(bm);
          b.bookmark = bm;
        }
        // depth inside the block: just behind the front board at the start, near the back when finished
        const depth = BOOK_D / 2 - 0.012 - (BOOK_D - 0.024) * Math.min(1, p.percent / 100);
        b.bookmark.position.set(BOOK_W * 0.24, BOOK_H / 2 - BOOK_MARK_H / 2 + BOOK_MARK_H * MARK_REST, depth);
        b.bookmark.userData.depth = depth;
        b.bookmark.setProgress(b.id, p.percent, p.color);
      }
    },
    /** Fly a book to a pose in group space (an arc, growing or shrinking on the way). */
    /** Fly a book to a pose. It stays parked there afterwards (on the table while its story
        loads, however long that takes) until flyHome brings it back to its place on the plank. */
    flyTo(id, pose, duration = 1.1, park = true) {
      const b = byId(id);
      if (!b) return Promise.resolve();
      return new Promise((resolve) => {
        b.flight = {
          from: { position: b.mesh.position.clone(), rotation: b.mesh.rotation.clone(), scale: b.mesh.scale.x },
          to: pose, t: 0, duration, resolve, park,
        };
      });
    },
    flyHome(id, duration = 1.0) { const b = byId(id); return b ? api.flyTo(id, homePose(b), duration, false) : Promise.resolve(); },
    update(dt, t) {
      slide.x += (slide.target - slide.x) * Math.min(1, dt * (slide.free ? 14 : 5));
      slider.position.x = slide.x;
      for (const l of locks) {
        if (!l.holder.visible) continue;
        // a slow bob and a gentle turn, like a charm on a string
        l.holder.position.y = BOOK_H / 2 - 0.16 + Math.sin(t * 1.6 + l.phase) * 0.03;
        l.holder.rotation.y = -0.35 + Math.sin(t * 0.8 + l.phase) * 0.3;
        l.holder.rotation.z = Math.sin(t * 1.1 + l.phase) * 0.06;
      }
      for (const r of toys) {
        // pop in, then live: eased hover, a spring for hops, a decaying spin, a wiggle while hovered
        if (r.pop < 1) { r.delay -= dt; if (r.delay <= 0) r.pop = Math.min(1, r.pop + dt * 1.6); }
        r.hover += (r.hoverTarget - r.hover) * Math.min(1, dt * 8);
        r.hopV += -r.hop * 70 * dt - r.hopV * 5 * dt;
        r.hop += r.hopV * dt;
        if (r.spin > 0) r.spin = Math.max(0, r.spin - dt * 1.3);
        const lift = Math.max(0, r.hop);
        const pop = Math.max(0.001, P.easeOutBack(r.pop));
        const squash = 1 + r.hopV * 0.05;
        r.holder.scale.set(pop * (1 + r.hover * 0.08) / Math.sqrt(squash), pop * (1 + r.hover * 0.08) * squash, pop * (1 + r.hover * 0.08) / Math.sqrt(squash));
        r.holder.position.y = shelfTop + lift * 0.12;
        r.holder.rotation.y = r.base.ry + Math.sin(t * 9) * 0.1 * r.hover + (r.spin > 0 ? (1 - P.easeInOut(r.spin)) * Math.PI * 2 : 0);
        r.holder.rotation.z = Math.sin(t * 7 + 1) * 0.05 * r.hover;
        r.glow.material.opacity = r.hover * (0.45 + Math.sin(t * 4) * 0.08) + Math.min(0.4, lift * 0.6);
      }
      for (const b of items) {
        if (b.flight) {
          const f = b.flight;
          f.t += dt;
          const p = Math.min(1, f.t / f.duration);
          const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // ease in-out cubic
          b.mesh.position.lerpVectors(f.from.position, f.to.position, e);
          b.mesh.position.y += Math.sin(p * Math.PI) * 0.55;                    // the arc
          b.mesh.rotation.set(
            THREE.MathUtils.lerp(f.from.rotation.x, f.to.rotation.x, e),
            THREE.MathUtils.lerp(f.from.rotation.y, f.to.rotation.y, e) + Math.sin(p * Math.PI) * 0.25,
            THREE.MathUtils.lerp(f.from.rotation.z, f.to.rotation.z, e));
          b.mesh.scale.setScalar(THREE.MathUtils.lerp(f.from.scale, f.to.scale, e));
          b.glow.material.opacity = 0;
          if (p >= 1) { b.flight = null; b.parked = f.park; f.resolve(); }
          continue;
        }
        if (b.parked) { b.glow.material.opacity = 0; continue; }   // lying where it landed
        b.hover += (b.hoverTarget - b.hover) * Math.min(1, dt * 7);
        if (b.wobble > 0) b.wobble = Math.max(0, b.wobble - dt * 1.6);
        const lift = b.hover * 0.07 + Math.sin(t * 1.6 + b.home.position.x) * 0.004 * b.hover;
        b.mesh.position.set(b.home.position.x + slide.x, b.home.position.y + lift, b.home.position.z + b.hover * 0.08);
        const shake = b.wobble > 0 ? Math.sin(b.wobble * 26) * 0.08 * b.wobble : 0;
        b.mesh.rotation.set(b.home.rotation.x - b.hover * 0.06, shake, 0);
        b.mesh.scale.setScalar(b.home.scale * (1 + b.hover * 0.03));
        // hovered: the bookmark lifts a touch and slides sideways out past the fore-edge, so the
        // whole ribbon shows without climbing into the plank above
        if (b.bookmark) {
          const e = P.easeInOut(b.hover);
          b.bookmark.position.set(BOOK_W * 0.24 + MARK_SLIDE * e, BOOK_H / 2 - BOOK_MARK_H / 2 + BOOK_MARK_H * (MARK_REST + MARK_LIFT * e), b.bookmark.userData.depth ?? BOOK_D / 2);
          b.bookmark.rotation.z = -0.06 * e;
        }
        b.glow.material.opacity = b.hover * (0.32 + Math.sin(t * 3) * 0.04);
        b.glow.position.set(b.mesh.position.x, b.mesh.position.y, b.glow.position.z);
      }
    },
  };
  return api;
}

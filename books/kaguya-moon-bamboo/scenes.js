/* The spreads of "Kaguya and the Moon Bamboo": a glowing stalk, a girl who grows, gold in the
   bamboo, a song on the wind, five silly princes, the secret in the moon, a thousand bows, the
   robe of feathers, the mountain that never ends, and the old couple looking up. The shared
   pop-up engine is in src/scenes.js; the story's Japanese words live in story.json. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, starField, makeFall, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/* ---------- the bamboo ---------- */

/** A bamboo stalk that sways and glows gold from inside. `girl` uses the card with the tiny
    Kaguya inside (page 1) and registers it as Kaguya too. */
function bamboo(d, { x = 0.3, z = -0.2, width = 0.22, girl = false, glowing = 0.3, delay = 0.2, name = "bamboo" } = {}) {
  const id = girl ? "bamboo-girl" : "bamboo";
  const card = figure(d, id, { width, x, y: 0, z, delay, name, label: "bamboo", radius: width * 0.7, onTap: () => api.glow() });
  if (!card) return null;
  const halo = card.glow(0.5, girl ? 0.45 : 0.5, 0xffe08a, width * 2.2, 0);
  halo.position.z = -0.01;
  const light = new THREE.PointLight(0xffd27a, 0, 1.2, 1.8);
  light.position.copy(card.point(0.5, 0.5, 0.12));
  card.group.add(light);
  const sparks = d.burst(0xffe9a8, 40, 0.02);
  const state = { glow: glowing, target: glowing, sway: 0 };
  const api = {
    card, state,
    glow() { state.target = 1; state.pulse = 1; sfx(d, "shimmer", 0.5); d.ctx.sound.chime(6, 0.4); sparks.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.55, 0.05)), 10, 0.2, 0.7); setTimeout(() => { state.target = Math.max(glowing, 0.45); }, 2600); },
    sway() { state.sway = 1; sfx(d, "rustle", 0, 0.4); card.bounce(); },
  };
  d.updaters.push((dt, t) => {
    state.glow = lerp(state.glow, state.target, Math.min(1, dt * 2.5));
    state.sway = Math.max(0, state.sway - dt * 0.8);
    halo.material.opacity = state.glow * (0.5 + Math.sin(t * 2.2) * 0.08);
    light.intensity = state.glow * 1.4;
    card.group.rotation.z = Math.sin(t * 0.9) * 0.012 + Math.sin(state.sway * 14) * 0.06 * state.sway;
  });
  d.action(name, "glow", () => api.glow());
  d.action(name, "sway", () => api.sway());
  if (girl) {
    // the tiny girl inside answers to her name: a bow is a little dip of the card
    const bow = new THREE.Group();
    bow.position.copy(card.point(0.5, 0.45, 0.02));
    card.group.add(bow);
    d.register("kaguya", bow, { label: "Kaguya", radius: 0.09, anchor: () => card.worldPoint(0.5, 0.45, 0.05), onTap: () => { api.glow(); d.ctx.sound.chime(8, 0.4); } });
    d.action("kaguya", "bow", () => { card.bounce(); api.glow(); d.ctx.sound.chime(8, 0.35); setTimeout(() => d.ctx.sound.chime(5, 0.25), 200); });
  }
  return api;
}

/* ---------- the moon ---------- */

/** The painted moon, rising a little each time it is asked. */
function moon(d, { x = 0.3, y = 0.55, z = -0.46, width = 0.3, glow = 0.5, delay = 0.25, kaguya = false } = {}) {
  const card = figure(d, "moon", { width, x, y, z, delay, name: "moon", label: "moon", radius: width * 0.6, onTap: () => rise() });
  if (!card) return null;
  const halo = card.glow(0.5, 0.5, 0xfff2cc, width * 2.6, glow * 0.6);
  halo.position.z = -0.01;
  const light = new THREE.PointLight(0xfff0c8, 0.6, 2.4, 1.6);
  light.position.copy(card.point(0.5, 0.5, 0.2));
  card.group.add(light);
  const state = { lift: 0, target: 0, pulse: 0, glow };
  const rise = () => { state.target = Math.min(0.14, state.target + 0.045); state.pulse = 1; sfx(d, "shimmer", 0.4); d.ctx.sound.chime(7, 0.35); };
  d.updaters.push((dt, t) => {
    state.lift = lerp(state.lift, state.target, Math.min(1, dt * 2));
    state.pulse = Math.max(0, state.pulse - dt * 0.8);
    card.group.position.y = y + state.lift + Math.sin(t * 0.7) * 0.005;
    halo.material.opacity = state.glow * 0.6 + state.pulse * 0.35 + Math.sin(t * 1.3) * 0.04;
    light.intensity = 0.5 + state.glow * 0.8 + state.pulse * 1.2;
  });
  d.action("moon", "rise", rise);
  if (kaguya) {
    // on the last pages somebody looks down from the moon: her name lights it up
    const face = new THREE.Group();
    face.position.copy(card.point(0.5, 0.5, 0.03));
    card.group.add(face);
    d.register("kaguya", face, { label: "Kaguya", radius: width * 0.5, anchor: () => card.worldPoint(0.5, 0.5, 0.06), onTap: () => { state.pulse = 1.4; d.ctx.sound.chime(9, 0.4); } });
    d.action("kaguya", "glow", () => { state.pulse = 1.4; state.glow = Math.min(1, state.glow + 0.2); sfx(d, "shimmer", 0.5); d.ctx.sound.chime(9, 0.4); setTimeout(() => d.ctx.sound.chime(11, 0.3), 250); });
    d.action("kaguya", "bow", () => { state.pulse = 1; card.bounce(); d.ctx.sound.chime(8, 0.35); });
  }
  return { card, state, rise, world: () => card.worldPoint(0.5, 0.5, 0.05) };
}

/* ---------- Kaguya ---------- */

/** The hero: she starts small and grows through the book (`scale`), sings, twirls, bows and rises. */
function standingKaguya(d, position, options = {}) {
  const k = standingHero(d, position, { scale: 0.44, name: "kaguya", label: "Kaguya", ...options });
  const sound = d.ctx.sound;
  const notes = d.burst(0xffd97a, 40, 0.022);
  const hearts = d.burst(0xff9ab0, 30, 0.026);
  const stars = d.burst(0xfff4d0, 60, 0.02);
  const head = () => d.group.worldToLocal(k.hero.head ? k.hero.head.getWorldPosition(_v) : k.group.localToWorld(new THREE.Vector3(0, 0.5, 0)));
  const state = { bow: 0, twirl: 0, rising: 0, floatY: 0 };
  d.action("kaguya", "bow", () => { state.bow = 1; sound.chime(8, 0.35); setTimeout(() => sound.chime(5, 0.25), 220); });
  d.action("kaguya", "sing", () => { k.hero.look(); k.spring.kick(0, 0.4, 0); [0, 2, 4, 7, 9].forEach((n, i) => setTimeout(() => { sound.chime(n + 3, 0.35); notes.emit(head().add(new THREE.Vector3(0.05, 0.1, 0.05)), 3, 0.18, 0.7); }, i * 240)); if (d.onSing) d.onSing(); });
  d.action("kaguya", "twirl", () => { state.twirl = 1; k.spring.kick(0, 0.6, 0); sfx(d, "shimmer", 0.4); sound.chime(6, 0.3); });
  d.action("kaguya", "heart", () => { k.hero.look(); k.spring.kick(0, -0.2, 0); hearts.emit(head().add(new THREE.Vector3(0, -0.15, 0.08)), 10, 0.15, 0.6); sound.chime(1, 0.35); sound.puff(); });
  d.action("kaguya", "glow", () => { stars.emit(head(), 16, 0.25, 0.7); sfx(d, "shimmer", 0.5); sound.chime(9, 0.4); });
  d.action("kaguya", "rise", () => {
    if (state.rising) return;
    state.rising = 1;
    k.hero.wave();
    sfx(d, "shimmer", 0.6);
    [0, 1, 2, 3, 4].forEach((i) => setTimeout(() => { stars.emit(head(), 8, 0.2, 0.5); sound.chime(6 + i, 0.3); }, i * 300));
    if (d.onRise) d.onRise();
  });
  d.updaters.push((dt, t) => {
    if (state.bow > 0) { state.bow = Math.max(0, state.bow - dt * 0.9); k.group.rotation.x = Math.sin(state.bow * Math.PI) * 0.5; }
    if (state.twirl > 0) { state.twirl = Math.max(0, state.twirl - dt * 0.7); k.group.rotation.y += dt * 9 * state.twirl; }
    if (state.rising) {
      state.floatY = Math.min(1.4, state.floatY + dt * 0.35);
      k.group.position.y = state.floatY;
      k.group.rotation.y += dt * 0.6;
      k.group.scale.setScalar(k.group.scale.x * (1 - dt * 0.12));
    }
  });
  return k;
}

/* ---------- friends and things ---------- */

function oldMan(d, { x = -0.3, z = -0.1, width = 0.3, delay = 0.3 } = {}) {
  const card = friend(d, "ojiisan", { name: "ojiisan", label: "the old man", width, x, z, delay, call: "chime", note: 2, radius: 0.18 });
  if (!card) return null;
  const s = { bow: 0 };
  d.action("ojiisan", "bow", () => { s.bow = 1; card.bounce(); d.ctx.sound.chime(2, 0.3); });
  d.updaters.push((dt) => { if (s.bow > 0) { s.bow = Math.max(0, s.bow - dt * 0.9); card.group.rotation.x = Math.sin(s.bow * Math.PI) * 0.35; } });
  return card;
}

function oldWoman(d, { x = 0.3, z = -0.1, width = 0.28, delay = 0.3 } = {}) {
  const card = friend(d, "obaasan", { name: "obaasan", label: "the old woman", width, x, z, delay, call: "chime", note: 4, verb: "wave", radius: 0.17 });
  return card;
}

function kimono(d, { x = 0.34, z = -0.3, width = 0.24 } = {}) {
  const card = figure(d, "kimono", { width, x, y: 0.02, z, delay: 0.3, name: "kimono", label: "kimono", radius: 0.16, onTap: () => wrap() });
  if (!card) return null;
  const s = { wrap: 0 };
  const wrap = () => { s.wrap = 1; card.bounce(); sfx(d, "rustle", 0, 0.5); d.ctx.sound.chime(3, 0.3); };
  d.updaters.push((dt, t) => { s.wrap = Math.max(0, s.wrap - dt); card.group.rotation.z = Math.sin(t * 1.1) * 0.02 + Math.sin(s.wrap * 18) * 0.12 * s.wrap; });
  d.action("kimono", "wrap", wrap);
  return card;
}

function goldPile(d, { x = -0.2, z = 0.14, width = 0.3 } = {}) {
  const card = figure(d, "gold-coins", { width, x, y: 0, z, delay: 0.35, name: "gold", label: "gold", radius: 0.16, onTap: () => sparkle() });
  if (!card) return null;
  const glints = d.burst(0xffe9a8, 60, 0.018);
  const sparkle = () => { card.bounce(); glints.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.5, 0.05)), 18, 0.3, 0.9); sfx(d, "shimmer", 0.5); d.ctx.sound.chime(9, 0.35); };
  d.action("gold", "sparkle", sparkle);
  return card;
}

function bird(d, { x = 0.36, z = -0.24, y = 0.28, width = 0.14 } = {}) {
  const card = friend(d, "bird", { name: "bird", label: "bird", width, x, y, z, delay: 0.4, call: "cranecall", note: 0, radius: 0.1 });
  if (!card) return null;
  const s = { flutter: 0 };
  d.action("bird", "flutter", () => { s.flutter = 1; card.bounce(); sfx(d, "flutter", 0, 0.4); d.ctx.sound.chime(10, 0.25); });
  d.updaters.push((dt, t) => { s.flutter = Math.max(0, s.flutter - dt * 1.2); card.group.position.y = y + Math.sin(t * 1.6) * 0.008 + Math.sin(s.flutter * 22) * 0.04 * s.flutter; });
  return card;
}

/** Petals drifting over the page; swipes blow them and "sakura" / "wind" verbs stir them. */
function petals(d, { count = 110, color = 0xffc2d4, level = 0.6, names = ["sakura"] } = {}) {
  const fall = makeFall(d, { count, color, size: 0.024, speed: 0.06, sway: 0.08, level, opacity: 0.9, box: [1.3, 1.0, 0.9], center: [0, 0.5, -0.1] });
  for (const name of names) {
    if (!d.objects[name]) d.register(name, new THREE.Group(), { label: name === "wind" ? "wind" : "blossom", radius: 0.3, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.7, -0.1)) });
    d.action(name, "blow", () => { fall.blow(0.9); fall.set(Math.min(1.6, fall.level + 0.5)); sfx(d, "rustle", 0, 0.4); });
  }
  swipeOn(d, "sky", (dx) => { fall.blow(dx * 8); fall.set(Math.min(1.6, fall.level + Math.abs(dx) * 2)); }, { onEnd: () => sfx(d, "rustle", 0, 0.3) });
  return fall;
}

/* ---------- pages ---------- */

const builders = {
  "kaguya-grove": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "grove");
    oldMan(d, { x: -0.3, z: -0.06, width: 0.32 });
    let glowed = false;
    const stalk = bamboo(d, { x: 0.22, z: -0.14, width: 0.3, girl: true, glowing: 0.5 });
    if (stalk) { const g = stalk.glow; stalk.glow = () => { g(); if (!glowed) { glowed = true; ctx.onMagic("glow"); } }; d.action("bamboo", "glow", () => stalk.glow()); d.action("kaguya", "bow", () => { stalk.card.bounce(); stalk.glow(); }); }
    bamboo(d, { x: 0.46, z: -0.34, width: 0.16, name: "bamboo-2", delay: 0.4 });
    return d;
  },

  "kaguya-home": (ctx) => {
    const d = new Diorama(ctx);
    const home = backCard(d, "home", { name: "house", label: "home" });
    const glow = home.glow(0.5, 0.45, 0xffd9a0, 1.0, 0);
    const s = { warm: 0 };
    d.updaters.push((dt, t) => { s.warm = Math.max(0, s.warm - dt * 0.35); glow.material.opacity = s.warm * (0.3 + Math.sin(t * 2) * 0.05); });
    d.action("house", "glow", () => { s.warm = 1; home.bounce(); sfx(d, "shimmer", 0.4); d.ctx.sound.chime(4, 0.3); });
    oldWoman(d, { x: -0.28, z: -0.08, width: 0.3 });
    kimono(d, { x: 0.36, z: -0.3, width: 0.24 });
    standingKaguya(d, new THREE.Vector3(0.06, 0, 0.3), { scale: 0.26, faces: -1 });
    return d;
  },

  "kaguya-gold": (ctx) => {
    const d = new Diorama(ctx);
    const yard = backCard(d, "gold");
    d.hotspot(yard, "flowers", [0.05, 0.55, 0.35, 0.35], { label: "flowers", onTap: () => { splash(d, new THREE.Vector3(-0.3, 0.2, -0.4), { color: 0xffb0c8, count: 16, size: 0.024, speed: 0.3, up: 0.8 }); d.ctx.sound.chime(5, 0.3); } });
    d.action("flowers", "bloom", () => { d.objects.flowers.onTap(); splash(d, new THREE.Vector3(-0.1, 0.25, -0.4), { color: 0xffd0e0, count: 20, size: 0.026, speed: 0.35, up: 0.9 }); sfx(d, "shimmer", 0.4); });
    bamboo(d, { x: 0.4, z: -0.28, width: 0.2, glowing: 0.6 });
    goldPile(d, { x: -0.22, z: 0.12, width: 0.3 });
    figure(d, "sakura-branch", { width: 0.42, x: 0.16, y: 0.42, z: -0.42, delay: 0.3, name: "sakura", label: "cherry blossom", radius: 0.2, onTap: () => { fall.blow(0.8); fall.set(1.4); sfx(d, "rustle", 0, 0.4); } });
    const fall = petals(d, { names: ["sakura"] });
    standingKaguya(d, new THREE.Vector3(0.12, 0, 0.32), { scale: 0.4 });
    return d;
  },

  "kaguya-song": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "song");
    bird(d, { x: 0.4, z: -0.26, y: 0.3, width: 0.14 });
    const leaves = petals(d, { count: 60, color: 0xd9c07a, level: 0.35, names: ["wind"] });
    let sang = false;
    d.onSing = () => { leaves.blow(0.6); if (!sang) { sang = true; ctx.onMagic("song"); } };
    standingKaguya(d, new THREE.Vector3(-0.1, 0, 0.3), { scale: 0.46 });
    return d;
  },

  "kaguya-princes": (ctx) => {
    const d = new Diorama(ctx);
    const gate = backCard(d, "princes");
    d.hotspot(gate, "sea", [0.0, 0.3, 0.32, 0.3], { label: "the sea", onTap: () => { splash(d, new THREE.Vector3(-0.42, 0.25, -0.45), { color: 0x9fd4ff, count: 14 }); sfx(d, "splash", 0, 0.4); } });
    d.action("sea", "ripple", () => d.objects.sea.onTap());
    d.hotspot(gate, "mountain", [0.68, 0.25, 0.32, 0.4], { label: "the golden mountain", glow: 0xffe08a, onTap: () => { sfx(d, "shimmer", 0.5); d.ctx.sound.chime(9, 0.35); } });
    d.action("mountain", "shine", () => d.objects.mountain.onTap());
    // the dragon rises out of the sea when it is asked
    const dragon = figure(d, "dragon", { width: 0.4, x: -0.26, y: 0, z: -0.3, delay: 0.3, name: "dragon", label: "dragon", radius: 0.22, onTap: () => up() });
    const ds = { up: 0, target: 0 };
    const up = () => { ds.target = ds.target >= 1 ? 0.7 : 1; splash(d, new THREE.Vector3(-0.26, 0.05, -0.26), { color: 0x9fd4ff, count: 20 }); sfx(d, "splash", 0, 0.5); setTimeout(() => sfx(d, "howl", 0, 0.35), 500); };
    if (dragon) d.updaters.push((dt, t) => { ds.up = lerp(ds.up, ds.target, Math.min(1, dt * 1.8)); dragon.group.position.y = -dragon.height * (1 - ds.up) * 0.9 + Math.sin(t) * 0.006 * ds.up; });
    d.action("dragon", "splash", up);
    let laughed = false;
    friend(d, "prince", { name: "prince", label: "a prince", width: 0.3, x: 0.3, z: -0.04, delay: 0.35, call: "laugh", note: 0, radius: 0.18, onTap: () => { if (!laughed) { laughed = true; ctx.onMagic("princes"); } } });
    standingKaguya(d, new THREE.Vector3(-0.02, 0, 0.3), { scale: 0.48, faces: 1 });
    return d;
  },

  "kaguya-secret": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "secret");
    const s = { dim: 0 };
    d.action("sky", "night", () => { s.dim = 1; sky.bounce(); d.ctx.sound.chime(0, 0.25); });
    d.updaters.push((dt) => { s.dim = Math.max(0, s.dim - dt * 0.5); sky.material.color.setScalar(1 - s.dim * 0.25); });
    starField(d, [[-0.48, 0.9, -0.45], [-0.3, 0.98, -0.5], [-0.05, 0.93, -0.5], [0.05, 0.82, -0.48], [0.5, 0.9, -0.47]].map((p) => new THREE.Vector3(...p)), { lit: true, delay: 0.3, size: 0.03 });
    moon(d, { x: 0.3, y: 0.56, z: -0.44, width: 0.3, glow: 0.7 });
    let told = false;
    const k = standingKaguya(d, new THREE.Vector3(-0.1, 0, 0.3), { scale: 0.48, faces: 1 });
    const heart = d.objects.kaguya.actions.heart;
    d.action("kaguya", "heart", () => { heart(); if (!told) { told = true; ctx.onMagic("secret"); } });
    k.state.lookAt = () => d.group.localToWorld(new THREE.Vector3(0.3, 0.6, -0.44));
    return d;
  },

  "kaguya-guards": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "guards");
    const torches = sky.glow(0.5, 0.35, 0xffb060, 1.2, 0.12);
    const s = { watch: 0 };
    d.updaters.push((dt, t) => { s.watch = Math.max(0, s.watch - dt * 0.4); torches.material.opacity = 0.12 + Math.sin(t * 7) * 0.03 + s.watch * 0.25; });
    d.action("sky", "watch", () => { s.watch = 1; sky.bounce(); sfx(d, "crack", 0, 0.3); d.ctx.sound.chime(1, 0.3); });
    figure(d, "soldiers", { width: 0.62, x: 0.06, y: 0.32, z: -0.4, delay: 0.3, name: "soldiers", label: "soldiers", radius: 0.3, onTap: () => { sfx(d, "thunk", 0, 0.4); d.ctx.sound.click(); } });
    moon(d, { x: 0.36, y: 0.62, z: -0.5, width: 0.28, glow: 0.9 });
    oldWoman(d, { x: -0.3, z: -0.04, width: 0.3 });
    standingKaguya(d, new THREE.Vector3(0.0, 0, 0.3), { scale: 0.48, faces: -1 });
    return d;
  },

  "kaguya-robe": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "robe");
    const cloud = figure(d, "moon-cloud", { width: 0.56, x: 0.12, y: 0.62, z: -0.36, delay: 0.3, name: "cloud", label: "the cloud of light", radius: 0.3, onTap: () => descend() });
    const cs = { down: 0, target: 0 };
    const glints = d.burst(0xfff4d0, 80, 0.02);
    const descend = () => { cs.target = Math.min(0.3, cs.target + 0.12); sfx(d, "shimmer", 0.6); d.ctx.sound.chime(9, 0.35); glints.emit(new THREE.Vector3(0.12, 0.5, -0.3), 20, 0.3, 0.6); };
    if (cloud) d.updaters.push((dt, t) => { cs.down = lerp(cs.down, cs.target, Math.min(1, dt * 1.5)); cloud.group.position.y = 0.62 - cs.down + Math.sin(t * 0.8) * 0.01; });
    d.action("cloud", "descend", descend);
    figure(d, "feather-robe", { width: 0.22, x: 0.38, y: 0.05, z: -0.1, delay: 0.4, name: "robe", label: "the robe of feathers", radius: 0.14, onTap: () => { sfx(d, "flutter", 0, 0.5); d.ctx.sound.chime(10, 0.3); } });
    let rose = false;
    d.onRise = () => { if (!rose) { rose = true; ctx.onMagic("robe"); } };
    const k = standingKaguya(d, new THREE.Vector3(-0.08, 0, 0.28), { scale: 0.48 });
    k.state.lookAt = () => d.group.localToWorld(new THREE.Vector3(0.12, 0.7, -0.36));
    return d;
  },

  "kaguya-fuji": (ctx) => {
    const d = new Diorama(ctx);
    const mountain = backCard(d, "fuji");
    const smoke = d.burst(0xe8e4dc, 90, 0.045);
    let smoked = false;
    d.hotspot(mountain, "fuji", [0.3, 0.05, 0.4, 0.4], { label: "Mount Fuji", glow: 0xffd0a0, onTap: () => { const top = d.group.worldToLocal(mountain.worldPoint(0.5, 0.12, 0.04)); [0, 1, 2, 3, 4].forEach((i) => setTimeout(() => smoke.emit(top, 4, 0.06, 0.35), i * 160)); sfx(d, "crumble", 0, 0.3); d.ctx.sound.chime(2, 0.3); if (!smoked) { smoked = true; ctx.onMagic("fuji"); } } });
    d.action("fuji", "smoke", () => d.objects.fuji.onTap());
    d.every(2.5, () => smoke.emit(d.group.worldToLocal(mountain.worldPoint(0.5, 0.12, 0.04)), 1, 0.04, 0.3));
    figure(d, "soldiers", { width: 0.4, x: -0.24, y: 0, z: 0.0, delay: 0.35, name: "soldiers", label: "the Emperor's men", radius: 0.2, onTap: () => { sfx(d, "thunk", 0, 0.4); } });
    return d;
  },

  "kaguya-lookup": (ctx) => lastScene(ctx, { end: false }),
  end: (ctx) => lastScene(ctx, { end: true }),
};

function lastScene(ctx, { end }) {
  const d = new Diorama(ctx);
  backCard(d, "lookup");
  const stalk = bamboo(d, { x: 0.36, z: -0.26, width: 0.24, glowing: 0.5 });
  bamboo(d, { x: -0.44, z: -0.36, width: 0.16, name: "bamboo-2", delay: 0.4 });
  moon(d, { x: 0.06, y: 0.7, z: -0.5, width: 0.3, glow: 0.9, kaguya: true });
  oldMan(d, { x: -0.24, z: -0.02, width: 0.28 });
  oldWoman(d, { x: 0.02, z: 0.06, width: 0.26 });
  let thanked = false;
  const glow = d.objects.kaguya.actions.glow;
  d.action("kaguya", "glow", () => { glow(); if (stalk) stalk.glow(); if (!thanked) { thanked = true; ctx.onMagic("arigatou"); } });
  d.every(6, () => stalk && stalk.glow());
  if (end) setTimeout(() => ctx.onMagic("arigatou"), 2500);
  return d;
}

export default builders;

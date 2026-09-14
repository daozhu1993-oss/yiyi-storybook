/* The spreads of "Ruby and the Golden Gate": the window on the hill, the cable car, warm bread,
   the sea lions, the ferry across the bay, the kite in the park, the tallest hill, noon at the
   pier, the bridge, and good night. The shared pop-up engine is in src/scenes.js; the English
   words to keep live in story.json. Ruby and Biscuit are painted cut-outs (no 3D rig). */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, starField, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

const _v = new THREE.Vector3();

/* ---------- Ruby: a standing card, a waving card shown for a moment, a sleeping card ---------- */

function ruby(d, { x = -0.22, z = 0.3, width = 0.28, pose = "stand", delay = 0.3 } = {}) {
  const sound = d.ctx.sound;
  const stars = d.burst(0xfff0c0, 40, 0.02);
  const sleeping = pose === "sleep";
  const main = figure(d, sleeping ? "ruby-sleep" : "ruby-stand", { width: sleeping ? width * 1.25 : width, x, y: 0, z, delay, name: "ruby", label: "Ruby", radius: width * 0.5, onTap: () => wave() });
  if (!main) return null;
  const alt = sleeping ? null : figure(d, "ruby-wave", { width, x, y: 0, z: z - 0.002, delay, register: false });
  if (alt) alt.group.visible = false;
  const s = { wave: 0, nod: 0 };
  const top = () => d.group.worldToLocal(main.worldPoint(0.5, 0.95, 0.04));
  const nod = () => { s.nod = 1; main.bounce(); sound.chime(5, 0.3); };
  const wave = () => {
    if (!alt) { nod(); return; }
    s.wave = 1; main.group.visible = false; alt.group.visible = true; alt.bounce();
    sound.chime(7, 0.35); setTimeout(() => sound.chime(9, 0.25), 180);
    stars.emit(top(), 8, 0.16, 0.6);
    if (d.onWave) d.onWave();
  };
  d.updaters.push((dt) => {
    if (s.wave > 0) { s.wave = Math.max(0, s.wave - dt * 0.6); if (s.wave === 0) { alt.group.visible = false; main.group.visible = true; } }
    if (s.nod > 0) { s.nod = Math.max(0, s.nod - dt * 1.2); main.group.rotation.z = Math.sin(s.nod * Math.PI * 2) * 0.12 * s.nod; }
  });
  d.action("ruby", "wave", wave);
  d.action("ruby", "nod", nod);
  d.action("ruby", "sleep", () => { main.bounce(); sound.chime(2, 0.25); setTimeout(() => sound.chime(0, 0.2), 260); if (d.onSleep) d.onSleep(); });
  return main;
}

/** Biscuit the corgi: hops when tapped, wags on cue. */
function biscuit(d, { x = 0.12, z = 0.34, width = 0.16, run = false, delay = 0.4 } = {}) {
  const card = figure(d, run ? "biscuit-run" : "biscuit", { width, x, y: 0, z, delay, name: "dog", label: "Biscuit", radius: 0.1, onTap: () => wag() });
  if (!card) return null;
  const s = { hop: 0, run: 0 };
  const wag = () => { s.hop = 1; sfx(d, "boing", 2, 0.4); d.ctx.sound.chime(6, 0.2); if (d.onWag) d.onWag(); };
  const dash = () => { if (s.run > 0) return; s.run = 1; d.ctx.sound.whoosh(false); };
  d.updaters.push((dt, t) => {
    s.hop = Math.max(0, s.hop - dt * 2);
    if (s.run > 0) { s.run = Math.max(0, s.run - dt * 0.6); const p = 1 - s.run; card.group.position.x = x + Math.sin(p * Math.PI * 2) * 0.3; }
    card.group.position.y = Math.sin(s.hop * Math.PI) * 0.06;
    card.group.rotation.z = Math.sin(s.hop * Math.PI * 3) * 0.15 * s.hop + Math.sin(t * 2.2) * 0.02;
  });
  d.action("dog", "wag", wag);
  d.action("dog", "run", run ? dash : wag);
  return card;
}

/* ---------- things that roll, ring, steam, sail, fly and bloom ---------- */

/** The fog: a wide soft card that drifts, rolls away on cue and can be dragged aside. */
function fog(d, { name = "fogbank", x = 0.05, y = 0.02, z = -0.3, width = 0.9, delay = 0.35 } = {}) {
  const s = { roll: 0, dir: 1, drag: 0 };
  const card = figure(d, "fog", { width, x, y, z, delay, name, label: "the fog", radius: width * 0.4, onTap: () => roll(), onDrag: (p) => { s.drag = p.x - x; }, onDragEnd: () => { s.drag = 0; } });
  if (!card) return null;
  const roll = () => { if (s.roll > 0) return; s.roll = 1; s.dir *= -1; d.ctx.sound.puff(); sfx(d, "breath", 0, 0.4); if (d.onRoll) d.onRoll(); };
  d.updaters.push((dt, t) => {
    if (s.roll > 0) s.roll = Math.max(0, s.roll - dt * 0.4);
    const p = 1 - s.roll;
    card.group.position.x = x + Math.sin(p * Math.PI) * 0.35 * s.dir + s.drag * 0.6;
    card.group.position.y = y + Math.sin(t * 0.7) * 0.012;
    card.material.opacity = 0.92 - Math.sin(p * Math.PI) * 0.35;
  });
  card.material.transparent = true;
  d.action(name, "roll", roll);
  return card;
}

/** The cable car: rings its bell and rocks down the street. */
function cablecar(d, { x = 0.18, z = 0.1, width = 0.48, delay = 0.3 } = {}) {
  const card = figure(d, "cablecar", { width, x, y: 0, z, delay, name: "cablecar", label: "the cable car", radius: 0.22, onTap: () => ride() });
  if (!card) return null;
  const s = { ride: 0, ring: 0 };
  const ring = () => { s.ring = 1; d.ctx.sound.bell(0, 0.6); setTimeout(() => d.ctx.sound.bell(2, 0.5), 260); if (d.onRing) d.onRing(); };
  const ride = () => { if (s.ride > 0) return; s.ride = 1; ring(); };
  d.hotspot(card, "bell", [0.3, 0.72, 0.4, 0.28], { label: "the bell", glow: 0xffe9a8, onTap: ring });
  d.updaters.push((dt, t) => {
    s.ring = Math.max(0, s.ring - dt * 1.5);
    if (s.ride > 0) { s.ride = Math.max(0, s.ride - dt * 0.5); const p = 1 - s.ride; card.group.position.x = x - Math.sin(p * Math.PI) * 0.25; card.group.position.y = Math.sin(p * Math.PI * 6) * 0.01; }
    card.group.rotation.z = Math.sin(s.ring * Math.PI * 4) * 0.04 * s.ring + Math.sin(t * 1.6) * 0.008;
  });
  d.action("cablecar", "ring", ride);
  d.action("bell", "ring", ring);
  return card;
}

function steamy(d, id, { name, label = name, x, z, width, delay = 0.3, note = 4, radius = 0.14 } = {}) {
  const card = figure(d, id, { width, x, y: 0, z, delay, name, label, radius, onTap: () => steam() });
  if (!card) return null;
  const puffs = d.burst(0xfff6e8, 50, 0.04);
  const steam = () => { card.bounce(); const top = d.group.worldToLocal(card.worldPoint(0.5, 0.9, 0.04)); [0, 1, 2].forEach((i) => setTimeout(() => puffs.emit(top, 4, 0.06, 0.45), i * 180)); d.ctx.sound.puff(); d.ctx.sound.chime(note, 0.3); };
  d.action(name, "steam", steam);
  return card;
}

function boat(d, id, { name = "boat", label = "the boat", x = 0.1, z = -0.2, width = 0.4, y = 0, delay = 0.3, span = 0.45 } = {}) {
  const card = figure(d, id, { width, x, y, z, delay, name, label, radius: width * 0.5, onTap: () => sail() });
  if (!card) return null;
  const s = { sail: 0, dir: 1 };
  const sail = () => { if (s.sail > 0) return; s.sail = 1; d.ctx.sound.whoosh(false); splash(d, new THREE.Vector3(x, 0.03, z + 0.03), { color: 0xa8d8ff, count: 12 }); };
  d.updaters.push((dt, t) => {
    if (s.sail > 0) { s.sail = Math.max(0, s.sail - dt * 0.45); const p = 1 - s.sail; card.group.position.x = x + Math.sin(p * Math.PI) * span * s.dir; if (s.sail === 0) s.dir *= -1; }
    card.group.position.y = y + Math.sin(t * 1.4) * 0.006;
    card.group.rotation.z = Math.sin(t * 1.1) * 0.03;
  });
  d.action(name, "sail", sail);
  return card;
}

/** The kite: loops up into the sky and floats back. */
function kite(d, { x = 0.3, y = 0.36, z = -0.2, width = 0.2, delay = 0.35 } = {}) {
  const card = figure(d, "kite", { width, x, y, z, delay, name: "kite", label: "the kite", radius: 0.14, onTap: () => fly() });
  if (!card) return null;
  const s = { fly: 0 };
  const fly = () => { if (s.fly > 0) return; s.fly = 1; sfx(d, "flutter", 0, 0.5); d.ctx.sound.whoosh(false); };
  d.updaters.push((dt, t) => {
    if (s.fly > 0) {
      s.fly = Math.max(0, s.fly - dt * 0.5);
      const p = 1 - s.fly;
      card.group.position.set(x + Math.sin(p * Math.PI * 2) * 0.25, y + Math.sin(p * Math.PI) * 0.3, z);
      card.group.rotation.z = Math.sin(p * Math.PI * 2) * 0.5;
    } else {
      card.group.position.set(x + Math.sin(t * 0.9) * 0.02, y + Math.sin(t * 1.3) * 0.02, z);
      card.group.rotation.z = Math.sin(t * 1.1) * 0.08;
    }
  });
  d.action("kite", "fly", fly);
  return card;
}

function flower(d, { x = -0.36, z = 0.16, width = 0.11 } = {}) {
  const card = figure(d, "flower", { width, x, y: 0, z, delay: 0.4, name: "flower", label: "the flower", radius: 0.09, onTap: () => bloom() });
  if (!card) return null;
  const s = { bloom: 0 };
  const bloom = () => { s.bloom = 1; splash(d, new THREE.Vector3(x, 0.12, z + 0.03), { color: 0xffb070, count: 12, size: 0.022, speed: 0.25, up: 0.7 }); d.ctx.sound.chime(8, 0.3); };
  d.updaters.push((dt) => { s.bloom = Math.max(0, s.bloom - dt * 0.8); card.group.scale.setScalar(1 + Math.sin(s.bloom * Math.PI) * 0.35); });
  d.action("flower", "bloom", bloom);
  return card;
}

/** The sea lions: bark and clap. */
function sealions(d, { x = 0.26, z = 0.06, width = 0.34, small = false, delay = 0.3 } = {}) {
  const card = figure(d, small ? "sealion-small" : "sealion", { width, x, y: 0, z, delay, name: "sealion", label: small ? "the sea lions" : "the sea lion", radius: width * 0.5, onTap: () => bark() });
  if (!card) return null;
  const s = { bark: 0 };
  const bark = () => { s.bark = 1; sfx(d, "howl", 4, 0.35); setTimeout(() => sfx(d, "boing", 1, 0.3), 220); if (d.onBark) d.onBark(); };
  d.updaters.push((dt, t) => { s.bark = Math.max(0, s.bark - dt * 1.4); card.group.rotation.z = Math.sin(s.bark * Math.PI * 4) * 0.12 * s.bark; card.group.position.y = Math.sin(s.bark * Math.PI) * 0.05 + Math.sin(t * 1.5) * 0.004; });
  d.action("sealion", "bark", bark);
  d.action("sealion", "clap", bark);
  return card;
}

/** A glowing spot on the backdrop (the sun, an island, a star, the bridge) that flares on cue. */
function shining(d, card, name, rect, { label, verb = "shine", color = 0xfff2c0, sparkle = false, note = 7, onFirst = null } = {}) {
  const glints = d.burst(0xffffff, 120, 0.016);
  const glow = card.glow(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, color, Math.max(rect[2] * card.width, rect[3] * card.height) * 1.2, 0.08);
  const s = { on: 0 };
  let first = true;
  const flare = () => {
    s.on = 1; d.ctx.sound.chime(note, 0.3);
    if (sparkle) { sfx(d, "shimmer", 0.6); d.ctx.sound.sparkle(); for (let i = 0; i < 10; i++) setTimeout(() => { for (let k = 0; k < 3; k++) { const u = rect[0] + Math.random() * rect[2], v = rect[1] + Math.random() * rect[3]; glints.emit(d.group.worldToLocal(card.worldPoint(u, v, 0.03)), 1, 0.02, 0.15); } }, i * 120); }
    if (first && onFirst) { first = false; onFirst(); }
  };
  d.hotspot(card, name, rect, { label, glow: color, onTap: flare });
  d.updaters.push((dt, t) => { s.on = Math.max(0, s.on - dt * 0.35); glow.material.opacity = 0.08 + s.on * 0.4 + Math.sin(t * 2) * 0.03; });
  d.action(name, verb, flare);
  return flare;
}

/* ---------- pages ---------- */

const builders = {
  "ruby-window": (ctx) => {
    const d = new Diorama(ctx);
    const room = backCard(d, "window", { name: "window", label: "the window" });
    d.action("window", "peek", () => { room.bounce(); d.ctx.sound.chime(4, 0.25); });
    fog(d, { x: 0.12, y: 0.32, z: -0.42, width: 0.6 });
    let greeted = false;
    d.onWave = () => { if (!greeted) { greeted = true; ctx.onMagic("goodmorning"); } };
    ruby(d, { x: -0.2, z: 0.3 });
    biscuit(d, { x: 0.18, z: 0.34 });
    return d;
  },

  "ruby-cablecar": (ctx) => {
    const d = new Diorama(ctx);
    const street = backCard(d, "street", { name: "street", label: "the street" });
    d.hotspot(street, "tree", [0.02, 0.35, 0.22, 0.45], { label: "the tree", onTap: () => { street.bounce(); sfx(d, "rustle", 0, 0.4); } });
    d.action("tree", "sway", () => d.objects.tree.onTap());
    let rung = false;
    d.onRing = () => { if (!rung) { rung = true; ctx.onMagic("bell"); } };
    cablecar(d, { x: 0.16, z: 0.08, width: 0.5 });
    ruby(d, { x: -0.3, z: 0.32, width: 0.272 });
    biscuit(d, { x: -0.06, z: 0.4, width: 0.14 });
    return d;
  },

  "ruby-bakery": (ctx) => {
    const d = new Diorama(ctx);
    const shop = backCard(d, "bakery", { name: "bakery", label: "the bakery" });
    d.hotspot(shop, "fogbank", [0.62, 0.45, 0.36, 0.4], { label: "the fog", onTap: () => { d.ctx.sound.puff(); sfx(d, "breath", 0, 0.35); } });
    d.action("fogbank", "roll", () => d.objects.fogbank.onTap());
    steamy(d, "bread", { name: "bread", label: "the bread", x: -0.02, z: 0.16, width: 0.2, note: 6 });
    friend(d, "baker", { name: "baker", label: "the baker", width: 0.36, x: 0.3, z: -0.16, delay: 0.3, call: "giggle", note: 0, verb: "smile", radius: 0.2 });
    ruby(d, { x: -0.3, z: 0.3, width: 0.272 });
    biscuit(d, { x: 0.36, z: 0.36, width: 0.13 });
    return d;
  },

  "ruby-pier": (ctx) => {
    const d = new Diorama(ctx);
    const docks = backCard(d, "pier", { name: "pier", label: "the pier" });
    shining(d, docks, "sun", [0.72, 0.7, 0.22, 0.26], { label: "the sun", color: 0xfff0b0, note: 8 });
    let barked = false;
    d.onBark = () => { if (!barked) { barked = true; ctx.onMagic("sealion"); } };
    sealions(d, { x: 0.28, z: 0.04, width: 0.36 });
    sealions(d, { x: 0.44, z: 0.3, width: 0.16, small: true, delay: 0.45 });
    ruby(d, { x: -0.28, z: 0.3, width: 0.272 });
    biscuit(d, { x: 0.0, z: 0.4, width: 0.13 });
    return d;
  },

  "ruby-bay": (ctx) => {
    const d = new Diorama(ctx);
    const water = backCard(d, "bay", { name: "bay", label: "the bay" });
    shining(d, water, "island", [0.5, 0.5, 0.36, 0.28], { label: "the island", verb: "blink", color: 0xfff2c0, sparkle: true, note: 6 });
    const cloud = fog(d, { name: "cloud", x: -0.2, y: 0.2, z: -0.34, width: 0.5 });
    if (cloud) { d.objects.cloud.label = "the cloud"; d.action("cloud", "drift", d.objects.cloud.actions.roll); }
    boat(d, "ferry", { name: "boat", label: "the boat", x: 0.06, z: -0.1, width: 0.5, span: 0.32 });
    ruby(d, { x: -0.3, z: 0.32, width: 0.255 });
    biscuit(d, { x: 0.36, z: 0.36, width: 0.13 });
    return d;
  },

  "ruby-park": (ctx) => {
    const d = new Diorama(ctx);
    const lawn = backCard(d, "park", { name: "park", label: "the park" });
    d.hotspot(lawn, "tree", [0.0, 0.3, 0.24, 0.5], { label: "the tree", onTap: () => { lawn.bounce(); sfx(d, "rustle", 0, 0.4); } });
    d.action("tree", "sway", () => d.objects.tree.onTap());
    kite(d, { x: 0.3, y: 0.4, z: -0.24, width: 0.2 });
    friend(d, "painter", { name: "painter", label: "the painter", width: 0.32, x: 0.3, z: -0.04, delay: 0.3, call: "chime", note: 4, verb: "paint", radius: 0.18 });
    flower(d, { x: -0.4, z: 0.18, width: 0.11 });
    ruby(d, { x: -0.16, z: 0.32, width: 0.272 });
    biscuit(d, { x: 0.1, z: 0.42, width: 0.13 });
    return d;
  },

  "ruby-peak": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "peak", { name: "sky", label: "the sky" });
    const bank = fog(d, { x: 0.0, y: 0.06, z: -0.28, width: 1.0 });
    if (bank) swipeOn(d, "fogbank", (dx) => { bank.group.position.x += dx * 0.5; }, { onEnd: () => d.ctx.sound.puff() });
    d.onWag = null;
    ruby(d, { x: -0.24, z: 0.32, width: 0.272 });
    biscuit(d, { x: 0.14, z: 0.38, width: 0.14 });
    return d;
  },

  "ruby-noon": (ctx) => {
    const d = new Diorama(ctx);
    const docks = backCard(d, "noon", { name: "pier", label: "the pier" });
    shining(d, docks, "sun", [0.6, 0.66, 0.26, 0.3], { label: "the sun", color: 0xfff0b0, sparkle: true, note: 9 });
    sealions(d, { x: 0.3, z: 0.02, width: 0.2, small: true });
    sealions(d, { x: 0.46, z: 0.24, width: 0.16, small: true, delay: 0.45 });
    ruby(d, { x: -0.26, z: 0.3, width: 0.272 });
    biscuit(d, { x: 0.04, z: 0.4, width: 0.13 });
    return d;
  },

  "ruby-bridge": (ctx) => {
    const d = new Diorama(ctx);
    const view = backCard(d, "bridge", { name: "sky", label: "the sky" });
    let shone = false;
    shining(d, view, "bridge", [0.05, 0.3, 0.9, 0.5], { label: "the Golden Gate Bridge", color: 0xffb070, sparkle: true, note: 9, onFirst: () => { if (!shone) { shone = true; ctx.onMagic("bridge"); } } });
    ruby(d, { x: -0.24, z: 0.32, width: 0.272 });
    biscuit(d, { x: 0.2, z: 0.36, width: 0.16, run: true });
    return d;
  },

  "ruby-home": (ctx) => homeScene(ctx, { end: false }),
  end: (ctx) => homeScene(ctx, { end: true }),
};

function homeScene(ctx, { end }) {
  const d = new Diorama(ctx);
  const room = backCard(d, "home", { name: "house", label: "home" });
  shining(d, room, "star", [0.55, 0.78, 0.2, 0.18], { label: "the star", verb: "twinkle", color: 0xfff6d0, sparkle: true, note: 10 });
  d.hotspot(room, "fogbank", [0.5, 0.42, 0.42, 0.22], { label: "the fog", onTap: () => { d.ctx.sound.puff(); sfx(d, "breath", 0, 0.3); } });
  d.action("fogbank", "roll", () => d.objects.fogbank.onTap());
  starField(d, [[-0.46, 0.9, -0.45], [-0.28, 0.96, -0.5], [0.1, 0.94, -0.5], [0.4, 0.92, -0.48]].map((p) => new THREE.Vector3(...p)), { lit: true, delay: 0.3, size: 0.026 });
  let said = false;
  d.onSleep = () => { if (!said) { said = true; ctx.onMagic("goodnight"); } };
  ruby(d, { x: -0.14, z: 0.3, width: 0.289, pose: "sleep" });
  biscuit(d, { x: 0.24, z: 0.36, width: 0.14 });
  if (end) setTimeout(() => ctx.onMagic("goodnight"), 2500);
  return d;
}

export default builders;

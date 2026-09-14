/* The spreads of "Whit and the London Bells": the road to the city, the market, the red bus,
   the bridge that opens, tea in the rain, the ravens of the tower, Tabby to the rescue, the
   Queen's coin, the bells of Bow, and London is home. The shared pop-up engine is in
   src/scenes.js; the English words to keep live in story.json. Whit and Tabby are painted cut-outs. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, starField, makeFall, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

/* ---------- Whit and Tabby ---------- */

function whit(d, { x = -0.22, z = 0.3, width = 0.28, pose = "stand", delay = 0.3 } = {}) {
  const sound = d.ctx.sound;
  const stars = d.burst(0xfff0c0, 40, 0.02);
  const sleeping = pose === "sleep";
  const main = figure(d, sleeping ? "whit-sleep" : "whit-stand", { width: sleeping ? width * 1.25 : width, x, y: 0, z, delay, name: "whit", label: "Whit", radius: width * 0.5, onTap: () => wave() });
  if (!main) return null;
  const alt = sleeping ? null : figure(d, "whit-wave", { width, x, y: 0, z: z - 0.002, delay, register: false });
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
  d.action("whit", "wave", wave);
  d.action("whit", "tip", wave);
  d.action("whit", "nod", nod);
  d.action("whit", "bow", () => { nod(); if (d.onBow) d.onBow(); });
  d.action("whit", "sleep", () => { main.bounce(); sound.chime(2, 0.25); setTimeout(() => sound.chime(0, 0.2), 260); if (d.onSleep) d.onSleep(); });
  return main;
}

/** Tabby: purrs and hops; the leaping card pounces across the page. */
function tabby(d, { x = 0.12, z = 0.34, width = 0.16, leap = false, delay = 0.4 } = {}) {
  const card = figure(d, leap ? "tabby-leap" : "tabby", { width, x, y: 0, z, delay, name: "cat", label: "Tabby", radius: 0.1, onTap: () => (leap ? pounce() : purr()) });
  if (!card) return null;
  const s = { hop: 0, pounce: 0 };
  const purr = () => { s.hop = 1; sfx(d, "giggle", 2, 0.3); d.ctx.sound.chime(6, 0.2); if (d.onPurr) d.onPurr(); };
  const pounce = () => { if (s.pounce > 0) return; s.pounce = 1; d.ctx.sound.whoosh(false); sfx(d, "boing", 3, 0.4); if (d.onPounce) d.onPounce(); };
  d.updaters.push((dt, t) => {
    s.hop = Math.max(0, s.hop - dt * 2);
    if (s.pounce > 0) { s.pounce = Math.max(0, s.pounce - dt * 0.7); const p = 1 - s.pounce; card.group.position.x = x + Math.sin(p * Math.PI) * 0.34; card.group.position.y = Math.sin(p * Math.PI * 2) * 0.12 * (p < 0.5 ? 1 : 0.4); }
    else card.group.position.y = Math.sin(s.hop * Math.PI) * 0.06;
    card.group.rotation.z = Math.sin(s.hop * Math.PI * 3) * 0.12 * s.hop + Math.sin(t * 2.0) * 0.02;
  });
  d.action("cat", "purr", purr);
  d.action("cat", "leap", leap ? pounce : purr);
  return card;
}

/** Mice: scurry off the page and back. */
function mouse(d, { x = 0.3, z = 0.2, width = 0.1, delay = 0.45, name = "mouse", dir = 1 } = {}) {
  const card = figure(d, "mouse", { width, x, y: 0, z, delay, name, label: "the mouse", radius: 0.08, onTap: () => scurry() });
  if (!card) return null;
  const s = { run: 0 };
  const scurry = () => { if (s.run > 0) return; s.run = 1; sfx(d, "snap", 4, 0.3); d.ctx.sound.pop(1.4); };
  d.updaters.push((dt, t) => {
    if (s.run > 0) { s.run = Math.max(0, s.run - dt * 0.8); const p = 1 - s.run; card.group.position.x = x + Math.sin(p * Math.PI) * 0.3 * dir; card.group.rotation.z = Math.sin(p * Math.PI * 8) * 0.1; }
    else card.group.rotation.z = Math.sin(t * 5) * 0.02;
  });
  d.action(name, "scurry", scurry);
  return card;
}

/* ---------- things that drive, sail, open, steam, spin and ring ---------- */

function rain(d, { level = 0.8 } = {}) {
  const fall = makeFall(d, { count: 220, color: 0xdff4ff, size: 0.016, speed: 0.55, sway: 0.02, level, box: [1.4, 1.2, 1.0], center: [0, 0.6, -0.05] });
  d.register("rain", new THREE.Group(), { label: "the rain", radius: 0.4, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.8, -0.1)) });
  d.action("rain", "fall", () => { fall.set(Math.min(1.8, fall.level + 0.5)); sfx(d, "rain", 0, 0.5); });
  swipeOn(d, "sky", (dx) => { fall.blow(dx * 8); fall.set(Math.min(1.8, fall.level + Math.abs(dx) * 3)); }, { onEnd: () => sfx(d, "rain", 0, 0.4) });
  return fall;
}

function bus(d, { x = 0.14, z = 0.08, width = 0.56, delay = 0.3 } = {}) {
  const card = figure(d, "bus", { width, x, y: 0, z, delay, name: "bus", label: "the bus", radius: 0.26, onTap: () => drive() });
  if (!card) return null;
  const s = { drive: 0, ring: 0 };
  const ring = () => { s.ring = 1; d.ctx.sound.bell(1, 0.6); if (d.onRing) d.onRing(); };
  const drive = () => { if (s.drive > 0) return; s.drive = 1; ring(); setTimeout(() => d.ctx.sound.whoosh(false), 200); };
  d.hotspot(card, "bell", [0.05, 0.55, 0.25, 0.3], { label: "the bell", glow: 0xffe9a8, onTap: ring });
  d.updaters.push((dt, t) => {
    s.ring = Math.max(0, s.ring - dt * 1.5);
    if (s.drive > 0) { s.drive = Math.max(0, s.drive - dt * 0.45); const p = 1 - s.drive; card.group.position.x = x + Math.sin(p * Math.PI) * 0.22; card.group.position.y = Math.abs(Math.sin(p * Math.PI * 8)) * 0.006; }
    card.group.rotation.z = Math.sin(s.ring * Math.PI * 4) * 0.02 * s.ring;
  });
  d.action("bus", "drive", drive);
  d.action("bell", "ring", ring);
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

function steamy(d, id, { name, label = name, x, z, width, delay = 0.3, note = 4, radius = 0.14 } = {}) {
  const card = figure(d, id, { width, x, y: 0, z, delay, name, label, radius, onTap: () => steam() });
  if (!card) return null;
  const puffs = d.burst(0xfff6e8, 50, 0.04);
  const steam = () => { card.bounce(); const top = d.group.worldToLocal(card.worldPoint(0.5, 0.9, 0.04)); [0, 1, 2].forEach((i) => setTimeout(() => puffs.emit(top, 4, 0.06, 0.45), i * 180)); d.ctx.sound.puff(); d.ctx.sound.chime(note, 0.3); };
  d.action(name, "steam", steam);
  return card;
}

function wobbly(d, id, { name, label = name, x, z, width, delay = 0.35, radius = 0.12, verb = "wobble" } = {}) {
  const card = figure(d, id, { width, x, y: 0, z, delay, name, label, radius, onTap: () => wobble() });
  if (!card) return null;
  const s = { wobble: 0 };
  const wobble = () => { s.wobble = 1; sfx(d, "boing", 1, 0.35); };
  d.updaters.push((dt) => { s.wobble = Math.max(0, s.wobble - dt * 1.2); card.group.rotation.z = Math.sin(s.wobble * 16) * 0.2 * s.wobble; });
  d.action(name, verb, wobble);
  return card;
}

function coin(d, { x = 0.1, y = 0.12, z = 0.24, width = 0.12, delay = 0.4 } = {}) {
  const card = figure(d, "coin", { width, x, y, z, delay, name: "coin", label: "the coin", radius: 0.09, onTap: () => spin() });
  if (!card) return null;
  const glints = d.burst(0xfff2b0, 40, 0.018);
  const s = { spin: 0 };
  const spin = () => { if (s.spin > 0) return; s.spin = 1; sfx(d, "shimmer", 0.5); d.ctx.sound.chime(9, 0.3); glints.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.5, 0.04)), 8, 0.1, 0.5); if (d.onSpin) d.onSpin(); };
  d.updaters.push((dt, t) => { if (s.spin > 0) { s.spin = Math.max(0, s.spin - dt * 0.8); card.group.rotation.y = (1 - s.spin) * Math.PI * 4; card.group.position.y = y + Math.sin((1 - s.spin) * Math.PI) * 0.15; } else card.group.position.y = y + Math.sin(t * 1.6) * 0.008; });
  d.action("coin", "spin", spin);
  return card;
}

/** A glowing spot on the backdrop that flares on cue (the clock, the lamps, the moon, the bells). */
function shining(d, card, name, rect, { label, verb = "shine", color = 0xfff2c0, sparkle = false, note = 7, sound = null, onFirst = null } = {}) {
  const glints = d.burst(0xffffff, 120, 0.016);
  const glow = card.glow(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, color, Math.max(rect[2] * card.width, rect[3] * card.height) * 1.2, 0.08);
  const s = { on: 0 };
  let first = true;
  const flare = () => {
    s.on = 1; if (sound) sound(); else d.ctx.sound.chime(note, 0.3);
    if (sparkle) { sfx(d, "shimmer", 0.6); for (let i = 0; i < 8; i++) setTimeout(() => { for (let k = 0; k < 3; k++) { const u = rect[0] + Math.random() * rect[2], v = rect[1] + Math.random() * rect[3]; glints.emit(d.group.worldToLocal(card.worldPoint(u, v, 0.03)), 1, 0.02, 0.15); } }, i * 120); }
    if (first && onFirst) { first = false; onFirst(); }
  };
  d.hotspot(card, name, rect, { label, glow: color, onTap: flare });
  d.updaters.push((dt, t) => { s.on = Math.max(0, s.on - dt * 0.35); glow.material.opacity = 0.08 + s.on * 0.4 + Math.sin(t * 2) * 0.03; });
  d.action(name, verb, flare);
  return flare;
}

/* ---------- pages ---------- */

const builders = {
  "whit-road": (ctx) => {
    const d = new Diorama(ctx);
    const road = backCard(d, "road", { name: "city", label: "London" });
    shining(d, road, "street", [0.3, 0.1, 0.45, 0.3], { label: "the streets", color: 0xffe0a0, sparkle: true, note: 6 });
    rain(d, { level: 0.5 });
    let greeted = false;
    d.onWave = () => { if (!greeted) { greeted = true; ctx.onMagic("hello"); } };
    whit(d, { x: -0.2, z: 0.3 });
    tabby(d, { x: 0.16, z: 0.36 });
    return d;
  },

  "whit-market": (ctx) => {
    const d = new Diorama(ctx);
    const hall = backCard(d, "market", { name: "market", label: "the market" });
    d.action("market", "bustle", () => { hall.bounce(); sfx(d, "cheer", 0, 0.3); });
    wobbly(d, "cake", { name: "cake", label: "the cake", x: 0.34, z: 0.14, width: 0.16 });
    mouse(d, { x: 0.1, z: 0.26, width: 0.1, dir: 1 });
    let sorry = false;
    d.onBow = () => { if (!sorry) { sorry = true; sfx(d, "thunk", 0, 0.5); ctx.onMagic("sorry"); } };
    whit(d, { x: -0.26, z: 0.3, width: 0.272 });
    tabby(d, { x: -0.02, z: 0.4, width: 0.14 });
    return d;
  },

  "whit-bus": (ctx) => {
    const d = new Diorama(ctx);
    const street = backCard(d, "busstop", { name: "city", label: "London" });
    shining(d, street, "clock", [0.66, 0.45, 0.22, 0.45], { label: "the clock", verb: "chime", color: 0xffe9a8, note: 3, sound: () => { d.ctx.sound.bell(0, 0.5); setTimeout(() => d.ctx.sound.bell(0, 0.4), 500); } });
    d.action("street", "shine", () => street.bounce());
    bus(d, { x: 0.1, z: 0.06, width: 0.58 });
    whit(d, { x: -0.34, z: 0.32, width: 0.255 });
    tabby(d, { x: -0.1, z: 0.42, width: 0.12 });
    return d;
  },

  "whit-river": (ctx) => {
    const d = new Diorama(ctx);
    const thames = backCard(d, "river", { name: "river", label: "the river" });
    d.action("river", "ripple", () => { thames.bounce(); splash(d, new THREE.Vector3(0.0, 0.2, -0.45), { color: 0xbfe0ff, count: 10, size: 0.02, speed: 0.2, up: 0.5 }); sfx(d, "splash", 0, 0.3); });
    shining(d, thames, "bridge", [0.15, 0.35, 0.7, 0.4], { label: "the bridge", verb: "open", color: 0xffe0b0, sparkle: true, note: 5, sound: () => { sfx(d, "thunk", 0, 0.4); setTimeout(() => d.ctx.sound.chime(5, 0.3), 300); } });
    boat(d, "boat", { name: "boat", label: "the boat", x: 0.0, z: -0.14, width: 0.3, span: 0.4 });
    friend(d, "duck", { name: "duck", label: "the ducks", width: 0.12, x: 0.38, z: 0.12, delay: 0.4, call: "quack", note: 3, verb: "quack", radius: 0.08 });
    whit(d, { x: -0.3, z: 0.32, width: 0.255 });
    tabby(d, { x: -0.04, z: 0.4, width: 0.13 });
    return d;
  },

  "whit-park": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "park", { name: "park", label: "the park" });
    rain(d, { level: 0.9 });
    const brolly = figure(d, "umbrella", { width: 0.42, x: -0.1, y: 0.22, z: 0.1, delay: 0.3, name: "umbrella", label: "the umbrella", radius: 0.2, onTap: () => open() });
    const s = { open: 0 };
    const open = () => { s.open = 1; sfx(d, "flutter", 0, 0.4); d.ctx.sound.pop(1.0); };
    if (brolly) d.updaters.push((dt) => { s.open = Math.max(0, s.open - dt * 0.9); brolly.group.scale.setScalar(1 + Math.sin(s.open * Math.PI) * 0.15); });
    d.action("umbrella", "open", open);
    friend(d, "lady", { name: "lady", label: "the kind lady", width: 0.32, x: 0.3, z: -0.1, delay: 0.35, call: "giggle", note: 0, radius: 0.18 });
    steamy(d, "tea", { name: "tea", label: "the tea", x: 0.36, z: 0.3, width: 0.13, note: 6, radius: 0.1 });
    whit(d, { x: -0.26, z: 0.32, width: 0.255 });
    tabby(d, { x: 0.02, z: 0.42, width: 0.12 });
    return d;
  },

  "whit-tower": (ctx) => {
    const d = new Diorama(ctx);
    const keep = backCard(d, "tower", { name: "tower", label: "the tower" });
    d.action("tower", "loom", () => keep.bounce());
    friend(d, "raven", { name: "raven", label: "the ravens", width: 0.16, x: 0.36, y: 0.3, z: -0.3, delay: 0.4, call: "caw", note: 0, verb: "croak", radius: 0.1 });
    friend(d, "guard", { name: "guard", label: "the guard", width: 0.3, x: 0.24, z: -0.02, delay: 0.3, call: "thunk", note: 0, verb: "salute", radius: 0.16 });
    whit(d, { x: -0.28, z: 0.32, width: 0.255 });
    tabby(d, { x: -0.02, z: 0.42, width: 0.12 });
    return d;
  },

  "whit-kitchen": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "kitchen", { name: "kitchen", label: "the kitchen" });
    friend(d, "guard", { name: "guard", label: "the guard", width: 0.26, x: 0.38, z: -0.16, delay: 0.35, call: "thunk", note: 0, verb: "salute", radius: 0.14 });
    const mice = [mouse(d, { x: 0.02, z: 0.2, width: 0.09, dir: 1 }), mouse(d, { x: 0.22, z: 0.3, width: 0.09, dir: 1, name: "mouse2", delay: 0.5 }), mouse(d, { x: 0.12, z: 0.42, width: 0.08, dir: 1, name: "mouse3", delay: 0.55 })];
    d.onPounce = () => { ["mouse", "mouse2", "mouse3"].forEach((n, i) => setTimeout(() => { const e = d.objects[n]; if (e && e.actions.scurry) e.actions.scurry(); }, i * 150)); setTimeout(() => sfx(d, "cheer", 0, 0.4), 700); };
    whit(d, { x: -0.3, z: 0.32, width: 0.255 });
    tabby(d, { x: -0.16, z: 0.36, width: 0.2, leap: true });
    return d;
  },

  "whit-palace": (ctx) => {
    const d = new Diorama(ctx);
    const hall = backCard(d, "palace", { name: "palace", label: "the palace" });
    const glow = hall.glow(0.5, 0.6, 0xffe9b0, 1.0, 0.1);
    d.updaters.push((dt, t) => { glow.material.opacity = 0.1 + Math.sin(t * 1.5) * 0.03; });
    friend(d, "queen", { name: "queen", label: "the Queen", width: 0.36, x: 0.26, z: -0.12, delay: 0.3, call: "chime", note: 6, verb: "nod", radius: 0.2 });
    let gold = false;
    d.onSpin = () => { if (!gold) { gold = true; ctx.onMagic("gold"); } };
    coin(d, { x: -0.02, y: 0.14, z: 0.22, width: 0.12 });
    whit(d, { x: -0.3, z: 0.32, width: 0.255 });
    tabby(d, { x: 0.36, z: 0.34, width: 0.13 });
    return d;
  },

  "whit-hill": (ctx) => {
    const d = new Diorama(ctx);
    const view = backCard(d, "hill", { name: "city", label: "London" });
    let rung = false;
    shining(d, view, "bell", [0.38, 0.35, 0.24, 0.4], { label: "the bells of Bow", verb: "ring", color: 0xffe9a8, sparkle: true, note: 4, sound: () => { d.ctx.sound.bell(0, 0.6); setTimeout(() => d.ctx.sound.bell(2, 0.5), 320); setTimeout(() => d.ctx.sound.bell(4, 0.45), 640); }, onFirst: () => { if (!rung) { rung = true; ctx.onMagic("bell"); } } });
    d.action("city", "shine", () => view.bounce());
    whit(d, { x: -0.16, z: 0.32, width: 0.272 });
    tabby(d, { x: 0.2, z: 0.4, width: 0.13 });
    return d;
  },

  "whit-home": (ctx) => homeScene(ctx, { end: false }),
  end: (ctx) => homeScene(ctx, { end: true }),
};

function homeScene(ctx, { end }) {
  const d = new Diorama(ctx);
  const room = backCard(d, "home", { name: "city", label: "London" });
  shining(d, room, "lamp", [0.08, 0.3, 0.2, 0.4], { label: "the lamp", verb: "glow", color: 0xffd9a0, note: 4 });
  shining(d, room, "moon", [0.55, 0.62, 0.28, 0.3], { label: "the moon", verb: "rise", color: 0xfff6d0, sparkle: true, note: 8 });
  d.action("city", "shine", () => room.bounce());
  d.register("bell", new THREE.Group(), { label: "the bells", radius: 0.2, anchor: () => d.group.localToWorld(new THREE.Vector3(0.3, 0.5, -0.5)) });
  d.action("bell", "ring", () => { d.ctx.sound.bell(0, 0.5); setTimeout(() => d.ctx.sound.bell(2, 0.4), 320); });
  let said = false;
  d.onSleep = () => { if (!said) { said = true; ctx.onMagic("goodnight"); } };
  whit(d, { x: -0.14, z: 0.3, width: 0.289, pose: "sleep" });
  tabby(d, { x: 0.24, z: 0.36, width: 0.14 });
  if (end) setTimeout(() => ctx.onMagic("goodnight"), 2500);
  return d;
}

export default builders;

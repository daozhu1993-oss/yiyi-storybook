/* The spreads of "Lucía and the Tooth Mouse": a wobbly tooth in the Plaza Mayor, pop!, under the
   pillow, the mouse in the biscuit tin, across the Puerta del Sol, the cat on the wall, the little
   king, up the drainpipe, buenos días, and half a biscuit. The shared pop-up engine is in
   src/scenes.js; the Spanish words to keep live in story.json. Lucía, Bolita and Pérez are
   painted cut-outs. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, starField, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

/* ---------- Lucía, Bolita and Ratoncito Pérez ---------- */

function lucia(d, { x = -0.22, z = 0.3, width = 0.28, pose = "stand", delay = 0.3 } = {}) {
  const sound = d.ctx.sound;
  const stars = d.burst(0xfff0c0, 40, 0.02);
  const sleeping = pose === "sleep";
  const main = figure(d, sleeping ? "lucia-sleep" : "lucia-stand", { width: sleeping ? width * 1.25 : width, x, y: 0, z, delay, name: "lucia", label: "Lucía", radius: width * 0.5, onTap: () => wave() });
  if (!main) return null;
  const alt = sleeping ? null : figure(d, "lucia-wave", { width, x, y: 0, z: z - 0.002, delay, register: false });
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
  d.action("lucia", "wave", wave);
  d.action("lucia", "wiggle", () => { nod(); if (d.onWiggle) d.onWiggle(); });
  d.action("lucia", "nod", nod);
  d.action("lucia", "sleep", () => { main.bounce(); sound.chime(2, 0.25); setTimeout(() => sound.chime(0, 0.2), 260); if (d.onSleep) d.onSleep(); });
  return main;
}

function bolita(d, { x = 0.12, z = 0.34, width = 0.15, delay = 0.4 } = {}) {
  const card = figure(d, "bolita", { width, x, y: 0, z, delay, name: "dog", label: "Bolita", radius: 0.1, onTap: () => wag() });
  if (!card) return null;
  const s = { hop: 0 };
  const wag = () => { s.hop = 1; sfx(d, "boing", 2, 0.4); d.ctx.sound.chime(6, 0.2); };
  d.updaters.push((dt, t) => { s.hop = Math.max(0, s.hop - dt * 2); card.group.position.y = Math.sin(s.hop * Math.PI) * 0.06; card.group.rotation.z = Math.sin(s.hop * Math.PI * 3) * 0.15 * s.hop + Math.sin(t * 2.2) * 0.02; });
  d.action("dog", "wag", wag);
  d.action("dog", "sniff", wag);
  return card;
}

/** Pérez: a standing card that bows (swapping to the bowing card), or a running card that dashes. */
function perez(d, { x = 0.2, z = 0.3, width = 0.14, pose = "stand", delay = 0.4 } = {}) {
  const sound = d.ctx.sound;
  const running = pose === "run";
  const main = figure(d, running ? "perez-run" : "perez", { width, x, y: 0, z, delay, name: "mouse", label: "Ratoncito Pérez", radius: width * 0.6, onTap: () => (running ? dash() : bow()) });
  if (!main) return null;
  const alt = running ? null : figure(d, "perez-bow", { width, x, y: 0, z: z - 0.002, delay, register: false });
  if (alt) alt.group.visible = false;
  const s = { bow: 0, hop: 0, dash: 0 };
  const hop = () => { s.hop = 1; sound.pop(1.3); sound.chime(8, 0.2); };
  const bow = () => {
    if (!alt) { hop(); return; }
    s.bow = 1; main.group.visible = false; alt.group.visible = true; alt.bounce(); sound.chime(6, 0.3); setTimeout(() => sound.chime(8, 0.25), 160);
    if (d.onBow) d.onBow();
  };
  const dash = () => { if (s.dash > 0) return; s.dash = 1; sound.whoosh(false); sfx(d, "snap", 4, 0.3); };
  d.updaters.push((dt, t) => {
    if (s.bow > 0) { s.bow = Math.max(0, s.bow - dt * 0.7); if (s.bow === 0) { alt.group.visible = false; main.group.visible = true; } }
    s.hop = Math.max(0, s.hop - dt * 2);
    if (s.dash > 0) { s.dash = Math.max(0, s.dash - dt * 0.6); const p = 1 - s.dash; main.group.position.x = x + Math.sin(p * Math.PI * 2) * 0.28; }
    main.group.position.y = Math.sin(s.hop * Math.PI) * 0.05 + (running ? Math.abs(Math.sin(t * 6)) * 0.004 : 0);
  });
  d.action("mouse", "bow", bow);
  d.action("mouse", "tip", bow);
  d.action("mouse", "hop", hop);
  d.action("mouse", "run", dash);
  return main;
}

/* ---------- things that steam, rattle, spin, splash, flutter and bloom ---------- */

function steamy(d, id, { name, label = name, x, z, width, delay = 0.3, note = 4, radius = 0.12 } = {}) {
  const card = figure(d, id, { width, x, y: 0, z, delay, name, label, radius, onTap: () => steam() });
  if (!card) return null;
  const puffs = d.burst(0xfff6e8, 50, 0.04);
  const steam = () => { card.bounce(); const top = d.group.worldToLocal(card.worldPoint(0.5, 0.9, 0.04)); [0, 1, 2].forEach((i) => setTimeout(() => puffs.emit(top, 4, 0.06, 0.45), i * 180)); d.ctx.sound.puff(); d.ctx.sound.chime(note, 0.3); if (d.onSteam) d.onSteam(name); };
  d.action(name, "steam", steam);
  return card;
}

function wobbly(d, id, { name, label = name, x, z, width, delay = 0.35, radius = 0.1, verb = "wobble", y = 0 } = {}) {
  const card = figure(d, id, { width, x, y, z, delay, name, label, radius, onTap: () => wobble() });
  if (!card) return null;
  const s = { wobble: 0 };
  const wobble = () => { s.wobble = 1; sfx(d, "boing", 1, 0.35); if (d.onWobble) d.onWobble(name); };
  d.updaters.push((dt) => { s.wobble = Math.max(0, s.wobble - dt * 1.2); card.group.rotation.z = Math.sin(s.wobble * 16) * 0.2 * s.wobble; });
  d.action(name, verb, wobble);
  return card;
}

/** The biscuit tin: rattles, and its lid hops. */
function tin(d, { x = 0.3, z = 0.12, width = 0.22, delay = 0.35 } = {}) {
  const card = figure(d, "tin", { width, x, y: 0, z, delay, name: "tin", label: "the biscuit tin", radius: 0.14, onTap: () => rattle() });
  if (!card) return null;
  const s = { rattle: 0 };
  const rattle = () => { s.rattle = 1; sfx(d, "snap", 2, 0.35); setTimeout(() => sfx(d, "snap", 4, 0.3), 150); d.ctx.sound.chime(7, 0.2); if (d.onRattle) d.onRattle(); };
  d.updaters.push((dt) => { s.rattle = Math.max(0, s.rattle - dt * 1.4); card.group.position.x = x + Math.sin(s.rattle * 40) * 0.012 * s.rattle; card.group.position.y = Math.abs(Math.sin(s.rattle * 20)) * 0.02 * s.rattle; });
  d.action("tin", "rattle", rattle);
  return card;
}

function coin(d, { x = 0.1, y = 0.12, z = 0.24, width = 0.1, delay = 0.4 } = {}) {
  const card = figure(d, "coin", { width, x, y, z, delay, name: "coin", label: "la moneda", radius: 0.08, onTap: () => spin() });
  if (!card) return null;
  const glints = d.burst(0xfff2b0, 40, 0.018);
  const s = { spin: 0 };
  const spin = () => { if (s.spin > 0) return; s.spin = 1; sfx(d, "shimmer", 0.5); d.ctx.sound.chime(9, 0.3); glints.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.5, 0.04)), 8, 0.1, 0.5); if (d.onSpin) d.onSpin(); };
  d.updaters.push((dt, t) => { if (s.spin > 0) { s.spin = Math.max(0, s.spin - dt * 0.8); card.group.rotation.y = (1 - s.spin) * Math.PI * 4; card.group.position.y = y + Math.sin((1 - s.spin) * Math.PI) * 0.15; } else card.group.position.y = y + Math.sin(t * 1.6) * 0.008; });
  d.action("coin", "spin", spin);
  return card;
}

function flower(d, { x = -0.36, z = 0.16, width = 0.1 } = {}) {
  const card = figure(d, "flower", { width, x, y: 0, z, delay: 0.4, name: "flower", label: "la flor", radius: 0.08, onTap: () => bloom() });
  if (!card) return null;
  const s = { bloom: 0 };
  const bloom = () => { s.bloom = 1; splash(d, new THREE.Vector3(x, 0.12, z + 0.03), { color: 0xff8090, count: 12, size: 0.022, speed: 0.25, up: 0.7 }); d.ctx.sound.chime(8, 0.3); };
  d.updaters.push((dt) => { s.bloom = Math.max(0, s.bloom - dt * 0.8); card.group.scale.setScalar(1 + Math.sin(s.bloom * Math.PI) * 0.35); });
  d.action("flower", "bloom", bloom);
  return card;
}

function letter(d, { x = 0.02, y = 0.04, z = 0.26, width = 0.12, delay = 0.45 } = {}) {
  const card = figure(d, "letter", { width, x, y, z, delay, name: "letter", label: "la carta", radius: 0.08, onTap: () => flutter() });
  if (!card) return null;
  const s = { flutter: 0 };
  const flutter = () => { if (s.flutter > 0) return; s.flutter = 1; sfx(d, "rustle", 0, 0.5); d.ctx.sound.chime(6, 0.3); };
  d.updaters.push((dt, t) => { if (s.flutter > 0) { s.flutter = Math.max(0, s.flutter - dt * 0.9); const p = 1 - s.flutter; card.group.position.y = y + Math.sin(p * Math.PI) * 0.16; card.group.rotation.z = Math.sin(p * Math.PI * 4) * 0.3; } else card.group.rotation.z = Math.sin(t * 1.2) * 0.02; });
  d.action("letter", "flutter", flutter);
  return card;
}

/** A glowing spot on the backdrop that flares on cue. */
function shining(d, card, name, rect, { label, verb = "glow", color = 0xfff2c0, sparkle = false, note = 7, sound = null, onFirst = null } = {}) {
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
  "lucia-plaza": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "plaza", { name: "plaza", label: "la plaza" });
    let greeted = false, wiggled = false;
    d.onWave = () => { if (!greeted) { greeted = true; ctx.onMagic("hola"); } };
    d.onWiggle = () => { if (!wiggled) { wiggled = true; sfx(d, "boing", 5, 0.3); } };
    steamy(d, "churro", { name: "churro", label: "el churro", x: 0.12, z: 0.2, width: 0.14, note: 6 });
    lucia(d, { x: -0.22, z: 0.3 });
    bolita(d, { x: 0.36, z: 0.34 });
    return d;
  },

  "lucia-street": (ctx) => {
    const d = new Diorama(ctx);
    const street = backCard(d, "street", { name: "street", label: "la calle" });
    shining(d, street, "lamp", [0.7, 0.55, 0.16, 0.3], { label: "the lamp", color: 0xffd9a0, note: 4 });
    d.action("street", "glow", () => { street.bounce(); d.objects.lamp.onTap(); });
    let popped = false;
    const tooth = wobbly(d, "tooth", { name: "tooth", label: "el diente", x: -0.02, z: 0.28, width: 0.08, verb: "pop", radius: 0.07 });
    d.onWobble = (name) => { if (name === "tooth" && !popped) { popped = true; d.ctx.sound.pop(1.6); ctx.onMagic("diente"); } };
    tin(d, { x: 0.34, z: 0.1, width: 0.22 });
    lucia(d, { x: -0.28, z: 0.3, width: 0.272 });
    bolita(d, { x: 0.12, z: 0.42, width: 0.13 });
    return d;
  },

  "lucia-bedroom": (ctx) => {
    const d = new Diorama(ctx);
    const room = backCard(d, "bedroom", { name: "room", label: "la casa" });
    shining(d, room, "moon", [0.6, 0.6, 0.26, 0.3], { label: "la luna", verb: "glow", color: 0xfff6d0, sparkle: true, note: 8 });
    const pillow = figure(d, "pillow", { width: 0.34, x: 0.1, z: 0.12, delay: 0.3, name: "pillow", label: "la almohada", radius: 0.16, onTap: () => lift() });
    const s = { lift: 0 };
    const lift = () => { s.lift = 1; sfx(d, "rustle", 0, 0.4); d.ctx.sound.chime(5, 0.25); };
    if (pillow) d.updaters.push((dt) => { s.lift = Math.max(0, s.lift - dt * 0.9); pillow.group.rotation.x = -Math.sin(s.lift * Math.PI) * 0.35; pillow.group.position.y = Math.sin(s.lift * Math.PI) * 0.08; });
    d.action("pillow", "lift", lift);
    starField(d, [[-0.4, 0.9, -0.45], [0.46, 0.96, -0.5], [-0.1, 0.94, -0.5]].map((p) => new THREE.Vector3(...p)), { lit: true, delay: 0.3, size: 0.024 });
    lucia(d, { x: -0.28, z: 0.32, width: 0.289, pose: "sleep" });
    bolita(d, { x: 0.38, z: 0.36, width: 0.13 });
    return d;
  },

  "lucia-tin": (ctx) => {
    const d = new Diorama(ctx);
    const home = backCard(d, "tinhome", { name: "tin", label: "the biscuit tin" });
    d.action("tin", "rattle", () => { home.bounce(); sfx(d, "snap", 2, 0.3); });
    let shone = false;
    d.onSpin = () => { if (!shone) { shone = true; ctx.onMagic("moneda"); } };
    coin(d, { x: 0.22, y: 0.1, z: 0.2, width: 0.11 });
    perez(d, { x: -0.16, z: 0.28, width: 0.3 });
    return d;
  },

  "lucia-sol": (ctx) => {
    const d = new Diorama(ctx);
    const square = backCard(d, "sol", { name: "plaza", label: "la plaza" });
    shining(d, square, "fountain", [0.5, 0.15, 0.3, 0.35], { label: "la fuente", verb: "splash", color: 0xbfe0ff, note: 5, sound: () => { sfx(d, "splash", 0, 0.4); splash(d, new THREE.Vector3(0.14, 0.2, -0.45), { color: 0xbfe0ff, count: 14, size: 0.02, speed: 0.25, up: 0.6 }); } });
    shining(d, square, "bear", [0.1, 0.3, 0.3, 0.45], { label: "el oso y el árbol", verb: "wave", color: 0xffe0a0, note: 2, sound: () => { sfx(d, "howl", 2, 0.3); square.bounce(); } });
    shining(d, square, "star", [0.3, 0.8, 0.4, 0.18], { label: "las estrellas", verb: "twinkle", color: 0xfff6d0, sparkle: true, note: 10 });
    starField(d, [[-0.46, 0.92, -0.46], [0.44, 0.9, -0.48], [0.0, 0.98, -0.5]].map((p) => new THREE.Vector3(...p)), { lit: true, delay: 0.3, size: 0.026 });
    perez(d, { x: -0.1, z: 0.32, width: 0.2, pose: "run" });
    return d;
  },

  "lucia-wall": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "alley", { name: "sky", label: "la noche" });
    const cat = figure(d, "gato", { width: 0.3, x: 0.22, y: 0.14, z: -0.12, delay: 0.3, name: "cat", label: "el gato", radius: 0.16, onTap: () => blink() });
    const s = { blink: 0 };
    const blink = () => { s.blink = 1; sfx(d, "giggle", 0, 0.3); d.ctx.sound.chime(1, 0.25); };
    if (cat) d.updaters.push((dt, t) => { s.blink = Math.max(0, s.blink - dt * 1.4); cat.group.rotation.z = Math.sin(s.blink * Math.PI * 2) * 0.08 * s.blink + Math.sin(t * 0.8) * 0.01; });
    d.action("cat", "blink", blink);
    let bowed = false;
    d.onBow = () => { if (!bowed) { bowed = true; setTimeout(blink, 500); ctx.onMagic("buenasnoches"); } };
    perez(d, { x: -0.22, z: 0.3, width: 0.24 });
    return d;
  },

  "lucia-palace": (ctx) => {
    const d = new Diorama(ctx);
    const palace = backCard(d, "palace", { name: "palace", label: "el palacio" });
    shining(d, palace, "windows", [0.2, 0.35, 0.6, 0.35], { label: "el palacio", verb: "glow", color: 0xffe9b0, sparkle: true, note: 6 });
    d.action("palace", "glow", () => d.objects.windows.onTap());
    friend(d, "king", { name: "king", label: "el rey", width: 0.3, x: 0.26, z: -0.06, delay: 0.3, call: "giggle", note: 3, verb: "wave", radius: 0.16 });
    flower(d, { x: 0.02, z: 0.24, width: 0.1 });
    perez(d, { x: -0.26, z: 0.3, width: 0.22 });
    return d;
  },

  "lucia-window": (ctx) => {
    const d = new Diorama(ctx);
    const house = backCard(d, "window", { name: "house", label: "la casa" });
    shining(d, house, "window", [0.55, 0.45, 0.3, 0.4], { label: "the window", verb: "glow", color: 0xffe0a0, note: 5 });
    d.action("house", "glow", () => d.objects.window.onTap());
    d.hotspot(house, "garden", [0.0, 0.05, 0.45, 0.45], { label: "el jardín", onTap: () => { house.bounce(); sfx(d, "rustle", 0, 0.4); } });
    d.action("garden", "rustle", () => d.objects.garden.onTap());
    let shone = false;
    d.onSpin = () => { if (!shone) { shone = true; ctx.onMagic("moneda"); } };
    coin(d, { x: 0.28, y: 0.1, z: 0.26, width: 0.1 });
    letter(d, { x: 0.1, y: 0.04, z: 0.3, width: 0.12 });
    bolita(d, { x: -0.34, z: 0.36, width: 0.14 });
    perez(d, { x: -0.06, z: 0.24, width: 0.18, pose: "run" });
    return d;
  },

  "lucia-morning": (ctx) => {
    const d = new Diorama(ctx);
    const kitchen = backCard(d, "morning", { name: "kitchen", label: "la casa" });
    shining(d, kitchen, "sun", [0.62, 0.62, 0.3, 0.3], { label: "el sol", verb: "shine", color: 0xfff0b0, sparkle: true, note: 9 });
    steamy(d, "leche", { name: "milk", label: "la leche", x: 0.12, z: 0.22, width: 0.09, note: 5, radius: 0.08 });
    steamy(d, "pan", { name: "bread", label: "el pan", x: 0.28, z: 0.16, width: 0.14, note: 4, radius: 0.1 });
    wobbly(d, "queso", { name: "cheese", label: "el queso", x: 0.42, z: 0.3, width: 0.12 });
    letter(d, { x: -0.04, y: 0.04, z: 0.34, width: 0.11 });
    let thanked = false;
    d.onWave = () => { if (!thanked) { thanked = true; ctx.onMagic("gracias"); } };
    lucia(d, { x: -0.28, z: 0.3, width: 0.272 });
    return d;
  },

  "lucia-bakery": (ctx) => bakeryScene(ctx, { end: false }),
  end: (ctx) => bakeryScene(ctx, { end: true }),
};

function bakeryScene(ctx, { end }) {
  const d = new Diorama(ctx);
  const door = backCard(d, "bakery", { name: "street", label: "la calle" });
  d.action("street", "glow", () => door.bounce());
  let thanked = false;
  d.onRattle = () => { if (!thanked) { thanked = true; setTimeout(() => ctx.onMagic("gracias"), 400); } };
  tin(d, { x: 0.3, z: 0.14, width: 0.22 });
  wobbly(d, "galleta", { name: "biscuit", label: "la galleta", x: 0.06, z: 0.3, width: 0.1, radius: 0.08 });
  perez(d, { x: 0.42, z: 0.36, width: 0.13 });
  if (end) {
    d.onSleep = () => ctx.onMagic("gracias");
    lucia(d, { x: -0.24, z: 0.3, width: 0.289, pose: "sleep" });
    setTimeout(() => ctx.onMagic("gracias"), 2500);
  } else lucia(d, { x: -0.26, z: 0.3, width: 0.272 });
  bolita(d, { x: -0.44, z: 0.4, width: 0.12 });
  return d;
}

export default builders;

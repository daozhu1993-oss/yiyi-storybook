/* The spreads of "Colette and the Paris Postcard": a postcard under the door, the magic word
   at the bakery, the market, the river, the lady who smiles, the garden of little boats, the
   métro, rain on Montmartre, the tower that sparkles, and the words that go home to Mamie. The
   shared pop-up engine is in src/scenes.js; the French words live in story.json. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, starField, makeFall, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/* ---------- Colette and Gaston ---------- */

function standingColette(d, position, options = {}) {
  const c = standingHero(d, position, { scale: 0.48, name: "colette", label: "Colette", ...options });
  const sound = d.ctx.sound;
  const hearts = d.burst(0xff8fa8, 30, 0.026);
  const stars = d.burst(0xfff0c0, 40, 0.02);
  const head = () => d.group.worldToLocal(c.hero.head ? c.hero.head.getWorldPosition(_v) : c.group.localToWorld(new THREE.Vector3(0, 0.5, 0)));
  const s = { nod: 0, squeeze: 0 };
  d.action("colette", "nod", () => { s.nod = 1; c.spring.kick(0, 0.3, 0); sound.chime(5, 0.3); });
  d.action("colette", "smile", () => { c.hero.look(); c.spring.kick(0, 0.35, 0); stars.emit(head().add(new THREE.Vector3(0, 0.05, 0.08)), 10, 0.18, 0.6); sound.chime(7, 0.35); setTimeout(() => sound.chime(9, 0.25), 200); if (d.onSmile) d.onSmile(); });
  d.action("colette", "squeeze", () => { s.squeeze = 1; c.state.shake = 1; sound.click(); sound.puff(); });
  d.action("colette", "hug", () => { c.hero.jump(); c.spring.kick(0, 1.0, 0); hearts.emit(head().add(new THREE.Vector3(0, 0.1, 0.05)), 12, 0.2, 0.7); sound.chime(6, 0.4); setTimeout(() => sound.chime(8, 0.3), 200); if (d.onHug) d.onHug(); });
  d.updaters.push((dt) => {
    if (s.nod > 0) { s.nod = Math.max(0, s.nod - dt * 1.2); c.group.rotation.x = Math.sin(s.nod * Math.PI * 2) * 0.18 * s.nod; }
    if (s.squeeze > 0) { s.squeeze = Math.max(0, s.squeeze - dt); c.group.scale.x = c.group.scale.y * (1 - Math.sin(s.squeeze * Math.PI) * 0.25); }
  });
  return c;
}

/** Gaston the pigeon: a card that hops, flies a little loop and comes back. */
function gaston(d, { x = 0.3, y = 0, z = 0.1, width = 0.13, delay = 0.35, name = "pigeon" } = {}) {
  const card = figure(d, "gaston", { width, x, y, z, delay, name, label: "Gaston", radius: 0.1, onTap: () => fly() });
  if (!card) return null;
  const s = { fly: 0, hop: 0 };
  const fly = () => { if (s.fly > 0) return; s.fly = 1; sfx(d, "flutter", 0, 0.5); setTimeout(() => sfx(d, "flutter", 0, 0.3), 500); };
  d.updaters.push((dt, t) => {
    if (s.fly > 0) {
      s.fly = Math.max(0, s.fly - dt * 0.55);
      const p = 1 - s.fly;
      card.group.position.set(x + Math.sin(p * Math.PI * 2) * 0.22, y + Math.sin(p * Math.PI) * 0.35, z);
      card.group.rotation.z = Math.sin(p * Math.PI * 2) * 0.4;
    } else {
      s.hop = Math.max(0, s.hop - dt * 2);
      card.group.position.set(x, y + Math.sin(s.hop * Math.PI) * 0.05, z);
      card.group.rotation.z = Math.sin(t * 2.4) * 0.03;
    }
  });
  d.action(name, "fly", fly);
  d.action(name, "hop", () => { s.hop = 1; d.ctx.sound.pop(1.2); });
  return { card, fly };
}

/* ---------- the postcard ---------- */

function postcard(d, { x = -0.1, z = 0.2, width = 0.3, delay = 0.25, onFlip = null } = {}) {
  const card = figure(d, "postcard", { width, x, y: 0, z, delay, name: "postcard", label: "the postcard", radius: 0.18, onTap: () => flip() });
  if (!card) return null;
  const s = { flip: 0, turns: 0 };
  const flip = () => { if (s.flip > 0) return; s.flip = 1; sfx(d, "rustle", 0, 0.5); d.ctx.sound.chime(5, 0.3); if (onFlip) onFlip(); };
  d.updaters.push((dt, t) => {
    if (s.flip > 0) { s.flip = Math.max(0, s.flip - dt * 1.1); card.group.rotation.y = (1 - s.flip) * Math.PI * 2; card.group.position.y = Math.sin((1 - s.flip) * Math.PI) * 0.12; }
    else card.group.rotation.z = Math.sin(t * 0.9) * 0.01;
  });
  d.action("postcard", "flip", flip);
  return card;
}

/* ---------- things that steam, roll, wobble, sail and bloom ---------- */

function steamy(d, id, { name, label = name, x, z, width, delay = 0.3, note = 4, radius = 0.14 } = {}) {
  const card = figure(d, id, { width, x, y: 0, z, delay, name, label, radius, onTap: () => steam() });
  if (!card) return null;
  const puffs = d.burst(0xfff6e8, 50, 0.04);
  const steam = () => { card.bounce(); const top = d.group.worldToLocal(card.worldPoint(0.5, 0.9, 0.04)); [0, 1, 2].forEach((i) => setTimeout(() => puffs.emit(top, 4, 0.06, 0.45), i * 180)); d.ctx.sound.puff(); d.ctx.sound.chime(note, 0.3); };
  d.action(name, "steam", steam);
  return card;
}

function apple(d, { x = -0.12, z = 0.22, width = 0.12 } = {}) {
  const card = figure(d, "apple", { width, x, y: 0, z, delay: 0.35, name: "apple", label: "apple", radius: 0.1, onTap: () => roll() });
  if (!card) return null;
  const s = { roll: 0, dir: 1 };
  const roll = () => { if (s.roll > 0) return; s.roll = 1; s.dir *= -1; d.ctx.sound.pop(1.0); };
  d.updaters.push((dt) => { if (s.roll > 0) { s.roll = Math.max(0, s.roll - dt * 0.9); const p = 1 - s.roll; card.group.position.x = x + Math.sin(p * Math.PI) * 0.18 * s.dir; card.group.rotation.z = -p * Math.PI * 2 * s.dir; } });
  d.action("apple", "roll", roll);
  return card;
}

function cheese(d, { x = 0.3, z = 0.1, width = 0.2 } = {}) {
  const card = figure(d, "cheese", { width, x, y: 0, z, delay: 0.35, name: "cheese", label: "cheese", radius: 0.12, onTap: () => wobble() });
  if (!card) return null;
  const s = { wobble: 0 };
  const smell = d.burst(0xd8e8a0, 30, 0.03);
  const wobble = () => { s.wobble = 1; smell.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.9, 0.04)), 6, 0.08, 0.4); sfx(d, "boing", 1, 0.35); };
  d.updaters.push((dt) => { s.wobble = Math.max(0, s.wobble - dt * 1.2); card.group.rotation.z = Math.sin(s.wobble * 16) * 0.2 * s.wobble; });
  d.action("cheese", "wobble", wobble);
  return card;
}

function boat(d, id, { name = "boat", label = "boat", x = 0.1, z = -0.2, width = 0.4, y = 0, delay = 0.3, span = 0.45 } = {}) {
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

function flower(d, { x = -0.3, z = 0.16, width = 0.12 } = {}) {
  const card = figure(d, "flower", { width, x, y: 0, z, delay: 0.4, name: "flower", label: "flower", radius: 0.1, onTap: () => bloom() });
  if (!card) return null;
  const s = { bloom: 0 };
  const bloom = () => { s.bloom = 1; splash(d, new THREE.Vector3(x, 0.12, z + 0.03), { color: 0xffb0c8, count: 12, size: 0.022, speed: 0.25, up: 0.7 }); d.ctx.sound.chime(8, 0.3); };
  d.updaters.push((dt) => { s.bloom = Math.max(0, s.bloom - dt * 0.8); card.group.scale.setScalar(1 + Math.sin(s.bloom * Math.PI) * 0.35); });
  d.action("flower", "bloom", bloom);
  return card;
}

/** A painting in a frame with a glow: the lady who smiles. */
function painting(d, { x = 0.02, y = 0.34, z = -0.4, width = 0.3 } = {}) {
  const card = figure(d, "painting", { width, x, y, z, delay: 0.3, name: "painting", label: "the painting", radius: 0.18, onTap: () => glow() });
  if (!card) return null;
  const halo = card.glow(0.5, 0.5, 0xffe9b0, width * 2.2, 0.15);
  halo.position.z = -0.01;
  const s = { pulse: 0 };
  const glow = () => { s.pulse = 1; card.bounce(); sfx(d, "shimmer", 0.4); d.ctx.sound.chime(7, 0.3); };
  d.updaters.push((dt, t) => { s.pulse = Math.max(0, s.pulse - dt * 0.8); halo.material.opacity = 0.15 + s.pulse * 0.4 + Math.sin(t * 1.5) * 0.03; });
  d.action("painting", "glow", glow);
  return card;
}

/** Rain over the page; swipes blow it. */
function rain(d, { level = 0.8 } = {}) {
  const fall = makeFall(d, { count: 220, color: 0xdff4ff, size: 0.016, speed: 0.55, sway: 0.02, level, box: [1.4, 1.2, 1.0], center: [0, 0.6, -0.05] });
  d.register("rain", new THREE.Group(), { label: "rain", radius: 0.4, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.8, -0.1)) });
  d.action("rain", "fall", () => { fall.set(Math.min(1.8, fall.level + 0.5)); sfx(d, "rain", 0, 0.5); });
  swipeOn(d, "sky", (dx) => { fall.blow(dx * 8); fall.set(Math.min(1.8, fall.level + Math.abs(dx) * 3)); }, { onEnd: () => sfx(d, "rain", 0, 0.4) });
  return fall;
}

/** The tower in the backdrop sparkles: a shower of white glints over its rect plus a glow. */
function sparklingTower(d, card, rect, { onSparkle = null } = {}) {
  const glints = d.burst(0xffffff, 160, 0.016);
  const glow = card.glow(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 0xfff2c0, Math.max(rect[2] * card.width, rect[3] * card.height) * 1.1, 0.1);
  const s = { on: 0 };
  let first = true;
  const sparkle = () => {
    s.on = 1;
    sfx(d, "shimmer", 0.6);
    d.ctx.sound.sparkle();
    for (let i = 0; i < 14; i++) setTimeout(() => { for (let k = 0; k < 4; k++) { const u = rect[0] + Math.random() * rect[2], v = rect[1] + Math.random() * rect[3]; glints.emit(d.group.worldToLocal(card.worldPoint(u, v, 0.03)), 1, 0.02, 0.15); } }, i * 120);
    if (first && onSparkle) { first = false; onSparkle(); }
  };
  d.hotspot(card, "tower", rect, { label: "the Eiffel Tower", glow: 0xfff2c0, onTap: sparkle });
  d.updaters.push((dt, t) => { s.on = Math.max(0, s.on - dt * 0.25); glow.material.opacity = 0.1 + s.on * 0.4 + Math.sin(t * 9) * 0.05 * s.on; });
  d.action("tower", "sparkle", sparkle);
  return sparkle;
}

/* ---------- pages ---------- */

const builders = {
  "colette-postcard": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "attic");
    let flipped = false;
    postcard(d, { x: -0.14, z: 0.2, width: 0.3, onFlip: () => { if (!flipped) { flipped = true; ctx.onMagic("bonjour"); } } });
    gaston(d, { x: 0.36, z: -0.1, width: 0.13 });
    standingColette(d, new THREE.Vector3(0.14, 0, 0.3), { faces: -1 });
    return d;
  },

  "colette-bakery": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "bakery");
    const baker = friend(d, "baker", { name: "baker", label: "the baker", width: 0.34, x: 0.26, z: -0.2, delay: 0.3, call: "giggle", note: 0, verb: "smile", radius: 0.2 });
    let warm = false;
    steamy(d, "croissant", { name: "croissant", label: "croissant", x: -0.06, z: 0.14, width: 0.18, note: 6 });
    const steam = d.objects.croissant && d.objects.croissant.actions.steam;
    if (steam) d.action("croissant", "steam", () => { steam(); if (!warm) { warm = true; ctx.onMagic("croissant"); } });
    steamy(d, "bread", { name: "bread", label: "bread", x: 0.42, z: 0.06, width: 0.16, note: 3 });
    standingColette(d, new THREE.Vector3(-0.28, 0, 0.3), { faces: 1 });
    return d;
  },

  "colette-market": (ctx) => {
    const d = new Diorama(ctx);
    const market = backCard(d, "market", { name: "market", label: "the market" });
    d.action("market", "bustle", () => { market.bounce(); sfx(d, "cheer", 0, 0.35); });
    friend(d, "market-woman", { name: "woman", label: "the market woman", width: 0.32, x: 0.3, z: -0.18, delay: 0.3, call: "chime", note: 5, radius: 0.18 });
    apple(d, { x: -0.1, z: 0.2, width: 0.12 });
    cheese(d, { x: 0.36, z: 0.14, width: 0.2 });
    gaston(d, { x: 0.12, z: 0.36, width: 0.11 });
    standingColette(d, new THREE.Vector3(-0.3, 0, 0.3), { faces: 1 });
    return d;
  },

  "colette-river": (ctx) => {
    const d = new Diorama(ctx);
    const quay = backCard(d, "river");
    d.hotspot(quay, "bridge", [0.15, 0.3, 0.7, 0.25], { label: "the bridge", onTap: () => { splash(d, new THREE.Vector3(0.1, 0.25, -0.45), { color: 0xfff0c0, count: 10, size: 0.02, speed: 0.2, up: 0.5 }); d.ctx.sound.chime(4, 0.3); } });
    d.action("bridge", "wave", () => d.objects.bridge.onTap());
    boat(d, "boat", { name: "boat", label: "boat", x: 0.02, z: -0.16, width: 0.44, span: 0.4 });
    const g = gaston(d, { x: 0.4, y: 0.34, z: -0.3, width: 0.13 });
    standingColette(d, new THREE.Vector3(-0.28, 0, 0.3), { faces: 1 });
    return d;
  },

  "colette-museum": (ctx) => {
    const d = new Diorama(ctx);
    const hall = backCard(d, "museum", { name: "museum", label: "the museum" });
    const s = { hush: 0 };
    d.updaters.push((dt) => { s.hush = Math.max(0, s.hush - dt * 0.4); hall.material.color.setScalar(1 - s.hush * 0.2); });
    d.action("museum", "hush", () => { s.hush = 1; d.ctx.sound.puff(); d.ctx.sound.chime(0, 0.2); });
    painting(d, { x: 0.02, y: 0.36, z: -0.42, width: 0.3 });
    friend(d, "guard", { name: "guard", label: "the guard", width: 0.28, x: 0.36, z: -0.16, delay: 0.35, call: "giggle", note: 0, radius: 0.16 });
    let smiled = false;
    d.onSmile = () => { if (!smiled) { smiled = true; ctx.onMagic("smile"); } };
    const c = standingColette(d, new THREE.Vector3(-0.22, 0, 0.3), { faces: 1 });
    c.state.lookAt = () => d.group.localToWorld(new THREE.Vector3(0.02, 0.4, -0.42));
    return d;
  },

  "colette-garden": (ctx) => {
    const d = new Diorama(ctx);
    const garden = backCard(d, "garden", { name: "garden", label: "the garden" });
    d.action("garden", "bloom", () => { garden.bounce(); splash(d, new THREE.Vector3(-0.2, 0.3, -0.4), { color: 0xffc0d8, count: 20, size: 0.024, speed: 0.3, up: 0.8 }); d.ctx.sound.chime(6, 0.3); });
    boat(d, "sailboat", { name: "sailboat", label: "a little boat", x: 0.06, z: -0.12, width: 0.16, span: 0.3 });
    friend(d, "cat", { name: "cat", label: "the cat", width: 0.24, x: 0.36, z: -0.02, delay: 0.35, call: "chime", note: 1, verb: "purr", radius: 0.14 });
    flower(d, { x: -0.36, z: 0.14, width: 0.12 });
    standingColette(d, new THREE.Vector3(-0.14, 0, 0.32), { faces: 1 });
    return d;
  },

  "colette-metro": (ctx) => {
    const d = new Diorama(ctx);
    const station = backCard(d, "metro");
    const s = { rumble: 0 };
    d.hotspot(station, "train", [0.0, 0.35, 0.75, 0.4], { label: "the métro", onTap: () => { s.rumble = 1; d.ctx.sound.whoosh(true); sfx(d, "thunder", 0, 0.25); } });
    d.action("train", "rumble", () => d.objects.train.onTap());
    d.updaters.push((dt) => { s.rumble = Math.max(0, s.rumble - dt * 0.8); station.group.position.x = Math.sin(s.rumble * 40) * 0.01 * s.rumble; });
    const notes = d.burst(0xffd97a, 30, 0.022);
    const man = friend(d, "accordion-man", { name: "accordion", label: "the accordion", width: 0.3, x: 0.32, z: -0.16, delay: 0.35, call: "chime", note: 4, radius: 0.18, onTap: () => { [0, 1, 2, 3].forEach((i) => setTimeout(() => { d.ctx.sound.chime([4, 6, 7, 9][i], 0.3); notes.emit(new THREE.Vector3(0.3, 0.4, -0.12), 2, 0.12, 0.6); }, i * 220)); } });
    if (man) d.action("accordion", "play", () => d.objects.accordion.onTap());
    gaston(d, { x: -0.36, y: 0.5, z: 0.28, width: 0.1 });
    standingColette(d, new THREE.Vector3(-0.22, 0, 0.3), { faces: 1 });
    return d;
  },

  "colette-montmartre": (ctx) => {
    const d = new Diorama(ctx);
    const hill = backCard(d, "montmartre", { name: "city", label: "Paris" });
    const shine = hill.glow(0.5, 0.75, 0xfff0c0, 1.3, 0);
    const s = { shine: 0 };
    d.updaters.push((dt, t) => { s.shine = Math.max(0, s.shine - dt * 0.4); shine.material.opacity = s.shine * (0.3 + Math.sin(t * 3) * 0.05); });
    d.action("city", "shine", () => { s.shine = 1; hill.bounce(); sfx(d, "shimmer", 0.5); });
    let rained = false;
    const fall = rain(d, { level: 0.7 });
    const fallAction = d.objects.rain.actions.fall;
    d.action("rain", "fall", () => { fallAction(); if (!rained) { rained = true; } });
    const painter = friend(d, "painter", { name: "umbrella", label: "the painter's umbrella", width: 0.38, x: 0.28, z: -0.16, delay: 0.3, call: "giggle", note: 0, radius: 0.22 });
    if (painter) d.action("umbrella", "open", () => { painter.bounce(); painter.lift(true); setTimeout(() => painter.lift(false), 800); sfx(d, "flutter", 0, 0.4); });
    standingColette(d, new THREE.Vector3(-0.22, 0, 0.3), { faces: 1 });
    return d;
  },

  "colette-tower": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "tower");
    const s = { dim: 0 };
    d.updaters.push((dt) => { s.dim = Math.max(0, s.dim - dt * 0.5); sky.material.color.setScalar(1 - s.dim * 0.2); });
    d.action("sky", "night", () => { s.dim = 1; sky.bounce(); d.ctx.sound.chime(0, 0.25); });
    let sparkled = false;
    sparklingTower(d, sky, [0.32, 0.05, 0.36, 0.75], { onSparkle: () => { if (!sparkled) { sparkled = true; ctx.onMagic("sparkle"); } } });
    starField(d, [[-0.48, 0.92, -0.45], [-0.3, 0.98, -0.5], [-0.1, 0.9, -0.5], [0.42, 0.95, -0.48], [0.5, 0.8, -0.46]].map((p) => new THREE.Vector3(...p)), { lit: true, delay: 0.3, size: 0.03 });
    gaston(d, { x: 0.36, z: 0.14, width: 0.12 });
    const c = standingColette(d, new THREE.Vector3(-0.2, 0, 0.3), { faces: 1 });
    c.state.lookAt = () => d.group.localToWorld(new THREE.Vector3(0.1, 0.6, -0.5));
    return d;
  },

  "colette-home": (ctx) => homeScene(ctx, { end: false }),
  end: (ctx) => homeScene(ctx, { end: true }),
};

function homeScene(ctx, { end }) {
  const d = new Diorama(ctx);
  const room = backCard(d, "home", { name: "house", label: "home" });
  const lamp = room.glow(0.25, 0.45, 0xffd9a0, 0.8, 0.15);
  const s = { warm: 0 };
  d.updaters.push((dt, t) => { s.warm = Math.max(0, s.warm - dt * 0.35); lamp.material.opacity = 0.15 + s.warm * 0.35 + Math.sin(t * 2) * 0.03; });
  d.action("house", "glow", () => { s.warm = 1; room.bounce(); sfx(d, "shimmer", 0.4); d.ctx.sound.chime(4, 0.3); });
  sparklingTower(d, room, [0.68, 0.1, 0.26, 0.45]);
  postcard(d, { x: -0.16, z: 0.16, width: 0.3 });
  gaston(d, { x: 0.36, z: 0.02, width: 0.13 });
  let hugged = false;
  d.onHug = () => { if (!hugged) { hugged = true; ctx.onMagic("jetaime"); } };
  standingColette(d, new THREE.Vector3(0.1, 0, 0.32), { faces: -1, pose: end ? "sleep" : "stand" });
  if (end) setTimeout(() => ctx.onMagic("jetaime"), 2500);
  return d;
}

export default builders;

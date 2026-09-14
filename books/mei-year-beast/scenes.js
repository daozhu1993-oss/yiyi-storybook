/* The spreads of "Mei and the Year Beast": a snowy village, the beast called Nian, the old
   traveler, red, light, noise, the longest night, the morning after, the feast, and the plum
   branch. The shared pop-up engine is in src/scenes.js; the Chinese words live in story.json. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, starField, makeFall, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/* ---------- Mei ---------- */

function standingMei(d, position, options = {}) {
  const m = standingHero(d, position, { scale: 0.46, name: "mei", label: "Mei", ...options });
  const sound = d.ctx.sound;
  const confetti = d.burst(0xff5a4a, 60, 0.024);
  const gold = d.burst(0xffd97a, 40, 0.02);
  const head = () => d.group.worldToLocal(m.hero.head ? m.hero.head.getWorldPosition(_v) : m.group.localToWorld(new THREE.Vector3(0, 0.5, 0)));
  d.action("mei", "brave", () => { m.hero.jump(); m.spring.kick(0, 1.2, 0); m.state.shake = 1; sfx(d, "drum", 0, 0.6); sound.chime(7, 0.4); if (d.onBrave) d.onBrave(); });
  d.action("mei", "cheer", () => { m.hero.jump(); m.spring.kick(0, 1.4, 0); confetti.emit(head().add(new THREE.Vector3(0, 0.15, 0.05)), 18, 0.35, 0.9); gold.emit(head().add(new THREE.Vector3(0, 0.15, 0.05)), 10, 0.3, 0.8); sfx(d, "cheer", 0, 0.5); sound.chime(9, 0.35); if (d.onCheer) d.onCheer(); });
  return m;
}

/* ---------- the Nian ---------- */

/** The beast: it roars (a shake and a howl), it flees (runs off the page and shrinks). */
function nian(d, { x = 0.3, z = -0.22, width = 0.5, delay = 0.3, peek = false, onFlee = null } = {}) {
  const card = figure(d, "nian", { width, x, y: 0, z, delay, name: "nian", label: "Nian", radius: width * 0.5, onTap: () => roar() });
  if (!card) return null;
  const s = { roar: 0, flee: 0, gone: false, peek: peek ? 1 : 0 };
  const dust = d.burst(0xd8ccb8, 50, 0.035);
  const roar = () => { if (s.gone) return; s.roar = 1; sfx(d, "howl", 0, 0.6); d.ctx.sound.chime(0, 0.3); };
  const flee = () => {
    if (s.gone || s.flee > 0) return;
    s.flee = 1; sfx(d, "howl", 1, 0.4); d.ctx.sound.whoosh(true);
    [0, 1, 2, 3].forEach((i) => setTimeout(() => dust.emit(new THREE.Vector3(x + i * 0.05, 0.03, z + 0.05), 5, 0.15, 0.4), i * 150));
    if (onFlee) setTimeout(onFlee, 900);
  };
  d.updaters.push((dt, t) => {
    s.roar = Math.max(0, s.roar - dt * 1.2);
    if (s.flee > 0) {
      s.flee = Math.max(0, s.flee - dt * 0.7);
      const p = 1 - s.flee;
      card.group.position.set(x + p * 0.5, Math.abs(Math.sin(p * Math.PI * 4)) * 0.05, z - p * 0.25);
      card.group.scale.setScalar(Math.max(0.05, 1 - p * 0.95));
      if (s.flee === 0) { s.gone = true; card.group.visible = false; }
      return;
    }
    const peekY = s.peek ? -card.height * 0.45 : 0;
    card.group.position.set(x + Math.sin(s.roar * 30) * 0.02 * s.roar, peekY + Math.sin(t * 1.3) * 0.006, z);
    card.group.rotation.z = Math.sin(s.roar * 24) * 0.08 * s.roar;
    card.group.scale.setScalar(1 + s.roar * 0.08);
  });
  d.action("nian", "roar", roar);
  d.action("nian", "flee", flee);
  return { card, roar, flee };
}

/* ---------- red, light and noise ---------- */

function lanterns(d, { x = 0.06, y = 0.42, z = -0.4, width = 0.7, delay = 0.3, lit = 0.4 } = {}) {
  const card = figure(d, "lanterns", { width, x, y, z, delay, name: "lanterns", label: "lanterns", radius: 0.3, onTap: () => light() });
  if (!card) return null;
  const glow = card.glow(0.5, 0.5, 0xff8a5a, width * 1.2, lit * 0.3);
  glow.position.z = -0.01;
  const lamp = new THREE.PointLight(0xff9a60, lit, 1.6, 1.6);
  lamp.position.copy(card.point(0.5, 0.5, 0.15));
  card.group.add(lamp);
  const s = { lit, target: lit };
  const light = () => { s.target = Math.min(1, s.target + 0.3); card.bounce(); sfx(d, "shimmer", 0.4); d.ctx.sound.chime(6, 0.3); };
  d.updaters.push((dt, t) => { s.lit = lerp(s.lit, s.target, Math.min(1, dt * 2)); glow.material.opacity = s.lit * (0.35 + Math.sin(t * 2.5) * 0.05); lamp.intensity = s.lit * 1.4; card.group.rotation.z = Math.sin(t * 0.9) * 0.015; });
  d.action("lanterns", "light", light);
  return card;
}

function bonfire(d, { x = 0.02, z = -0.02, width = 0.3, delay = 0.3, name = "fire" } = {}) {
  const card = figure(d, "bonfire", { width, x, y: 0, z, delay, name, label: "fire", radius: 0.18, onTap: () => blaze() });
  if (!card) return null;
  const glow = card.glow(0.5, 0.45, 0xffa040, width * 2.4, 0.3);
  glow.position.z = -0.01;
  const lamp = new THREE.PointLight(0xffa050, 1.2, 1.8, 1.6);
  lamp.position.copy(card.point(0.5, 0.5, 0.15));
  card.group.add(lamp);
  const sparks = d.burst(0xffd27a, 70, 0.018);
  const s = { blaze: 0 };
  const blaze = () => { s.blaze = 1; card.bounce(); sfx(d, "fizz", 0, 0.4); [0, 1, 2].forEach((i) => setTimeout(() => sparks.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.8, 0.04)), 8, 0.2, 0.9), i * 150)); };
  d.updaters.push((dt, t) => { s.blaze = Math.max(0, s.blaze - dt * 0.6); const f = 0.3 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.03; glow.material.opacity = f + s.blaze * 0.4; lamp.intensity = 1.0 + f + s.blaze * 1.5; card.group.scale.setScalar(1 + s.blaze * 0.12); });
  d.every(1.4, () => sparks.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.8, 0.04)), 2, 0.1, 0.6));
  d.action(name, "blaze", blaze);
  return { card, blaze, sparks };
}

function candles(d, { x = -0.34, y = 0.24, z = -0.36, width = 0.22 } = {}) {
  const card = figure(d, "candles", { width, x, y, z, delay: 0.35, name: "candles", label: "candles", radius: 0.14, onTap: () => light() });
  if (!card) return null;
  const glow = card.glow(0.5, 0.5, 0xffe0a0, width * 2, 0.2);
  glow.position.z = -0.01;
  const s = { lit: 0.2, target: 0.2 };
  const light = () => { s.target = Math.min(1, s.target + 0.4); card.bounce(); d.ctx.sound.chime(8, 0.3); sfx(d, "shimmer", 0.3); };
  d.updaters.push((dt, t) => { s.lit = lerp(s.lit, s.target, Math.min(1, dt * 2)); glow.material.opacity = s.lit * (0.45 + Math.sin(t * 6) * 0.06); });
  d.action("candles", "light", light);
  return card;
}

function firecrackers(d, { x = -0.28, y = 0.12, z = -0.14, width = 0.16, delay = 0.35, onPop = null } = {}) {
  const card = figure(d, "firecrackers", { width, x, y, z, delay, name: "firecrackers", label: "firecrackers", radius: 0.12, onTap: () => pop() });
  if (!card) return null;
  const sparks = d.burst(0xffd27a, 80, 0.018);
  const paper = d.burst(0xff5a4a, 60, 0.022);
  const s = { pop: 0 };
  let first = true;
  const pop = () => {
    s.pop = 1;
    [0, 1, 2, 3, 4, 5].forEach((i) => setTimeout(() => { const at = d.group.worldToLocal(card.worldPoint(0.5, 0.2 + Math.random() * 0.6, 0.04)); sparks.emit(at, 6, 0.3, 0.8); paper.emit(at, 4, 0.25, 0.9); d.ctx.sound.pop(1.4 + Math.random() * 0.5); }, i * 130));
    sfx(d, "crack", 0, 0.5);
    if (first && onPop) { first = false; onPop(); }
  };
  d.updaters.push((dt) => { s.pop = Math.max(0, s.pop - dt * 1.4); card.group.rotation.z = Math.sin(s.pop * 40) * 0.12 * s.pop; });
  d.action("firecrackers", "pop", pop);
  return card;
}

function drum(d, { x = 0.32, z = 0.02, width = 0.26, delay = 0.3 } = {}) {
  const card = figure(d, "drum", { width, x, y: 0, z, delay, name: "drum", label: "drum", radius: 0.16, onTap: () => boom() });
  if (!card) return null;
  const ring = card.glow(0.5, 0.6, 0xffe0a0, width * 1.6, 0);
  const s = { boom: 0 };
  const boom = () => { s.boom = 1; sfx(d, "drum", 0, 0.7); card.bounce(); if (d.onBoom) d.onBoom(); };
  d.updaters.push((dt) => { s.boom = Math.max(0, s.boom - dt * 2.2); ring.material.opacity = s.boom * 0.5; ring.scale.setScalar(width * (1.4 + (1 - s.boom) * 1.2)); card.group.scale.setScalar(1 + Math.sin(s.boom * Math.PI) * 0.1); });
  d.action("drum", "boom", boom);
  return card;
}

/* ---------- friends and things ---------- */

function grandma(d, { x = -0.3, z = -0.1, width = 0.3, delay = 0.3 } = {}) {
  return friend(d, "nainai", { name: "nainai", label: "Grandma", width, x, z, delay, call: "chime", note: 4, verb: "wave", radius: 0.18 });
}

function traveler(d, { x = 0.3, z = -0.12, width = 0.32, delay = 0.3 } = {}) {
  const card = friend(d, "laoren", { name: "traveler", label: "the old traveler", width, x, z, delay, call: "chime", note: 2, radius: 0.18 });
  if (!card) return null;
  const s = { nod: 0 };
  d.action("traveler", "nod", () => { s.nod = 1; card.bounce(); d.ctx.sound.chime(2, 0.3); setTimeout(() => d.ctx.sound.chime(4, 0.25), 220); });
  d.updaters.push((dt) => { if (s.nod > 0) { s.nod = Math.max(0, s.nod - dt * 1.1); card.group.rotation.x = Math.sin(s.nod * Math.PI * 2) * 0.2 * s.nod; } });
  return card;
}

function steamy(d, id, { name, label = name, x, z, width, delay = 0.35, note = 4, radius = 0.13 } = {}) {
  const card = figure(d, id, { width, x, y: 0, z, delay, name, label, radius, onTap: () => steam() });
  if (!card) return null;
  const puffs = d.burst(0xfff6e8, 50, 0.04);
  const steam = () => { card.bounce(); const top = d.group.worldToLocal(card.worldPoint(0.5, 0.9, 0.04)); [0, 1, 2].forEach((i) => setTimeout(() => puffs.emit(top, 4, 0.06, 0.45), i * 180)); d.ctx.sound.puff(); d.ctx.sound.chime(note, 0.3); };
  d.action(name, "steam", steam);
  return card;
}

function plumBranch(d, { x = -0.34, y = 0.1, z = -0.3, width = 0.34, delay = 0.3 } = {}) {
  const card = figure(d, "plum-branch", { width, x, y, z, delay, name: "plum", label: "plum blossom", radius: 0.2, onTap: () => bloom() });
  if (!card) return null;
  const bloom = () => { card.bounce(); splash(d, d.group.worldToLocal(card.worldPoint(0.5, 0.6, 0.05)), { color: 0xffb0c8, count: 16, size: 0.024, speed: 0.3, up: 0.8 }); d.ctx.sound.chime(8, 0.3); sfx(d, "shimmer", 0.3); if (d.onBloom) d.onBloom(); };
  d.action("plum", "bloom", bloom);
  return card;
}

function redPaper(d, { x = -0.36, y = 0.3, z = -0.38, width = 0.16 } = {}) {
  const card = figure(d, "red-paper", { width, x, y, z, delay: 0.35, name: "paper", label: "red paper", radius: 0.12, onTap: () => flutter() });
  if (!card) return null;
  const s = { flutter: 0 };
  const flutter = () => { s.flutter = 1; card.bounce(); sfx(d, "rustle", 0, 0.5); };
  d.updaters.push((dt, t) => { s.flutter = Math.max(0, s.flutter - dt); card.group.rotation.z = Math.sin(t * 1.4) * 0.02 + Math.sin(s.flutter * 20) * 0.12 * s.flutter; });
  d.action("paper", "flutter", flutter);
  return card;
}

function door(d, { x = 0.36, z = -0.3, width = 0.28 } = {}) {
  const card = figure(d, "door", { width, x, y: 0, z, delay: 0.3, name: "door", label: "door", radius: 0.16, onTap: () => open() });
  if (!card) return null;
  const s = { open: 0, target: 0 };
  const open = () => { s.target = s.target > 0.5 ? 0 : 1; sfx(d, "thunk", 0, 0.35); d.ctx.sound.click(); };
  d.updaters.push((dt) => { s.open = lerp(s.open, s.target, Math.min(1, dt * 4)); card.group.rotation.y = -s.open * 0.9; });
  d.action("door", "open", open);
  return card;
}

function snow(d, { level = 0.7 } = {}) {
  const fall = makeFall(d, { count: 160, color: 0xffffff, size: 0.02, speed: 0.1, sway: 0.05, level, box: [1.4, 1.1, 1.0], center: [0, 0.55, -0.05] });
  d.action("sky", "snow", () => { fall.set(Math.min(1.6, fall.level + 0.4)); sfx(d, "shimmer", 0.25); });
  swipeOn(d, "sky", (dx) => { fall.blow(dx * 8); fall.set(Math.min(1.6, fall.level + Math.abs(dx) * 2)); });
  return fall;
}

function goats(d, { x = -0.36, z = 0.06, width = 0.28 } = {}) {
  return friend(d, "goats", { name: "goats", label: "the goats", width, x, z, delay: 0.4, call: "baa", note: 0, verb: "bleat", radius: 0.16 });
}

/* ---------- pages ---------- */

const builders = {
  "mei-village": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "village");
    d.hotspot(sky, "mountain", [0.25, 0.0, 0.5, 0.4], { label: "the mountain", glow: 0x8090c0, onTap: () => { sfx(d, "thunder", 0, 0.3); d.ctx.sound.chime(0, 0.3); } });
    d.action("mountain", "loom", () => { d.objects.mountain.onTap(); sky.bounce(); });
    d.hotspot(sky, "river", [0.0, 0.62, 0.5, 0.25], { label: "the river", glow: 0xa8d8ff, onTap: () => { splash(d, new THREE.Vector3(-0.3, 0.12, -0.4), { color: 0xa8d8ff, count: 12 }); sfx(d, "splash", 0, 0.3); } });
    d.action("river", "flow", () => d.objects.river.onTap());
    snow(d, { level: 0.7 });
    plumBranch(d, { x: -0.36, y: 0.1, z: -0.3, width: 0.34 });
    grandma(d, { x: 0.3, z: -0.1, width: 0.3 });
    standingMei(d, new THREE.Vector3(-0.06, 0, 0.3), { faces: 1 });
    return d;
  },

  "mei-beast": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "beast");
    let roared = false;
    const beast = nian(d, { x: 0.18, z: -0.22, width: 0.56 });
    if (beast) { const r = beast.roar; beast.roar = () => { r(); if (!roared) { roared = true; ctx.onMagic("nian"); } }; d.action("nian", "roar", () => beast.roar()); }
    snow(d, { level: 0.5 });
    goats(d, { x: -0.36, z: 0.1, width: 0.24 });
    standingMei(d, new THREE.Vector3(-0.34, 0, 0.34), { scale: 0.4, faces: 1 });
    return d;
  },

  "mei-traveler": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "traveler");
    snow(d, { level: 0.4 });
    traveler(d, { x: 0.3, z: -0.14, width: 0.34 });
    steamy(d, "dumplings", { name: "dumplings", label: "dumplings", x: -0.06, z: 0.16, width: 0.18, note: 6 });
    steamy(d, "teapot", { name: "tea", label: "tea", x: 0.14, z: 0.24, width: 0.13, note: 4 });
    standingMei(d, new THREE.Vector3(-0.3, 0, 0.3), { faces: 1 });
    return d;
  },

  "mei-red": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "red");
    let red = false;
    lanterns(d, { x: 0.04, y: 0.44, z: -0.42, width: 0.7, lit: 0.5 });
    const light = d.objects.lanterns && d.objects.lanterns.actions.light;
    if (light) d.action("lanterns", "light", () => { light(); if (!red) { red = true; ctx.onMagic("red"); } });
    redPaper(d, { x: -0.38, y: 0.3, z: -0.36, width: 0.16 });
    door(d, { x: 0.36, z: -0.28, width: 0.28 });
    grandma(d, { x: -0.16, z: -0.1, width: 0.28 });
    goats(d, { x: 0.38, z: 0.16, width: 0.2 });
    standingMei(d, new THREE.Vector3(0.1, 0, 0.32), { faces: -1 });
    return d;
  },

  "mei-fire": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "fire");
    const s = { dim: 0 };
    d.updaters.push((dt) => { s.dim = Math.max(0, s.dim - dt * 0.5); sky.material.color.setScalar(1 - s.dim * 0.25); });
    d.action("sky", "night", () => { s.dim = 1; sky.bounce(); d.ctx.sound.chime(0, 0.25); });
    bonfire(d, { x: 0.06, z: -0.06, width: 0.32 });
    candles(d, { x: -0.36, y: 0.26, z: -0.38, width: 0.22 });
    traveler(d, { x: 0.38, z: -0.2, width: 0.26 });
    standingMei(d, new THREE.Vector3(-0.28, 0, 0.32), { faces: 1 });
    return d;
  },

  "mei-noise": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "noise");
    const fire = bonfire(d, { x: 0.04, z: -0.12, width: 0.28 });
    let popped = false;
    firecrackers(d, { x: -0.22, y: 0.1, z: -0.06, width: 0.16, onPop: () => { if (fire) fire.blaze(); if (!popped) { popped = true; ctx.onMagic("baozhu"); } } });
    drum(d, { x: 0.34, z: 0.06, width: 0.26 });
    grandma(d, { x: 0.4, z: -0.28, width: 0.24 });
    goats(d, { x: -0.4, z: 0.16, width: 0.22 });
    traveler(d, { x: -0.36, z: -0.3, width: 0.22 });
    standingMei(d, new THREE.Vector3(-0.06, 0, 0.34), { scale: 0.42, faces: 1 });
    return d;
  },

  "mei-night": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "night");
    let fled = false;
    const beast = nian(d, { x: 0.22, z: -0.26, width: 0.5, onFlee: () => { if (!fled) { fled = true; ctx.onMagic("guonianle"); } } });
    firecrackers(d, { x: -0.36, y: 0.1, z: -0.1, width: 0.15 });
    drum(d, { x: -0.1, z: 0.12, width: 0.22 });
    let brave = false;
    d.onBrave = () => { if (!brave) { brave = true; ctx.onMagic("brave"); } if (beast) beast.roar(); };
    d.onBoom = () => { if (beast) beast.roar(); };
    lanterns(d, { x: -0.2, y: 0.4, z: -0.42, width: 0.5, lit: 0.9 });
    standingMei(d, new THREE.Vector3(-0.22, 0, 0.34), { faces: 1 });
    return d;
  },

  "mei-morning": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "morning");
    const dragon = figure(d, "dragon", { width: 0.62, x: 0.08, y: 0, z: -0.24, delay: 0.3, name: "dragon", label: "dragon", radius: 0.3, onTap: () => dance() });
    const ds = { dance: 0 };
    const dance = () => { ds.dance = 1; sfx(d, "drum", 0, 0.6); setTimeout(() => sfx(d, "drum", 1, 0.5), 300); d.ctx.sound.chime(7, 0.3); };
    if (dragon) d.updaters.push((dt, t) => { ds.dance = Math.max(0, ds.dance - dt * 0.5); dragon.group.position.y = Math.abs(Math.sin(t * 6)) * 0.06 * ds.dance; dragon.group.rotation.z = Math.sin(t * 5) * 0.08 * ds.dance; });
    d.action("dragon", "dance", dance);
    figure(d, "envelope", { width: 0.12, x: 0.42, y: 0, z: 0.2, delay: 0.4, name: "envelope", label: "red envelope", radius: 0.1, onTap: () => { splash(d, new THREE.Vector3(0.42, 0.1, 0.22), { color: 0xffd97a, count: 10, size: 0.02, speed: 0.25, up: 0.7 }); d.ctx.sound.chime(9, 0.35); } });
    d.action("envelope", "open", () => d.objects.envelope.onTap());
    let cheered = false;
    d.onCheer = () => { dance(); if (!cheered) { cheered = true; ctx.onMagic("guonianle"); } };
    grandma(d, { x: -0.36, z: -0.14, width: 0.26 });
    standingMei(d, new THREE.Vector3(-0.1, 0, 0.34), { faces: 1 });
    return d;
  },

  "mei-feast": (ctx) => {
    const d = new Diorama(ctx);
    const room = backCard(d, "feast", { name: "table", label: "the family table" });
    d.action("table", "feast", () => { room.bounce(); sfx(d, "cheer", 0, 0.35); d.ctx.sound.chime(5, 0.3); });
    const fish = figure(d, "fish-dish", { width: 0.28, x: 0.06, y: 0, z: 0.1, delay: 0.35, name: "fish", label: "fish", radius: 0.14, onTap: () => swim() });
    const fs = { swim: 0 };
    const swim = () => { fs.swim = 1; sfx(d, "bubbles", 2, 0.4); d.ctx.sound.chime(6, 0.3); };
    if (fish) d.updaters.push((dt) => { fs.swim = Math.max(0, fs.swim - dt * 1.2); fish.group.rotation.z = Math.sin(fs.swim * 18) * 0.18 * fs.swim; });
    d.action("fish", "swim", swim);
    const fu = figure(d, "fu", { width: 0.16, x: 0.36, y: 0.34, z: -0.4, delay: 0.35, name: "fu", label: "the word for luck", radius: 0.12, onTap: () => flip() });
    const us = { flip: 0, upside: 1 };
    const flip = () => { us.flip = 1; us.upside = us.upside ? 0 : 1; d.ctx.sound.chime(8, 0.35); sfx(d, "shimmer", 0.3); };
    if (fu) { fu.group.rotation.z = Math.PI; d.updaters.push((dt) => { us.flip = Math.max(0, us.flip - dt * 1.5); fu.group.rotation.z = lerp(fu.group.rotation.z, us.upside ? Math.PI : 0, Math.min(1, dt * 5)); fu.group.scale.setScalar(1 + Math.sin(us.flip * Math.PI) * 0.2); }); }
    d.action("fu", "flip", flip);
    grandma(d, { x: -0.3, z: -0.16, width: 0.3 });
    lanterns(d, { x: -0.1, y: 0.46, z: -0.42, width: 0.5, lit: 0.8 });
    standingMei(d, new THREE.Vector3(0.28, 0, 0.32), { scale: 0.42, faces: -1 });
    return d;
  },

  "mei-plum": (ctx) => plumScene(ctx, { end: false }),
  end: (ctx) => plumScene(ctx, { end: true }),
};

function plumScene(ctx, { end }) {
  const d = new Diorama(ctx);
  const sky = backCard(d, "plum");
  d.hotspot(sky, "mountain", [0.3, 0.0, 0.45, 0.35], { label: "the mountain", glow: 0x8090c0, onTap: () => { sfx(d, "thunder", 0, 0.2); d.ctx.sound.chime(0, 0.3); } });
  d.action("mountain", "loom", () => d.objects.mountain.onTap());
  snow(d, { level: 0.3 });
  plumBranch(d, { x: -0.28, y: 0.08, z: -0.22, width: 0.4 });
  nian(d, { x: 0.4, z: -0.44, width: 0.24, peek: true, delay: 0.5 });
  lanterns(d, { x: 0.1, y: 0.46, z: -0.46, width: 0.5, lit: 0.6 });
  grandma(d, { x: 0.3, z: -0.06, width: 0.26 });
  standingMei(d, new THREE.Vector3(-0.02, 0, 0.32), { faces: 1, pose: end ? "sleep" : "stand" });
  if (end) setTimeout(() => ctx.onMagic("guonianle"), 2500);
  return d;
}

export default builders;

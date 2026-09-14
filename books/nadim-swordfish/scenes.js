/* The spreads of "Nadim and the Swordfish": a kampong by the sea, swordfish leaping onto the
   beach, a stone wall, a net and a shout that all fail, and a small boy's soft idea: banana
   stems. The shared pop-up engine is in src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, sfx, splash, friend } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/* ---------- the swordfish ---------- */

/** A school of swordfish that leap out of the sea in arcs, one after another. Each is a card
    that starts below the page and flies up and over; `over` is how high they clear. */
function school(d, spots, { over = 0.4, name = "swordfish", label = "swordfish", ambient = true, onLeap = null } = {}) {
  const fish = [];
  spots.forEach(([x, z, width, dir = 1], i) => {
    const card = figure(d, "swordfish", { width, x, y: -0.35, z, delay: 0.3 + i * 0.05, name: i === 0 ? name : `${name}${i + 1}`, label, radius: width * 0.6, onTap: () => api.leap() });
    if (!card) return;
    card.group.rotation.y = dir < 0 ? Math.PI : 0;
    fish.push({ card, t: 1, dir, x, z, width, delay: i * 0.18 });
  });
  const api = {
    fish,
    leap() {
      fish.forEach((f) => { if (f.t >= 1) setTimeout(() => { f.t = 0; sfx(d, "splash", 0, 0.3); splash(d, new THREE.Vector3(f.x, 0.02, f.z + 0.05), { color: 0x8fd0ff, count: 10, size: 0.022 }); }, f.delay * 1000); });
      if (onLeap) onLeap();
    },
  };
  d.updaters.push((dt) => {
    for (const f of fish) {
      if (f.t < 1) {
        f.t = Math.min(1, f.t + dt / 1.5);
        const p = f.t;
        f.card.group.position.set(f.dir * p * 0.22, Math.sin(p * Math.PI) * (0.35 + over) , 0);
        f.card.group.rotation.z = f.dir * (0.9 - p * 1.8);
      } else f.card.group.position.set(0, 0, 0);
    }
  });
  d.action(name, "leap", () => api.leap());
  d.action(name, "jump", () => api.leap());
  if (ambient) d.every(4.5, () => api.leap());
  return api;
}

/** One swordfish with its nose stuck in a banana stem (the turn of the story). */
function stuckFish(d, { x = 0.12, z = 0.0, width = 0.36, shown = true, onStuck = null, onSigh = null } = {}) {
  const card = figure(d, "swordfish-stuck", { width, x, y: 0, z, delay: 0.3, name: "stuck", label: "swordfish", radius: 0.2, onTap: () => sigh() });
  if (!card) return null;
  card.group.visible = shown;
  const state = { wiggle: 0, sighed: false };
  const hearts = d.burst(0xf6a3c0, 30, 0.026);
  const show = () => { if (card.group.visible) { state.wiggle = 1; return; } card.group.visible = true; card.bounce(); state.wiggle = 1; sfx(d, "thunk", 0, 0.6); setTimeout(() => sfx(d, "thunk", 1, 0.5), 300); setTimeout(() => sfx(d, "thunk", 2, 0.45), 600); if (onStuck) onStuck(); };
  const sigh = () => { card.bounce(); hearts.emit(d.group.worldToLocal(card.worldPoint(0.35, 0.7, 0.05)), 10, 0.2, 0.6); d.ctx.sound.puff(); d.ctx.sound.chime(5, 0.3); if (!state.sighed) { state.sighed = true; if (onSigh) onSigh(); } };
  d.updaters.push((dt, t) => { state.wiggle = Math.max(0, state.wiggle - dt * 0.8); card.group.rotation.z = Math.sin(t * 14) * 0.08 * state.wiggle; });
  d.action("stuck", "stuck", show);
  d.action("stuck", "sigh", sigh);
  d.action("swordfish", "stuck", show);
  d.action("swordfish", "sigh", sigh);
  d.action("swordfish", "swim", () => { card.bounce(); splash(d, new THREE.Vector3(x - 0.2, 0.05, z), { color: 0x8fd0ff, count: 12 }); sfx(d, "splash", 0, 0.35); });
  return { card, show, sigh };
}

/* ---------- friends and things ---------- */

function merlion(d, { x = 0.36, z = -0.3, width = 0.26, onWink = null } = {}) {
  const card = figure(d, "merlion", { width, x, y: 0, z, delay: 0.25, name: "merlion", label: "Merlion", radius: 0.16, onTap: () => spout() });
  if (!card) return null;
  const drops = d.burst(0xbfe6ff, 40, 0.02);
  const spout = () => { card.bounce(); const from = d.group.worldToLocal(card.worldPoint(0.25, 0.78, 0.05)); [0, 1, 2, 3].forEach((i) => setTimeout(() => drops.emit(from.clone(), 5, 0.2, 0.7, new THREE.Vector3(-0.9, 0.6, 0)), i * 120)); sfx(d, "splash", 0, 0.35); };
  d.action("merlion", "spout", spout);
  d.action("merlion", "spouts", spout);
  d.action("merlion", "wink", () => { card.bounce(); card.lift(true); setTimeout(() => card.lift(false), 600); d.ctx.sound.chime(6, 0.35); if (onWink) onWink(); });
  return { card, spout };
}

function otters(d, { x = -0.3, z = 0.02, width = 0.22 } = {}) {
  const card = friend(d, "otters", { name: "otters", label: "otters", width, x, z, delay: 0.3, call: "otter", note: 0, verb: "squeak", radius: 0.14 });
  if (card) d.action("otters", "drag", () => { card.bounce(); card.lift(true); setTimeout(() => card.lift(false), 700); sfx(d, "otter", 1, 0.45); });
  return card;
}

function hornbill(d, { x = 0.1, y = 0.5, z = -0.3, width = 0.16 } = {}) {
  const card = friend(d, "hornbill", { name: "hornbill", label: "hornbill", width, x, y, z, delay: 0.35, call: "hornbill", note: 0, verb: "call", radius: 0.12 });
  if (card) d.updaters.push((dt, t) => { card.group.position.y = Math.sin(t * 1.4) * 0.01; });
  return card;
}

function villagers(d, { x = -0.25, z = -0.2, width = 0.6 } = {}) {
  const card = friend(d, "crowd", { name: "crowd", label: "village", width, x, z, delay: 0.35, call: "laugh", note: 0, verb: "laugh", radius: 0.3 });
  if (!card) return null;
  const s = { shake: 0 };
  d.action("crowd", "panic", () => { s.shake = 1; card.bounce(); d.ctx.sound.pop(1.4); setTimeout(() => d.ctx.sound.pop(1.2), 200); });
  d.action("crowd", "hush", () => { card.lift(true); setTimeout(() => card.lift(false), 900); d.ctx.sound.chime(0, 0.2); });
  d.action("crowd", "cheer", () => { card.bounce(); sfx(d, "cheer", 0, 0.5); });
  d.updaters.push((dt, t) => { s.shake = Math.max(0, s.shake - dt); card.group.rotation.z = Math.sin(t * 22) * 0.04 * s.shake; });
  return card;
}

function stoneWall(d, { x = 0.05, z = -0.1, width = 0.7, onCrash = null } = {}) {
  const card = figure(d, "wall", { width, x, y: 0, z, delay: 0.2, name: "wall", label: "wall", radius: 0.3, onTap: () => crumble() });
  if (!card) return null;
  const stones = d.burst(0x9a9a9a, 40, 0.03);
  const state = { fall: 0, crashed: false };
  const crumble = () => { if (state.crashed) { card.bounce(); return; } state.crashed = true; state.fall = 1; sfx(d, "crumble", 0, 0.6); stones.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.6, 0.05)), 20, 0.4, 0.8); if (onCrash) onCrash(); };
  d.updaters.push((dt) => { if (state.crashed && state.fall > 0) { state.fall = Math.max(0, state.fall - dt * 0.8); card.group.rotation.z = (1 - state.fall) * 0.25; card.group.position.y = -(1 - state.fall) * card.height * 0.45; card.group.scale.y = 1 - (1 - state.fall) * 0.4; } });
  d.action("wall", "crumble", crumble);
  return card;
}

function fishingNet(d, { x = 0.05, z = -0.15, width = 0.7, onSnip = null } = {}) {
  const card = figure(d, "net", { width, x, y: 0, z, delay: 0.2, name: "net", label: "net", radius: 0.3, onTap: () => tear() });
  if (!card) return null;
  const state = { torn: false, wobble: 0 };
  const tear = () => { state.wobble = 1; card.bounce(); sfx(d, "snap", 0, 0.5); setTimeout(() => sfx(d, "snap", 2, 0.45), 250); if (!state.torn) { state.torn = true; if (onSnip) onSnip(); } };
  d.updaters.push((dt, t) => { state.wobble = Math.max(0, state.wobble - dt); card.group.rotation.z = Math.sin(t * 0.8) * 0.01 + Math.sin(state.wobble * 16) * 0.06 * state.wobble; });
  d.action("net", "tear", tear);
  return card;
}

/** Banana stems: on the "stems" page they can be dragged into their row on the beach. */
function bananaStems(d, { x = 0.22, z = -0.05, width = 0.34, draggable = false, onPlaced = null } = {}) {
  const home = new THREE.Vector3(x, 0, z);
  const card = figure(d, "banana-stems", { width, x, y: 0, z, delay: 0.25, register: false });
  if (!card) return null;
  const state = { wobble: 0, drag: null, placed: !draggable, offset: new THREE.Vector3() };
  const target = new THREE.Vector3(0.52, 0, 0);   // relative to `home`: the row on the right
  d.register("banana", card.group, {
    label: "banana stems", radius: 0.2, anchor: () => card.worldPoint(0.5, 0.5, 0.05),
    onHover: (on) => card.lift(on),
    onTap: () => wobble(),
    onDrag: draggable ? (p) => { const local = d.group.worldToLocal(p.clone()).sub(home); local.y = 0; local.z = 0; state.drag = local; } : undefined,
    onDragEnd: draggable ? () => { if (state.drag) { if (state.drag.x > target.x - 0.18) { state.offset.copy(target); state.placed = true; sfx(d, "thunk", 0, 0.45); if (onPlaced) onPlaced(); } else state.offset.copy(state.drag); } state.drag = null; } : undefined,
  });
  const wobble = () => { state.wobble = 1; card.bounce(); sfx(d, "boing", 0, 0.4); };
  d.updaters.push((dt, t) => {
    card.update(dt, t);
    state.wobble = Math.max(0, state.wobble - dt);
    if (state.drag) card.group.position.lerp(state.drag, Math.min(1, dt * 14)); else card.group.position.lerp(state.offset, Math.min(1, dt * 8));
    card.group.rotation.z = Math.sin(state.wobble * 16) * 0.08 * state.wobble;
  });
  d.action("banana", "wobble", wobble);
  return { card, state };
}

/* ---------- Nadim ---------- */

function standingNadim(d, position, options = {}) {
  const nadim = standingHero(d, position, { scale: 0.5, name: "nadim", label: "Nadim", ...options });
  const sparkle = d.burst(0xffe9a8, 30, 0.02);
  const head = () => d.group.worldToLocal(nadim.hero.head ? nadim.hero.head.getWorldPosition(_v) : nadim.group.localToWorld(new THREE.Vector3(0, 0.5, 0)));
  d.action("nadim", "idea", () => { nadim.hero.look(); nadim.spring.kick(0, 0.5, 0); sparkle.emit(head().add(new THREE.Vector3(0, 0.1, 0.05)), 12, 0.2, 0.5); d.ctx.sound.chime(7, 0.4); if (d.onIdea) d.onIdea(); });
  d.action("nadim", "scratch", () => { nadim.hero.wave(); nadim.spring.kick(0.1, 0.3, 0); sfx(d, "giggle", 4, 0.35); if (d.onScratch) d.onScratch(); });
  return nadim;
}

/* ---------- pages ---------- */

/** The sea as a touchable band of the back card (the swordfish leap when it is tapped). */
function seaBand(d, card, onTap, { name = "sea", rect = [0, 0.18, 1, 0.32] } = {}) {
  d.hotspot(card, name, rect, { label: "sea", radius: 0.4, glow: 0xbfe6ff, onTap: () => { splash(d, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.05, -0.2), { color: 0x8fd0ff, count: 12 }); sfx(d, "splash", 0, 0.35); if (onTap) onTap(); } });
  d.action(name, "ripple", () => { card.bounce(); splash(d, new THREE.Vector3(0, 0.05, -0.2), { color: 0x8fd0ff, count: 14 }); sfx(d, "splash", 0, 0.35); });
}

const builders = {
  "nadim-beach": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "kampong-beach", { name: "kampong", label: "kampong" });
    d.action("kampong", "wave", () => { back.bounce(); d.ctx.sound.chime(3, 0.3); });
    seaBand(d, back, null, { rect: [0, 0.15, 0.6, 0.3] });
    merlion(d, { x: 0.36, z: -0.3, width: 0.26 });
    otters(d, { x: -0.3, z: 0.02, width: 0.22 });
    hornbill(d, { x: 0.08, y: 0.5, z: -0.3, width: 0.16 });
    standingNadim(d, new THREE.Vector3(-0.02, 0, 0.32));
    return d;
  },

  "nadim-swordfish": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "beach-wide");
    let first = false;
    const fish = school(d, [[-0.4, -0.3, 0.26], [-0.1, -0.34, 0.22], [0.18, -0.3, 0.26], [0.42, -0.36, 0.2]], { over: 0.3, onLeap: () => { if (!first) { first = true; ctx.onMagic("swordfish"); } } });
    seaBand(d, back, () => fish.leap());
    villagers(d, { x: -0.26, z: -0.12, width: 0.56 });
    standingNadim(d, new THREE.Vector3(0.34, 0, 0.32), { faces: -1 });
    return d;
  },

  "nadim-wall": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "beach-stones");
    let crashed = false;
    const wall = stoneWall(d, { x: 0.06, z: -0.1, width: 0.7, onCrash: () => { if (!crashed) { crashed = true; ctx.onMagic("crash"); } } });
    const fish = school(d, [[-0.12, -0.34, 0.24], [0.26, -0.36, 0.24]], { over: 0.55, onLeap: () => setTimeout(() => wall && d.objects.wall && d.objects.wall.actions.crumble(), 900) });
    seaBand(d, back, () => fish.leap());
    const strong = friend(d, "fisherman", { name: "fisherman", label: "fisherman", width: 0.3, x: -0.38, z: 0.0, delay: 0.3, call: "pop", note: 0.5, verb: "lift", radius: 0.16 });
    d.action("fisherman", "lift", () => { if (strong) { strong.bounce(); strong.lift(true); setTimeout(() => strong.lift(false), 700); } d.ctx.sound.pop(0.5); });
    standingNadim(d, new THREE.Vector3(0.38, 0, 0.32), { faces: -1 });
    return d;
  },

  "nadim-net": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "beach-wide");
    let snipped = false;
    fishingNet(d, { x: 0.06, z: -0.15, width: 0.7, onSnip: () => { if (!snipped) { snipped = true; ctx.onMagic("snip"); } } });
    const fish = school(d, [[-0.1, -0.34, 0.24], [0.28, -0.36, 0.22]], { over: 0.25, onLeap: () => setTimeout(() => d.objects.net && d.objects.net.actions.tear(), 800) });
    seaBand(d, back, () => fish.leap());
    const wise = friend(d, "wiseman", { name: "wiseman", label: "wise old man", width: 0.3, x: -0.38, z: 0.0, delay: 0.3, call: "chime", note: 2, verb: "think", radius: 0.16 });
    d.action("wiseman", "think", () => { if (wise) wise.bounce(); d.ctx.sound.chime(2, 0.3); setTimeout(() => d.ctx.sound.chime(4, 0.25), 300); });
    standingNadim(d, new THREE.Vector3(0.38, 0, 0.32), { faces: -1 });
    return d;
  },

  "nadim-shout": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "beach-wide");
    const fish = school(d, [[-0.14, -0.34, 0.24], [0.14, -0.36, 0.24], [0.4, -0.32, 0.2]], { over: 0.7 });
    seaBand(d, back, () => fish.leap());
    const chief = friend(d, "chief", { name: "chief", label: "chief", width: 0.3, x: -0.36, z: 0.0, delay: 0.3, call: "pop", note: 0.6, verb: "shout", radius: 0.16 });
    const puff = d.burst(0xffffff, 30, 0.03);
    d.action("chief", "shout", () => { if (chief) chief.bounce(); puff.emit(chief ? d.group.worldToLocal(chief.worldPoint(0.75, 0.75, 0.05)) : new THREE.Vector3(-0.2, 0.3, 0), 10, 0.3, 0.3, new THREE.Vector3(1, 0.1, 0)); d.ctx.sound.pop(0.5); setTimeout(() => d.ctx.sound.pop(0.45), 220); });
    standingNadim(d, new THREE.Vector3(0.3, 0, 0.32), { faces: -1 });
    return d;
  },

  "nadim-idea": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "bay-merlion");
    seaBand(d, back, null, { rect: [0, 0.2, 1, 0.25] });
    let idea = false;
    d.onIdea = () => { if (!idea) { idea = true; ctx.onMagic("idea"); } };
    bananaStems(d, { x: 0.4, z: -0.24, width: 0.3 });
    villagers(d, { x: -0.3, z: -0.26, width: 0.5 });
    merlion(d, { x: 0.12, z: -0.4, width: 0.2 });
    standingNadim(d, new THREE.Vector3(0.0, 0, 0.32));
    return d;
  },

  "nadim-stems": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "beach-wait");
    bananaStems(d, { x: -0.3, z: 0.0, width: 0.34, draggable: true, onPlaced: () => { d.ctx.sound.chime(5, 0.4); } });
    otters(d, { x: -0.02, z: 0.12, width: 0.22 });
    standingNadim(d, new THREE.Vector3(0.36, 0, 0.32), { faces: -1 });
    return d;
  },

  "nadim-stuck": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "beach-wait");
    let stuck = false;
    const stems = bananaStems(d, { x: 0.22, z: -0.06, width: 0.34 });
    const held = stuckFish(d, { x: 0.12, z: 0.02, width: 0.34, shown: false, onStuck: () => { if (!stuck) { stuck = true; ctx.onMagic("stuck"); } } });
    const fish = school(d, [[-0.36, -0.32, 0.24], [-0.1, -0.36, 0.22]], { over: 0.3, ambient: false, onLeap: () => setTimeout(() => held && held.show(), 1300) });
    seaBand(d, back, () => fish.leap());
    villagers(d, { x: -0.34, z: -0.32, width: 0.44 });
    standingNadim(d, new THREE.Vector3(0.44, 0, 0.32), { faces: -1, scale: 0.46 });
    return d;
  },

  "nadim-scratch": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "beach-quiet");
    let itchy = false;
    const held = stuckFish(d, { x: 0.16, z: 0.0, width: 0.4, shown: true, onSigh: () => { if (!itchy) { itchy = true; ctx.onMagic("itchy"); } } });
    d.onScratch = () => setTimeout(() => held && held.sigh(), 500);
    const nadim = standingNadim(d, new THREE.Vector3(-0.26, 0, 0.32));
    nadim.state.lookAt = () => held ? held.card.worldPoint(0.5, 0.5, 0.05) : d.pointer;
    return d;
  },

  "nadim-hill": (ctx) => hillScene(ctx, { end: false }),
  end: (ctx) => hillScene(ctx, { end: true }),
};

function hillScene(ctx, { end }) {
  const d = new Diorama(ctx);
  const hill = backCard(d, "red-hill", { name: "hill", label: "hill" });
  const petals = d.burst(0xe2493d, 50, 0.026);
  let red = end;
  d.action("hill", "bloom", () => { hill.bounce(); [0, 1, 2].forEach((i) => setTimeout(() => petals.emit(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.55, -0.4), 12, 0.35, 0.8), i * 200)); sfx(d, "shimmer", 0.45); if (!red) { red = true; ctx.onMagic("red"); } });
  const swimming = figure(d, "swordfish-row", { width: 0.42, x: -0.2, y: 0.02, z: -0.3, delay: 0.3, name: "swordfish", label: "swordfish", radius: 0.22, onTap: () => swim() });
  const swim = () => { if (swimming) { swimming.bounce(); swimming.group.position.x -= 0.05; } splash(d, new THREE.Vector3(-0.2, 0.05, -0.25), { color: 0x8fd0ff, count: 12 }); sfx(d, "splash", 0, 0.35); };
  d.action("swordfish", "swim", swim);
  if (swimming) d.updaters.push((dt, t) => { swimming.group.position.y = Math.sin(t * 1.3) * 0.015; swimming.group.position.x = lerp(swimming.group.position.x, 0, dt * 0.3); });
  villagers(d, { x: 0.22, z: -0.16, width: 0.5 });
  merlion(d, { x: 0.44, z: -0.34, width: 0.18 });
  standingNadim(d, new THREE.Vector3(-0.36, 0, 0.32));
  if (end) setTimeout(() => ctx.onMagic("red"), 2500);
  return d;
}

export default builders;

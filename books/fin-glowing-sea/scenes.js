/* The spreads of "Fin and the Glowing Sea": one builder per scene id in story.json, plus the
   end page. Fin-specific pieces (Fin swimming, the sea you can stir, glows that answer the
   story, bubbles) live here; the shared pop-up engine is in src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

function sfx(d, name, ...args) {
  const s = d.ctx.sound;
  if (s[name]) return s[name](...args);
  return s.chime(3, 0.3);
}

/* ---------- the sea ---------- */

/** The water of a spread: the back card becomes "sea" (stir it with a drag for a trail of light
    and a current that sways the kelp), with dark / bright / sparkle verbs and rising bubbles. */
function makeSea(d, back, { bubbles = true, tint = 1 } = {}) {
  const sea = { current: 0, last: null, tint, tintTarget: tint, listeners: [] };
  const trail = d.burst(0xa8f4ff, 160, 0.022);
  const bubble = d.burst(0xe6fbff, 90, 0.026);
  sea.sparkle = (at, n = 18) => { trail.emit(at, n, 0.35, 1.2); };
  sea.blow = (at, n = 14) => { bubble.emit(at, n, 0.45, 0.8); d.ctx.sound.pop(1.4); };
  const entry = d.objects[back.name || "sea"] || d.objects.sea;
  if (entry) {
    entry.onDrag = (worldPoint) => {
      const local = d.group.worldToLocal(worldPoint.clone());
      if (sea.last) {
        const dx = local.x - sea.last.x;
        if (Math.abs(dx) > 0.004) sea.current = clamp(sea.current + dx * 7, -2, 2);
        if (local.distanceTo(sea.last) > 0.012) trail.emit(local, 3, 0.12, 0.5);
      }
      sea.last = local.clone();
    };
    entry.onDragEnd = () => { sea.last = null; if (Math.abs(sea.current) > 0.5) d.ctx.sound.whoosh(sea.current > 0); };
  }
  d.updaters.push((dt, t) => {
    sea.current *= Math.max(0, 1 - dt * 1.4);
    sea.value = sea.current + Math.sin(t * 0.6) * 0.25 + Math.sin(t * 1.7) * 0.1;
    sea.tint = lerp(sea.tint, sea.tintTarget, dt * 1.2);
    if (back.material) back.material.color.setScalar(sea.tint);
  });
  if (bubbles) d.every(2.2, () => bubble.emit(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.05, (Math.random() - 0.5) * 0.4), 4, 0.25, 0.3));
  d.action("sea", "dark", () => { sea.tintTarget = 0.45; d.ctx.sound.click(); });
  d.action("sea", "bright", () => { sea.tintTarget = 1.15; d.ctx.sound.sparkle(); });
  d.action("sea", "sparkle", () => { for (let i = 0; i < 5; i++) trail.emit(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 0.7, (Math.random() - 0.5) * 0.4), 8, 0.3, 1.2); d.ctx.sound.sparkle(); });
  d.action("bubbles", "blow", () => sea.blow(new THREE.Vector3(0.05, 0.3, 0.2), 22));
  d.register("bubbles", new THREE.Group(), { label: "bubbles", radius: 0.3, anchor: () => d.group.localToWorld(new THREE.Vector3(0.1, 0.6, 0.1)) });
  d.action("bubbles", "blow", () => sea.blow(new THREE.Vector3(0.05, 0.3, 0.2), 22));
  return sea;
}

/** Cards that sway with the current (kelp). */
function swaysWith(d, card, sea, { amount = 0.18, stiffness = 20, name } = {}) {
  if (!card) return;
  const s = { a: 0, v: 0, seed: Math.random() * 6 };
  d.updaters.push((dt, t) => {
    const target = -sea.value * amount + Math.sin(t * 0.8 + s.seed) * 0.04;
    s.v += (target - s.a) * stiffness * dt - s.v * 4 * dt;
    s.a += s.v * dt;
    card.group.rotation.z = s.a;
  });
  if (name) d.action(name, "sway", () => { sea.current = clamp(sea.current + 1.6, -2, 2); s.v -= 1.2; d.ctx.sound.whoosh(true); });
}

/** A soft light that can be asked to glow: a flat plane on the page (never a billboard). */
function light(d, at, { color = 0xfff0b8, size = 0.4, level = 0 } = {}) {
  const plane = P.glowPlane(color, size, 0);
  plane.position.copy(at);
  d.group.add(plane);
  const s = { level, target: level, seed: Math.random() * 6 };
  d.updaters.push((dt, t) => { s.level = lerp(s.level, s.target, dt * 2.5); plane.material.opacity = s.level * (0.5 + Math.sin(t * 2.4 + s.seed) * 0.08); });
  return { plane, set: (v) => { s.target = v; }, pulse: () => { s.level = Math.min(1.2, s.level + 0.5); }, get level() { return s.level; } };
}

/* ---------- Fin ---------- */

/** Fin in the water: a gentle bob, a spring for nudges, story verbs, and a glow she can turn on. */
function swimmingFin(d, position, { scale = 0.45, pose = "swim", delay = 0.3, name = "fin", faces = 1 } = {}) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.scale.setScalar(scale);
  const baseYaw = faces < 0 ? -0.35 : 0.25;
  group.rotation.y = baseYaw;
  const fin = d.ctx.makeHero();
  fin.setPose(pose);
  group.add(fin.group);
  const halo = P.glowPlane(0xa8f4ff, 1.1, 0);
  halo.position.set(0, 0.32, -0.08);
  group.add(halo);
  const origin = position.clone();
  const state = { off: new THREE.Vector3(), vel: new THREE.Vector3(), seed: Math.random() * 6, spin: 0, glow: 0, glowTarget: 0, tilt: 0, tiltTarget: 0, travel: 0, tx: 0, dir: 1, size: 1, sizeTarget: 1, bob: pose === "sleep" ? 0.3 : 1 };
  const kick = (x, y, z = 0) => state.vel.add(new THREE.Vector3(x, y, z));
  d.add(group, {
    pop: "rise", delay, name, label: "Fin", radius: 0.22,
    anchor: () => fin.head ? fin.head.getWorldPosition(new THREE.Vector3()) : group.getWorldPosition(new THREE.Vector3()),
    onHover: (on) => { if (on) fin.blink(); },
    onTap: () => { fin.wave(); kick(0, 0.5); d.ctx.sound.chime(2, 0.4); },
  });
  const sound = d.ctx.sound;
  const swim = (dir = 1, seconds = 1.2) => { state.travel = seconds; state.dir = dir; kick(dir * 0.3, 0.2); state.tiltTarget = -0.25 * dir; setTimeout(() => { state.tiltTarget = 0; }, seconds * 900); sound.whoosh(true); };
  d.action(name, "look", () => { fin.look(); });
  d.action(name, "find", () => { fin.look(); kick(0, 0.3); });
  d.action(name, "breath", () => { kick(0, 0.7); fin.jump(); sound.pop(1.2); });
  d.action(name, "dive", () => { kick(0.2, -1.4); state.tiltTarget = 0.7; setTimeout(() => { state.tiltTarget = 0; }, 1400); sound.whoosh(false); });
  d.action(name, "wave", () => { fin.wave(); sound.chime(2, 0.4); });
  d.action(name, "giggle", () => { kick(0, 0.4); fin.blink(); sound.chime(5, 0.3); setTimeout(() => sound.chime(6, 0.25), 160); });
  d.action(name, "swim", () => swim(1));
  d.action(name, "small", () => { state.sizeTarget = 0.82; setTimeout(() => { state.sizeTarget = 1; }, 1800); fin.look(); sound.chime(0, 0.3); });
  d.action(name, "brave", () => { state.sizeTarget = 1.08; fin.jump(); kick(0, 0.8); sound.sparkle(); setTimeout(() => { state.sizeTarget = 1; }, 1600); });
  d.action(name, "ride", () => { fin.jump(); kick(0.2, 1.0); sound.whoosh(true); });
  d.action(name, "spin", () => { state.spin = 1; sound.sparkle(); });
  d.action(name, "glow", () => { state.glowTarget = 1; sound.sparkle(); setTimeout(() => { state.glowTarget = 0.2; }, 3500); });
  d.action(name, "give", () => { fin.wave(); kick(0.3, 0.3); sound.chime(4, 0.35); });
  d.action(name, "sleep", () => { fin.setPose("sleep"); state.bob = 0.3; sound.chime(0, 0.3); });
  d.action(name, "home", () => { fin.wave(); sound.chime(2, 0.4); });
  d.updaters.push((dt, t) => {
    state.vel.addScaledVector(state.off, -30 * dt).addScaledVector(state.vel, -5 * dt);
    state.off.addScaledVector(state.vel, dt);
    if (state.travel > 0) { state.travel -= dt; state.tx += state.dir * 0.13 * dt; }
    // relative to the pop-up pivot: travel + the spring's nudge, never accumulated
    group.position.set(state.tx + state.off.x * 0.2, state.off.y + Math.sin(t * 1.3 + state.seed) * 0.02 * state.bob, state.off.z);
    state.tilt = lerp(state.tilt, state.tiltTarget, dt * 3);
    state.size = lerp(state.size, state.sizeTarget, dt * 3);
    group.scale.setScalar(scale * state.size);
    if (state.spin > 0) { state.spin = Math.max(0, state.spin - dt * 1.1); }
    group.rotation.set(state.tilt, baseYaw + (1 - state.spin) * Math.PI * 2 * (state.spin > 0 ? 1 : 0), Math.sin(t * 0.9 + state.seed) * 0.04 * state.bob);
    state.glow = lerp(state.glow, state.glowTarget, dt * 2);
    halo.material.opacity = state.glow * (0.55 + Math.sin(t * 3) * 0.1);
    group.updateMatrixWorld(true);
    fin.lookAt(d.pointer);
    fin.update(dt, t);
  });
  return { group, fin, kick, state, origin, swim };
}

/** A creature card with a call and a story verb. */
function creature(d, id, { name, label = name, width, x, y = 0, z, delay = 0.3, call = "chime", note = 3, verb, radius = 0.14, rotY = 0, onTap } = {}) {
  const card = figure(d, id, { width, x, y, z, delay, name, label, radius, rotY, onTap: () => { sfx(d, call, note, 0.35); if (onTap) onTap(); } });
  if (card && verb) d.action(name, verb, () => { card.bounce(); sfx(d, call, note, 0.35); });
  return card;
}

/* ---------- the jar and the friends ---------- */

/** The glass jar Fin carries to fill with light. `fill(level)` sets how much glow it holds. */
function makeJar(d, fin, { level = 0.05 } = {}) {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 18, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.32, roughness: 0.15, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.045, 18), glass.material); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.055;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 14), new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.9 })); cork.position.y = 0.065;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0 }));
  core.position.y = -0.02;
  const halo = P.glowPlane(0xfff0b8, 0.5, 0);
  group.add(glass, bottom, cork, core, halo);
  group.position.set(0.19, 0.3, 0.1);   // in Fin's flipper (her group is scaled, so these are her units)
  fin.group.add(group);
  const state = { level, target: level };
  d.updaters.push((dt, t) => {
    state.level = lerp(state.level, state.target, dt * 2);
    core.material.opacity = Math.min(1, state.level * 1.2);
    core.scale.setScalar(0.6 + state.level * 0.9);
    halo.material.opacity = state.level * (0.75 + Math.sin(t * 2.6) * 0.1);
    halo.scale.setScalar(0.5 + state.level * 0.6);
  });
  d.register("jar", glass, { label: "jar", radius: 0.1, onTap: () => { state.level = Math.min(1.3, state.level + 0.4); d.ctx.sound.sparkle(); } });
  d.action("jar", "shine", () => { state.level = Math.min(1.3, state.level + 0.5); d.ctx.sound.sparkle(); });
  return { group, fill: (v) => { state.target = v; }, get level() { return state.level; } };
}

/** The friends who come along: each card bobs, answers its verb, and can "follow" (a hop toward Fin). */
function friends(d, list, ctx) {
  const cards = {};
  for (const f of list) {
    const card = creature(d, f.id, { name: f.name, label: f.label || f.name, width: f.width, x: f.x, y: f.y || 0, z: f.z, delay: f.delay || 0.35, call: f.call, note: f.note, verb: f.verb, radius: f.radius || 0.14 });
    if (!card) continue;
    cards[f.name] = card;
    const seed = Math.random() * 6;
    d.updaters.push((dt, t) => { card.group.position.y = Math.sin(t * 1.2 + seed) * 0.012; });
    d.action(f.name, "follow", () => { card.bounce(); card.lift(true); setTimeout(() => card.lift(false), 500); sfx(d, f.call, f.note, 0.3); });
  }
  if (cards.octopus) d.action("octopus", "dance", () => { const c = cards.octopus; c.bounce(); setTimeout(() => c.bounce(), 260); setTimeout(() => c.bounce(), 520); sfx(d, "pop", 1.3); setTimeout(() => sfx(d, "pop", 1.5), 260); });
  d.register("parade", new THREE.Group(), { label: "everyone", radius: 0.5, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.3, 0.1)) });
  d.action("parade", "cheer", () => { Object.values(cards).forEach((c, i) => setTimeout(() => c.bounce(), i * 120)); ctx.sound.sparkle(); });
  return cards;
}

const OCTO = { id: "octopus", name: "octopus", width: 0.22, call: "boing", note: 1.4, verb: "boo" };
const CRAB = { id: "crab", name: "crab", width: 0.2, call: "snap", verb: "snap" };
const JELLY = { id: "jellies", name: "jellies", label: "jellyfish", width: 0.36, call: "chime", note: 6, verb: "glow", radius: 0.2 };

/* ---------- pages ---------- */

const builders = {
  "sea-reef": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "reef-dark", { name: "reef", label: "reef" });
    const sea = makeSea(d, back, { tint: 0.85 });
    const reefGlow = light(d, new THREE.Vector3(0, 0.3, -0.5), { color: 0xffb6a0, size: 1.0, level: 0.05 });
    d.action("reef", "glow", () => { reefGlow.set(0.6); sea.tintTarget = 1.15; ctx.sound.sparkle(); setTimeout(() => { reefGlow.set(0.15); sea.tintTarget = 0.9; }, 3500); });
    d.action("reef", "dark", () => { reefGlow.set(0); sea.tintTarget = 0.45; ctx.sound.click(); });
    figure(d, "coral-front", { width: 0.9, x: 0.0, y: 0, z: 0.06, delay: 0.15, name: "corals", label: "corals", radius: 0.3, onTap: () => { reefGlow.pulse(); ctx.sound.sparkle(); } });
    const fish = creature(d, "fish-dark", { name: "fish", label: "lantern fish", width: 0.24, x: 0.26, y: 0.42, z: -0.2, delay: 0.3, call: "chime", note: 1, verb: "dim" });
    if (fish) d.updaters.push((dt, t) => { fish.group.position.y = Math.sin(t * 1.1) * 0.015; fish.group.rotation.z = Math.sin(t * 0.7) * 0.05 - 0.1; });
    swimmingFin(d, new THREE.Vector3(-0.2, 0.22, 0.32), { scale: 0.45 });
    return d;
  },

  "sea-dive": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "shallows", { name: "sea", label: "sea" });
    const sea = makeSea(d, back);
    const fin = swimmingFin(d, new THREE.Vector3(0.0, 0.5, 0.18), { scale: 0.45 });
    const jar = makeJar(d, fin, { level: 0.04 });
    let shown = false;
    d.action("jar", "shine", () => { jar.fill(0.3); ctx.sound.sparkle(); setTimeout(() => jar.fill(0.04), 1500); if (!shown) { shown = true; ctx.onMagic("jar"); } });
    d.action("fin", "dive", () => { fin.kick(0.1, -1.6); fin.state.tiltTarget = 0.8; setTimeout(() => { fin.state.tiltTarget = 0; }, 1600); sea.blow(new THREE.Vector3(0.05, 0.45, 0.25), 24); ctx.sound.whoosh(false); });
    d.every(1.6, () => sea.blow(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.2, 0.2), 3));
    return d;
  },

  "sea-kelp": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "kelp-forest", { name: "sea", label: "sea" });
    const sea = makeSea(d, back);
    const kelpA = figure(d, "kelp", { width: 0.34, x: -0.32, y: 0, z: -0.22, delay: 0.15, name: "kelp", label: "kelp", radius: 0.3 });
    const kelpB = figure(d, "kelp", { width: 0.3, x: 0.34, y: 0, z: -0.3, delay: 0.2, register: false });
    swaysWith(d, kelpA, sea, { amount: 0.2, name: "kelp" });
    swaysWith(d, kelpB, sea, { amount: 0.16 });
    const cards = friends(d, [{ ...OCTO, width: 0.26, x: 0.12, y: -0.14, z: -0.12 }], ctx);
    const octo = cards.octopus;
    const o = { up: 0.6, target: 0.6 };
    if (octo) {
      d.updaters.push((dt, t) => { o.up = lerp(o.up, o.target, dt * 5); octo.group.position.y = o.up * 0.2 + Math.sin(t * 1.4) * 0.01; });
      d.action("octopus", "peek", () => { o.target = 0.6; sfx(d, "pop", 1.2); });
      d.action("octopus", "boo", () => { o.target = 1; octo.bounce(); sfx(d, "pop", 1.5); setTimeout(() => { o.target = 0.6; }, 900); });
      d.action("octopus", "hide", () => { o.target = 0; sfx(d, "puff"); });
    }
    const fin = swimmingFin(d, new THREE.Vector3(-0.08, 0.28, 0.32), { scale: 0.45 });
    makeJar(d, fin, { level: 0.04 });
    return d;
  },

  "sea-crab": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "crab-rocks", { name: "sea", label: "sea" });
    makeSea(d, back);
    figure(d, "rocks", { width: 0.5, x: 0.16, y: 0, z: -0.22, delay: 0.15, name: "rocks", label: "rocks", radius: 0.3, onTap: () => ctx.sound.click() });
    friends(d, [{ ...CRAB, width: 0.26, x: -0.2, z: 0.04 }, { ...OCTO, width: 0.18, x: -0.42, y: 0.08, z: -0.1, delay: 0.5 }], ctx);
    const fin = swimmingFin(d, new THREE.Vector3(0.24, 0.3, 0.32), { scale: 0.45, faces: -1 });
    makeJar(d, fin, { level: 0.04 });
    return d;
  },

  "sea-deep": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "deep-dark", { name: "sea", label: "sea" });
    const sea = makeSea(d, back, { tint: 0.7 });
    const cards = friends(d, [{ ...JELLY, width: 0.6, x: 0.08, y: 0.3, z: -0.15 }, { ...OCTO, width: 0.16, x: -0.44, y: 0.04, z: 0.02, delay: 0.5 }, { ...CRAB, width: 0.14, x: -0.32, y: 0, z: 0.16, delay: 0.55 }], ctx);
    const jellies = cards.jellies;
    const glows = [];
    if (jellies) {
      [0xff9fd0, 0x9fd4ff, 0xd9b3ff].forEach((c, i) => { const g = jellies.glow(0.18 + i * 0.32, 0.75, c, 0.34, 0.12); g.userData.target = 0.12; g.userData.level = 0.12; glows.push(g); });
      d.updaters.push((dt, t) => { glows.forEach((g, i) => { g.userData.level = lerp(g.userData.level, g.userData.target, dt * 2); g.material.opacity = g.userData.level + Math.sin(t * 2 + i) * 0.04; }); });
      const lightUp = (v) => glows.forEach((g) => { g.userData.target = v; });
      const entry = d.objects.jellies;
      if (entry) { const oldHover = entry.onHover; entry.onHover = (on) => { if (oldHover) oldHover(on); lightUp(on ? 0.7 : 0.25); }; }
      d.action("jellies", "glow", () => { lightUp(0.8); jellies.bounce(); ctx.sound.sparkle(); setTimeout(() => lightUp(0.3), 3500); });
    }
    d.action("sea", "dark", () => { sea.tintTarget = 0.4; ctx.sound.click(); });
    const fin = swimmingFin(d, new THREE.Vector3(-0.2, 0.22, 0.32), { scale: 0.42 });
    const jar = makeJar(d, fin, { level: 0.05 });
    d.action("jar", "shine", () => { jar.fill(0.35); sea.sparkle(new THREE.Vector3(-0.1, 0.45, 0.3), 10); ctx.sound.sparkle(); });
    return d;
  },

  "sea-ship": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "ship-sand", { name: "ship", label: "ship" });
    const sea = makeSea(d, back);
    d.action("ship", "creak", () => { back.bounce(); ctx.sound.click(); });
    const chest = figure(d, "chest-open", { width: 0.3, x: 0.16, y: 0, z: 0.0, delay: 0.25, name: "chest", label: "chest", radius: 0.16, onTap: () => open() });
    const pearlGlow = light(d, new THREE.Vector3(0.16, 0.12, 0.05), { color: 0xfff4c8, size: 0.36, level: 0.1 });
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, emissive: 0xfff0c8, emissiveIntensity: 0.6, roughness: 0.25, clearcoat: 1 }));
    pearl.position.set(0.16, 0.1, 0.05);
    d.group.add(pearl);
    friends(d, [{ ...OCTO, width: 0.16, x: -0.44, y: 0.04, z: 0.0, delay: 0.5 }, { ...CRAB, width: 0.14, x: -0.36, y: 0, z: 0.18, delay: 0.55 }, { ...JELLY, width: 0.28, x: 0.4, y: 0.42, z: -0.2, delay: 0.6 }], ctx);
    const fin = swimmingFin(d, new THREE.Vector3(-0.2, 0.26, 0.32), { scale: 0.45 });
    const jar = makeJar(d, fin, { level: 0.3 });
    let opened = false;
    const open = () => { if (chest) chest.bounce(); pearlGlow.set(1.1); ctx.sound.chime(6, 0.4); if (!opened) { opened = true; ctx.onMagic("pearl"); } setTimeout(() => { pearlGlow.set(0.2); pearl.visible = false; jar.fill(0.9); sea.sparkle(new THREE.Vector3(-0.1, 0.45, 0.3), 16); }, 1800); };
    d.action("chest", "open", open);
    d.register("pearl", pearl, { label: "pearl", radius: 0.1, onTap: () => { pearlGlow.pulse(); ctx.sound.sparkle(); } });
    d.action("pearl", "glow", () => { pearlGlow.set(1.2); ctx.sound.sparkle(); setTimeout(() => pearlGlow.set(0.5), 2500); });
    d.action("jar", "shine", () => { jar.fill(0.9); pearl.visible = false; pearlGlow.set(0.1); sea.sparkle(new THREE.Vector3(-0.1, 0.45, 0.3), 16); ctx.sound.sparkle(); });
    d.updaters.push((dt, t) => { pearl.position.y = 0.1 + Math.sin(t * 2) * 0.006; });
    return d;
  },

  "sea-whale": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "whale-blue", { name: "sea", label: "sea" });
    const sea = makeSea(d, back);
    const whale = creature(d, "whale", { name: "whale", width: 0.92, x: 0.02, y: 0.2, z: -0.22, delay: 0.25, call: "chime", note: 0, radius: 0.4 });
    const w = { rise: 0, target: 0 };
    let sung = false;
    const song = () => { if (whale) whale.bounce(); sfx(d, "whale"); ctx.sound.chime(0, 0.6); setTimeout(() => ctx.sound.chime(1, 0.5), 400); sea.sparkle(new THREE.Vector3(-0.3, 0.35, -0.1), 12); if (!sung) { sung = true; ctx.onMagic("song"); } };
    d.action("whale", "sing", song);
    d.action("whale", "up", () => { w.target = Math.min(0.3, w.target + 0.12); ctx.sound.whoosh(true); });
    // everyone rides on the whale's back
    const riders = friends(d, [{ ...OCTO, width: 0.16, x: -0.22, y: 0.5, z: -0.16, delay: 0.5 }, { ...CRAB, width: 0.13, x: 0.02, y: 0.52, z: -0.16, delay: 0.55 }, { ...JELLY, width: 0.26, x: 0.28, y: 0.52, z: -0.18, delay: 0.6 }], ctx);
    const fin = swimmingFin(d, new THREE.Vector3(-0.42, 0.44, 0.0), { scale: 0.4 });
    makeJar(d, fin, { level: 0.9 });
    d.action("fin", "ride", () => { fin.fin.jump(); fin.kick(0, 0.9); ctx.sound.whoosh(true); });
    d.updaters.push((dt, t) => {
      w.rise = lerp(w.rise, w.target, dt * 1.2);
      if (whale) { whale.group.position.y = w.rise + Math.sin(t * 0.7) * 0.02; whale.group.rotation.z = Math.sin(t * 0.5) * 0.03; }
      for (const c of Object.values(riders)) c.group.position.y += w.rise;
      fin.group.position.y += w.rise;
    });
    return d;
  },

  "sea-plankton": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "plankton", { name: "sea", label: "sea" });
    const sea = makeSea(d, back);
    friends(d, [{ ...OCTO, width: 0.16, x: -0.42, y: 0.1, z: 0.0, delay: 0.5 }, { ...CRAB, width: 0.13, x: 0.36, y: 0, z: 0.2, delay: 0.55 }, { ...JELLY, width: 0.28, x: 0.34, y: 0.5, z: -0.2, delay: 0.6 }], ctx);
    const fin = swimmingFin(d, new THREE.Vector3(-0.04, 0.32, 0.3), { scale: 0.45 });
    const jar = makeJar(d, fin, { level: 0.9 });
    fin.state.glowTarget = 0.25;
    d.action("jar", "shine", () => { jar.fill(1.2); sea.sparkle(new THREE.Vector3(0.1, 0.5, 0.3), 24); ctx.sound.sparkle(); setTimeout(() => jar.fill(0.9), 2500); });
    d.every(1.2, () => sea.sparkle(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.15 + Math.random() * 0.8, (Math.random() - 0.5) * 0.5), 5));
    return d;
  },

  "sea-light": (ctx) => {
    const d = new Diorama(ctx);
    const bright = backCard(d, "reef-bright", { name: "reef", label: "reef" });
    const dark = backCard(d, "reef-dark", { name: "reef-dark", label: "reef", z: -0.555 });
    const sea = makeSea(d, bright, { tint: 1 });
    const fade = { v: 1, target: 1 };
    if (dark.material) { dark.material.transparent = true; dark.material.needsUpdate = true; }
    d.updaters.push((dt) => { fade.v = lerp(fade.v, fade.target, dt * 1.5); if (dark.material) dark.material.opacity = fade.v; dark.group.visible = fade.v > 0.02; });
    const fishDark = creature(d, "fish-dark", { name: "fish", label: "lantern fish", width: 0.24, x: 0.26, y: 0.42, z: -0.2, delay: 0.3, call: "chime", note: 1 });
    const fishBright = figure(d, "fish-bright", { width: 0.26, x: 0.26, y: 0.42, z: -0.19, delay: 0.3, register: false });
    if (fishBright) fishBright.group.visible = false;
    const lantern = light(d, new THREE.Vector3(0.2, 0.62, -0.15), { color: 0xffe9a8, size: 0.5, level: 0 });
    friends(d, [{ ...OCTO, width: 0.2, x: -0.42, y: 0.06, z: 0.06, delay: 0.5 }, { ...CRAB, width: 0.16, x: 0.34, y: 0, z: 0.24, delay: 0.55 }, { ...JELLY, width: 0.28, x: -0.3, y: 0.5, z: -0.25, delay: 0.6 }], ctx);
    const fin = swimmingFin(d, new THREE.Vector3(-0.06, 0.28, 0.32), { scale: 0.45 });
    const jar = makeJar(d, fin, { level: 0.35 });
    let lit = false;
    const laugh = () => {
      if (lit) { lantern.pulse(); sfx(d, "giggle"); ctx.sound.sparkle(); return; }
      lit = true;
      const f = fishDark ? fishDark : null;
      if (f) { f.bounce(); setTimeout(() => f.bounce(), 220); setTimeout(() => f.bounce(), 440); }
      sfx(d, "giggle"); setTimeout(() => sfx(d, "giggle"), 300);
      setTimeout(() => {
        fade.target = 0; lantern.set(1); sea.tintTarget = 1.15; jar.fill(0.6);
        if (fishDark) fishDark.group.visible = false;
        if (fishBright) { fishBright.group.visible = true; fishBright.bounce(); }
        sea.sparkle(new THREE.Vector3(0.25, 0.5, -0.1), 30);
        ctx.sound.sparkle(); setTimeout(() => ctx.sound.chime(6, 0.4), 300);
        ctx.onMagic("laugh");
      }, 700);
    };
    d.action("fish", "glow", laugh);
    d.action("reef", "glow", laugh);
    d.action("jar", "shine", () => { jar.fill(0.5); ctx.sound.sparkle(); setTimeout(() => jar.fill(0.35), 1500); });
    return d;
  },

  "sea-home": (ctx) => homeScene(ctx, { asleep: true }),
  end: (ctx) => homeScene(ctx, { asleep: true, ending: true }),
};

function homeScene(ctx, { asleep, ending = false }) {
  const d = new Diorama(ctx);
  const back = backCard(d, "reef-bright", { name: "reef", label: "reef" });
  const sea = makeSea(d, back, { tint: 1.05 });
  const reefGlow = light(d, new THREE.Vector3(0, 0.3, -0.5), { color: 0xffd0a8, size: 1.0, level: 0.25 });
  d.action("reef", "glow", () => { reefGlow.set(0.8); sea.tintTarget = 1.2; ctx.sound.sparkle(); setTimeout(() => { reefGlow.set(0.3); sea.tintTarget = 1.05; }, 3000); });
  figure(d, "coral-front", { width: 0.9, x: 0.0, y: 0, z: 0.04, delay: 0.15, name: "corals", label: "corals", radius: 0.3, onTap: () => { reefGlow.pulse(); ctx.sound.sparkle(); } });
  const fish = creature(d, "fish-bright", { name: "fish", label: "lantern fish", width: 0.24, x: 0.28, y: 0.44, z: -0.2, delay: 0.3, call: "giggle", note: 6, verb: "glow" });
  const lantern = light(d, new THREE.Vector3(0.22, 0.64, -0.16), { color: 0xffe9a8, size: 0.4, level: 0.6 });
  if (fish) d.updaters.push((dt, t) => { fish.group.position.y = Math.sin(t * 1.1) * 0.015; });
  friends(d, [{ ...CRAB, width: 0.2, x: -0.3, y: 0, z: 0.12 }, { ...OCTO, width: 0.22, x: 0.3, y: 0.1, z: 0.14, verb: "peek" }, { ...JELLY, width: 0.26, x: -0.36, y: 0.5, z: -0.26, delay: 0.5 }], ctx);
  const sand = d.burst(0xe9d9a8, 60, 0.02);
  d.register("sand", new THREE.Group(), { label: "sand", radius: 0.3, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.02, 0.25)) });
  d.action("sand", "puff", () => { sand.emit(new THREE.Vector3(0, 0.03, 0.25), 16, 0.2, 0.9); ctx.sound.puff(); });
  const fin = swimmingFin(d, new THREE.Vector3(-0.04, 0.02, 0.32), { scale: 0.45, pose: asleep ? "sleep" : "swim" });
  if (asleep) { fin.fin.setPose("sleep"); fin.state.bob = 0.3; }
  if (ending) setTimeout(() => ctx.onMagic("sleep"), 2500);
  d.every(3, () => { if (Math.random() < 0.5) lantern.pulse(); });
  return d;
}

export default builders;

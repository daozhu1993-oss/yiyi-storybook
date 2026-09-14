/* The spreads of "Noy and the Rain Rocket": dry paddies, a rocket festival, three rockets that
   go wrong (too small, too wet, sideways into the Naga's river), the whole village building one
   together, and the rain. The shared pop-up engine is in src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, starField, makeFall, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/* ---------- the rockets ---------- */

/** A bamboo rocket card with a fizzing fuse. Its story verbs: fizz, pop (a hop and a flop),
    drip (soaked), zoom (sideways into the river) and launch (up, up, up). */
function makeRocket(d, id, { x, y = 0, z, width, name = "rocket", label = "rocket", delay = 0.3, lean = 0, onPop = null, onZoom = null, onLaunch = null } = {}) {
  const card = figure(d, id, { width, x, y, z, delay, name, label, radius: width * 0.8, onTap: () => api.fizz() });
  if (!card) return null;
  card.group.rotation.z = lean;
  const fuse = card.glow(0.5, 0.97, 0xffd97a, width * 0.5, 0);
  const sparks = d.burst(0xffe9a8, 50, 0.018);
  const smoke = d.burst(0xd8d4cc, 80, 0.04);
  const drops = d.burst(0x8fd0ff, 30, 0.02);
  const state = { fizz: 0, mode: "idle", t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), lean };
  const tip = () => d.group.worldToLocal(card.worldPoint(0.5, 0.97, 0.03));
  const api = {
    card, state,
    fizz() { state.fizz = 1; sfx(d, "fizz", 0, 0.5); card.bounce(); sparks.emit(tip(), 8, 0.2, 0.6); },
    pop() {
      if (state.mode !== "idle") return;
      state.mode = "pop"; state.t = 0; state.fizz = 1;
      sfx(d, "fizz", 0, 0.5);
      setTimeout(() => { sparks.emit(tip(), 14, 0.35, 0.8); d.ctx.sound.pop(1.3); }, 400);
      if (onPop) setTimeout(onPop, 900);
    },
    drip() { card.bounce(); drops.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.5, 0.04)), 12, 0.25, 0.5); sfx(d, "splash", 0, 0.35); state.lean = Math.min(0.9, state.lean + 0.35); },
    zoom(target) {
      if (state.mode !== "idle") return;
      state.mode = "zoom"; state.t = 0; state.fizz = 1;
      state.from.set(0, 0, 0); state.to.copy(target);
      d.ctx.sound.whoosh(true); sfx(d, "fizz", 0, 0.4);
      if (onZoom) setTimeout(onZoom, 1100);
    },
    launch() {
      if (state.mode !== "idle") return;
      state.mode = "launch"; state.t = 0; state.fizz = 1;
      sfx(d, "launch", 0, 0.7);
      if (onLaunch) setTimeout(onLaunch, 1500);
    },
  };
  d.updaters.push((dt, t) => {
    state.fizz = Math.max(0, state.fizz - dt * 0.7);
    fuse.material.opacity = state.fizz * (0.6 + Math.sin(t * 40) * 0.3);
    if (state.fizz > 0.2 && Math.random() < 0.3) sparks.emit(tip(), 1, 0.15, 0.4);
    if (state.mode === "pop") {
      state.t += dt;
      const p = Math.min(1, state.t / 0.9);
      card.group.position.set(p * 0.12, Math.sin(p * Math.PI) * 0.12, 0);
      card.group.rotation.z = state.lean + p * 1.3;
      if (p >= 1) { state.mode = "down"; }
    } else if (state.mode === "zoom") {
      state.t += dt;
      const p = Math.min(1, state.t / 1.1);
      card.group.position.lerpVectors(state.from, state.to, p);
      card.group.position.y += Math.sin(p * Math.PI) * 0.3;
      card.group.rotation.z = state.lean - 1.2 * p;
      if (Math.random() < 0.6) smoke.emit(card.group.position.clone().add(new THREE.Vector3(x, y, z)), 1, 0.05, 0.2);
      if (p >= 1) { state.mode = "gone"; card.group.visible = false; splash(d, state.to.clone().add(new THREE.Vector3(x, 0.02, z)), { color: 0x8fd0ff, count: 18 }); sfx(d, "splash", 0, 0.5); }
    } else if (state.mode === "launch") {
      state.t += dt;
      const p = Math.min(1, state.t / 1.6);
      card.group.position.y = p * p * 1.6;
      card.group.rotation.z = state.lean * (1 - p);
      card.group.scale.setScalar(1 - p * 0.55);
      smoke.emit(new THREE.Vector3(x, y + card.group.position.y, z), 2, 0.12, 0.25);
      sparks.emit(new THREE.Vector3(x, y + card.group.position.y, z), 1, 0.2, 0.3);
      if (p >= 1) { state.mode = "gone"; card.group.visible = false; }
    } else {
      card.group.rotation.z = state.lean + Math.sin(t * 1.2) * 0.01;
    }
  });
  d.action(name, "fizz", () => api.fizz());
  d.action(name, "pop", () => api.pop());
  d.action(name, "drip", () => api.drip());
  d.action(name, "zoom", () => api.zoom(new THREE.Vector3(0.5, 0, -0.2)));
  d.action(name, "launch", () => api.launch());
  return api;
}

/* ---------- the sky, the rice and the rain ---------- */

function sky(d, id, { stars = false } = {}) {
  const card = backCard(d, id);
  const flash = card.glow(0.5, 0.7, 0xffffff, 1.2, 0);
  const state = { flash: 0 };
  d.updaters.push((dt) => { state.flash = Math.max(0, state.flash - dt * 2.5); flash.material.opacity = state.flash * 0.5; });
  d.action("sky", "empty", () => { card.bounce(); d.ctx.sound.chime(0, 0.25); });
  d.action("sky", "rumble", () => { state.flash = 1; sfx(d, "thunder", 0, 0.6); card.bounce(); });
  if (stars) {
    const list = starField(d, [[-0.45, 0.88, -0.45], [-0.2, 0.96, -0.5], [0.1, 0.9, -0.48], [0.4, 0.95, -0.5], [0.5, 0.75, -0.46]].map((p) => new THREE.Vector3(...p)), { lit: true, delay: 0.3, size: 0.03 });
    d.action("sky", "stars", () => { list.forEach((s, i) => setTimeout(() => s.twinkle(), i * 80)); d.ctx.sound.sparkle(); });
  }
  return { card, state };
}

/** The rice strip in front: dry and drooping, or green and fresh (the swap is the story's turn). */
function rice(d, { green = false, x = 0.02, z = 0.08, width = 0.92, onGreen = null } = {}) {
  const dry = figure(d, "rice-dry", { width, x, y: 0, z, delay: 0.15, name: "rice", label: "rice", radius: 0.3, register: !green });
  const fresh = figure(d, "rice-green", { width, x, y: 0, z: z + 0.005, delay: 0.15, register: green });
  if (dry) dry.group.visible = !green;
  if (fresh) fresh.group.visible = green;
  if (green && fresh) d.register("rice", fresh.group, { label: "rice", radius: 0.3, anchor: () => fresh.worldPoint(0.5, 0.4, 0.05), onTap: () => { fresh.bounce(); d.ctx.sound.sparkle(); } });
  const state = { green, droop: 0 };
  const turn = () => {
    if (state.green) { if (fresh) fresh.bounce(); d.ctx.sound.sparkle(); return; }
    state.green = true;
    if (dry) dry.group.visible = false;
    if (fresh) { fresh.group.visible = true; fresh.bounce(); d.register("rice", fresh.group, { label: "rice", radius: 0.3, anchor: () => fresh.worldPoint(0.5, 0.4, 0.05), onTap: () => fresh.bounce() }); }
    splash(d, new THREE.Vector3(x, 0.15, z + 0.05), { color: 0x9fe07a, count: 24, size: 0.022, speed: 0.4, up: 0.9 });
    sfx(d, "shimmer", 0.45);
    if (onGreen) onGreen();
  };
  d.updaters.push((dt, t) => { state.droop = Math.max(0, state.droop - dt); if (dry) dry.group.rotation.z = Math.sin(t * 0.8) * 0.01 + Math.sin(state.droop * 12) * 0.05 * state.droop; });
  d.action("rice", "wilt", () => { state.droop = 1; if (dry) dry.bounce(); d.ctx.sound.puff(); });
  d.action("rice", "green", turn);
  return { turn, state };
}

function rain(d, { level = 1, onFall = null } = {}) {
  const fall = makeFall(d, { count: 220, color: 0xdff4ff, size: 0.016, speed: 0.55, sway: 0.02, level, box: [1.4, 1.2, 1.0], center: [0, 0.6, -0.05] });
  d.register("rain", new THREE.Group(), { label: "rain", radius: 0.4, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.8, -0.1)) });
  let first = true;
  d.action("rain", "fall", () => { fall.set(Math.min(1.8, fall.level + 0.5)); sfx(d, "rain", 0, 0.5); if (first && onFall) { first = false; onFall(); } });
  return fall;
}

/* ---------- friends ---------- */

function frog(d, { x = 0.32, z = 0.0, width = 0.22 } = {}) {
  const card = friend(d, "frog", { name: "frog", label: "frog", width, x, z, delay: 0.3, call: "croak", note: 0, verb: "croak", radius: 0.14 });
  if (!card) return null;
  const s = { hop: 0 };
  d.action("frog", "hop", () => { s.hop = 1; sfx(d, "croak", 1, 0.5); });
  d.updaters.push((dt) => { if (s.hop > 0) { s.hop = Math.max(0, s.hop - dt * 1.4); card.group.position.y = Math.sin(s.hop * Math.PI) * 0.12; } });
  return card;
}

function buffalo(d, { x = 0.3, z = -0.02, width = 0.34 } = {}) {
  const card = friend(d, "buffalo", { name: "buffalo", label: "buffalo", width, x, z, delay: 0.3, call: "moo", note: 0, verb: "moo", radius: 0.2 });
  if (!card) return null;
  const mud = d.burst(0x8a5a2b, 40, 0.026);
  d.action("buffalo", "splash", () => { card.bounce(); mud.emit(d.group.worldToLocal(card.worldPoint(0.5, 0.15, 0.05)), 16, 0.35, 0.8); sfx(d, "moo", 1, 0.5); sfx(d, "splash", 0, 0.3); });
  d.action("buffalo", "carry", () => { card.bounce(); card.lift(true); setTimeout(() => card.lift(false), 900); sfx(d, "moo", 0, 0.4); });
  return card;
}

function grandpa(d, { x = 0.34, z = -0.05, width = 0.26 } = {}) {
  const card = friend(d, "grandpa", { name: "grandpa", label: "Grandpa", width, x, z, delay: 0.3, call: "khaen", note: 0, verb: "play", radius: 0.16 });
  if (!card) return null;
  const notes = d.burst(0xffd97a, 30, 0.022);
  d.action("grandpa", "play", () => { card.bounce(); sfx(d, "khaen", 0, 0.55); [0, 1, 2, 3].forEach((i) => setTimeout(() => notes.emit(d.group.worldToLocal(card.worldPoint(0.6, 0.8, 0.05)), 3, 0.15, 0.8), i * 250)); });
  return card;
}

/** The Naga rises out of the river: the card starts sunk below the page and comes up with bubbles. */
function naga(d, { x = 0.32, z = -0.18, width = 0.44, risen = false, onRise = null } = {}) {
  const card = figure(d, "naga", { width, x, y: 0, z, delay: 0.3, name: "naga", label: "Naga", radius: 0.22, onTap: () => (state.up < 0.9 ? rise() : nod()) });
  if (!card) return null;
  const state = { up: risen ? 1 : 0, target: risen ? 1 : 0, nod: 0 };
  const bubbles = d.burst(0xbfe6ff, 40, 0.024);
  const rise = () => { if (state.target >= 1) { nod(); return; } state.target = 1; sfx(d, "bubbles", 3, 0.5); [0, 1, 2, 3].forEach((i) => setTimeout(() => bubbles.emit(new THREE.Vector3(x, 0.05, z + 0.05), 6, 0.25, 0.9), i * 200)); setTimeout(() => { sfx(d, "whale", 0, 0.4); if (onRise) onRise(); }, 900); };
  const nod = () => { state.nod = 1; card.bounce(); d.ctx.sound.chime(2, 0.35); };
  d.updaters.push((dt, t) => {
    state.up = lerp(state.up, state.target, Math.min(1, dt * 1.6));
    state.nod = Math.max(0, state.nod - dt);
    card.group.position.y = -card.height * (1 - state.up) + Math.sin(t * 0.9) * 0.008 * state.up;
    card.group.rotation.z = Math.sin(state.nod * Math.PI * 2) * 0.08 * state.nod;
  });
  d.action("naga", "rise", rise);
  d.action("naga", "nod", nod);
  return { card, rise, nod };
}

function crowd(d, { x = -0.15, z = -0.3, width = 0.6 } = {}) {
  const card = friend(d, "crowd", { name: "crowd", label: "crowd", width, x, z, delay: 0.35, call: "cheer", note: 0, verb: "cheer", radius: 0.3 });
  return card;
}

/* ---------- Noy ---------- */

function standingNoy(d, position, options = {}) {
  const noy = standingHero(d, position, { scale: 0.5, name: "noy", label: "Noy", ...options });
  const sound = d.ctx.sound;
  const sparkle = d.burst(0xffe9a8, 30, 0.02);
  const head = () => d.group.worldToLocal(noy.hero.head ? noy.hero.head.getWorldPosition(_v) : noy.group.localToWorld(new THREE.Vector3(0, 0.5, 0)));
  d.action("noy", "idea", () => { noy.hero.look(); noy.spring.kick(0, 0.5, 0); sparkle.emit(head().add(new THREE.Vector3(0, 0.1, 0.05)), 12, 0.2, 0.5); sound.chime(7, 0.4); if (d.onIdea) d.onIdea(); });
  d.action("noy", "bow", () => { noy.state.bow = 1; sound.chime(3, 0.3); });
  d.action("noy", "dance", () => { noy.hero.jump(); noy.spring.kick(0.2, 1.2, 0); noy.state.shake = 1; sound.chime(5, 0.4); setTimeout(() => sound.chime(7, 0.3), 250); });
  d.updaters.push((dt) => {
    if (noy.state.bow > 0) { noy.state.bow = Math.max(0, noy.state.bow - dt * 0.8); noy.group.rotation.x = Math.sin(noy.state.bow * Math.PI) * 0.55; }
  });
  return noy;
}

/* ---------- pages ---------- */

const builders = {
  "noy-paddies": (ctx) => {
    const d = new Diorama(ctx);
    sky(d, "paddies-dry");
    rice(d, { green: false });
    grandpa(d, { x: 0.34, z: -0.05, width: 0.26 });
    let idea = false;
    d.onIdea = () => { if (!idea) { idea = true; ctx.onMagic("idea"); } };
    standingNoy(d, new THREE.Vector3(-0.2, 0, 0.32));
    return d;
  },

  "noy-festival": (ctx) => {
    const d = new Diorama(ctx);
    sky(d, "festival-field");
    figure(d, "tower", { width: 0.36, x: 0.38, y: 0, z: -0.3, delay: 0.15, name: "tower", label: "tower", radius: 0.2, onTap: () => d.ctx.sound.click() });
    crowd(d, { x: -0.18, z: -0.36, width: 0.6 });
    makeRocket(d, "rocket-big", { x: 0.24, z: -0.18, width: 0.2, lean: 0.12 });
    standingNoy(d, new THREE.Vector3(-0.28, 0, 0.32));
    return d;
  },

  "noy-frog": (ctx) => {
    const d = new Diorama(ctx);
    sky(d, "paddies-dry");
    rice(d, { green: false, z: 0.06 });
    let popped = false;
    makeRocket(d, "rocket-small", { x: 0.06, z: 0.12, width: 0.12, onPop: () => { if (!popped) { popped = true; ctx.onMagic("pop"); } } });
    frog(d, { x: 0.34, z: 0.02, width: 0.22 });
    standingNoy(d, new THREE.Vector3(-0.28, 0, 0.32));
    return d;
  },

  "noy-buffalo": (ctx) => {
    const d = new Diorama(ctx);
    sky(d, "village-yard");
    buffalo(d, { x: 0.3, z: -0.04, width: 0.34 });
    makeRocket(d, "rocket-small", { x: -0.02, z: 0.1, width: 0.14, lean: 0.25 });
    standingNoy(d, new THREE.Vector3(-0.32, 0, 0.32));
    return d;
  },

  "noy-river": (ctx) => {
    const d = new Diorama(ctx);
    const river = backCard(d, "riverbank", { name: "river", label: "river" });
    d.action("river", "ripple", () => { river.bounce(); splash(d, new THREE.Vector3(0.2, 0.05, -0.1), { color: 0x8fd0ff, count: 16 }); sfx(d, "splash", 0, 0.4); });
    let woke = false;
    const serpent = naga(d, { x: 0.34, z: -0.2, width: 0.46, onRise: () => { if (!woke) { woke = true; ctx.onMagic("naga"); } } });
    makeRocket(d, "rocket-small", { x: -0.16, z: 0.08, width: 0.13, lean: -0.3, onZoom: () => serpent && serpent.rise() });
    standingNoy(d, new THREE.Vector3(-0.36, 0, 0.32));
    return d;
  },

  "noy-naga": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "riverbank", { name: "river", label: "river" });
    naga(d, { x: 0.3, z: -0.16, width: 0.5, risen: true });
    standingNoy(d, new THREE.Vector3(-0.26, 0, 0.32));
    return d;
  },

  "noy-village": (ctx) => {
    const d = new Diorama(ctx);
    const yard = backCard(d, "village-yard", { name: "village", label: "village" });
    const g = grandpa(d, { x: -0.38, z: -0.12, width: 0.24 });
    const f = frog(d, { x: -0.12, z: 0.1, width: 0.15 });
    const b = buffalo(d, { x: 0.32, z: -0.06, width: 0.3 });
    const n = naga(d, { x: 0.5, z: -0.34, width: 0.24, risen: true });
    makeRocket(d, "rocket-big", { x: 0.08, z: -0.22, width: 0.22, lean: -0.15 });
    d.action("village", "gather", () => { yard.bounce(); [g, f, b].forEach((c, i) => c && setTimeout(() => c.bounce(), i * 120)); if (n) n.nod(); sfx(d, "cheer", 0, 0.45); });
    standingNoy(d, new THREE.Vector3(0.02, 0, 0.34), { scale: 0.46 });
    return d;
  },

  "noy-launch": (ctx) => {
    const d = new Diorama(ctx);
    const s = sky(d, "launch-sky");
    figure(d, "tower", { width: 0.4, x: 0.34, y: 0, z: -0.32, delay: 0.15, name: "tower", label: "tower", radius: 0.2, onTap: () => d.ctx.sound.click() });
    crowd(d, { x: -0.16, z: -0.12, width: 0.6 });
    let launched = false;
    makeRocket(d, "rocket-big", { x: 0.3, z: -0.26, width: 0.24, onLaunch: () => { s.state.flash = 1; sfx(d, "thunder", 0, 0.6); sfx(d, "cheer", 0, 0.5); if (!launched) { launched = true; ctx.onMagic("launch"); } } });
    standingNoy(d, new THREE.Vector3(-0.36, 0, 0.32));
    return d;
  },

  "noy-rain": (ctx) => {
    const d = new Diorama(ctx);
    sky(d, "rain-paddies");
    let rained = false;
    const fall = rain(d, { level: 1, onFall: () => { if (!rained) { rained = true; ctx.onMagic("rain"); } } });
    swipeOn(d, "sky", (dx) => { fall.blow(dx * 8); fall.set(Math.min(1.8, fall.level + Math.abs(dx) * 3)); }, { onEnd: () => sfx(d, "rain", 0, 0.4) });
    rice(d, { green: false, z: 0.06 });
    buffalo(d, { x: 0.32, z: -0.06, width: 0.3 });
    standingNoy(d, new THREE.Vector3(-0.22, 0, 0.32));
    return d;
  },

  "noy-green": (ctx) => nightScene(ctx, { asleep: false }),
  end: (ctx) => nightScene(ctx, { asleep: true }),
};

function nightScene(ctx, { asleep }) {
  const d = new Diorama(ctx);
  sky(d, "paddies-night", { stars: true });
  rice(d, { green: true, z: 0.06 });
  frog(d, { x: 0.32, z: 0.02, width: 0.2 });
  grandpa(d, { x: -0.38, z: -0.1, width: 0.24 });
  const noy = standingNoy(d, new THREE.Vector3(-0.06, 0, 0.32), { pose: asleep ? "sleep" : "stand" });
  let slept = asleep;
  d.action("noy", "sleep", () => { noy.sleep(); d.ctx.sound.chime(0, 0.3); if (!slept) { slept = true; ctx.onMagic("sleep"); } });
  if (asleep) { noy.sleep(); setTimeout(() => ctx.onMagic("sleep"), 2500); }
  d.every(5, () => sfx(d, "croak", 2, 0.25));
  return d;
}

export default builders;

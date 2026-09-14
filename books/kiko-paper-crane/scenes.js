/* The spreads of "Kiko and the Paper Crane": a race up the mountain against a rising moon,
   with a paper crane carried in Kiko's paws, a koi that jumps, a tanuki that drums, petals to
   swipe, a bell to ring, mist to blow away, and fox fire that turns paper into feathers. The
   shared pop-up engine is in src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, makeFall, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/* ---------- the moon (the clock of the story) ---------- */

/** The painted moon, higher on every page. `level` 0 = just risen, 1 = straight overhead. */
function risingMoon(d, level, { x = 0.34, z = -0.45, width = 0.28, onGift = null } = {}) {
  const y = 0.1 + level * 0.66;
  const card = figure(d, "moon", { width, x, y, z, delay: 0.2, name: "moon", label: "moon", radius: width * 0.6, onTap: () => rise() });
  if (!card) return null;
  const halo = card.glow(0.5, 0.5, 0xfff0c0, width * 2.4, 0.3);
  halo.position.z = -0.01;
  const beam = P.glowPlane(0xfff4d0, 1, 0);
  beam.scale.set(0.35, 1.4, 1);
  beam.position.set(x, y - 0.55, z + 0.02);
  d.group.add(beam);
  const state = { lift: 0, target: 0, pulse: 0, beam: 0 };
  const rise = () => { state.target = Math.min(0.12, state.target + 0.04); state.pulse = 1; d.ctx.sound.whoosh(true); sfx(d, "shimmer", 0.3); };
  const gift = () => { state.beam = 1; state.pulse = 1; sfx(d, "shimmer", 0.5); d.ctx.sound.chime(7, 0.4); if (onGift) onGift(); };
  d.updaters.push((dt, t) => {
    state.lift = lerp(state.lift, state.target, Math.min(1, dt * 2));
    state.pulse = Math.max(0, state.pulse - dt);
    card.group.position.y = state.lift + Math.sin(t * 0.8) * 0.006;
    halo.material.opacity = 0.3 + state.pulse * 0.4 + Math.sin(t * 1.4) * 0.05;
    beam.material.opacity = state.beam * (0.22 + Math.sin(t * 2) * 0.04);
    beam.position.y = y + state.lift - 0.55;
  });
  d.action("moon", "rise", rise);
  d.action("moon", "gift", gift);
  return { card, rise, gift, world: () => card.worldPoint(0.5, 0.5, 0.05) };
}

/* ---------- the crane ---------- */

/** The crane in Kiko's paws: a paper card (or the real bird after the fox fire), fluttering. */
function carriedCrane(d, kiko, { face = "crane-paper", width = 0.26 } = {}) {
  const holder = new THREE.Group();
  holder.position.set(0.16, 0.34, 0.16);   // in Kiko's units: her group is scaled
  kiko.group.add(holder);
  const cards = {};
  for (const id of ["crane-paper", "crane-real"]) {
    const a = art(d, id);
    if (!a) continue;
    const c = P.makeCard(a, { width: id === "crane-real" ? width * 1.2 : width, paperNormal: d.ctx.textures.paperNormal });
    c.group.position.y = -c.height * 0.5;
    c.group.visible = id === face;
    holder.add(c.group);
    cards[id] = c;
  }
  const halo = P.glowPlane(0xffffff, 0.55, 0);
  halo.position.z = -0.02;
  holder.add(halo);
  const state = { flutter: 0, face, glow: 0 };
  const api = {
    holder, cards, state,
    flutter(s = 1) { state.flutter = Math.min(1.5, state.flutter + s); sfx(d, "rustle", 0, 0.4); },
    become(id) { state.face = id; for (const [k, c] of Object.entries(cards)) c.group.visible = k === id; if (cards[id]) cards[id].bounce(); state.glow = 1; },
    pulse() { state.glow = 1; },
    world() { return holder.getWorldPosition(new THREE.Vector3()); },
  };
  d.register("crane", holder, { label: "crane", radius: 0.12, anchor: () => api.world(), onHover: (on) => { if (on) api.flutter(0.4); }, onTap: () => api.flutter(1) });
  d.updaters.push((dt, t) => {
    state.flutter = Math.max(0, state.flutter - dt * 1.2);
    state.glow = Math.max(0, state.glow - dt * 0.7);
    holder.rotation.z = Math.sin(t * 2.2) * 0.06 + Math.sin(t * 28) * 0.25 * state.flutter;
    holder.rotation.y = Math.sin(t * 1.4) * 0.15;
    for (const c of Object.values(cards)) c.update(dt, t);
    halo.material.opacity = state.glow * 0.8 * (state.face === "crane-real" ? 1 : 0.6);
    kiko.hero.hold(holder.getWorldPosition(_v), "right");
  });
  d.action("crane", "flutter", () => api.flutter(1));
  return api;
}

/** A crane on its own card (in the bamboo, or flying to the moon). */
function freeCrane(d, id, { x, y, z, width, delay = 0.35, name = "crane", label = "crane" } = {}) {
  const card = figure(d, id, { width, x, y, z, delay, name, label, radius: width * 0.7, onTap: () => flutter() });
  if (!card) return null;
  const state = { flutter: 0, base: 0 };
  const flutter = () => { state.flutter = Math.min(1.5, state.flutter + 1); sfx(d, "rustle", 0, 0.4); };
  d.updaters.push((dt, t) => {
    state.flutter = Math.max(0, state.flutter - dt * 1.2);
    card.group.rotation.z = Math.sin(t * 2) * 0.05 + Math.sin(t * 28) * 0.2 * state.flutter;
    if (!card.flying) card.group.position.y = Math.sin(t * 1.3) * 0.012;
  });
  d.action(name, "flutter", flutter);
  return { card, flutter, state };
}

/* ---------- Kiko ---------- */

function standingKiko(d, position, options = {}) {
  const kiko = standingHero(d, position, { scale: 0.5, name: "kiko", label: "Kiko", ...options });
  const sound = d.ctx.sound;
  d.action("kiko", "carry", () => { kiko.hero.look(); kiko.spring.kick(0, 0.4, 0); if (kiko.crane) kiko.crane.pulse(); sound.chime(4, 0.3); });
  d.action("kiko", "climb", () => { kiko.move(1, 0.9); kiko.hero.jump(); kiko.spring.kick(0.2, 1.0, 0); sound.whoosh(true); });
  return kiko;
}

/* ---------- pages ---------- */

const builders = {
  "kiko-bamboo": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "bamboo-grove");
    risingMoon(d, 0.05);
    let found = false;
    const stalk = figure(d, "bamboo-stalk", { width: 0.24, x: 0.22, y: 0, z: -0.18, delay: 0.15, name: "bamboo", label: "bamboo", radius: 0.18, onTap: () => glow() });
    const glowPlane = stalk ? stalk.glow(0.5, 0.42, 0xffd97a, 0.36, 0.4) : null;
    const gs = { pulse: 0, sway: 0 };
    const glow = () => { gs.pulse = 1; if (stalk) stalk.bounce(); sfx(d, "shimmer", 0.4); if (crane) crane.flutter(); if (!found) { found = true; ctx.onMagic("crane"); } };
    d.action("bamboo", "glow", glow);
    d.action("bamboo", "sway", () => { gs.sway += 1; d.ctx.sound.whoosh(true); });
    d.updaters.push((dt, t) => {
      gs.pulse = Math.max(0, gs.pulse - dt); gs.sway = Math.max(0, gs.sway - dt * 1.2);
      if (glowPlane) glowPlane.material.opacity = 0.4 + gs.pulse * 0.5 + Math.sin(t * 2.6) * 0.06;
      if (stalk) stalk.group.rotation.z = Math.sin(t * 1.2) * 0.02 + Math.sin(t * 9) * 0.06 * gs.sway;
    });
    const crane = freeCrane(d, "crane-paper", { x: 0.24, y: 0.3, z: -0.12, width: 0.11, delay: 0.4 });
    const kiko = standingKiko(d, new THREE.Vector3(-0.24, 0, 0.32));
    kiko.state.lookAt = () => stalk ? stalk.worldPoint(0.5, 0.45, 0.05) : d.pointer;
    return d;
  },

  "kiko-promise": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "lantern-town-dusk");
    risingMoon(d, 0.2);
    lanternsCard(d, { x: 0.3, y: 0.42, z: -0.3, width: 0.44 });
    const kiko = standingKiko(d, new THREE.Vector3(-0.22, 0, 0.32));
    kiko.crane = carriedCrane(d, kiko);
    return d;
  },

  "kiko-pond": (ctx) => {
    const d = new Diorama(ctx);
    const pond = backCard(d, "koi-pond", { name: "pond", label: "pond" });
    risingMoon(d, 0.35);
    const koi = figure(d, "koi", { width: 0.2, x: 0.14, y: 0.0, z: -0.04, delay: 0.3, name: "koi", label: "koi", radius: 0.14, onTap: () => jump() });
    const ks = { t: 1, dir: 1 };
    const jump = () => {
      if (ks.t < 1) return;
      ks.t = 0; ks.dir = Math.random() < 0.5 ? -1 : 1;
      sfx(d, "splash", 0, 0.5);
      splash(d, new THREE.Vector3(0.14, 0.04, 0.0), { color: 0x8fd0ff, count: 16, size: 0.026, speed: 0.4, up: 1.0 });
      setTimeout(() => { sfx(d, "bubbles", 3, 0.4); splash(d, new THREE.Vector3(0.14 + ks.dir * 0.1, 0.04, 0.0), { color: 0x8fd0ff, count: 14, size: 0.024, speed: 0.35, up: 0.8 }); }, 800);
    };
    d.updaters.push((dt) => {
      if (!koi) return;
      if (ks.t < 1) {
        ks.t = Math.min(1, ks.t + dt / 0.95);
        const p = ks.t;
        koi.group.position.set(ks.dir * p * 0.1, Math.sin(p * Math.PI) * 0.3, 0);
        koi.group.rotation.z = ks.dir * (p - 0.5) * -2.2;
      } else { koi.group.position.set(0, 0, 0); koi.group.rotation.z = 0; }
    });
    d.action("koi", "jump", jump);
    d.action("pond", "splash", jump);
    if (d.objects.pond) d.objects.pond.onTap = jump;
    const kiko = standingKiko(d, new THREE.Vector3(-0.3, 0, 0.32));
    kiko.crane = carriedCrane(d, kiko);
    kiko.state.lookAt = () => koi ? koi.worldPoint(0.5, 0.5, 0.05) : d.pointer;
    return d;
  },

  "kiko-tanuki": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "tanuki-forest");
    risingMoon(d, 0.5);
    const tanuki = figure(d, "tanuki", { width: 0.27, x: 0.26, y: 0, z: -0.06, delay: 0.25, name: "tanuki", label: "tanuki", radius: 0.2, onTap: () => drum() });
    const ts = { dance: 0 };
    const drum = () => { if (tanuki) tanuki.bounce(); sfx(d, "drum", 0, 0.7); setTimeout(() => { sfx(d, "drum", 1, 0.6); if (tanuki) tanuki.bounce(); }, 260); };
    d.action("tanuki", "drum", drum);
    d.action("tanuki", "dance", () => { ts.dance = 1; sfx(d, "giggle", 5, 0.5); drum(); });
    d.updaters.push((dt, t) => { ts.dance = Math.max(0, ts.dance - dt * 0.5); if (tanuki) tanuki.group.rotation.z = Math.sin(t * 9) * 0.12 * ts.dance; });
    const kiko = standingKiko(d, new THREE.Vector3(-0.28, 0, 0.32));
    kiko.crane = carriedCrane(d, kiko);
    return d;
  },

  "kiko-blossoms": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "blossom-hill");
    risingMoon(d, 0.62, { x: 0.38 });
    const petals = makeFall(d, { count: 90, color: 0xf7bfd0, size: 0.028, speed: 0.06, sway: 0.12, level: 1, center: [0, 0.55, -0.05] });
    const branch = figure(d, "blossom-branch", { width: 0.6, x: -0.22, y: 0.44, z: -0.3, delay: 0.2, name: "petals", label: "petals", radius: 0.25, onTap: () => blow(1.5) });
    const bs = { v: 0, a: 0 };
    const blow = (s) => { petals.blow(s); bs.v += s * 0.5; d.ctx.sound.whoosh(s > 0); sfx(d, "flutter", 3, 0.35); };
    swipeOn(d, "sky", (dx) => { petals.blow(dx * 12); bs.v += dx * 4; }, { onEnd: () => d.ctx.sound.whoosh(true) });
    d.updaters.push((dt, t) => { bs.v += -bs.a * 30 * dt - bs.v * 4 * dt; bs.a += bs.v * dt; if (branch) branch.group.rotation.z = clamp(bs.a, -0.2, 0.2) + Math.sin(t * 0.9) * 0.02; });
    d.action("petals", "blow", () => blow(1.5));
    const kiko = standingKiko(d, new THREE.Vector3(-0.1, 0, 0.32));
    kiko.crane = carriedCrane(d, kiko);
    return d;
  },

  "kiko-torii": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "torii-steps", { name: "steps", label: "steps" });
    risingMoon(d, 0.72, { x: -0.36 });
    figure(d, "torii", { width: 0.74, x: 0.04, y: 0, z: -0.32, delay: 0.15, name: "torii", label: "gate", radius: 0.3, onTap: () => ring() });
    const bell = figure(d, "bell", { width: 0.16, x: 0.38, y: 0.5, z: -0.2, delay: 0.3, name: "bell", label: "bell", radius: 0.12, onTap: () => ring() });
    const bs = { v: 0, a: 0, rung: false };
    const ring = () => { bs.v += 5; sfx(d, "bell", 0, 0.6); if (bell) bell.bounce(); if (!bs.rung) { bs.rung = true; ctx.onMagic("bell"); } };
    d.updaters.push((dt, t) => { bs.v += -bs.a * 40 * dt - bs.v * 2.5 * dt; bs.a += bs.v * dt; if (bell) bell.group.rotation.z = bs.a * 0.08 + Math.sin(t * 0.7) * 0.02; });
    d.action("bell", "ring", ring);
    d.action("torii", "ring", ring);
    d.action("steps", "climb", () => { d.objects.kiko && d.objects.kiko.actions.climb(); });
    const kiko = standingKiko(d, new THREE.Vector3(-0.26, 0, 0.32));
    kiko.crane = carriedCrane(d, kiko);
    return d;
  },

  "kiko-mountain": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "mountain-mist", { name: "mountain", label: "mountain" });
    risingMoon(d, 0.85, { x: 0.36 });
    const mist = makeMist(d);
    swipeOn(d, "mountain", (dx) => mist.blow(dx * 10), { onEnd: () => d.ctx.sound.whoosh(true) });
    d.action("mist", "blow", () => { mist.blow(1.6); d.ctx.sound.whoosh(true); });
    d.action("mountain", "mist", () => { mist.thicken(); d.ctx.sound.puff(); });
    const kiko = standingKiko(d, new THREE.Vector3(-0.2, 0, 0.32));
    kiko.crane = carriedCrane(d, kiko);
    return d;
  },

  "kiko-foxfire": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "mountain-mist");
    risingMoon(d, 0.9, { x: 0.36 });
    makeMist(d, { level: 0.35 });
    let fired = false;
    const kiko = standingKiko(d, new THREE.Vector3(-0.1, 0, 0.32), { onTap: () => foxfire() });
    kiko.crane = carriedCrane(d, kiko);
    // fox fire lives on her tail: a blue glow behind her, in her units
    const tail = P.glowPlane(0x66c2ff, 0.7, 0);
    tail.position.set(-0.12, 0.28, -0.2);
    kiko.group.add(tail);
    const fs = { level: 0 };
    const sparks = d.burst(0x8fd6ff, 60, 0.024);
    const foxfire = () => {
      fs.level = 1.2;
      kiko.hero.look(); kiko.spring.kick(0, 0.6, 0);
      sfx(d, "shimmer", 0.5); d.ctx.sound.glow();
      sparks.emit(d.group.worldToLocal(tail.getWorldPosition(_v)), 20, 0.4, 0.9);
      setTimeout(() => {
        sparks.emit(d.group.worldToLocal(kiko.crane.world()), 26, 0.5, 1.1);
        kiko.crane.become("crane-real");
        sfx(d, "cranecall", 0, 0.5);
        if (!fired) { fired = true; ctx.onMagic("foxfire"); }
      }, 700);
    };
    d.action("kiko", "foxfire", foxfire);
    d.action("crane", "real", () => { if (kiko.crane.state.face !== "crane-real") foxfire(); else kiko.crane.pulse(); });
    d.updaters.push((dt, t) => { fs.level = Math.max(0, fs.level - dt * 0.35); tail.material.opacity = Math.min(1, fs.level) * (0.7 + Math.sin(t * 6) * 0.15); });
    return d;
  },

  "kiko-fly": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "mountain-mist");
    const moon = risingMoon(d, 0.95, { x: 0.36 });
    let flown = false;
    const crane = freeCrane(d, "crane-real", { x: -0.02, y: 0.42, z: -0.06, width: 0.34, delay: 0.3 });
    const fly = () => {
      if (!crane || crane.card.flying) { if (crane) crane.flutter(); return; }
      crane.card.flying = { t: 0 };
      crane.flutter(); sfx(d, "cranecall", 0, 0.5); d.ctx.sound.whoosh(true);
      if (!flown) { flown = true; setTimeout(() => ctx.onMagic("fly"), 1400); }
    };
    d.updaters.push((dt) => {
      if (!crane || !crane.card.flying) return;
      const f = crane.card.flying;
      f.t = Math.min(1, f.t + dt / 2.2);
      const e = P.easeInOut(f.t);
      const to = moon ? d.group.worldToLocal(moon.world()) : new THREE.Vector3(0.36, 0.75, -0.45);
      const from = new THREE.Vector3(-0.02, 0.42, -0.06);
      const p = from.clone().lerp(to, e);
      p.y += Math.sin(f.t * Math.PI) * 0.25;
      crane.card.group.position.copy(p).sub(from);
      crane.card.group.scale.setScalar(lerp(1, 0.28, e));
      if (f.t >= 1 && !f.done) { f.done = true; sfx(d, "shimmer", 0.4); }
    });
    d.action("crane", "fly", fly);
    const kiko = standingKiko(d, new THREE.Vector3(-0.3, 0, 0.32));
    kiko.state.lookAt = () => crane ? crane.card.worldPoint(0.5, 0.5, 0.05) : d.pointer;
    d.action("kiko", "wave", () => { kiko.hero.wave(); d.ctx.sound.chime(2, 0.4); });
    return d;
  },

  "kiko-lanterns": (ctx) => lanternScene(ctx, { asleep: false }),
  end: (ctx) => lanternScene(ctx, { asleep: true }),
};

/** Three paper lanterns on a rope that light up one by one. */
function lanternsCard(d, { x = -0.26, y = 0.36, z = -0.3, width = 0.5, lit = false, onLit = null } = {}) {
  const card = figure(d, "lanterns", { width, x, y, z, delay: 0.2, name: "lanterns", label: "lanterns", radius: 0.22, onTap: () => light() });
  if (!card) return null;
  const glows = [[0.19, 0.5], [0.5, 0.45], [0.81, 0.5]].map(([nx, ny]) => card.glow(nx, ny, 0xffb060, width * 0.55, lit ? 0.7 : 0));
  const state = { level: lit ? 1 : 0, target: lit ? 1 : 0, done: lit };
  const light = new THREE.PointLight(0xffb070, lit ? 1 : 0, 1.6, 1.8);
  light.position.copy(card.point(0.5, 0.5, 0.15));
  card.group.add(light);
  const raise = () => { state.target = Math.min(1, state.target + 0.34); card.bounce(); sfx(d, "shimmer", 0.35); d.ctx.sound.chime(4 + Math.round(state.target * 3), 0.3); if (state.target >= 0.99 && !state.done) { state.done = true; if (onLit) onLit(); } };
  d.updaters.push((dt, t) => {
    state.level = lerp(state.level, state.target, Math.min(1, dt * 2));
    glows.forEach((g, i) => { const k = clamp(state.level * 3 - i, 0, 1); g.material.opacity = k * (0.7 + Math.sin(t * 5 + i) * 0.08); });
    light.intensity = state.level * 1.1;
    card.group.rotation.z = Math.sin(t * 0.9) * 0.02;
  });
  d.action("lanterns", "light", raise);
  return { card, raise, state };
}

/** Soft mist across the mountain: glow planes that drift and thin out when swiped. */
function makeMist(d, { level = 1 } = {}) {
  const planes = [];
  const spots = [[-0.42, 0.28, 0.02], [-0.1, 0.22, 0.1], [0.24, 0.3, 0.04], [0.5, 0.2, 0.12], [0.0, 0.5, -0.1]];
  spots.forEach(([x, y, z], i) => {
    const g = P.glowPlane(0xf4f7ff, 0.75, 0.32 * level);
    g.material.blending = THREE.NormalBlending;
    g.position.set(x, y, z);
    g.userData.seed = i * 1.7;
    g.userData.home = x;
    d.group.add(g);
    planes.push(g);
  });
  const state = { level, target: level, wind: 0 };
  d.register("mist", new THREE.Group(), { label: "mist", radius: 0.4, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.35, 0.05)) });
  d.updaters.push((dt, t) => {
    state.wind *= Math.max(0, 1 - dt * 1.4);
    state.target = Math.max(0, state.target - Math.abs(state.wind) * dt * 0.35);
    state.level = lerp(state.level, state.target, Math.min(1, dt * 1.5));
    planes.forEach((g) => {
      g.position.x += state.wind * 0.3 * dt;
      g.position.x = lerp(g.position.x, g.userData.home, dt * 0.3);
      g.material.opacity = state.level * (0.3 + Math.sin(t * 0.6 + g.userData.seed) * 0.06);
      g.scale.setScalar(0.75 + Math.sin(t * 0.4 + g.userData.seed) * 0.05 + Math.abs(state.wind) * 0.1);
    });
  });
  return { planes, state, blow: (s) => { state.wind += s; }, thicken: () => { state.target = Math.min(1, state.target + 0.5); } };
}

function lanternScene(ctx, { asleep }) {
  const d = new Diorama(ctx);
  backCard(d, "lantern-festival-night");
  let slept = asleep;
  const moon = risingMoon(d, 1.0, { x: 0.36, width: 0.3 });
  lanternsCard(d, { x: -0.28, y: 0.4, z: -0.3, width: 0.5, lit: asleep });
  if (asleep) freeCrane(d, "crane-real", { x: 0.36, y: 0.86, z: -0.42, width: 0.09, delay: 0.5, name: "crane", label: "crane" });
  const kiko = standingKiko(d, new THREE.Vector3(-0.06, 0, 0.32), { pose: asleep ? "sleep" : "stand", faces: -1 });
  const sleep = () => { kiko.sleep(); d.ctx.sound.chime(0, 0.3); if (moon) moon.gift(); if (!slept) { slept = true; ctx.onMagic("sleep"); } };
  d.action("kiko", "sleep", sleep);
  d.action("crane", "fly", () => { d.ctx.sound.chime(6, 0.3); sfx(d, "cranecall", 0, 0.4); });
  if (asleep) { kiko.sleep(); setTimeout(() => { if (moon) moon.gift(); ctx.onMagic("sleep"); }, 2500); }
  return d;
}

export default builders;

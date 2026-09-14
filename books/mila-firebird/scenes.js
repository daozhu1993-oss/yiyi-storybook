/* The spreads of "Mila and the Firebird Feather": a snowy birch wood, a hut on chicken legs
   that turns when you ask it nicely, Grandmother Yaga's three tasks (seeds, a sieve, a lantern
   with no fire) and the Firebird waking under the ice. The shared pop-up engine is in
   src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, makeFall, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/* ---------- weather ---------- */

function snow(d, { level = 1, count = 140 } = {}) {
  const fall = makeFall(d, { count, color: 0xffffff, size: 0.02, speed: 0.09, sway: 0.04, level });
  d.register("snow", new THREE.Group(), { label: "snow", radius: 0.4, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.8, -0.2)) });
  d.action("snow", "fall", () => { fall.set(Math.min(1.6, fall.level + 0.6)); d.ctx.sound.puff(); });
  d.action("snow", "melt", () => { fall.melt(); d.ctx.sound.sparkle(); });
  return fall;
}

/** The birch wood as a back card you can swipe: the trees sway and the snow blows. */
function birches(d, id, fall) {
  const card = backCard(d, id, { name: "birches", label: "birches" });
  const s = { a: 0, v: 0 };
  swipeOn(d, "birches", (dx) => { s.v += dx * 6; if (fall) fall.blow(dx * 10); });
  d.updaters.push((dt, t) => { s.v += -s.a * 30 * dt - s.v * 4 * dt; s.a += s.v * dt; card.group.rotation.z = clamp(s.a, -0.06, 0.06) + Math.sin(t * 0.5) * 0.004; });
  d.action("birches", "sway", () => { s.v += 0.6; d.ctx.sound.whoosh(true); if (fall) fall.blow(1.2); });
  return card;
}

/* ---------- Mila ---------- */

function standingMila(d, position, options = {}) {
  const mila = standingHero(d, position, { scale: 0.52, name: "mila", label: "Mila", ...options });
  const sound = d.ctx.sound;
  d.action("mila", "kerchief", () => { mila.hero.look(); mila.spring.kick(0, 0.4, 0); splash(d, d.group.worldToLocal(mila.hero.head ? mila.hero.head.getWorldPosition(_v) : mila.group.getWorldPosition(_v)), { color: 0xd23b2b, count: 10, size: 0.02, speed: 0.25, up: 0.5 }); sound.chime(5, 0.3); });
  d.action("mila", "sing", () => sing(d, mila));
  return mila;
}

/** Mila sings: gold notes rise from her and a little tune plays; scenes hook the lantern to it. */
function sing(d, mila) {
  const from = d.group.worldToLocal(mila.hero.head ? mila.hero.head.getWorldPosition(_v) : mila.group.getWorldPosition(_v));
  const notes = d.burst(0xffd97a, 30, 0.024);
  [0, 2, 4, 7, 4, 2, 0].forEach((n, i) => setTimeout(() => { d.ctx.sound.chime(n, 0.35); notes.emit(from.clone().add(new THREE.Vector3(0.05, 0.05, 0.05)), 3, 0.15, 0.9); }, i * 190));
  mila.hero.look();
  mila.spring.kick(0, 0.3, 0);
  if (d.onSing) d.onSing();
}

/* ---------- the hut ---------- */

/** The hut on chicken legs: it starts with its back to us (dim, mirrored) and turns to face us
    when tapped or dragged; Grandmother Yaga steps out when it has turned. */
function makeHut(d, { x = 0.14, z = -0.2, width = 0.5, onTurned = null } = {}) {
  const card = figure(d, "hut", { width, x, y: 0, z, delay: 0.15, register: false });
  if (!card) return null;
  const state = { turn: 0, target: 0, last: null, turned: false, cluck: 0 };
  d.register("hut", card.group, {
    label: "hut", radius: 0.3, anchor: () => card.worldPoint(0.5, 0.5, 0.05),
    onHover: (on) => card.lift(on),
    onTap: () => turn(),
    onDrag: (p) => { if (state.last) state.target = clamp(state.target + (p.x - state.last.x) * 3.5, 0, 1); state.last = p.clone(); },
    onDragEnd: () => { state.last = null; if (state.target > 0.55) turn(); },
  });
  const turn = () => { state.target = 1; sfx(d, "cluck", 0, 0.5); card.bounce(); };
  d.updaters.push((dt, t) => {
    card.update(dt, t);
    state.turn = lerp(state.turn, state.target, Math.min(1, dt * 2.6));
    const a = Math.PI * (1 - state.turn);
    card.group.rotation.y = a;
    card.group.scale.x = Math.cos(a) >= 0 ? 1 : -1;          // the back is the mirrored, darker hut
    const tint = 0.4 + 0.6 * state.turn;
    card.material.color.setRGB(tint, tint * 0.97, tint * 0.95);
    card.group.rotation.z = Math.sin(t * 2.4) * 0.015 * (1 - state.turn * 0.6);   // the legs shift
    card.group.position.y = Math.abs(Math.sin(t * 2.4)) * 0.008 * (1 - state.turn * 0.6);
    if (!state.turned && state.turn > 0.92) { state.turned = true; d.ctx.sound.chime(4, 0.4); if (onTurned) onTurned(); }
  });
  d.action("hut", "turn", turn);
  return { card, state, turn };
}

/* ---------- the tasks ---------- */

function seedsCard(d, { x = 0.06, z = 0.05, width = 0.34, onSorted = null } = {}) {
  const card = figure(d, "seeds", { width, x, y: 0, z, delay: 0.2, name: "seeds", label: "seeds", radius: 0.16, onTap: () => sort() });
  if (!card) return null;
  const red = d.burst(0xd23b2b, 40, 0.02), black = d.burst(0x2a2320, 40, 0.02);
  let sorted = false;
  const sort = () => {
    const from = d.group.worldToLocal(card.worldPoint(0.5, 0.35, 0.03));
    [0, 1, 2].forEach((i) => setTimeout(() => {
      red.emit(from.clone(), 7, 0.3, 0.9, new THREE.Vector3(-0.5, 0.2, 0));
      black.emit(from.clone(), 7, 0.3, 0.9, new THREE.Vector3(0.5, 0.2, 0));
      sfx(d, "snap", i, 0.5);
    }, i * 220));
    card.bounce();
    if (!sorted) { sorted = true; setTimeout(() => onSorted && onSorted(), 700); }
  };
  d.action("seeds", "sort", sort);
  return { card, sort };
}

function sieveCard(d, { x = 0.1, z = 0.05, width = 0.3, onFrozen = null } = {}) {
  const card = figure(d, "sieve", { width, x, y: 0, z, delay: 0.2, name: "sieve", label: "sieve", radius: 0.15, onTap: () => fill() });
  if (!card) return null;
  const halo = card.glow(0.5, 0.5, 0x9fd8ff, width * 1.6, 0);
  halo.position.z = -0.01;
  const state = { ice: 0, target: 0, frozen: false };
  const fill = () => { card.bounce(); splash(d, d.group.worldToLocal(card.worldPoint(0.5, 0.55, 0.04)), { color: 0x8fd0ff, count: 16, size: 0.022, speed: 0.35, up: 0.8 }); sfx(d, "splash", 0, 0.4); };
  const freeze = () => { state.target = 1; sfx(d, "shimmer", 0.4); sfx(d, "crack", 0, 0.35); card.bounce(); if (!state.frozen) { state.frozen = true; if (onFrozen) onFrozen(); } };
  d.updaters.push((dt, t) => {
    state.ice = lerp(state.ice, state.target, Math.min(1, dt * 2));
    card.material.color.setRGB(1 - state.ice * 0.25, 1 - state.ice * 0.1, 1);
    card.material.emissive.setRGB(state.ice * 0.05, state.ice * 0.12, state.ice * 0.25);
    halo.material.opacity = state.ice * (0.35 + Math.sin(t * 2) * 0.06);
  });
  d.action("sieve", "fill", fill);
  d.action("sieve", "freeze", freeze);
  return { card, fill, freeze };
}

function lanternCard(d, { x = 0.12, z = 0.03, width = 0.26, glow = 0, onLit = null } = {}) {
  const card = figure(d, "lantern", { width, x, y: 0, z, delay: 0.2, name: "lantern", label: "lantern", radius: 0.15, onTap: () => light(0.5) });
  if (!card) return null;
  const eyes = [card.glow(0.4, 0.62, 0xffd27a, width * 0.55, 0), card.glow(0.6, 0.62, 0xffd27a, width * 0.55, 0)];
  const halo = card.glow(0.5, 0.55, 0xffc26a, width * 2.2, 0);
  halo.position.z = -0.01;
  const light = new THREE.PointLight(0xffc98a, 0, 1.4, 1.8);
  light.position.copy(card.point(0.5, 0.6, 0.12));
  card.group.add(light);
  const state = { level: glow, target: glow, lit: false };
  const raise = (v) => { state.target = clamp(state.target + v, 0, 1); card.bounce(); sfx(d, "shimmer", 0.35); if (state.target >= 0.99 && !state.lit) { state.lit = true; if (onLit) onLit(); } };
  d.updaters.push((dt, t) => {
    state.level = lerp(state.level, state.target, Math.min(1, dt * 1.8));
    const flick = 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.03;
    eyes.forEach((e) => { e.material.opacity = state.level * 0.9 * flick; });
    halo.material.opacity = state.level * 0.4 * flick;
    light.intensity = state.level * 1.2 * flick;
    card.material.emissive.setRGB(state.level * 0.25, state.level * 0.15, state.level * 0.03);
  });
  d.action("lantern", "light", () => raise(0.5));
  return { card, raise, state };
}

/* ---------- friends ---------- */

function yaga(d, { x = -0.32, z = -0.15, width = 0.34, hidden = false } = {}) {
  const card = friend(d, "yaga", { name: "yaga", label: "Yaga", width, x, z, delay: 0.25, call: "chime", note: 1, verb: "grumble", radius: 0.2 });
  if (!card) return null;
  d.action("yaga", "nod", () => { card.bounce(); d.ctx.sound.chime(3, 0.3); });
  if (hidden) card.group.visible = false;
  return card;
}

function wolf(d, { x = 0.3, z = 0.02, width = 0.24, rotY = 0 } = {}) {
  const card = friend(d, "wolf", { name: "wolf", label: "wolf", width, x, z, delay: 0.3, call: "howl", note: 0, verb: "howl", radius: 0.16, rotY });
  if (!card) return null;
  d.action("wolf", "look", () => { card.bounce(); card.lift(true); setTimeout(() => card.lift(false), 700); d.ctx.sound.chime(2, 0.3); });
  return card;
}

function firebird(d, { x = 0.12, z = -0.12, width = 0.44, awake = false, floating = false, onWake = null } = {}) {
  const asleep = figure(d, "firebird-asleep", { width, x, y: 0, z, delay: 0.25, name: "firebird", label: "Firebird", radius: 0.2, onTap: () => wake() });
  const awakeCard = figure(d, "firebird-awake", { width: width * 1.15, x, y: floating ? 0.35 : 0.02, z, delay: 0.25, register: false });
  if (awakeCard) { awakeCard.group.visible = awake; }
  if (asleep) asleep.group.visible = !awake;
  const halo = awakeCard ? awakeCard.glow(0.5, 0.5, 0xffb347, width * 2.4, 0.3) : null;
  if (halo) halo.position.z = -0.01;
  const state = { awake, bob: 0 };
  const sparks = d.burst(0xffc857, 60, 0.026);
  const wake = () => {
    if (state.awake) { if (awakeCard) awakeCard.bounce(); sparks.emit(d.group.worldToLocal(awakeCard.worldPoint(0.5, 0.5, 0.05)), 14, 0.4, 1.0); sfx(d, "shimmer", 0.4); return; }
    state.awake = true;
    sfx(d, "crack", 0, 0.5);
    const at = d.group.worldToLocal((asleep || awakeCard).worldPoint(0.5, 0.35, 0.05));
    splash(d, at, { color: 0xe8f4ff, count: 20, size: 0.03, speed: 0.5, up: 1.2 });
    setTimeout(() => {
      if (asleep) asleep.group.visible = false;
      if (awakeCard) { awakeCard.group.visible = true; awakeCard.bounce(); d.register("firebird", awakeCard.group, { label: "Firebird", radius: 0.22, anchor: () => awakeCard.worldPoint(0.5, 0.5, 0.05), onTap: () => wake() }); }
      sparks.emit(at.clone(), 30, 0.5, 1.4);
      sfx(d, "shimmer", 0.5); d.ctx.sound.chime(7, 0.4);
      if (onWake) onWake();
    }, 500);
  };
  if (awake && awakeCard) d.register("firebird", awakeCard.group, { label: "Firebird", radius: 0.22, anchor: () => awakeCard.worldPoint(0.5, 0.5, 0.05), onTap: () => wake() });
  d.updaters.push((dt, t) => {
    if (awakeCard && floating) awakeCard.group.position.y = 0.35 + Math.sin(t * 1.3) * 0.03;
    if (halo) halo.material.opacity = state.awake ? 0.3 + Math.sin(t * 2.2) * 0.06 : 0;
  });
  d.action("firebird", "sleep", () => { if (asleep && asleep.group.visible) asleep.bounce(); d.ctx.sound.chime(0, 0.25); });
  d.action("firebird", "wake", wake);
  return { asleep, awakeCard, wake, state };
}

/* ---------- pages ---------- */

const builders = {
  "mila-winter": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "village-winter");
    const fall = snow(d, { level: 1 });
    friend(d, "grandpa", { name: "grandpa", label: "Grandpa", width: 0.26, x: 0.3, z: -0.05, delay: 0.25, call: "chime", note: 2, verb: "nod", radius: 0.18 });
    firebird(d, { x: -0.36, z: -0.3, width: 0.22 });
    standingMila(d, new THREE.Vector3(-0.1, 0, 0.32));
    return d;
  },

  "mila-forest": (ctx) => {
    const d = new Diorama(ctx);
    const fall = snow(d, { level: 1.2 });
    birches(d, "birch-wood", fall);
    wolf(d, { x: 0.3, z: 0.0, width: 0.24 });
    standingMila(d, new THREE.Vector3(-0.2, 0, 0.32));
    return d;
  },

  "mila-hut": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "hut-clearing");
    snow(d, { level: 0.6 });
    let toasted = false;
    const y = yaga(d, { x: 0.44, z: -0.02, width: 0.36, hidden: true });
    makeHut(d, { x: 0.1, z: -0.2, width: 0.5, onTurned: () => { if (y) { y.group.visible = true; y.bounce(); } if (!toasted) { toasted = true; ctx.onMagic("hut"); } } });
    standingMila(d, new THREE.Vector3(-0.34, 0, 0.32));
    return d;
  },

  "mila-tasks": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "cottage-inside");
    yaga(d, { x: -0.32, z: -0.15, width: 0.34 });
    seedsCard(d, { x: -0.02, z: 0.02, width: 0.18 });
    sieveCard(d, { x: 0.2, z: 0.04, width: 0.16 });
    lanternCard(d, { x: 0.4, z: 0.0, width: 0.15 });
    firebird(d, { x: 0.2, z: -0.4, width: 0.16 });
    standingMila(d, new THREE.Vector3(0.34, 0, 0.32), { faces: -1 });
    return d;
  },

  "mila-seeds": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "cottage-inside");
    yaga(d, { x: 0.42, z: -0.22, width: 0.34 });
    let done = false;
    seedsCard(d, { x: 0.02, z: 0.06, width: 0.36, onSorted: () => { if (!done) { done = true; ctx.onMagic("seeds"); } } });
    const doll = friend(d, "doll", { name: "doll", label: "doll", width: 0.13, x: -0.34, z: 0.14, delay: 0.3, call: "giggle", note: 5, verb: "help", radius: 0.1 });
    d.action("doll", "help", () => { if (doll) doll.bounce(); d.ctx.sound.chime(6, 0.25); setTimeout(() => d.objects.seeds && d.objects.seeds.actions.sort(), 400); });
    standingMila(d, new THREE.Vector3(-0.2, 0, 0.32), { faces: 1 });
    return d;
  },

  "mila-sieve": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "cottage-inside");
    let frozen = false;
    const sieve = sieveCard(d, { x: 0.08, z: 0.06, width: 0.3, onFrozen: () => { if (!frozen) { frozen = true; ctx.onMagic("ice"); } } });
    const w = wolf(d, { x: -0.3, z: 0.0, width: 0.24 });
    const frost = d.burst(0xeaf6ff, 50, 0.03);
    const breathe = () => {
      if (w) w.bounce();
      sfx(d, "breath", 0, 0.5);
      const from = w ? d.group.worldToLocal(w.worldPoint(0.8, 0.62, 0.04)) : new THREE.Vector3(-0.2, 0.2, 0.05);
      [0, 1, 2].forEach((i) => setTimeout(() => frost.emit(from.clone(), 8, 0.2, 0.3, new THREE.Vector3(0.9, 0.1, 0)), i * 150));
      setTimeout(() => sieve && sieve.freeze(), 650);
    };
    d.action("wolf", "breathe", breathe);
    standingMila(d, new THREE.Vector3(0.4, 0, 0.32), { faces: -1 });
    return d;
  },

  "mila-lantern": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "cottage-inside");
    yaga(d, { x: -0.36, z: -0.2, width: 0.32 });
    let lit = false;
    const lantern = lanternCard(d, { x: 0.12, z: 0.04, width: 0.28, glow: 0.04, onLit: () => { if (!lit) { lit = true; ctx.onMagic("lantern"); } } });
    d.onSing = () => { setTimeout(() => lantern && lantern.raise(0.4), 900); };
    let mila = null;
    mila = standingMila(d, new THREE.Vector3(0.4, 0, 0.32), { faces: -1, onTap: () => mila && sing(d, mila) });
    return d;
  },

  "mila-feather": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "cottage-inside");
    yaga(d, { x: -0.36, z: -0.15, width: 0.32 });
    const stove = figure(d, "stove", { width: 0.42, x: 0.26, y: 0, z: -0.24, delay: 0.2, name: "stove", label: "stove", radius: 0.2, onTap: () => glowStove() });
    const fire = stove ? stove.glow(0.5, 0.4, 0xff9a3c, 0.3, 0.35) : null;
    const st = { glow: 0 };
    const glowStove = () => { st.glow = 1; if (stove) stove.bounce(); d.ctx.sound.puff(); sfx(d, "shimmer", 0.3); };
    d.action("stove", "glow", glowStove);
    const feather = figure(d, "feather", { width: 0.16, x: 0.04, y: 0.28, z: 0.12, delay: 0.35, name: "feather", label: "feather", radius: 0.12, onTap: () => glowFeather() });
    const halo = feather ? feather.glow(0.5, 0.5, 0xffb347, 0.5, 0.3) : null;
    if (halo) halo.position.z = -0.01;
    const fs = { pulse: 0 };
    const glowFeather = () => { fs.pulse = 1; if (feather) feather.bounce(); sfx(d, "shimmer", 0.4); splash(d, new THREE.Vector3(0.04, 0.38, 0.12), { color: 0xffc857, count: 12, size: 0.022, speed: 0.3, up: 0.7 }); };
    d.action("feather", "glow", glowFeather);
    d.updaters.push((dt, t) => {
      st.glow = Math.max(0, st.glow - dt * 0.6);
      if (fire) fire.material.opacity = 0.3 + st.glow * 0.5 + Math.sin(t * 7) * 0.05;
      fs.pulse = Math.max(0, fs.pulse - dt);
      if (feather) { feather.group.position.y = Math.sin(t * 1.4) * 0.02; feather.group.rotation.z = Math.sin(t * 0.9) * 0.12; }
      if (halo) halo.material.opacity = 0.3 + fs.pulse * 0.5 + Math.sin(t * 2.4) * 0.05;
    });
    standingMila(d, new THREE.Vector3(0.36, 0, 0.32), { faces: -1 });
    return d;
  },

  "mila-wake": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "frozen-lake", { name: "lake", label: "lake" });
    snow(d, { level: 0.5 });
    let woke = false;
    const bird = firebird(d, { x: 0.14, z: -0.14, width: 0.46, onWake: () => { if (!woke) { woke = true; ctx.onMagic("firebird"); } } });
    d.action("lake", "crack", () => { sfx(d, "crack", 0, 0.5); splash(d, new THREE.Vector3(0.1, 0.05, 0.0), { color: 0xe8f4ff, count: 16, size: 0.028, speed: 0.4, up: 0.9 }); });
    const mila = standingMila(d, new THREE.Vector3(-0.34, 0, 0.32), { faces: 1 });
    // the feather in Mila's hand (her group is scaled, so these are her units)
    const a = art(d, "feather");
    let halo = null;
    if (a) {
      const card = P.makeCard(a, { width: 0.3, paperNormal: d.ctx.textures.paperNormal });
      const holder = new THREE.Group();
      holder.position.set(0.2, 0.34, 0.16);
      holder.rotation.z = -0.4;
      holder.add(card.group);
      halo = P.glowPlane(0xffb347, 0.7, 0.35);
      halo.position.set(0, 0.15, -0.02);
      holder.add(halo);
      mila.group.add(holder);
      const fs = { pulse: 0 };
      d.register("feather", holder, { label: "feather", radius: 0.12, anchor: () => holder.getWorldPosition(new THREE.Vector3()), onTap: () => glow() });
      const glow = () => { fs.pulse = 1; card.bounce(); sfx(d, "shimmer", 0.45); mila.hero.jump(); mila.spring.kick(0, 0.9, 0); splash(d, d.group.worldToLocal(holder.getWorldPosition(_v)), { color: 0xffc857, count: 12, size: 0.022, speed: 0.3, up: 0.8 }); };
      d.action("feather", "glow", glow);
      d.updaters.push((dt, t) => {
        card.update(dt, t);
        mila.hero.hold(holder.getWorldPosition(_v), "right");
        fs.pulse = Math.max(0, fs.pulse - dt);
        halo.material.opacity = 0.35 + fs.pulse * 0.5 + Math.sin(t * 2.4) * 0.05;
      });
    }
    return d;
  },

  "mila-spring": (ctx) => springScene(ctx, { asleep: false }),
  end: (ctx) => springScene(ctx, { asleep: true }),
};

function springScene(ctx, { asleep }) {
  const d = new Diorama(ctx);
  backCard(d, "spring-wood");
  const fall = snow(d, { level: asleep ? 0 : 0.35 });
  let melted = asleep;
  d.action("snow", "melt", () => { fall.melt(); d.ctx.sound.sparkle(); if (!melted) { melted = true; ctx.onMagic("spring"); } });
  const flowers = figure(d, "flowers", { width: 0.9, x: 0.0, y: 0, z: 0.08, delay: 0.2, name: "flowers", label: "flowers", radius: 0.3, onTap: () => bloom() });
  const petals = d.burst(0xf6c1cf, 40, 0.022);
  const bloom = () => { if (flowers) flowers.bounce(); petals.emit(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.12, 0.1), 14, 0.3, 0.8); sfx(d, "shimmer", 0.35); };
  d.action("flowers", "bloom", bloom);
  wolf(d, { x: 0.3, z: -0.06, width: 0.22 });
  yaga(d, { x: 0.46, z: -0.3, width: 0.24 });
  firebird(d, { x: -0.22, z: -0.3, width: 0.34, awake: true, floating: true });
  const mila = standingMila(d, new THREE.Vector3(-0.08, 0, 0.32), { pose: asleep ? "sleep" : "stand", faces: 1 });
  if (asleep) { mila.sleep(); setTimeout(() => ctx.onMagic("spring"), 2500); }
  return d;
}

export default builders;

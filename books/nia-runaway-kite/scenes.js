/* The spreads of "Nia and the Runaway Kite": one builder per scene id in story.json, plus the
   end page. Nia-specific pieces (the kite on its string, the wind you can swipe, Nia's story
   verbs) live here; the shared pop-up engine is in src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingSpring } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/** A sound the kit may or may not have. */
function sfx(d, name, ...args) {
  const s = d.ctx.sound;
  if (s[name]) return s[name](...args);
  return s.chime(3, 0.3);
}

/* ---------- the wind ---------- */

/** One shared wind per spread: gusts from story verbs or a swipe, and a gentle idle breeze.
    Everything that leans, flutters or flies reads `wind.value` (about -1..1, positive = to the right). */
function makeWind(d, back, { idle = 0.25 } = {}) {
  const wind = { value: 0, gust: 0, idle, seed: Math.random() * 6, last: null, listeners: [] };
  wind.blow = (strength = 1) => {
    wind.gust = clamp(wind.gust + strength, -2.4, 2.4);
    d.ctx.sound.whoosh(strength > 0);
    if (Math.abs(strength) > 0.6) leaves(d, back, strength);
    for (const fn of wind.listeners) fn(strength);
  };
  // swipe across the page: the back card takes the drag and turns sideways motion into wind
  const entry = d.objects[back.name || "sky"] || Object.values(d.objects)[0];
  if (entry) {
    entry.onDrag = (worldPoint) => {
      if (wind.last) {
        const dx = worldPoint.x - wind.last.x;
        if (Math.abs(dx) > 0.004) wind.gust = clamp(wind.gust + dx * 9, -2.4, 2.4);
      }
      wind.last = worldPoint.clone();
    };
    entry.onDragEnd = () => { if (Math.abs(wind.gust) > 0.5) { d.ctx.sound.whoosh(wind.gust > 0); leaves(d, back, wind.gust); } wind.last = null; };
  }
  d.updaters.push((dt, t) => {
    wind.gust *= Math.max(0, 1 - dt * 1.6);
    wind.value = wind.gust + Math.sin(t * 0.8 + wind.seed) * idle * 0.6 + Math.sin(t * 2.3 + wind.seed) * idle * 0.25;
  });
  d.register("wind", new THREE.Group(), { label: "wind", radius: 0.4, anchor: () => back.worldPoint ? back.worldPoint(0.5, 0.85, 0.05) : d.group.getWorldPosition(new THREE.Vector3()) });
  d.action("wind", "blow", () => wind.blow(1.2));
  d.action("wind", "gust", () => wind.blow(2.2));
  d.action("wind", "soft", () => { wind.gust *= 0.3; wind.idle = 0.12; d.ctx.sound.sparkle(); });
  return wind;
}

function leaves(d, back, strength) {
  const burst = d.burst(0xa8d46a, 40, 0.024);
  const origin = new THREE.Vector3(strength > 0 ? -0.5 : 0.5, 0.35, 0.05);
  burst.emit(origin, 14, 0.5, 1.6, new THREE.Vector3(Math.sign(strength) * 0.9, 0.15, 0));
}

/** Cards that lean with the wind (grass, trees): a spring on rotation.z. */
function leansWith(d, card, wind, { amount = 0.18, stiffness = 26, name } = {}) {
  if (!card) return;
  const s = { a: 0, v: 0 };
  d.updaters.push((dt) => {
    const target = -wind.value * amount;
    s.v += (target - s.a) * stiffness * dt - s.v * 4.5 * dt;
    s.a += s.v * dt;
    card.group.rotation.z = s.a;
  });
  if (name) d.action(name, "lean", () => { wind.blow(1.6); s.v -= 1.2; });
}

/* ---------- the kite ---------- */

/** The red kite: a painted card that flies on a spring, a ribbon tail, and a string back to
    whoever holds it. Modes: held (tethered, tugging), free (drifting away), stuck (held in
    place by a cloud or a tree), hung (on a peg). */
function makeKite(d, { width = 0.22, at = new THREE.Vector3(0.25, 0.8, -0.1), mode = "held", wind = null, delay = 0.35, face = "kite-face", name = "kite", label = "kite" } = {}) {
  const group = new THREE.Group();
  const a = art(d, face) || art(d, "kite-face");
  const card = a ? P.makeCard(a, { width, paperNormal: d.ctx.textures.paperNormal }) : null;
  const height = card ? card.height : width * 1.35;
  if (card) { card.group.position.y = -height * 0.5; group.add(card.group); }
  // tail: a string of little bows
  const bows = [];
  const bowColors = [0x4f8fd6, 0xf2c94c, 0xe2493d, 0x4f8fd6, 0xf2c94c, 0xe2493d];
  const tailMat = new THREE.LineBasicMaterial({ color: 0xf6e7c8 });
  const tailGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 8 }, () => new THREE.Vector3()));
  const tail = new THREE.Line(tailGeo, tailMat);
  group.add(tail);
  bowColors.forEach((c, i) => {
    const bow = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.02), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }));
    group.add(bow); bows.push(bow);
  });
  // string
  const N = 16;
  const stringGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: N }, () => new THREE.Vector3()));
  const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xfff7e6, transparent: true, opacity: 0.9 }));
  string.frustumCulled = false;
  d.group.add(string);
  // the pop-up pivot (Diorama.add) takes `at` and zeroes the group, so everything here is
  // relative to `origin`; absolute targets are converted on the way in
  const origin = at.clone();
  const state = { mode, pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(), drag: null, seed: Math.random() * 6, anchor: null, tug: 0 };
  group.position.copy(origin);
  const api = {
    group, card, state, string, height, origin,
    setMode(m) { state.mode = m; string.visible = m === "held"; },
    setTarget(v) { state.target.copy(v).sub(origin); },
    setDepth(z) { state.pos.z = z - origin.z; state.target.z = z - origin.z; },
    kick(x, y, z = 0) { state.vel.add(new THREE.Vector3(x, y, z)); },
    wobble() { state.vel.x += (Math.random() - 0.5) * 1.2; state.vel.y += 0.4; },
    /** who holds the string: a function returning a world point */
    tether(fn) { state.anchor = fn; string.visible = state.mode === "held"; },
    /** world position of the string knot (bottom tip of the kite) */
    knot() { return group.localToWorld(new THREE.Vector3(0, -height, 0)); },
    update(dt, t) {
      const w = wind ? wind.value : 0;
      if (state.mode === "hung") {
        group.position.copy(state.target);
        group.rotation.z = Math.sin(t * 1.3 + state.seed) * 0.03;
      } else if (state.drag) {
        state.pos.lerp(state.drag, Math.min(1, dt * 12));
        state.vel.multiplyScalar(0.5);
        group.position.copy(state.pos);
      } else {
        const sway = state.mode === "stuck" ? 0.02 : 0.06;
        _v.set(Math.sin(t * 0.9 + state.seed) * sway + w * 0.22, Math.sin(t * 1.4 + state.seed * 1.7) * sway * 0.6 + Math.abs(w) * 0.05, 0).add(state.target);
        const k = state.mode === "stuck" ? 40 : 14;
        state.vel.addScaledVector(_v.sub(state.pos), k * dt).addScaledVector(state.vel, -4.2 * dt);
        if (state.mode === "free") state.vel.x += w * 0.25 * dt * 10;
        state.pos.addScaledVector(state.vel, dt);
        group.position.copy(state.pos);
      }
      state.tug = lerp(state.tug, clamp(state.vel.length() * 2 + Math.abs(w) * 0.5, 0, 1), dt * 6);
      group.rotation.z = clamp(-state.vel.x * 0.5 - w * 0.25, -0.7, 0.7);
      group.rotation.x = clamp(-state.vel.y * 0.25, -0.35, 0.35);
      // tail trails away from the motion and the wind
      const dir = new THREE.Vector3(-state.vel.x * 0.4 - w * 0.5, -1, 0.15).normalize();
      const pts = tailGeo.attributes.position.array;
      for (let i = 0; i < 8; i++) {
        const u = i / 7;
        const p = new THREE.Vector3(0, -height, 0).addScaledVector(dir, u * 0.34);
        p.x += Math.sin(t * 5 + u * 6 + state.seed) * 0.03 * u;
        p.z += Math.cos(t * 4 + u * 5) * 0.02 * u;
        pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z;
        if (i > 0 && i - 1 < bows.length) { bows[i - 1].position.copy(p); bows[i - 1].rotation.z = Math.sin(t * 6 + i) * 0.5; }
      }
      tailGeo.attributes.position.needsUpdate = true;
      // the string, from the holder to the knot with a little sag
      if (string.visible && state.anchor) {
        const from = d.group.worldToLocal(state.anchor().clone());
        const to = d.group.worldToLocal(api.knot());
        const arr = stringGeo.attributes.position.array;
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1);
          const p = from.clone().lerp(to, u);
          p.y -= Math.sin(u * Math.PI) * 0.05 * (1 - state.tug * 0.7);
          p.x += Math.sin(u * Math.PI) * w * 0.04;
          arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
        }
        stringGeo.attributes.position.needsUpdate = true;
        stringGeo.computeBoundingSphere();
      }
    },
  };
  api.setMode(mode);
  d.add(group, {
    pop: "rise", delay, name, label, radius: 0.16,
    anchor: () => group.getWorldPosition(new THREE.Vector3()),
    onHover: (on) => { if (on) api.wobble(); },
    onTap: () => { api.kick((Math.random() - 0.5) * 1.2, 0.9); d.ctx.sound.pop(1.2); },
    onDrag: (worldPoint) => { const local = d.group.worldToLocal(worldPoint.clone()).sub(origin); local.z = state.pos.z; local.y = Math.max(0.15 - origin.y, local.y); state.drag = local; },
    onDragEnd: () => { if (state.drag) state.target.copy(state.drag); state.drag = null; d.ctx.sound.whoosh(true); },
  });
  d.updaters.push((dt, t) => api.update(dt, t));
  d.action(name, "tug", () => { api.kick(0.3, 0.8); d.ctx.sound.pop(1.1); });
  d.action(name, "up", () => { api.kick(0, 1.6); d.ctx.sound.whoosh(true); });
  d.action(name, "dance", () => { api.kick(0.9, 0.5); setTimeout(() => api.kick(-1.2, 0.3), 350); setTimeout(() => api.kick(0.7, 0.4), 700); d.ctx.sound.sparkle(); });
  d.action(name, "high", () => { api.kick(0, 1.2); d.ctx.sound.whoosh(true); });
  d.action(name, "down", () => { api.kick(0, -1.3); d.ctx.sound.whoosh(false); });
  d.action(name, "away", () => { api.setMode("free"); api.kick(1.4, 0.9); d.ctx.sound.whoosh(true); });
  d.action(name, "stuck", () => { api.wobble(); d.ctx.sound.puff(); });
  d.action(name, "pop", () => { api.wobble(); d.ctx.sound.pop(1.3); });
  d.action(name, "hang", () => { api.wobble(); d.ctx.sound.chime(4, 0.3); });
  return api;
}

/* ---------- Nia ---------- */

/** Nia standing on the page (a spring under her feet, story verbs, and a hand for the string). */
function standingNia(d, position, { scale = 0.5, pose = "stand", delay = 0.3, name = "nia", holds = null, faces = 1 } = {}) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.scale.setScalar(scale);
  group.rotation.y = faces < 0 ? -0.35 : 0.25;
  const nia = d.ctx.makeHero();
  nia.setPose(pose);
  group.add(nia.group);
  const origin = position.clone();
  const state = { kite: holds, running: 0, dir: 1 };
  let spring = null;
  d.add(group, {
    pop: "rise", delay, name, label: "Nia", radius: 0.22,
    anchor: () => nia.head ? nia.head.getWorldPosition(new THREE.Vector3()) : group.getWorldPosition(new THREE.Vector3()),
    onHover: (on) => { if (on) nia.blink(); },
    onTap: () => { nia.wave(); spring.kick(0, 0.5, 0); d.ctx.sound.chime(2, 0.4); },
  });
  spring = standingSpring(group); // after add(): the pivot holds the place, the spring works from zero
  const sound = d.ctx.sound;
  const run = (dir = 1, seconds = 1.1) => { state.running = seconds; state.dir = dir; nia.setPose("run"); spring.kick(dir * 0.4, 0.35, 0); sound.whoosh(true); };
  const holdPose = () => { nia.play("hold"); spring.kick(-0.2, 0.2, 0); }; // Pull_Radish: a lean-back tug on the string
  d.action(name, "run", () => run(1));
  d.action(name, "walk", () => run(1, 1.4));
  d.action(name, "chase", () => run(1));
  d.action(name, "hold", () => { holdPose(); sound.pop(1.0); });
  d.action(name, "hop", () => { nia.jump(); spring.kick(0.3, 1.3, 0); sound.pop(1.2); });
  d.action(name, "jump", () => { nia.jump(); spring.kick(0, 1.6, 0); sound.whoosh(true); });
  d.action(name, "climb", () => { run(1, 1.2); spring.kick(0.2, 0.9, 0); });
  d.action(name, "slip", () => { nia.look(); spring.kick(-0.3, 0.3, 0); sound.pop(0.7); if (state.kite) { state.kite.setMode("free"); state.kite.kick(1.2, 0.8); } });
  d.action(name, "oh", () => { nia.jump(); sound.chime(1, 0.4); });
  d.action(name, "hat", () => { nia.look(); spring.kick(0, 0.3, 0); sound.click(); });
  d.action(name, "catch", () => { nia.jump(); spring.kick(0, 1.4, 0); sound.sparkle(); if (state.kite) { state.kite.setMode("held"); state.kite.setTarget(new THREE.Vector3(origin.x + group.position.x + 0.22, 0.55, origin.z + group.position.z - 0.05)); state.kite.tether(() => nia.paw()); } });
  d.action(name, "yawn", () => { nia.setPose("sleep"); sound.chime(0, 0.3); setTimeout(() => { if (pose !== "sleep") nia.setPose("stand"); }, 2600); });
  d.action(name, "sleep", () => { nia.setPose("sleep"); sound.chime(0, 0.3); });
  d.action(name, "look", () => { nia.look(); });
  d.action(name, "wave", () => { nia.wave(); sound.chime(2, 0.4); });
  d.updaters.push((dt, t) => {
    if (state.running > 0) {
      state.running -= dt;
      group.position.x += state.dir * 0.12 * dt;
      if (state.running <= 0) { nia.setPose(pose); }
    }
    spring.update(dt);
    group.updateMatrixWorld(true);
    if (state.kite && state.kite.state.mode === "held") nia.hold(state.kite.knot(), "right");
    nia.lookAt(state.kite && state.kite.state.mode !== "hung" ? state.kite.group.getWorldPosition(_v) : d.pointer);
    nia.update(dt, t);
  });
  if (holds) { holds.tether(() => nia.paw()); }
  return { group, nia, get spring() { return spring; }, state, run, origin };
}

/** A friend card that bounces and calls out. */
function friend(d, id, { name, label = name, width, x, y = 0, z, delay = 0.3, call = "chime", note = 3, verb, radius = 0.14 } = {}) {
  const card = figure(d, id, { width, x, y, z, delay, name, label, radius, onTap: () => sfx(d, call, note, 0.35), onHover: () => {} });
  if (card && verb) d.action(name, verb, () => { card.bounce(); sfx(d, call, note, 0.35); });
  return card;
}

/* ---------- pages ---------- */

/** A little red bow (the kite's lost tail bow) as a clue on the gate. */
function clueBow(d, at) {
  const group = new THREE.Group();
  group.position.copy(at);
  const mat = new THREE.MeshStandardMaterial({ color: 0xe2493d, roughness: 0.7, side: THREE.DoubleSide });
  const left = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.028), mat); left.position.x = -0.02; left.rotation.z = 0.35;
  const right = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.028), mat); right.position.x = 0.02; right.rotation.z = -0.35;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), mat);
  group.add(left, right, knot);
  const glow = P.glowPlane(0xffd97a, 0.28, 0.25);
  glow.position.z = -0.01;
  group.add(glow);
  d.add(group, { pop: "rise", delay: 0.4, name: "bow", label: "bow", radius: 0.1, onTap: () => { d.ctx.sound.sparkle(); glow.material.opacity = 0.9; } });
  d.updaters.push((dt, t) => { glow.material.opacity = lerp(glow.material.opacity, 0.3, dt * 2) + Math.sin(t * 3) * 0.03; group.rotation.z = Math.sin(t * 2.2) * 0.08; });
  let found = false;
  d.action("bow", "glow", () => { glow.material.opacity = 1; d.ctx.sound.sparkle(); if (!found) { found = true; d.ctx.onMagic("clue"); } });
  return group;
}

/** The sky above the hill, full of kites. */
function festival(d, ctx, { withNia = true } = {}) {
  const sky = backCard(d, "festival-sky", { name: "sky", label: "sky" });
  const wind = makeWind(d, sky, { idle: 0.5 });
  d.action("sky", "bright", () => { sky.bounce(); wind.blow(1); ctx.sound.sparkle(); });
  const kites = [];
  const spots = [[-0.42, 0.95, -0.4, 0.12, "kite-face"], [-0.18, 1.05, -0.45, 0.1, "kite-blue"], [0.1, 0.98, -0.42, 0.11, "kite-face"], [0.36, 0.9, -0.38, 0.13, "kite-blue"], [-0.3, 0.7, -0.36, 0.09, "kite-blue"], [0.44, 0.66, -0.34, 0.1, "kite-face"]];
  spots.forEach(([x, y, z, w, face], i) => {
    const k = makeKite(d, { width: w, at: new THREE.Vector3(x, y, z), wind, mode: "free", face, name: `kite${i + 3}`, label: "kites", delay: 0.3 + i * 0.08 });
    k.setMode("free");
    kites.push(k);
  });
  d.register("kites", new THREE.Group(), { label: "kites", radius: 0.5, anchor: () => d.group.localToWorld(new THREE.Vector3(0, 0.9, -0.4)) });
  let shown = false;
  d.action("kites", "dance", () => { kites.forEach((k, i) => setTimeout(() => k.kick((Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.5), i * 90)); ctx.sound.sparkle(); if (!shown) { shown = true; ctx.onMagic("festival"); } });
  d.every(2.5, () => { const k = kites[Math.floor(Math.random() * kites.length)]; k.kick((Math.random() - 0.5) * 0.6, 0.3); });
  return { sky, wind, kites };
}

const builders = {
  "kite-door": (ctx) => {
    const d = new Diorama(ctx);
    const wall = backCard(d, "cottage-front", { name: "cottage", label: "cottage" });
    const wind = makeWind(d, wall, { idle: 0.35 });
    d.hotspot(wall, "door", [0.2, 0.05, 0.36, 0.72], { label: "door", radius: 0.2, glow: 0xffe2a8, onTap: () => { wall.bounce(); ctx.sound.click(); } });
    const grass = figure(d, "grass", { width: 0.98, x: 0.02, y: 0, z: 0.08, delay: 0.15, name: "grass", label: "grass", radius: 0.3 });
    leansWith(d, grass, wind, { amount: 0.16, name: "grass" });
    const kite = makeKite(d, { at: new THREE.Vector3(0.22, 0.78, -0.1), wind, mode: "held" });
    const nia = standingNia(d, new THREE.Vector3(-0.06, 0, 0.32), { scale: 0.5, holds: kite });
    // the gust that takes the kite: it slips free and sails off to the top right
    let gone = false;
    const letGo = () => { if (gone) { kite.kick(0.6, 0.4); return; } gone = true; kite.setMode("free"); kite.setTarget(new THREE.Vector3(0.42, 1.0, -0.3)); kite.kick(1.6, 1.2); nia.nia.look(); ctx.sound.whoosh(true); };
    d.action("wind", "gust", () => { wind.blow(2.2); letGo(); });
    d.action("kite", "away", letGo);
    d.action("nia", "oh", () => { nia.nia.jump(); nia.spring.kick(0, 0.8, 0); ctx.sound.chime(1, 0.4); });
    wind.listeners.push((strength) => { if (strength > 1.5) letGo(); });
    return d;
  },

  "kite-meadow": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "meadow-sky");
    const wind = makeWind(d, sky, { idle: 0.4 });
    const grass = figure(d, "grass", { width: 0.98, x: -0.02, y: 0, z: 0.08, delay: 0.15, name: "grass", label: "meadow", radius: 0.3 });
    leansWith(d, grass, wind, { amount: 0.2, name: "grass" });
    // the kite is far ahead now: a tiny one drifting off at the top right
    const far = makeKite(d, { width: 0.09, at: new THREE.Vector3(0.44, 1.02, -0.45), wind, mode: "free", delay: 0.5 });
    far.setMode("free");
    standingNia(d, new THREE.Vector3(-0.12, 0, 0.32), { scale: 0.5 });
    d.action("sky", "bright", () => { sky.bounce(); ctx.sound.sparkle(); });
    return d;
  },

  "kite-letgo": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "fence-field");
    const wind = makeWind(d, sky, { idle: 0.4 });
    const fence = figure(d, "fence", { width: 0.98, x: 0.02, y: 0, z: -0.12, delay: 0.15, name: "fence", label: "fence", radius: 0.3, onTap: () => ctx.sound.click() });
    d.action("fence", "rattle", () => { if (fence) fence.bounce(); ctx.sound.click(); wind.blow(1.0); });
    clueBow(d, new THREE.Vector3(0.02, 0.2, -0.1));
    const nia = standingNia(d, new THREE.Vector3(-0.24, 0, 0.32), { scale: 0.5 });
    d.action("nia", "hop", () => { nia.nia.jump(); nia.spring.kick(0.4, 1.4, 0); nia.run(1, 0.6); ctx.sound.pop(1.2); });
    return d;
  },

  "kite-river": (ctx) => {
    const d = new Diorama(ctx);
    const river = backCard(d, "river", { name: "river", label: "river" });
    const wind = makeWind(d, river, { idle: 0.3 });
    const bank = figure(d, "riverbank", { width: 0.9, x: -0.02, y: 0, z: 0.0, delay: 0.15, name: "stones", label: "stones", radius: 0.3, onTap: () => { splash(d, new THREE.Vector3(0.0, 0.06, 0.1)); sfx(d, "pop", 0.9); } });
    d.action("stones", "hop", () => { if (bank) bank.bounce(); splash(d, new THREE.Vector3(-0.05, 0.05, 0.1)); sfx(d, "pop", 1.1); });
    d.action("river", "splash", () => { splash(d, new THREE.Vector3(0.1, 0.05, 0.05)); river.bounce(); sfx(d, "pop", 0.8); });
    friend(d, "ducks", { name: "ducks", width: 0.26, x: 0.3, y: 0, z: 0.2, delay: 0.3, call: "quack", note: 5, verb: "quack" });
    const kite = makeKite(d, { width: 0.12, at: new THREE.Vector3(0.36, 0.98, -0.42), wind, mode: "free" });
    kite.setMode("free");
    standingNia(d, new THREE.Vector3(-0.3, 0, 0.32), { scale: 0.45 });
    return d;
  },

  "kite-hill": (ctx) => {
    const d = new Diorama(ctx);
    const hill = backCard(d, "hill", { name: "hill", label: "hill" });
    const wind = makeWind(d, hill, { idle: 0.35 });
    d.action("hill", "climb", () => { hill.bounce(); ctx.sound.chime(3, 0.3); });
    friend(d, "sheep", { name: "sheep", width: 0.32, x: 0.2, y: 0.02, z: 0.02, delay: 0.3, call: "baa", note: 1, verb: "baa" });
    const kite = makeKite(d, { width: 0.12, at: new THREE.Vector3(0.3, 1.0, -0.42), wind, mode: "free" });
    kite.setMode("free");
    standingNia(d, new THREE.Vector3(-0.26, 0, 0.32), { scale: 0.45 });
    return d;
  },

  "kite-cloud": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "clouds-sky");
    const wind = makeWind(d, sky, { idle: 0.2 });
    const cloud = figure(d, "cloud-sleepy", { width: 0.64, x: 0.04, y: 0.34, z: -0.2, delay: 0.25, name: "cloud", label: "cloud", radius: 0.3, onTap: () => sneeze() });
    // the kite the cloud sneezes out is a blue one: not Nia's
    const kite = makeKite(d, { width: 0.2, at: new THREE.Vector3(0.02, 0.58, -0.3), wind, mode: "stuck", face: "kite-blue" });
    const puffs = d.burst(0xffffff, 60, 0.05);
    let sneezed = false;
    const sneeze = () => {
      if (cloud) cloud.bounce();
      puffs.emit(new THREE.Vector3(0.1, 0.55, -0.1), 26, 0.6, 1.4);
      ctx.sound.whoosh(true); setTimeout(() => ctx.sound.pop(1.4), 220);
      if (!sneezed) { sneezed = true; kite.setMode("free"); kite.setDepth(-0.05); kite.setTarget(new THREE.Vector3(0.3, 0.72, -0.05)); kite.kick(1.6, 0.9); ctx.onMagic("achoo"); }
      else kite.wobble();
    };
    d.action("cloud", "puff", () => { if (cloud) cloud.bounce(); ctx.sound.puff(); });
    d.action("cloud", "tickle", () => { if (cloud) { cloud.bounce(); cloud.lift(true); setTimeout(() => cloud.lift(false), 600); } ctx.sound.chime(6, 0.3); });
    d.action("cloud", "sneeze", sneeze);
    d.action("kite", "pop", sneeze);
    if (cloud) d.updaters.push((dt, t) => { cloud.group.position.y = Math.sin(t * 0.9) * 0.015; });
    standingNia(d, new THREE.Vector3(-0.3, 0, 0.34), { scale: 0.42 });
    return d;
  },

  "kite-oak": (ctx) => {
    const d = new Diorama(ctx);
    const wood = backCard(d, "oak-wood");
    const wind = makeWind(d, wood, { idle: 0.25 });
    const oak = figure(d, "oak-tree", { width: 0.84, x: -0.1, y: 0, z: -0.3, delay: 0.15, name: "oak", label: "oak", radius: 0.32, onTap: () => { leaves(d, wood, 1); ctx.sound.puff(); } });
    d.action("oak", "shake", () => { if (oak) oak.bounce(); leaves(d, wood, 0.8); ctx.sound.puff(); });
    const crow = friend(d, "crow", { name: "crow", width: 0.2, x: 0.2, y: 0.5, z: -0.24, delay: 0.35, call: "caw", note: 0, verb: "caw" });
    const kite = makeKite(d, { width: 0.2, at: new THREE.Vector3(0.02, 0.74, -0.34), wind, mode: "stuck", face: "kite-blue" });
    const crowState = { up: 0, target: 0 };
    if (crow) d.updaters.push((dt, t) => { crowState.up = lerp(crowState.up, crowState.target, dt * 2.5); crow.group.position.set(crowState.up * 0.18, crowState.up * 0.3 + Math.sin(t * 1.5) * 0.01, 0); });
    d.action("crow", "hop", () => { if (crow) crow.bounce(); sfx(d, "pop", 1.3); });
    d.action("crow", "push", () => { if (crow) crow.bounce(); sfx(d, "caw", 0, 0.35); crowState.target = 1; kite.setMode("free"); kite.setDepth(-0.1); kite.setTarget(new THREE.Vector3(0.4, 1.0, -0.1)); kite.kick(1.2, 1.0); setTimeout(() => { crowState.target = 0; }, 3000); });
    d.action("kite", "away", () => { kite.setMode("free"); kite.kick(0.8, 0.6); ctx.sound.whoosh(true); });
    standingNia(d, new THREE.Vector3(0.26, 0, 0.34), { scale: 0.45, faces: -1 });
    return d;
  },

  "kite-festival": (ctx) => {
    const d = new Diorama(ctx);
    festival(d, ctx);
    const nia = standingNia(d, new THREE.Vector3(-0.1, 0, 0.32), { scale: 0.5 });
    d.action("nia", "look", () => { nia.nia.look(); nia.spring.kick(0, 0.4, 0); });
    return d;
  },

  "kite-choice": (ctx) => {
    const d = new Diorama(ctx);
    const { wind } = festival(d, ctx);
    const red = makeKite(d, { width: 0.2, at: new THREE.Vector3(0.08, 0.78, -0.2), wind, mode: "free", delay: 0.25 });
    red.setMode("free");
    const blue = makeKite(d, { width: 0.18, at: new THREE.Vector3(0.34, 0.7, -0.24), wind, mode: "free", face: "kite-blue", name: "kite2", label: "blue kite", delay: 0.3 });
    blue.setMode("free");
    const nia = standingNia(d, new THREE.Vector3(-0.18, 0, 0.32), { scale: 0.5 });
    let freed = false;
    d.action("kite", "down", () => { red.setTarget(new THREE.Vector3(0.0, 0.5, 0.1)); red.kick(0, -0.8); ctx.sound.whoosh(false); setTimeout(() => red.setTarget(new THREE.Vector3(0.08, 0.78, -0.2)), 2200); });
    d.action("kite", "up", () => { red.setTarget(new THREE.Vector3(0.14, 0.95, -0.3)); red.kick(0.3, 1.6); blue.kick(-0.3, 1.2); ctx.sound.whoosh(true); if (!freed) { freed = true; ctx.onMagic("free"); } });
    d.action("nia", "hold", () => { nia.nia.play("hold"); nia.spring.kick(-0.2, 0.2, 0); red.kick(0, -0.6); ctx.sound.pop(1.0); });
    d.action("nia", "wave", () => { nia.nia.wave(); nia.spring.kick(0, 0.5, 0); ctx.sound.chime(2, 0.4); });
    return d;
  },

  "kite-home": (ctx) => homeScene(ctx, { asleep: false }),
  end: (ctx) => homeScene(ctx, { asleep: true }),
};

function splash(d, at) {
  const drops = d.burst(0x8fd0ff, 40, 0.028);
  drops.emit(at, 18, 0.5, 1.1);
}

function homeScene(ctx, { asleep }) {
  const d = new Diorama(ctx);
  const wall = backCard(d, "home-wall", { name: "wall", label: "wall" });
  const wind = makeWind(d, wall, { idle: 0.1 });
  const glow = wall.glow(0.72, 0.62, 0xffd9a0, 0.5, 0.25);
  const glowState = { level: 0.3 };
  d.hotspot(wall, "window", [0.56, 0.35, 0.34, 0.5], { label: "window", radius: 0.2, glow: 0xffd9a0, onTap: () => { wall.bounce(); glowState.level = 1; ctx.sound.chime(6, 0.4); } });
  d.action("window", "sunset", () => { glowState.level = 1; ctx.sound.chime(6, 0.4); });
  d.action("wall", "glow", () => { wall.bounce(); glowState.level = 0.8; ctx.sound.chime(4, 0.3); });
  d.updaters.push((dt, t) => { glowState.level = lerp(glowState.level, 0.3, dt * 0.4); glow.material.opacity = glowState.level * (0.35 + Math.sin(t * 2) * 0.05); });
  const bed = figure(d, "bedside", { width: 0.62, x: 0.14, y: 0, z: -0.18, delay: 0.2, name: "bed", label: "bed", radius: 0.3, onTap: () => ctx.sound.pop(0.8) });
  if (bed) d.hotspot(bed, "lamp", [0.0, 0.5, 0.3, 0.5], { label: "lamp", radius: 0.12, onTap: () => { bed.bounce(); ctx.sound.lampSwitch(true); glowState.level = 1; } });
  // two kites on the peg now: the red one, and the blue one that followed it home
  const red = makeKite(d, { width: 0.17, at: new THREE.Vector3(-0.36, 0.82, -0.5), mode: "hung", delay: 0.2 });
  red.setMode("hung");
  const blue = makeKite(d, { width: 0.15, at: new THREE.Vector3(-0.2, 0.76, -0.5), mode: "hung", delay: 0.28, face: "kite-blue", name: "kite2", label: "blue kite" });
  blue.setMode("hung");
  const nia = standingNia(d, new THREE.Vector3(-0.22, 0, 0.32), { scale: 0.45, pose: asleep ? "sleep" : "stand" });
  nia.state.kite = red;
  if (asleep) { nia.nia.setPose("sleep"); setTimeout(() => ctx.onMagic("sleep"), 2500); }
  d.action("nia", "home", () => { nia.nia.wave(); ctx.sound.chime(2, 0.4); });
  d.every(4, () => { if (!asleep && Math.random() < 0.4) nia.nia.blink(); });
  return d;
}

export default builders;

/* The spreads of "Pim and the Big Wish": a tiny planet you can spin, a sun that sets whenever
   the chair moves, a comet that grants one wish, and Pim growing until the whole planet fits in
   his hand. The shared pop-up engine (Diorama, cards, the standing hero) is in src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, starField, sfx, splash } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const NIGHT = "space-night", SUNSET = "space-sunset", DAWN = "space-dawn";

/* ---------- the planet ---------- */

/** A little textured sphere that spins when dragged; things stand on it with `place()`. */
function makePlanet(d, { radius = 0.24, at = new THREE.Vector3(0, 0.24, 0), name = "planet", label = "planet", delay = 0.1 } = {}) {
  const group = new THREE.Group();
  group.position.copy(at);
  const a = art(d, "planet-texture");
  // the painted texture is not tileable: mirror it around the sphere so the seam disappears
  let map = null;
  if (a) { map = a.texture.clone(); map.wrapS = THREE.MirroredRepeatWrapping; map.wrapT = THREE.ClampToEdgeWrapping; map.repeat.set(2, 1); map.needsUpdate = true; }
  const material = new THREE.MeshStandardMaterial({ map, color: a ? 0xffffff : 0x8aa07a, roughness: 0.9, metalness: 0 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 44, 30), material);
  sphere.castShadow = sphere.receiveShadow = true;
  const spin = new THREE.Group();
  spin.add(sphere);
  group.add(spin);
  const halo = P.glowPlane(0xbfd8ff, radius * 4.4, 0.08);
  halo.position.z = -radius * 0.95;
  group.add(halo);
  const state = { vel: 0, last: null, glow: 0 };
  const root = d.add(group, {
    pop: "rise", delay, name, label, radius: radius * 1.15,
    anchor: () => group.getWorldPosition(new THREE.Vector3()),
    onHover: (on) => { if (on) state.glow = Math.max(state.glow, 0.5); },
    onTap: () => { state.vel += 2.2; state.glow = 1; d.ctx.sound.chime(3, 0.3); },
    onDrag: (p) => { if (state.last) state.vel = clamp(state.vel + (p.x - state.last.x) * 45, -9, 9); state.last = p.clone(); },
    onDragEnd: () => { state.last = null; if (Math.abs(state.vel) > 2) d.ctx.sound.whoosh(state.vel > 0); },
  });
  d.updaters.push((dt, t) => {
    state.vel *= Math.max(0, 1 - dt * 1.3);
    spin.rotation.y += (0.06 + state.vel) * dt;
    state.glow = Math.max(0, state.glow - dt * 0.8);
    halo.material.opacity = 0.08 + state.glow * 0.3 + Math.sin(t * 0.9) * 0.02;
  });
  const api = {
    group, root, spin, radius, state, sphere,
    /** stand something on the surface: `dir` points from the centre to its feet; the orbit
        group lets it travel around the planet (the chair scoots) */
    place(object, dir) {
      // cards stand straight up from their spot on the surface (a card tilted along the
      // surface normal reads as a flat brown rectangle from the reader's angle)
      const orbit = new THREE.Group();
      const holder = new THREE.Group();
      holder.position.copy(dir.clone().normalize().multiplyScalar(radius - 0.006));
      holder.add(object);
      orbit.add(holder);
      spin.add(orbit);
      return orbit;
    },
    kick(v) { state.vel += v; },
    pulse() { state.glow = 1; },
    top() { return at.clone().add(new THREE.Vector3(0, radius, 0)); },
  };
  d.action(name, "spin", () => { api.kick(3); api.pulse(); d.ctx.sound.whoosh(true); });
  return api;
}

/** A cut-out standing on the planet: a holder carries the surface offset, the card keeps its own bounce. */
function onPlanet(d, planet, id, dir, { width, name, label, onTap, onHover, radius = 0.12 } = {}) {
  const a = art(d, id);
  if (!a) return null;
  const card = P.makeCard(a, { width, paperNormal: d.ctx.textures.paperNormal });
  const orbit = planet.place(card.group, dir);
  const state = { wobble: 0, orbit: 0, orbitTarget: 0 };
  d.updaters.push((dt, t) => {
    card.update(dt, t);
    if (state.wobble > 0) state.wobble = Math.max(0, state.wobble - dt * 1.4);
    card.group.rotation.z = Math.sin(state.wobble * 18) * 0.22 * state.wobble;
    state.orbit = lerp(state.orbit, state.orbitTarget, Math.min(1, dt * 4));
    orbit.rotation.y = state.orbit;
  });
  if (name) d.register(name, card.group, { label: label || name, radius, anchor: () => card.worldPoint(0.5, 0.5, 0.03), onHover: (on) => { card.lift(on); if (onHover) onHover(on); }, onTap: () => { card.bounce(); if (onTap) onTap(); } });
  return { card, orbit, state, local: () => d.group.worldToLocal(card.worldPoint(0.5, 0.5, 0.03)), wobble: () => { state.wobble = 1; }, scoot: (a) => { state.orbitTarget += a; } };
}

function rose(d, planet, dir, { width = 0.14, id = "rose", name = "rose", label = "rose", onBloom = null } = {}) {
  const r = onPlanet(d, planet, id, dir, { width, name, label, radius: width * 0.8, onTap: () => bloom() });
  if (!r) return null;
  const bloom = () => { r.card.bounce(); splash(d, r.local(), { color: 0xe2493d, count: 14, size: 0.022, speed: 0.3, up: 0.7 }); sfx(d, "shimmer", 0.35); if (onBloom) onBloom(); };
  d.action(name, "bloom", bloom);
  d.action(name, "wobble", () => { r.wobble(); d.ctx.sound.chime(5, 0.3); });
  d.action(name, "hide", () => { r.card.lift(true); planet.pulse(); d.ctx.sound.sparkle(); setTimeout(() => r.card.lift(false), 900); });
  return r;
}

function volcanoes(d, planet, dir, { width = 0.2 } = {}) {
  const v = onPlanet(d, planet, "volcanoes", dir, { width, name: "volcanoes", label: "volcanoes", radius: width * 0.7, onTap: () => puff() });
  if (!v) return null;
  const smoke = d.burst(0xd8d4cc, 60, 0.035);
  const puff = () => {
    [0.2, 0.5, 0.8].forEach((nx, i) => setTimeout(() => smoke.emit(d.group.worldToLocal(v.card.worldPoint(nx, 0.85, 0.02)), 8, 0.25, 0.9), i * 120));
    d.ctx.sound.puff();
    v.card.bounce();
  };
  d.action("volcanoes", "puff", puff);
  v.puff = puff;
  return v;
}

function sheep(d, planet, dir, { width = 0.14 } = {}) {
  const s = onPlanet(d, planet, "sheep-crate", dir, { width, name: "sheep", label: "sheep", radius: width * 0.8, onTap: () => sfx(d, "baa", 1, 0.5) });
  if (!s) return null;
  d.action("sheep", "baa", () => { s.card.bounce(); sfx(d, "baa", 1, 0.5); setTimeout(() => d.ctx.sound.yawn(), 700); });
  d.action("sheep", "hide", () => { s.card.lift(true); planet.pulse(); d.ctx.sound.sparkle(); setTimeout(() => s.card.lift(false), 900); });
  return s;
}

/** Pim's chair, which scoots around the planet (and makes the sun set) */
function chair(d, planet, dir, { width = 0.12, sun = null, pim = null } = {}) {
  const c = onPlanet(d, planet, "chair", dir, { width, name: "chair", label: "chair", radius: 0.1, onTap: () => scoot() });
  if (!c) return null;
  const scoot = () => {
    c.scoot(0.5);
    d.ctx.sound.click();
    if (pim) { pim.hero.jump(); pim.spring.kick(0.2, 0.8, 0); }
    if (sun) setTimeout(() => sun.set(), 350);
  };
  d.action("chair", "scoot", scoot);
  return c;
}

/* ---------- the sun and the moon ---------- */

/** The sun behind the planet: it sinks out of sight and comes up again somewhere else. */
function makeSun(d, { x = 0.34, y = 0.26, z = -0.3, width = 0.26 } = {}) {
  const card = figure(d, "sun", { width, x, y, z, delay: 0.2, name: "sun", label: "sun", radius: 0.15, onTap: () => api.set() });
  if (!card) return { set() {} };
  const halo = card.glow(0.5, 0.5, 0xffd27a, width * 2.4, 0.35);
  halo.position.z = -0.01;
  const state = { y: 0, phase: 0, sets: 0, timer: 0 };
  const api = {
    card, state,
    set() {
      if (state.phase) return;
      state.phase = 1; state.sets++;
      d.ctx.sound.chime(Math.max(0, 6 - state.sets), 0.35);
      d.ctx.sound.whoosh(false);
    },
  };
  d.updaters.push((dt, t) => {
    if (state.phase === 1) { state.y -= dt * 0.38; if (state.y < -0.46) { state.phase = 2; state.timer = 0.9; } }
    else if (state.phase === 2) { state.timer -= dt; if (state.timer <= 0) { state.phase = 3; card.group.position.x = (Math.random() - 0.5) * 0.24; d.ctx.sound.chime(4, 0.25); } }
    else if (state.phase === 3) { state.y += dt * 0.32; if (state.y >= 0) { state.y = 0; state.phase = 0; } }
    card.group.position.y = state.y;
    halo.material.opacity = 0.3 + Math.sin(t * 1.5) * 0.05 + (state.phase === 1 ? 0.25 : 0);
  });
  d.action("sun", "set", () => api.set());
  d.action("sun", "shine", () => { card.bounce(); d.ctx.sound.sparkle(); });
  return api;
}

/** The painted moon, which wobbles when Pim's head bumps it. */
function wobblyMoon(d, { x = 0.3, y = 0.62, z = -0.28, width = 0.24, onBump = null } = {}) {
  const card = figure(d, "moon", { width, x, y, z, delay: 0.25, name: "moon", label: "moon", radius: 0.14, onTap: () => wobble() });
  if (!card) return null;
  const halo = card.glow(0.5, 0.5, 0xfff0c0, width * 2.2, 0.3);
  halo.position.z = -0.01;
  const s = { a: 0, v: 0 };
  const wobble = () => { s.v += 6; d.ctx.sound.chime(1, 0.4); card.bounce(); if (onBump) onBump(); };
  d.updaters.push((dt, t) => {
    s.v += -s.a * 40 * dt - s.v * 3 * dt;
    s.a += s.v * dt;
    card.group.rotation.z = s.a * 0.08 + Math.sin(t * 0.8) * 0.02;
    halo.material.opacity = 0.3 + Math.sin(t * 1.4) * 0.05 + Math.abs(s.v) * 0.02;
  });
  d.action("moon", "wobble", wobble);
  return { card, wobble };
}

/* ---------- the comet ---------- */

/** A glowing comet with a trail: it swooshes across on its story verbs and can be dragged
    around the sky. Everything is relative to `at` (the pop-up pivot keeps the place). */
function makeComet(d, { at = new THREE.Vector3(-0.3, 0.9, -0.3), name = "comet", label = "comet", delay = 0.4 } = {}) {
  const group = new THREE.Group();
  group.position.copy(at);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff8dc }));
  const halo = P.glowPlane(0xffe9a8, 0.24, 0.7);
  group.add(core, halo);
  const trail = [];
  for (let i = 0; i < 8; i++) { const g = P.glowPlane(i < 3 ? 0xffe9a8 : 0xff9f5a, 0.16 - i * 0.015, 0.4 - i * 0.045); g.userData.base = 0.4 - i * 0.045; group.add(g); trail.push(g); }
  const origin = at.clone();
  const state = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(), drag: null, hist: [], seed: Math.random() * 6 };
  const sparks = d.burst(0xffe9a8, 60, 0.02);
  const api = {
    group, state, origin,
    world() { return group.getWorldPosition(new THREE.Vector3()); },
    local() { return origin.clone().add(state.pos); },
    glow() { sparks.emit(api.local(), 18, 0.35, 0.8); d.ctx.sound.sparkle(); },
    swoosh(dir = 1) {
      state.pos.set(-1.3 * dir, 0.15, 0); state.vel.set(3.2 * dir, -0.3, 0); state.target.set(0.9 * dir, -0.35, 0);
      d.ctx.sound.whoosh(true);
      setTimeout(() => api.glow(), 450);
      setTimeout(() => state.target.set(0, 0, 0), 1400);
    },
  };
  d.add(group, {
    pop: "rise", delay, name, label, radius: 0.16,
    anchor: () => api.world(),
    onHover: (on) => { if (on) state.vel.y += 0.2; },
    onTap: () => api.glow(),
    onDrag: (p) => { const local = d.group.worldToLocal(p.clone()).sub(origin); local.z = 0; local.y = Math.max(0.1 - origin.y, local.y); state.drag = local; },
    onDragEnd: () => { if (state.drag) state.target.copy(state.drag); state.drag = null; d.ctx.sound.whoosh(true); api.glow(); },
  });
  d.updaters.push((dt, t) => {
    if (state.drag) { state.pos.lerp(state.drag, Math.min(1, dt * 14)); state.vel.multiplyScalar(0.6); }
    else {
      _v.set(Math.sin(t * 0.7 + state.seed) * 0.05, Math.sin(t * 1.1 + state.seed) * 0.03, 0).add(state.target);
      state.vel.addScaledVector(_v.sub(state.pos), 9 * dt).addScaledVector(state.vel, -3.2 * dt);
      state.pos.addScaledVector(state.vel, dt);
    }
    group.position.copy(state.pos);
    state.hist.unshift(state.pos.clone());
    if (state.hist.length > 40) state.hist.pop();
    // the tail only shows while the comet moves; at rest the glows would stack into one bright blob
    const speed = state.vel.length();
    const tail = clamp(speed * 1.6, 0, 1);
    trail.forEach((g, i) => { const h = state.hist[Math.min(state.hist.length - 1, (i + 1) * 4)]; g.position.copy(h).sub(state.pos); g.position.z = -0.004 * (i + 1); g.material.opacity = g.userData.base * tail; });
    halo.scale.setScalar(0.24 + Math.sin(t * 6) * 0.02 + speed * 0.04);
  });
  d.action(name, "swoosh", () => api.swoosh(1));
  d.action(name, "glow", () => api.glow());
  d.action(name, "back", () => api.swoosh(-1));
  return api;
}

/* ---------- the sky ---------- */

/** A few real stars over the painted sky, and the sky's verbs (twinkle, hush). */
function skyStars(d, { lit = true, positions = null } = {}) {
  const spots = positions || [[-0.5, 0.88, -0.45], [-0.32, 0.98, -0.5], [0.05, 0.92, -0.48], [0.3, 1.0, -0.5], [0.5, 0.86, -0.46], [-0.12, 0.8, -0.5], [0.42, 0.7, -0.5]];
  const stars = starField(d, spots.map((p) => new THREE.Vector3(...p)), { lit, delay: 0.3, size: 0.035 });
  const twinkle = () => { stars.forEach((s, i) => setTimeout(() => s.twinkle(), i * 70)); d.ctx.sound.sparkle(); };
  d.action("sky", "twinkle", twinkle);
  d.action("sky", "jingle", () => { twinkle(); [0, 2, 4, 7].forEach((n, i) => setTimeout(() => d.ctx.sound.chime(n, 0.3), i * 140)); });
  d.action("sky", "hush", () => { d.ctx.sound.chime(0, 0.2); stars.forEach((s, i) => setTimeout(() => s.twinkle(), i * 160)); });
  return stars;
}

/* ---------- Pim ---------- */

function pimOn(d, planet, { scale = 0.42, pose = "stand", delay = 0.35, faces = 1, onTap = null } = {}) {
  const pim = standingHero(d, planet.top(), { scale, pose, delay, name: "pim", label: "Pim", faces, onTap });
  const sound = d.ctx.sound;
  d.action("pim", "stomp", () => { pim.hero.jump(); pim.spring.kick(0, 1.4, 0); setTimeout(() => sound.pop(0.4), 380); });
  d.action("pim", "bump", () => { pim.hero.jump(); pim.spring.kick(0, 1.2, 0); });
  d.action("pim", "hold", () => { pim.hero.look(); pim.spring.kick(0, 0.3, 0); sound.chime(4, 0.3); });
  return pim;
}

/* ---------- pages ---------- */

const builders = {
  "pim-planet": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, NIGHT);
    skyStars(d);
    const planet = makePlanet(d, { radius: 0.24, at: new THREE.Vector3(0, 0.24, 0.02) });
    rose(d, planet, new THREE.Vector3(-0.62, 0.72, 0.5), { width: 0.14 });
    volcanoes(d, planet, new THREE.Vector3(0.7, 0.6, 0.45), { width: 0.2 });
    sheep(d, planet, new THREE.Vector3(0.1, 0.45, -0.85), { width: 0.14 });
    pimOn(d, planet);
    return d;
  },

  "pim-sunset": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, SUNSET);
    const sun = makeSun(d);
    const planet = makePlanet(d, { radius: 0.24, at: new THREE.Vector3(0, 0.24, 0.02) });
    const pim = pimOn(d, planet, { faces: -1 });
    chair(d, planet, new THREE.Vector3(0.5, 0.78, 0.6), { width: 0.12, sun, pim });
    rose(d, planet, new THREE.Vector3(-0.7, 0.55, 0.45), { width: 0.12 });
    return d;
  },

  "pim-comet": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, NIGHT);
    skyStars(d);
    const planet = makePlanet(d, { radius: 0.2, at: new THREE.Vector3(-0.12, 0.2, 0.02) });
    const comet = makeComet(d, { at: new THREE.Vector3(0.25, 0.88, -0.3) });
    rose(d, planet, new THREE.Vector3(-0.6, 0.7, 0.55), { width: 0.11 });
    let wished = false;
    const pim = pimOn(d, planet, { onTap: () => grow() });
    const grow = () => {
      const s = Math.min(0.72, pim.group.scale.x + 0.15);
      pim.scaleTo(s, 1.1); pim.hero.jump(); sfx(d, "boing", 3, 0.5); comet.glow();
      if (!wished) { wished = true; ctx.onMagic("wish"); }
    };
    d.action("pim", "grow", grow);
    return d;
  },

  "pim-big": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, DAWN);
    const planet = makePlanet(d, { radius: 0.2, at: new THREE.Vector3(0, 0.2, 0.02) });
    rose(d, planet, new THREE.Vector3(-0.7, 0.55, 0.5), { width: 0.1 });
    const v = volcanoes(d, planet, new THREE.Vector3(0.68, 0.5, 0.55), { width: 0.16 });
    const pim = pimOn(d, planet, { scale: 0.78 });
    d.action("pim", "grow", () => { pim.scaleTo(Math.min(0.95, pim.group.scale.x + 0.08), 1.0); sfx(d, "boing", 3, 0.5); });
    d.action("pim", "stomp", () => { pim.hero.jump(); pim.spring.kick(0, 1.4, 0); setTimeout(() => { d.ctx.sound.pop(0.4); planet.kick(1.5); if (v) v.puff(); }, 380); });
    return d;
  },

  "pim-bigger": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, NIGHT);
    skyStars(d, { positions: [[-0.52, 0.86, -0.45], [-0.36, 0.98, -0.5], [-0.1, 0.94, -0.48], [0.06, 1.02, -0.5], [0.5, 0.96, -0.46], [-0.24, 0.7, -0.5], [0.46, 0.68, -0.5], [-0.5, 0.55, -0.48]] });
    const planet = makePlanet(d, { radius: 0.16, at: new THREE.Vector3(0, 0.16, 0.02) });
    let bumped = false;
    const moon = wobblyMoon(d, { x: 0.3, y: 0.64, z: -0.28, width: 0.24, onBump: () => { if (!bumped) { bumped = true; ctx.onMagic("moon"); } } });
    const pim = pimOn(d, planet, { scale: 1.15 });
    d.action("pim", "grow", () => { pim.scaleTo(Math.min(1.35, pim.group.scale.x + 0.1), 1.0); sfx(d, "boing", 2, 0.5); });
    d.action("pim", "bump", () => { pim.hero.jump(); pim.spring.kick(0, 1.2, 0); setTimeout(() => moon && moon.wobble(), 300); });
    d.action("sky", "twinkle", () => { d.objects.stars && d.objects.stars.actions.twinkle(); [0, 4, 7, 12].forEach((n, i) => setTimeout(() => d.ctx.sound.chime(n, 0.3), i * 130)); });
    return d;
  },

  "pim-lost": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, DAWN);
    const planet = makePlanet(d, { radius: 0.07, at: new THREE.Vector3(0.34, 0.07, 0.14) });
    const r = rose(d, planet, new THREE.Vector3(-0.5, 0.8, 0.5), { width: 0.035 });
    const s = sheep(d, planet, new THREE.Vector3(0.6, 0.6, 0.5), { width: 0.032 });
    const pim = standingHero(d, new THREE.Vector3(-0.22, 0, 0.12), { scale: 1.35, name: "pim", label: "Pim", faces: 1 });
    pim.state.lookAt = () => planet.group.getWorldPosition(new THREE.Vector3());
    d.action("pim", "look", () => { pim.hero.look(); pim.spring.kick(0, 0.3, 0); planet.pulse(); });
    planet.root && d.objects.planet && (d.objects.planet.onTap = () => { planet.pulse(); planet.kick(1.5); if (r) r.card.bounce(); if (s) s.card.bounce(); d.ctx.sound.sparkle(); });
    return d;
  },

  "pim-lonely": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, NIGHT);
    skyStars(d);
    const planet = makePlanet(d, { radius: 0.06, at: new THREE.Vector3(0.2, 0.62, 0.3), delay: 0.5 });
    rose(d, planet, new THREE.Vector3(-0.5, 0.8, 0.5), { width: 0.03 });
    const pim = standingHero(d, new THREE.Vector3(-0.12, 0, 0.1), { scale: 1.2, name: "pim", label: "Pim", faces: 1 });
    // the planet sits in Pim's hand: his arm reaches for a point in front of him and the planet follows the paw
    d.updaters.push(() => {
      pim.hero.hold(pim.group.localToWorld(new THREE.Vector3(0.2, 0.32, 0.22)), "left");
      const local = d.group.worldToLocal(pim.hero.paw());
      planet.root.position.lerp(local, 0.5);
    });
    pim.state.lookAt = () => pim.hero.paw();
    d.action("pim", "hold", () => { planet.pulse(); planet.kick(2); d.ctx.sound.chime(4, 0.3); });
    return d;
  },

  "pim-small": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, DAWN);
    const planet = makePlanet(d, { radius: 0.2, at: new THREE.Vector3(0, 0.2, 0.02) });
    const comet = makeComet(d, { at: new THREE.Vector3(0.3, 0.9, -0.3) });
    rose(d, planet, new THREE.Vector3(-0.66, 0.6, 0.5), { width: 0.11 });
    let shrunk = false;
    const pim = pimOn(d, planet, { scale: 1.05, onTap: () => shrink() });
    const shrink = () => {
      const s = Math.max(0.42, pim.group.scale.x - 0.32);
      pim.scaleTo(s, 1.4); comet.glow();
      [7, 4, 2, 0].forEach((n, i) => setTimeout(() => d.ctx.sound.chime(n, 0.3), i * 160));
      if (!shrunk) { shrunk = true; ctx.onMagic("small"); }
    };
    d.action("pim", "shrink", shrink);
    d.action("comet", "swoosh", () => comet.swoosh(-1));
    return d;
  },

  "pim-roses": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, DAWN);
    const planet = makePlanet(d, { radius: 0.24, at: new THREE.Vector3(0, 0.24, 0.02) });
    let bloomed = false;
    rose(d, planet, new THREE.Vector3(-0.58, 0.72, 0.55), { width: 0.2, id: "roses-two", onBloom: () => { if (!bloomed) { bloomed = true; ctx.onMagic("roses"); } } });
    volcanoes(d, planet, new THREE.Vector3(0.7, 0.55, 0.45), { width: 0.16 });
    pimOn(d, planet, { faces: -1 });
    return d;
  },

  "pim-sleep": (ctx) => sleepScene(ctx, { asleep: false }),
  end: (ctx) => sleepScene(ctx, { asleep: true }),
};

function sleepScene(ctx, { asleep }) {
  const d = new Diorama(ctx);
  backCard(d, asleep ? NIGHT : SUNSET);
  const stars = skyStars(d, { lit: asleep });
  const sun = asleep ? { set() {} } : makeSun(d);
  const planet = makePlanet(d, { radius: 0.24, at: new THREE.Vector3(0, 0.24, 0.02) });
  const pim = pimOn(d, planet, { pose: asleep ? "sleep" : "stand", faces: -1 });
  chair(d, planet, new THREE.Vector3(0.55, 0.75, 0.55), { width: 0.12, sun, pim });
  sheep(d, planet, new THREE.Vector3(-0.62, 0.62, 0.5), { width: 0.14 });
  rose(d, planet, new THREE.Vector3(0.05, 0.5, -0.85), { width: 0.14, id: asleep ? "roses-two" : "rose" });
  let slept = asleep;
  const sleep = () => { pim.sleep(); stars.forEach((s, i) => setTimeout(() => s.twinkle(), i * 90)); d.ctx.sound.chime(0, 0.3); if (!slept) { slept = true; ctx.onMagic("sleep"); } };
  d.action("pim", "sleep", sleep);
  d.action("sky", "twinkle", () => { stars.forEach((s, i) => setTimeout(() => s.twinkle(), i * 70)); d.ctx.sound.sparkle(); });
  if (asleep) setTimeout(() => ctx.onMagic("sleep"), 2500);
  return d;
}

export default builders;

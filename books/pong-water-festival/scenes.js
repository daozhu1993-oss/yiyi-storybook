/* The spreads of "Pong and the Water Festival": a baby elephant who hides from the Songkran
   buckets, a cheeky monkey, a temple bell, a river he puts one foot in, a jasmine garland, a
   drop that tickles, and a trunk that sprays everyone. The shared pop-up engine is in
   src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, backCard, figure, standingHero, makeFall, swipeOn, sfx, splash, friend } from "../../src/scenes.js";

const { clamp, lerp } = P;
const _v = new THREE.Vector3();

/* ---------- water ---------- */

/** A spray of water from one point toward a direction. */
function spray(d, from, dir, count = 22) {
  const drops = d.burst(0x8fd0ff, 60, 0.024);
  drops.emit(from, count, 0.5, 0.9, dir);
  d.ctx.sound.whoosh(true);
  setTimeout(() => sfx(d, "splash", 0, 0.35), 350);
}

function bucket(d, { x = -0.36, z = 0.08, width = 0.14, name = "bucket" } = {}) {
  const card = friend(d, "bucket", { name, label: "bucket", width, x, z, delay: 0.3, call: "splash", note: 0, verb: "splash", radius: 0.12 });
  if (!card) return null;
  d.action(name, "splash", () => { card.bounce(); splash(d, d.group.worldToLocal(card.worldPoint(0.5, 0.9, 0.04)), { color: 0x8fd0ff, count: 18 }); sfx(d, "splash", 0, 0.45); });
  return card;
}

/* ---------- friends ---------- */

function monkey(d, { x = -0.34, z = 0.0, width = 0.28, pong = null } = {}) {
  const card = friend(d, "monkey", { name: "monkey", label: "monkey", width, x, z, delay: 0.3, call: "monkey", note: 0, verb: "grin", radius: 0.16 });
  if (!card) return null;
  d.action("monkey", "splash", () => {
    card.bounce(); sfx(d, "monkey", 0, 0.5);
    const from = d.group.worldToLocal(card.worldPoint(0.7, 0.7, 0.05));
    const to = pong ? d.group.worldToLocal(pong.group.localToWorld(new THREE.Vector3(0, 0.3, 0))) : new THREE.Vector3(0.2, 0.2, 0.2);
    spray(d, from, to.sub(from).normalize().multiplyScalar(1.2), 20);
  });
  d.action("monkey", "yawn", () => { card.bounce(); d.ctx.sound.yawn(); });
  return card;
}

function tuktuk(d, { x = 0.28, z = -0.1, width = 0.4 } = {}) {
  const card = friend(d, "tuktuk", { name: "tuktuk", label: "tuk-tuk", width, x, z, delay: 0.25, call: "tuktuk", note: 0, verb: "honk", radius: 0.22 });
  if (card) d.updaters.push((dt, t) => { card.group.position.y = Math.abs(Math.sin(t * 6)) * 0.004; });
  return card;
}

function girl(d, { x = -0.34, z = -0.02, width = 0.26 } = {}) {
  return friend(d, "girl", { name: "girl", label: "girl", width, x, z, delay: 0.3, call: "chime", note: 5, verb: "wave", radius: 0.15 });
}

/** The jasmine garland: hanging in the scene, or swinging from Pong's trunk. */
function garland(d, { x = 0.34, y = 0.36, z = -0.3, width = 0.16, pong = null } = {}) {
  let group, card;
  if (pong) {
    const a = art(d, "garland");
    if (!a) return null;
    card = P.makeCard(a, { width: 0.34, paperNormal: d.ctx.textures.paperNormal });
    group = new THREE.Group();
    group.position.set(0.16, 0.36, 0.18);   // in Pong's units, hanging from his trunk
    card.group.position.y = -card.height;
    group.add(card.group);
    pong.group.add(group);
    d.register("garland", group, { label: "garland", radius: 0.12, anchor: () => group.getWorldPosition(new THREE.Vector3()), onTap: () => swing() });
    d.updaters.push((dt, t) => { card.update(dt, t); pong.hero.hold(group.getWorldPosition(_v), "right"); });
  } else {
    card = figure(d, "garland", { width, x, y, z, delay: 0.3, name: "garland", label: "garland", radius: 0.12, onTap: () => swing() });
    if (!card) return null;
    group = card.group;
  }
  const s = { v: 0, a: 0 };
  const swing = () => { s.v += 4; sfx(d, "shimmer", 0.3); d.ctx.sound.chime(6, 0.3); };
  d.updaters.push((dt, t) => { s.v += -s.a * 30 * dt - s.v * 2.2 * dt; s.a += s.v * dt; group.rotation.z = s.a * 0.1 + Math.sin(t * 1.1) * 0.03; });
  d.action("garland", "swing", swing);
  return { group, card, swing };
}

function lanterns(d, { x = -0.2, y = 0.42, z = -0.3, width = 0.5, lit = false } = {}) {
  const card = figure(d, "lanterns", { width, x, y, z, delay: 0.25, name: "lanterns", label: "lanterns", radius: 0.22, onTap: () => light() });
  if (!card) return null;
  const glows = [0.12, 0.28, 0.44, 0.6, 0.76, 0.9].map((nx) => card.glow(nx, 0.45, 0xffb060, width * 0.3, lit ? 0.6 : 0));
  const state = { level: lit ? 1 : 0, target: lit ? 1 : 0 };
  const light = () => { state.target = Math.min(1, state.target + 0.4); card.bounce(); sfx(d, "shimmer", 0.35); };
  d.updaters.push((dt, t) => { state.level = lerp(state.level, state.target, Math.min(1, dt * 2)); glows.forEach((g, i) => { g.material.opacity = clamp(state.level * 6 - i, 0, 1) * (0.6 + Math.sin(t * 4 + i) * 0.08); }); card.group.rotation.z = Math.sin(t * 0.9) * 0.02; });
  d.action("lanterns", "light", light);
  return { card, light };
}

/* ---------- Pong ---------- */

function standingPong(d, position, options = {}) {
  const pong = standingHero(d, position, { scale: 0.5, name: "pong", label: "Pong", ...options });
  const sound = d.ctx.sound;
  const trunk = () => d.group.worldToLocal(pong.group.localToWorld(new THREE.Vector3(0, 0.3, 0.26)));
  const shake = d.burst(0x8fd0ff, 40, 0.02);
  d.action("pong", "shirt", () => { pong.hero.look(); pong.spring.kick(0, 0.3, 0); sfx(d, "shimmer", 0.3); });
  d.action("pong", "hide", () => { pong.hero.look(); pong.state.walkX -= 0.05; pong.spring.kick(-0.2, 0.2, 0); sfx(d, "trumpet", 1, 0.35); });
  d.action("pong", "trunk", () => { pong.hero.look(); pong.spring.kick(0, 0.3, 0); sfx(d, "trumpet", 0, 0.45); });
  d.action("pong", "dip", () => { pong.hero.jump(); pong.spring.kick(0, 0.5, 0); splash(d, trunk().add(new THREE.Vector3(0, -0.28, 0)), { color: 0x8fd0ff, count: 14 }); sfx(d, "splash", 0, 0.4); setTimeout(() => { pong.state.shake = 1; sound.chime(1, 0.3); }, 500); });
  d.action("pong", "giggle", () => { pong.hero.jump(); pong.spring.kick(0, 0.9, 0); sfx(d, "giggle", 5, 0.55); if (d.onGiggle) d.onGiggle(); });
  d.action("pong", "spray", () => { pong.hero.wave(); spray(d, trunk(), new THREE.Vector3(1, 0.5, 0), 26); sfx(d, "trumpet", 0, 0.5); if (d.onSpray) d.onSpray(); });
  d.action("pong", "shake", () => { pong.state.shake = 1; shake.emit(trunk().add(new THREE.Vector3(0, 0.15, -0.1)), 18, 0.4, 0.8); sfx(d, "splash", 1, 0.35); if (d.onShake) d.onShake(); });
  return pong;
}

/* ---------- pages ---------- */

const builders = {
  "pong-village": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "village-morning");
    tuktuk(d, { x: 0.3, z: -0.1, width: 0.4 });
    bucket(d, { x: -0.36, z: 0.08, width: 0.14 });
    standingPong(d, new THREE.Vector3(0.02, 0, 0.32), { faces: -1 });
    return d;
  },

  "pong-market": (ctx) => {
    const d = new Diorama(ctx);
    const market = backCard(d, "floating-market", { name: "market", label: "market" });
    d.action("market", "bustle", () => { market.bounce(); sfx(d, "laugh", 0, 0.35); });
    const cart = figure(d, "mango-cart", { width: 0.4, x: 0.32, y: 0, z: -0.14, delay: 0.25, name: "mango", label: "mango cart", radius: 0.2, onTap: () => wobble() });
    const mangoes = d.burst(0xf7c948, 30, 0.026);
    const ms = { w: 0 };
    const wobble = () => { ms.w = 1; if (cart) { cart.bounce(); mangoes.emit(d.group.worldToLocal(cart.worldPoint(0.5, 0.7, 0.05)), 8, 0.3, 0.8); } sfx(d, "boing", 0, 0.4); };
    d.action("mango", "wobble", wobble);
    d.updaters.push((dt, t) => { ms.w = Math.max(0, ms.w - dt); if (cart) cart.group.rotation.z = Math.sin(ms.w * 18) * 0.06 * ms.w; });
    const pong = standingPong(d, new THREE.Vector3(0.0, 0, 0.32));
    monkey(d, { x: -0.34, z: 0.0, width: 0.28, pong });
    return d;
  },

  "pong-temple": (ctx) => {
    const d = new Diorama(ctx);
    const temple = backCard(d, "temple", { name: "temple", label: "temple" });
    d.action("temple", "chime", () => { temple.bounce(); sfx(d, "bell", 0, 0.5); });
    const bell = figure(d, "bell", { width: 0.3, x: -0.32, y: 0, z: -0.2, delay: 0.25, name: "bell", label: "bell", radius: 0.16, onTap: () => ring() });
    const bs = { v: 0, a: 0 };
    const ring = () => { bs.v += 5; sfx(d, "bell", 0, 0.6); if (bell) bell.bounce(); };
    d.updaters.push((dt, t) => { bs.v += -bs.a * 40 * dt - bs.v * 2.5 * dt; bs.a += bs.v * dt; if (bell) bell.group.rotation.z = bs.a * 0.06; });
    d.action("bell", "ring", ring);
    let blessed = false;
    const monk = figure(d, "monk", { width: 0.3, x: 0.32, y: 0, z: -0.08, delay: 0.3, name: "monk", label: "monk", radius: 0.16, onTap: () => pour() });
    const pour = () => {
      if (monk) monk.bounce();
      const from = monk ? d.group.worldToLocal(monk.worldPoint(0.3, 0.55, 0.05)) : new THREE.Vector3(0.2, 0.3, 0);
      const drops = d.burst(0x8fd0ff, 30, 0.02);
      [0, 1, 2].forEach((i) => setTimeout(() => drops.emit(from.clone(), 5, 0.15, 0.2, new THREE.Vector3(-0.6, -0.4, 0)), i * 150));
      sfx(d, "shimmer", 0.4); d.ctx.sound.chime(4, 0.3);
      if (!blessed) { blessed = true; ctx.onMagic("luck"); }
    };
    d.action("monk", "pour", pour);
    if (!monk) d.hotspot(temple, "monk", [0.55, 0.05, 0.3, 0.5], { label: "monk", radius: 0.2, onTap: pour });
    standingPong(d, new THREE.Vector3(-0.02, 0, 0.32));
    return d;
  },

  "pong-river": (ctx) => {
    const d = new Diorama(ctx);
    const river = backCard(d, "river-boats", { name: "river", label: "river" });
    d.action("river", "ripple", () => { river.bounce(); splash(d, new THREE.Vector3(0.1, 0.05, -0.05), { color: 0x8fd0ff, count: 14 }); sfx(d, "splash", 0, 0.35); });
    const boats = figure(d, "boats", { width: 0.5, x: 0.3, y: 0, z: -0.24, delay: 0.25, name: "boats", label: "boats", radius: 0.24, onTap: () => rock() });
    const rs = { r: 0 };
    const rock = () => { rs.r = 1; if (boats) boats.bounce(); sfx(d, "splash", 1, 0.3); };
    d.updaters.push((dt, t) => { rs.r = Math.max(0, rs.r - dt * 0.6); if (boats) boats.group.rotation.z = Math.sin(t * 1.6) * 0.02 + Math.sin(rs.r * 14) * 0.06 * rs.r; });
    d.action("boats", "rock", rock);
    girl(d, { x: -0.34, z: -0.02, width: 0.26 });
    standingPong(d, new THREE.Vector3(0.02, 0, 0.32));
    return d;
  },

  "pong-garland": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "river-boats");
    girl(d, { x: 0.34, z: 0.0, width: 0.28 });
    const pong = standingPong(d, new THREE.Vector3(-0.14, 0, 0.32));
    garland(d, { pong });
    d.action("pong", "sniff", () => { pong.hero.look(); pong.spring.kick(0, 0.3, 0); sfx(d, "shimmer", 0.3); });
    return d;
  },

  "pong-street": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "street-water");
    bucket(d, { x: -0.38, z: 0.06, width: 0.14 });
    let giggled = false;
    d.onGiggle = () => { if (!giggled) { giggled = true; ctx.onMagic("giggle"); } };
    const pong = standingPong(d, new THREE.Vector3(-0.04, 0, 0.32));
    monkey(d, { x: 0.34, z: -0.04, width: 0.26, pong });
    // the tickling drop: it lands on Pong's ear on the "trunk" verb too
    d.action("pong", "trunk", () => { const ear = d.group.worldToLocal(pong.group.localToWorld(new THREE.Vector3(0.14, 0.5, 0.05))); splash(d, ear, { color: 0x8fd0ff, count: 4, size: 0.02, speed: 0.15, up: 0.3 }); pong.hero.look(); pong.spring.kick(0.1, 0.3, 0); d.ctx.sound.chime(6, 0.25); });
    return d;
  },

  "pong-fountain": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "street-water");
    let sprayed = false;
    d.onSpray = () => { if (!sprayed) { sprayed = true; ctx.onMagic("spray"); } };
    bucket(d, { x: -0.32, z: 0.1, width: 0.16 });
    tuktuk(d, { x: 0.22, z: -0.36, width: 0.36 });
    crowd(d, { x: -0.12, z: -0.42, width: 0.56 });
    const pong = standingPong(d, new THREE.Vector3(-0.04, 0, 0.32));
    monkey(d, { x: 0.36, z: -0.08, width: 0.26, pong });
    return d;
  },

  "pong-splash": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "street-water");
    makeFall(d, { count: 90, color: 0xbfe6ff, size: 0.02, speed: 0.4, sway: 0.03, level: 0.8, box: [1.3, 1.0, 0.8], center: [0, 0.5, 0] });
    let happy = false;
    d.onShake = () => { if (!happy) { happy = true; ctx.onMagic("happy"); } };
    crowd(d, { x: 0.12, z: -0.26, width: 0.7 });
    bucket(d, { x: -0.4, z: 0.08, width: 0.14 });
    bucket(d, { x: 0.42, z: 0.12, width: 0.12, name: "bucket2" });
    standingPong(d, new THREE.Vector3(-0.22, 0, 0.32));
    return d;
  },

  "pong-lanterns": (ctx) => {
    const d = new Diorama(ctx);
    const sky = backCard(d, "street-evening");
    const sun = sky.glow(0.5, 0.62, 0xffb060, 0.5, 0.35);
    const ss = { y: 0, target: 0 };
    d.register("sun", new THREE.Group(), { label: "sun", radius: 0.2, anchor: () => sky.worldPoint(0.5, 0.62, 0.05) });
    d.action("sun", "set", () => { ss.target = Math.min(0.3, ss.target + 0.12); d.ctx.sound.chime(2, 0.3); });
    d.updaters.push((dt, t) => { ss.y = lerp(ss.y, ss.target, dt * 1.5); sun.position.copy(sky.point(0.5, 0.62 - ss.y, 0.02)); sun.material.opacity = 0.35 - ss.y * 0.8 + Math.sin(t) * 0.03; });
    lanterns(d, { x: -0.2, y: 0.42, z: -0.3, width: 0.5 });
    const pong = standingPong(d, new THREE.Vector3(-0.08, 0, 0.32));
    monkey(d, { x: 0.34, z: 0.0, width: 0.24, pong });
    return d;
  },

  "pong-home": (ctx) => homeScene(ctx, { asleep: false }),
  end: (ctx) => homeScene(ctx, { asleep: true }),
};

function crowd(d, { x, z, width }) {
  const card = friend(d, "crowd", { name: "crowd", label: "everyone", width, x, z, delay: 0.35, call: "cheer", note: 0, verb: "cheer", radius: 0.3 });
  if (card) d.action("crowd", "cheer", () => { card.bounce(); sfx(d, "cheer", 0, 0.5); splash(d, d.group.worldToLocal(card.worldPoint(0.5, 0.7, 0.05)), { color: 0x8fd0ff, count: 16 }); });
  return card;
}

function homeScene(ctx, { asleep }) {
  const d = new Diorama(ctx);
  const home = backCard(d, "home-night", { name: "home", label: "home" });
  const glow = home.glow(0.72, 0.62, 0xffd9a0, 0.45, 0.3);
  d.action("home", "glow", () => { home.bounce(); glow.material.opacity = 0.7; d.ctx.sound.chime(4, 0.3); });
  d.updaters.push((dt, t) => { glow.material.opacity = lerp(glow.material.opacity, 0.3, dt) + Math.sin(t * 2) * 0.02; });
  d.hotspot(home, "bed", [0.55, 0.05, 0.42, 0.45], { label: "bed", radius: 0.2, onTap: () => { home.bounce(); d.ctx.sound.click(); } });
  d.action("bed", "creak", () => { home.bounce(); d.ctx.sound.click(); });
  garland(d, { x: 0.36, y: 0.4, z: -0.3, width: 0.16 });
  const pong = standingPong(d, new THREE.Vector3(-0.1, 0, 0.32), { pose: asleep ? "sleep" : "stand" });
  let slept = asleep;
  d.action("pong", "sleep", () => { pong.sleep(); d.ctx.sound.chime(0, 0.3); if (!slept) { slept = true; ctx.onMagic("sleep"); } });
  if (asleep) { pong.sleep(); setTimeout(() => ctx.onMagic("sleep"), 2500); }
  return d;
}

export default builders;

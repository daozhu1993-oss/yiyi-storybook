/* The spreads of "Otto and the Shy Moon": one builder per scene id in story.json, plus the
   end page. Otto-specific pieces (the bedroom, Otto on his balloon, his story verbs) live here;
   the shared pop-up engine is in src/scenes.js. */
import * as THREE from "three";
import * as P from "../../src/props.js";
import { Diorama, art, skyFallback, backCard, figure, standingSpring, tiedBalloon, starField, moonCard } from "../../src/scenes.js";

const { clamp, lerp, easeOutBack } = P;

function floatingOtto(d, position, { pose = "float", balloonOffset = new THREE.Vector3(0.3, 0.62, 0.06), delay = 0.3, name = "otto", drift = 1, scale = 0.6 } = {}) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.scale.setScalar(scale);
  const otto = d.ctx.makeOtto();
  otto.setPose(pose);
  group.add(otto.group);
  const balloon = P.makeBalloon();
  balloon.state.rest.copy(balloonOffset);
  group.add(balloon.group);
  const origin = position.clone();
  const base = new THREE.Vector3();
  const seed = Math.random() * 6;
  const rig = { group, otto, balloon, base, origin, seed, dragging: false, off: new THREE.Vector3(), vel: new THREE.Vector3(), moveTo: (abs) => base.copy(abs).sub(origin), kick: (x, y, z) => rig.vel.add(new THREE.Vector3(x, y, z)) };
  d.register("balloon", balloon.group, {
    label: "balloon",
    radius: 0.16,
    onHover: (on) => { if (on) balloon.poke(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1, 0)); },
    onTap: () => { balloon.poke(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.25, 0.1)); d.ctx.sound.pop(1.3); },
    onDrag: (worldPoint) => {
      const local = group.worldToLocal(worldPoint.clone());
      const offset = local.sub(balloon.state.rest).sub(new THREE.Vector3(0, 0.19, 0));
      offset.z *= 0.3;
      if (offset.length() > 0.42) offset.setLength(0.42);
      balloon.state.drag = offset;
      rig.dragging = true;
    },
    onDragEnd: () => { balloon.state.drag = null; rig.dragging = false; d.ctx.sound.whoosh(true); },
  });
  d.add(group, {
    pop: "rise",
    delay,
    name,
    label: "Otto",
    radius: 0.22,
    anchor: () => otto.head ? otto.head.getWorldPosition(new THREE.Vector3()) : group.getWorldPosition(new THREE.Vector3()),
    onHover: (on) => { if (on) otto.blink(); },
    onTap: () => { otto.wave(); d.ctx.sound.chime(2, 0.4); },
  });
  ottoActions(d, name, otto, rig.kick);
  d.action(name, "held", () => { balloon.poke(new THREE.Vector3(0, 0.3, 0.05)); rig.kick(0, 0.4, 0); d.ctx.sound.pop(1.2); });
  d.updaters.push((dt, t) => {
    balloon.update(dt, t);
    rig.vel.addScaledVector(rig.off, -40 * dt).addScaledVector(rig.vel, -6 * dt);
    rig.off.addScaledVector(rig.vel, dt);
    const tug = balloon.state.offset.clone().multiplyScalar(rig.dragging ? 0.55 : 0.25);
    group.position.copy(rig.base).add(tug).add(rig.off);
    group.position.y += Math.sin(t * 1.1 + seed) * 0.02 * drift;
    group.rotation.z = Math.sin(t * 0.7 + seed) * 0.04 + -balloon.state.offset.x * 0.5;
    group.updateMatrixWorld(true);
    // aim the paw at the string knot, then run the character once for this frame
    balloon.group.updateWorldMatrix(true, false);
    const knotWorld = balloon.group.localToWorld(new THREE.Vector3(0, -0.03, 0));
    if (pose !== "sleep") otto.hold(knotWorld, "left");
    otto.lookAt(d.pointer);
    otto.update(dt, t);
    balloon.tether(otto.paw(), group);
  });
  return rig;
}

/** Story verbs every Otto answers to: float, up, down, wave, peek, look, sleep, jump, climb… */
function ottoActions(d, name, otto, kick) {
  const sound = d.ctx.sound;
  d.action(name, "float", () => { kick(0, 0.9, 0); otto.blink(); sound.whoosh(true); });
  d.action(name, "up", () => { kick(0, 1.6, 0); sound.whoosh(true); if (otto.jump) otto.jump(); });
  d.action(name, "down", () => { kick(0, -1.2, 0); sound.whoosh(false); });
  d.action(name, "wave", () => { otto.wave(); sound.chime(2, 0.4); });
  d.action(name, "peek", () => { kick(-0.7, 0.2, 0.3); otto.blink(); if (otto.look) otto.look(); sound.chime(1, 0.3); });
  d.action(name, "look", () => { if (otto.look) otto.look(); else otto.blink(); sound.chime(0, 0.3); });
  d.action(name, "shy", () => { kick(0.5, -0.1, 0); otto.blink(); sound.chime(3, 0.25); });
  d.action(name, "whisper", () => { kick(0, 0.2, 0.6); otto.blink(); sound.chime(4, 0.2); });
  d.action(name, "climb", () => { kick(0, 1.2, 0); sound.pop(0.9); });
  d.action(name, "jump", () => { kick(0, 1.8, 0); if (otto.jump) otto.jump(); sound.pop(1.3); });
  d.action(name, "sleep", () => {
    const back = otto.state.pose;
    otto.setPose("sleep"); sound.glow();
    setTimeout(() => { if (otto.state.pose === "sleep") otto.setPose(back === "sleep" ? "stand" : back); }, 3800);
  });
}

/** A small damped spring on a standing character's group (kicks move it, it settles back). */

function bedroom(d, { moon = false } = {}) {
  const wall = backCard(d, moon ? "bedroom-wall-moon" : "bedroom-wall", { width: 1.16, z: -0.55, name: "wall", label: "wall" });
  const windowGlow = wall.glow(0.63, 0.52, moon ? 0xfff0b8 : 0x9fb8ff, 0.55, moon ? 0.45 : 0);
  const glowState = { level: moon ? 0.45 : 0, base: moon ? 0.45 : 0 };
  d.hotspot(wall, "window", [0.42, 0.16, 0.45, 0.7], { label: "window", radius: 0.3, glow: moon ? 0xfff0b8 : 0x9fb8ff, onHover: (on) => { if (on) glowState.level = Math.max(glowState.level, 0.45); }, onTap: () => { wall.bounce(); d.ctx.sound.chime(4, 0.35); glowState.level = 0.8; } });
  d.hotspot(wall, "shelf", [0.02, 0.44, 0.34, 0.3], { label: "boat", radius: 0.2, onTap: () => { wall.bounce(); d.ctx.sound.pop(1.2); } });
  d.hotspot(wall, "bunting", [0.0, 0.84, 1, 0.16], { label: "stars", radius: 0.4, onTap: () => { wall.bounce(); d.ctx.sound.sparkle(); } });
  if (moon) d.hotspot(wall, "moon", [0.6, 0.5, 0.22, 0.3], { label: "moon", radius: 0.15, onTap: () => { glowState.level = 1; d.ctx.sound.chime(6, 0.4); } });
  const front = figure(d, "bedroom-front", { width: 0.92, x: 0.02, z: -0.03, delay: 0.14, name: "furniture", label: "bed", radius: 0.32, register: false, pop: "rise" });
  const lamp = { on: true, level: 1 };
  let lampGlow = null, lampLight = null;
  if (front) {
    lampGlow = front.glow(0.86, 0.84, 0xffd08a, 0.36, 0.5);
    lampLight = new THREE.PointLight(0xffc98a, 1.6, 1.4, 1.8);
    lampLight.position.copy(front.point(0.86, 0.84, 0.1));
    front.group.add(lampLight);
    d.hotspot(front, "lamp", [0.74, 0.58, 0.26, 0.42], { label: "lamp", radius: 0.14, onTap: () => { lamp.on = !lamp.on; front.bounce(); d.ctx.sound.lampSwitch(lamp.on); if (d.onLamp) d.onLamp(lamp.on); } });
    d.hotspot(front, "bed", [0.0, 0.2, 0.68, 0.75], { label: "bed", radius: 0.3, onTap: () => { front.bounce(); d.ctx.sound.pop(0.8); } });
    d.hotspot(front, "blocks", [0.52, 0.0, 0.25, 0.28], { label: "blocks", radius: 0.12, onTap: () => { front.bounce(); d.ctx.sound.pop(1.4); } });
    d.hotspot(front, "boat", [0.2, 0.0, 0.26, 0.42], { label: "boat", radius: 0.12, onTap: () => { front.bounce(); d.ctx.sound.chime(1, 0.3); } });
    d.hotspot(front, "nightstand", [0.7, 0.22, 0.3, 0.36], { label: "table", radius: 0.14, onTap: () => { front.bounce(); d.ctx.sound.click(); } });
  }
  d.action("window", "dark", () => { glowState.level = 0; glowState.dark = 1.2; d.ctx.sound.click(); });
  d.action("window", "night", () => { glowState.level = 0.6; d.ctx.sound.chime(4, 0.3); });
  d.action("window", "glow", () => { glowState.level = 1; d.ctx.sound.chime(6, 0.4); });
  if (moon) d.action("moon", "glow", () => { glowState.level = 1; d.ctx.sound.glow(); });
  d.action("wall", "night", () => { wall.bounce(); glowState.level = Math.max(glowState.level, 0.5); d.ctx.sound.chime(4, 0.3); });
  d.action("bed", "warm", () => { front && front.bounce(); d.ctx.sound.pop(0.8); });
  d.action("lamp", "glow", () => { lamp.on = true; front && front.bounce(); d.ctx.sound.lampSwitch(true); });
  d.updaters.push((dt, t) => {
    if (glowState.dark > 0) glowState.dark -= dt; else glowState.level += (glowState.base - glowState.level) * Math.min(1, dt * 1.5);
    windowGlow.material.opacity = glowState.level * 0.6;
    lamp.level += ((lamp.on ? 1 : 0) - lamp.level) * Math.min(1, dt * 6);
    if (lampGlow) lampGlow.material.opacity = lamp.level * (0.48 + Math.sin(t * 9) * 0.03);
    if (lampLight) lampLight.intensity = lamp.level * 1.6;
  });
  return { wall, front, lamp, glowState };
}

/* ---------- pages ---------- */

const builders = {
  "bedroom-dark": (ctx) => {
    const d = new Diorama(ctx);
    const room = bedroom(d);
    const otto = ctx.makeOtto();
    otto.group.position.set(0.3, 0, 0.3);
    otto.group.scale.setScalar(0.62);
    d.add(otto.group, { pop: "rise", delay: 0.26, name: "otto", label: "Otto", radius: 0.2, anchor: () => (otto.head ? otto.head.getWorldPosition(new THREE.Vector3()) : otto.group.getWorldPosition(new THREE.Vector3())), onTap: () => { otto.wave(); ctx.sound.chime(2, 0.4); } });
    const spring = standingSpring(otto.group);
    ottoActions(d, "otto", otto, spring.kick);
    d.updaters.push((dt, t) => { spring.update(dt); otto.lookAt(d.pointer); otto.update(dt, t); });
    const post = () => (room.front ? room.front.worldPoint(0.04, 0.84, 0.02) : d.group.localToWorld(new THREE.Vector3(-0.4, 0.4, 0)));
    tiedBalloon(d, post, new THREE.Vector3(-0.36, 0.5, 0.14));
    return d;
  },

  "bedroom-balloon": (ctx) => {
    const d = new Diorama(ctx);
    const room = bedroom(d);
    const start = new THREE.Vector3(0.14, 0.26, 0.26);
    const rig = floatingOtto(d, start, { delay: 0.28, scale: 0.56 });
    // the story beat: "Up, up, up went Otto! Out of the window and into the night."
    const windowLocal = () => {
      const w = room.wall.worldPoint(0.645, 0.5, 0.0);
      return d.group.worldToLocal(w);
    };
    const flight = { stage: 0, target: start.clone(), scale: 0.56, out: false, sparkles: 0 };
    const stages = () => {
      const win = windowLocal();
      const wallTop = room.wall ? room.wall.height : 0.8;
      return [
        start.clone(),
        new THREE.Vector3(0.12, 0.42, 0.2),
        new THREE.Vector3(0.05, 0.56, 0.06),
        new THREE.Vector3(win.x - 0.02, win.y - 0.02, win.z + 0.14),
        // "out of the window and into the night": up past the top of the room, in front of it
        new THREE.Vector3(win.x + 0.04, wallTop + 0.55, win.z + 0.12),
      ];
    };
    const goStage = (n) => {
      flight.stage = Math.max(flight.stage, Math.min(4, n));
      flight.target.copy(stages()[flight.stage]);
      flight.scale = flight.stage >= 3 ? 0.42 : 0.56;
      if (flight.stage >= 4) { flight.out = true; room.glowState.level = 0.9; room.glowState.base = 0.6; ctx.sound.whoosh(true); ctx.sound.sparkle(); }
      else ctx.sound.whoosh(true);
    };
    d.action("otto", "up", () => goStage(flight.stage + 1));
    d.action("otto", "out", () => goStage(4));
    d.action("window", "out", () => { goStage(4); room.wall.bounce(); });
    const stars = d.burst(0xfff0b8, 60, 0.03);
    d.action("wall", "night", () => {
      room.wall.bounce();
      room.glowState.level = Math.max(room.glowState.level, 0.8);
      const win = windowLocal();
      stars.emit(new THREE.Vector3(win.x, win.y + 0.1, win.z + 0.05), 18, 0.3, 1.2);
      ctx.sound.chime(4, 0.3);
    });
    d.updaters.push((dt) => {
      const k = Math.min(1, dt * 1.4);
      rig.base.lerp(flight.target.clone().sub(rig.origin), k);
      rig.group.scale.setScalar(THREE.MathUtils.lerp(rig.group.scale.x, flight.scale, k));
      if (flight.out && Math.random() < dt * 4) { const win = windowLocal(); stars.emit(new THREE.Vector3(win.x + (Math.random() - 0.5) * 0.3, win.y + (Math.random() - 0.5) * 0.3, win.z + 0.03), 1, 0.08, 1); }
    });
    const puffs = d.burst(0xfff3d0, 40, 0.025);
    d.every(1.2, () => { if (!flight.out) puffs.emit(rig.group.position.clone().add(rig.origin).add(new THREE.Vector3(0, 0.02, 0.05)), 3, 0.15, 0.6); });
    return d;
  },

  rooftops: (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "rooftops-sky");
    const strip = P.makePaperStrip(ctx.textures.town, 1.02);
    strip.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ctx.textures.town, alphaTest: 0.2 });
    strip.group.position.set(0, 0, -0.2);
    const glows = [[-0.3, 0.42], [-0.02, 0.5], [0.3, 0.38], [0.14, 0.3]].map(([nx, ny]) => {
      const s = P.glowSprite(0xffd08a, 0.16, 0.0);
      s.position.set(nx * 1.02, ny * strip.height, 0.02);
      strip.group.add(s);
      return s;
    });
    const town = { lit: 0, target: 0 };
    d.add(strip.group, { pop: "hinge", delay: 0.08, name: "town", label: "rooftops", radius: 0.4, onHover: (on) => { town.target = on ? 1 : 0; if (on) ctx.sound.chime(0, 0.25); }, onTap: () => { town.target = 1; strip.mesh.userData.bounce = 1; ctx.sound.sparkle(); setTimeout(() => { town.target = 0; }, 2500); } });
    d.updaters.push((dt, t) => {
      town.lit += (town.target - town.lit) * Math.min(1, dt * 4);
      glows.forEach((g, i) => { g.material.opacity = town.lit * (0.45 + Math.sin(t * 4 + i) * 0.1); });
      if (strip.mesh.userData.bounce > 0) {
        strip.mesh.userData.bounce -= dt * 1.5;
        const k = Math.sin(Math.max(0, strip.mesh.userData.bounce) * Math.PI);
        strip.mesh.scale.set(1 + k * 0.02, 1 + k * 0.05, 1);
      }
    });
    d.action("town", "glow", () => { town.target = 1; strip.mesh.userData.bounce = 1; ctx.sound.sparkle(); setTimeout(() => { town.target = 0; }, 3000); });
    const smoke = d.burst(0xbcc2e8, 80, 0.035);
    const cat = figure(d, "cat", { width: 0.19, x: 0.22, y: 0.2, z: -0.15, delay: 0.3, name: "cat", label: "cat", radius: 0.14, onTap: () => { ctx.sound.meow(); }, onHover: (on) => { if (on) ctx.sound.chime(3, 0.15); } });
    if (cat) {
      d.action("cat", "meow", () => { ctx.sound.meow(); cat.bounce(); });
      d.hotspot(cat, "chimney", [0.1, 0.0, 0.8, 0.42], { label: "chimney", radius: 0.12, onTap: () => { smoke.emit(cat.worldPoint(0.5, 0.42, 0.05).sub(d.group.getWorldPosition(new THREE.Vector3())), 14, 0.2, 0.8); ctx.sound.puff(); cat.bounce(); } });
      d.every(0.5, () => smoke.emit(cat.worldPoint(0.5, 0.44, 0.04).sub(d.group.getWorldPosition(new THREE.Vector3())), 1, 0.06, 0.4));
    }
    floatingOtto(d, new THREE.Vector3(-0.16, 0.3, 0.22), { delay: 0.38, scale: 0.58 });
    return d;
  },

  clouds: (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "clouds-sky");
    const specs = [
      ["cloud-a", 0.36, -0.3, 0.08, 0.06, "cloud", "cloud", false],
      ["cloud-sleepy", 0.46, 0.2, 0.02, 0.24, "sleepy", "sleepy cloud", true],
      ["cloud-b", 0.24, 0.38, 0.5, -0.22, "cloud2", "cloud", false],
      ["cloud-a", 0.26, -0.36, 0.58, -0.34, "clouds", "clouds", false],
    ];
    const puffs = d.burst(0xffffff, 60, 0.04);
    const cards = specs.map(([id, w, x, y, z, name, label, sleepy], i) => {
      const s = { seed: Math.random() * 6, shift: new THREE.Vector3(), push: new THREE.Vector3() };
      const card = figure(d, id, {
        width: w, x, y, z, delay: 0.1 + i * 0.06, name, label, radius: w * 0.45,
        onHover: (on) => { if (on) ctx.sound.chime(i, 0.2); },
        onTap: () => { if (sleepy) ctx.sound.yawn(); else ctx.sound.puff(); puffs.emit(new THREE.Vector3(x, y + w * 0.3, z), 6, 0.15, 0.8); },
        onDrag: (worldPoint) => { const local = d.group.worldToLocal(worldPoint.clone()); s.push.set(clamp(local.x - x, -0.25, 0.25), clamp(local.y - y - w * 0.3, -0.15, 0.15), 0); },
        onDragEnd: () => ctx.sound.puff(),
      });
      if (!card) return null;
      d.action(name, "yawn", () => { ctx.sound.yawn(); card.bounce(); puffs.emit(new THREE.Vector3(x, y + w * 0.3, z), 4, 0.12, 0.8); });
      d.action(name, "puff", () => { ctx.sound.puff(); s.push.set(0.12, 0.05, 0); puffs.emit(new THREE.Vector3(x + w * 0.3, y + w * 0.3, z + 0.05), 10, 0.2, 0.9); });
      d.updaters.push((dt, t) => {
        s.shift.lerp(s.push, Math.min(1, dt * 4));
        s.push.multiplyScalar(Math.max(0, 1 - dt * 1.5));
        card.group.position.copy(s.shift);
        card.group.position.y += Math.sin(t * 0.8 + s.seed) * 0.02;
      });
      return card;
    });
    floatingOtto(d, new THREE.Vector3(-0.12, 0.4, 0.3), { delay: 0.36, scale: 0.52 });
    return d;
  },

  "owl-tree": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "owl-forest");
    const tree = figure(d, "owl-tree", { width: 0.66, x: -0.18, z: -0.24, delay: 0.06, pop: "hinge", name: "tree", label: "tree", radius: 0.4, onTap: () => ctx.sound.puff() });
    const owl = figure(d, "owl", { width: 0.17, x: 0.09, y: 0.36, z: -0.2, delay: 0.3, name: "owl", label: "owl", radius: 0.12, onTap: () => { ctx.sound.hoot(); }, onHover: (on) => { if (on) ctx.sound.chime(3, 0.15); } });
    if (tree) d.action("tree", "tall", () => { tree.bounce(); tree.lift && tree.lift(); ctx.sound.whoosh(true); });
    if (owl) {
      d.action("owl", "blink", () => { owl.bounce(); ctx.sound.chime(5, 0.3); });
      d.action("owl", "hoo", () => { ctx.sound.hoot(); owl.bounce(); });
      // just the eye band, and a tap there still hoots: the hint promises "tap her to hear her hoot"
      d.hotspot(owl, "eyes", [0.2, 0.58, 0.6, 0.18], { label: "eyes", radius: 0.08, onTap: () => { owl.bounce(); ctx.sound.hoot(); } });
      const hop = { v: 0, y: 0 };
      d.updaters.push((dt, t) => {
        const world = owl.group.getWorldPosition(new THREE.Vector3());
        owl.state.targetTilt = clamp((d.pointer.x - world.x) * 0.9, -0.3, 0.3);
        if (owl.state.bounce > 0.9 && hop.y === 0) hop.v = 0.9;
        hop.v -= dt * 5;
        hop.y = Math.max(0, hop.y + hop.v * dt);
        if (hop.y === 0) hop.v = Math.max(hop.v, 0);
        owl.group.position.y = hop.y;
      });
    }
    floatingOtto(d, new THREE.Vector3(0.32, 0.16, 0.2), { delay: 0.36, scale: 0.55 });
    const fireflies = d.burst(0xd8ff7a, 40, 0.022);
    d.every(0.28, () => fireflies.emit(new THREE.Vector3(-0.1 + (Math.random() - 0.5) * 0.8, 0.04 + Math.random() * 0.3, 0.1 + (Math.random() - 0.5) * 0.5), 1, 0.04, 1));
    return d;
  },

  "star-path": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "stars-sky");
    const points = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      points.push(new THREE.Vector3(lerp(-0.26, 0.44, u), 0.16 + u * 0.58 + Math.sin(u * Math.PI) * 0.1, lerp(0.2, -0.34, u)));
    }
    const stars = points.map((p, i) => {
      const star = P.makeStar(0.055, { lit: i === 0 });
      star.group.position.copy(p);
      return star;
    });
    const state = { lit: 1, done: false };
    const path = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 60, 0.012, 8, false), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc94a, emissiveIntensity: 1.2, transparent: true, opacity: 0 }));
    d.add(path, { pop: null, name: "path", label: "path", radius: 0.4, onTap: () => ctx.sound.sparkle() });
    const sparkle = d.burst(0xfff0b8, 90, 0.035);
    stars.forEach((star, i) => {
      d.add(star.group, {
        pop: "rise",
        delay: 0.12 + i * 0.05,
        name: `star${i}`,
        label: "star",
        radius: 0.1,
        onHover: (on) => { if (on) star.twinkle(); },
        onTap: () => {
          if (state.done) { star.twinkle(); ctx.sound.chime(i, 0.4); return; }
          if (i === state.lit) {
            star.setLit(true); star.twinkle(); state.lit++;
            ctx.sound.chime(i * 2, 0.5);
            sparkle.emit(star.group.position.clone().add(points[i]).sub(star.group.position), 12, 0.25, 1);
            if (state.lit >= count) { state.done = true; ctx.sound.glow(); ctx.onMagic && ctx.onMagic("path"); }
          } else if (i < state.lit) { star.twinkle(); ctx.sound.chime(i, 0.3); }
          else { star.group.userData.wiggle = 1; ctx.sound.pop(0.7); }
        },
      });
    });
    d.register("stars", d.group, { label: "stars", radius: 0.4, onHover: (on) => { if (on) stars.forEach((s, i) => setTimeout(() => s.twinkle(), i * 60)); }, onTap: () => { stars.forEach((s, i) => setTimeout(() => s.twinkle(), i * 70)); ctx.sound.sparkle(); } });
    d.action("stars", "twinkle", () => { stars.forEach((s, i) => setTimeout(() => { s.twinkle(); sparkle.emit(points[i], 3, 0.1, 1); }, i * 90)); ctx.sound.sparkle(); });
    stars.forEach((s, i) => s.group.traverse((m) => { if (m.isMesh || m.isSprite) m.userData.owner = `star${i}`; }));
    const rigOffset = new THREE.Vector3(0.14, -0.04, 0.12);
    const rig = floatingOtto(d, points[0].clone().add(rigOffset), { delay: 0.2, scale: 0.5 });
    d.updaters.push((dt, t) => {
      stars.forEach((s) => {
        s.update(dt, t);
        if (s.group.userData.wiggle > 0) { s.group.userData.wiggle -= dt * 2; s.group.rotation.z = Math.sin(s.group.userData.wiggle * 30) * 0.3 * s.group.userData.wiggle; }
      });
      const target = points[Math.min(count - 1, state.lit - 1)].clone().add(rigOffset);
      rig.base.lerp(target.sub(rig.origin), Math.min(1, dt * 1.5));
      path.material.opacity += ((state.done ? 0.85 : 0) - path.material.opacity) * Math.min(1, dt * 2);
      if (state.done && Math.random() < dt * 3) sparkle.emit(points[Math.floor(Math.random() * count)], 2, 0.1, 1);
    });
    figure(d, "owl", { width: 0.14, x: -0.4, y: 0, z: -0.3, delay: 0.1, name: "owl", label: "owl", radius: 0.1, onTap: () => ctx.sound.hoot() });
    return d;
  },

  "behind-cloud": (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "clouds-sky");
    const moon = moonCard(d, { width: 0.34, x: 0.16, y: 0.1, z: -0.22, delay: 0.22, glow: 0.04, onTap: () => ctx.sound.chime(5, 0.4) });
    const state = { revealed: false, dragX: 0 };
    const sparkle = d.burst(0xfff0b8, 80, 0.035);
    const cloud = figure(d, "dark-cloud", {
      width: 0.72, x: 0.16, y: 0.02, z: 0.04, delay: 0.18, name: "cloud", label: "cloud", radius: 0.3,
      onHover: (on) => { if (on) ctx.sound.chime(0, 0.2); },
      onTap: () => ctx.sound.puff(),
      onDrag: (worldPoint) => { const local = d.group.worldToLocal(worldPoint.clone()); state.dragX = clamp(local.x - 0.16, -0.15, 0.55); },
      onDragEnd: () => ctx.sound.puff(),
    });
    if (cloud) d.action("cloud", "behind", () => { state.dragX = state.dragX > 0.2 ? 0 : 0.4; cloud.bounce(); ctx.sound.puff(); });
    if (moon) d.action("moon", "hide", () => { state.dragX = 0; moon.setGlow(0.04); ctx.sound.puff(); });
    d.updaters.push((dt, t) => {
      if (cloud) {
        cloud.group.position.x += (state.dragX - cloud.group.position.x) * Math.min(1, dt * 5);
        cloud.group.position.y = Math.sin(t * 0.7) * 0.015;
      }
      if (!state.revealed && state.dragX > 0.32 && moon) {
        state.revealed = true;
        moon.setGlow(0.55);
        moon.pulse();
        sparkle.emit(new THREE.Vector3(0.16, 0.3, -0.2), 24, 0.3, 1);
        ctx.sound.glow();
        ctx.onMagic && ctx.onMagic("moon");
      }
    });
    floatingOtto(d, new THREE.Vector3(-0.26, 0.1, 0.26), { pose: "peek", delay: 0.3, scale: 0.55 });
    return d;
  },

  "moon-glow": (ctx) => {
    const d = new Diorama(ctx);
    const back = backCard(d, "stars-sky");
    const moon = moonCard(d, { width: 0.5, x: 0.12, y: 0.24, z: -0.26, delay: 0.12, glow: 0.12, onTap: () => { ctx.sound.chime(6, 0.5); } });
    const state = { glowed: false, warmth: 0 };
    const sparkle = d.burst(0xfff0b8, 120, 0.04);
    const stars = starField(d, [new THREE.Vector3(-0.42, 0.7, -0.3), new THREE.Vector3(-0.2, 0.86, -0.4), new THREE.Vector3(0.46, 0.86, -0.35), new THREE.Vector3(0.5, 0.3, -0.3), new THREE.Vector3(-0.46, 0.25, -0.2)], { delay: 0.25, size: 0.035 });
    d.action("sky", "bright", () => { state.warmth = 1; moon && moon.pulse(); sparkle.emit(new THREE.Vector3(0.12, 0.48, -0.2), 30, 0.4, 1); ctx.sound.glow(); });
    d.updaters.push((dt, t) => {
      if (!moon) return;
      const moonWorld = moon.card.worldPoint(0.5, 0.5);
      const dist = Math.hypot(d.pointer.x - moonWorld.x, d.pointer.y - moonWorld.y);
      const near = clamp(1 - (dist - 0.22) / 0.6, 0, 1);
      state.warmth += (near - state.warmth) * Math.min(1, dt * (near > state.warmth ? 0.9 : 0.4));
      moon.setGlow(0.12 + state.warmth * 0.88);
      if (!back.fallback) { back.material.emissive.setRGB(state.warmth * 0.18, state.warmth * 0.16, state.warmth * 0.3); }
      if (!state.glowed && state.warmth > 0.9) {
        state.glowed = true;
        moon.pulse();
        sparkle.emit(new THREE.Vector3(0.12, 0.48, -0.2), 60, 0.5, 1);
        stars.forEach((s, i) => setTimeout(() => s.twinkle(), i * 80));
        ctx.sound.glow();
        ctx.onMagic && ctx.onMagic("glow");
      }
      if (state.warmth > 0.7 && Math.random() < dt * 6) sparkle.emit(new THREE.Vector3(0.12 + (Math.random() - 0.5) * 0.4, 0.4, -0.1), 1, 0.08, 1);
    });
    floatingOtto(d, new THREE.Vector3(-0.3, 0.1, 0.22), { delay: 0.3, scale: 0.55 });
    return d;
  },

  descent: (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "rooftops-sky");
    const moon = moonCard(d, { width: 0.2, x: 0.38, y: 0.6, z: -0.4, delay: 0.1, glow: 0.7, onTap: () => ctx.sound.chime(6, 0.4) });
    starField(d, [new THREE.Vector3(-0.3, 0.86, -0.4), new THREE.Vector3(0.05, 0.92, -0.42), new THREE.Vector3(-0.46, 0.66, -0.3), new THREE.Vector3(0.16, 0.74, -0.38)], { delay: 0.15, size: 0.032 });
    const tree = figure(d, "owl-tree", { width: 0.42, x: -0.36, z: -0.3, delay: 0.14, pop: "hinge", name: "tree", label: "tree", radius: 0.25, onTap: () => ctx.sound.puff() });
    figure(d, "owl", { width: 0.11, x: -0.19, y: 0.23, z: -0.27, delay: 0.28, name: "owl", label: "owl", radius: 0.08, onTap: () => ctx.sound.hoot() });
    const c1 = figure(d, "cloud-a", { width: 0.28, x: 0.3, y: 0.04, z: 0.22, delay: 0.22, name: "clouds", label: "clouds", radius: 0.14, onTap: () => ctx.sound.puff() });
    const c2 = figure(d, "cloud-b", { width: 0.2, x: -0.08, y: 0.0, z: 0.38, delay: 0.26, name: "cloud2", label: "cloud", radius: 0.1, onTap: () => ctx.sound.puff() });
    d.updaters.push((dt, t) => {
      if (c1) c1.group.position.y = Math.sin(t * 0.8) * 0.015;
      if (c2) c2.group.position.y = Math.sin(t * 0.7 + 2) * 0.012;
    });
    const rig = floatingOtto(d, new THREE.Vector3(0.05, 0.6, 0.05), { delay: 0.3, drift: 0.5, scale: 0.5 });
    const t0 = performance.now();
    d.updaters.push(() => {
      const p = clamp((performance.now() - t0) / 16000, 0, 1);
      const e = p * p * (3 - 2 * p);
      rig.moveTo(new THREE.Vector3(0.05 + Math.sin(e * Math.PI * 1.5) * 0.12, 0.6 - e * 0.44, 0.05));
    });
    return d;
  },

  "bedroom-moonlit": (ctx) => {
    const d = new Diorama(ctx);
    const room = bedroom(d, { moon: true });
    // Otto sits up in bed in front of the painted bed (never behind the card), then nods off
    const otto = ctx.makeOtto();
    otto.group.scale.setScalar(0.4);
    const bedSpot = room.front ? room.front.point(0.3, 0.4, 0.07).add(new THREE.Vector3(0.02, 0, -0.03)) : new THREE.Vector3(-0.24, 0.2, 0.05);
    otto.group.position.copy(bedSpot);
    otto.setPose("sleep");
    d.add(otto.group, { pop: "rise", delay: 0.26, name: "otto", label: "Otto", radius: 0.16, anchor: () => (otto.head ? otto.head.getWorldPosition(new THREE.Vector3()) : otto.group.getWorldPosition(new THREE.Vector3())), onTap: () => { otto.blink(); otto.wave(); ctx.sound.chime(2, 0.3); } });
    const zz = d.burst(0xdfe6ff, 30, 0.03);
    const state = { dark: false };
    const spring = standingSpring(otto.group);
    ottoActions(d, "otto", otto, spring.kick);
    d.action("otto", "sleep", () => { if (d.onLamp) d.onLamp(false); });
    d.updaters.push((dt, t) => { spring.update(dt); otto.lookAt(d.pointer); otto.update(dt, t); if (state.dark && Math.random() < dt * 0.8) zz.emit(new THREE.Vector3(-0.27, 0.62, -0.05), 1, 0.05, 0.4); });
    d.onLamp = (on) => {
      state.dark = !on;
      room.glowState.base = on ? 0.45 : 0.9;
      if (!on) { otto.setPose("sleep"); ctx.sound.glow(); ctx.onMagic && ctx.onMagic("sleep"); }
    };
    const post = () => (room.front ? room.front.worldPoint(0.04, 0.84, 0.02) : d.group.localToWorld(new THREE.Vector3(-0.4, 0.4, 0)));
    tiedBalloon(d, post, new THREE.Vector3(-0.36, 0.5, 0.14));
    return d;
  },

  end: (ctx) => {
    const d = new Diorama(ctx);
    backCard(d, "stars-sky");
    const moon = moonCard(d, { width: 0.44, x: 0.02, y: 0.24, z: -0.16, delay: 0.1, glow: 0.45, onTap: () => ctx.sound.chime(6, 0.4) });
    const moonTop = moon ? 0.24 + moon.card.height : 0.6;
    floatingOtto(d, new THREE.Vector3(0.02, moonTop - 0.02, -0.12), { pose: "stand", delay: 0.3, drift: 0.2, scale: 0.45 });
    const stars = starField(d, [new THREE.Vector3(-0.45, 0.75, -0.3), new THREE.Vector3(-0.3, 0.95, -0.4), new THREE.Vector3(0.36, 0.98, -0.38), new THREE.Vector3(0.5, 0.6, -0.3), new THREE.Vector3(-0.5, 0.3, -0.2), new THREE.Vector3(0.48, 0.22, -0.1), new THREE.Vector3(-0.15, 1.05, -0.45)], { delay: 0.2, size: 0.04 });
    const sparkle = d.burst(0xfff0b8, 120, 0.04);
    d.every(0.9, () => { const s = stars[Math.floor(Math.random() * stars.length)]; s.twinkle(); sparkle.emit(s.group.position, 6, 0.15, 1); });
    figure(d, "owl", { width: 0.16, x: -0.28, y: 0, z: 0.26, delay: 0.35, name: "owl", label: "owl", radius: 0.1, onTap: () => ctx.sound.hoot() });
    figure(d, "cat", { width: 0.17, x: 0.34, y: 0, z: 0.3, delay: 0.4, name: "cat", label: "cat", radius: 0.1, onTap: () => ctx.sound.meow() });
    return d;
  },
};

export default builders;

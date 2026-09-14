/* Shared 3D vocabulary for the pop-up dioramas: felt and paper materials, Otto, the balloon,
   clouds, the moon, stars, houses, trees, the owl, the cat, the bedroom furniture and a few
   particle helpers. Everything is procedural so it can react to the reader. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";

export const PALETTE = {
  fur: 0xc8823f,
  furLight: 0xf1d3a2,
  nose: 0x3a2418,
  scarf: 0xd9382c,
  balloon: 0xe0352b,
  cloud: 0xf4f0ff,
  cloudShade: 0xc9c4ea,
  moon: 0xfff0b8,
  gold: 0xffd166,
  navy: 0x1d2650,
  wood: 0xb8823f,
  woodDark: 0x7a4f26,
  cream: 0xf8efd8,
  leaf: 0x3f7a4b,
  leafDark: 0x2f5c3a,
  owl: 0x8a5a36,
  owlBelly: 0xe9cfa4,
  cat: 0x3b3550,
  blanket: 0x7fa7d9,
  pillow: 0xfbf4e3,
};

/* ---------- materials ---------- */

export function felt(color, options = {}) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.92,
    metalness: 0,
    sheen: 0.9,
    sheenRoughness: 0.55,
    sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.35),
    ...options,
  });
}

export function paper(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0, ...options });
}

export function glossy(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    ...options,
  });
}

export function glow(color, intensity = 1.2, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.6,
    ...options,
  });
}

export function wood(dark = false) {
  return new THREE.MeshStandardMaterial({ color: dark ? PALETTE.woodDark : PALETTE.wood, roughness: 0.62, metalness: 0.05 });
}

/* ---------- helpers ---------- */

export function sphere(radius, material, segments = 28) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.75)), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function capsule(radius, length, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function box(w, h, d, material, radius = 0.01) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function radialSprite(inner, outer, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, "0.55)"));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let glowTexture = null;
/** Same look as glowSprite but as a flat quad in its parent's plane (for glows on painted cards). */
export function glowPlane(color = 0xfff0b8, size = 1, opacity = 0.7) {
  if (!glowTexture) glowTexture = radialSprite("rgba(255,255,255,1)", "rgba(255,255,255,0)");
  const material = new THREE.MeshBasicMaterial({ map: glowTexture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.scale.setScalar(size);
  mesh.renderOrder = 5;
  // glows are light, not things: never a hit target (a hotspot halo 1.4x its rect was answering
  // taps on the whole owl as "eyes")
  mesh.raycast = () => {};
  return mesh;
}

export function glowSprite(color = 0xfff0b8, scale = 1, opacity = 0.7) {
  if (!glowTexture) glowTexture = radialSprite("rgba(255,255,255,1)", "rgba(255,255,255,0)");
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  sprite.renderOrder = 5;
  return sprite;
}

export function starShape(outer, inner, points = 5) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function easeOutBack(t) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- Otto ---------- */

export function makeOtto() {
  const group = new THREE.Group();
  const fur = felt(PALETTE.fur);
  const light = felt(PALETTE.furLight);
  const dark = glossy(0x2a1a12, { roughness: 0.15 });

  const body = sphere(0.135, fur);
  body.scale.set(1, 1.12, 0.92);
  body.position.y = 0.14;
  group.add(body);
  const belly = sphere(0.09, light);
  belly.scale.set(1, 1.15, 0.6);
  belly.position.set(0, 0.13, 0.08);
  group.add(belly);

  const head = new THREE.Group();
  head.position.y = 0.34;
  group.add(head);
  const skull = sphere(0.15, fur);
  skull.scale.set(1.05, 0.98, 0.98);
  head.add(skull);
  for (const side of [-1, 1]) {
    const ear = sphere(0.05, fur);
    ear.position.set(side * 0.105, 0.115, -0.01);
    head.add(ear);
    const inner = sphere(0.028, light);
    inner.position.set(side * 0.105, 0.115, 0.02);
    head.add(inner);
    const cheek = sphere(0.028, felt(0xf0a08f, { transparent: true, opacity: 0.55 }));
    cheek.scale.set(1, 0.7, 0.5);
    cheek.position.set(side * 0.085, -0.03, 0.115);
    head.add(cheek);
  }
  const muzzle = sphere(0.068, light);
  muzzle.scale.set(1.15, 0.85, 0.8);
  muzzle.position.set(0, -0.045, 0.11);
  head.add(muzzle);
  const nose = sphere(0.024, dark);
  nose.scale.set(1.2, 0.85, 0.8);
  nose.position.set(0, -0.025, 0.165);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3a2418 }));
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.06, 0.158);
  head.add(mouth);

  const eyes = [];
  const lids = [];
  for (const side of [-1, 1]) {
    const eye = sphere(0.026, dark, 18);
    eye.position.set(side * 0.055, 0.015, 0.128);
    head.add(eye);
    const shine = sphere(0.008, new THREE.MeshBasicMaterial({ color: 0xffffff }), 8);
    shine.position.set(side * 0.045, 0.026, 0.15);
    head.add(shine);
    const lid = sphere(0.03, fur, 16);
    lid.position.copy(eye.position);
    lid.scale.set(1, 0.1, 1);
    lid.position.y += 0.026;
    head.add(lid);
    eyes.push(eye);
    lids.push(lid);
  }

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.03, 10, 24), felt(PALETTE.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.225;
  scarf.castShadow = true;
  group.add(scarf);
  const tail = box(0.05, 0.14, 0.02, felt(PALETTE.scarf), 0.008);
  tail.position.set(0.06, 0.15, 0.11);
  tail.rotation.z = 0.15;
  group.add(tail);

  const limbs = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.125, 0.2, 0.02);
    const armMesh = capsule(0.035, 0.09, fur);
    armMesh.position.y = -0.06;
    arm.add(armMesh);
    const paw = sphere(0.04, light);
    paw.position.y = -0.125;
    arm.add(paw);
    group.add(arm);
    limbs[side < 0 ? "armL" : "armR"] = arm;

    const leg = new THREE.Group();
    leg.position.set(side * 0.06, 0.05, 0.01);
    const legMesh = capsule(0.04, 0.05, fur);
    legMesh.position.y = -0.03;
    leg.add(legMesh);
    const foot = sphere(0.048, light);
    foot.scale.set(1, 0.7, 1.2);
    foot.position.set(0, -0.07, 0.02);
    leg.add(foot);
    group.add(leg);
    limbs[side < 0 ? "legL" : "legR"] = leg;
  }

  const state = { pose: "stand", blink: 0, nextBlink: 2 + Math.random() * 3, wave: 0, look: new THREE.Vector3(0, 0.34, 2), bob: Math.random() * 6 };
  const api = {
    group,
    head,
    body,
    limbs,
    state,
    setPose(pose) {
      state.pose = pose;
    },
    blink() {
      state.blink = 0.001;
    },
    wave() {
      state.wave = 1.6;
    },
    lookAt(worldPoint) {
      state.look.copy(worldPoint);
    },
    /** point the right arm at a world position (the balloon string) */
    hold(worldPoint) {
      const local = group.worldToLocal(worldPoint.clone());
      const shoulder = limbs.armR.position;
      state.hold = Math.atan2(local.x - shoulder.x, -(local.y - shoulder.y));
    },
    paw() {
      return limbs.armR.localToWorld(new THREE.Vector3(0, -0.125, 0));
    },
    update(dt, t) {
      // blink
      state.nextBlink -= dt;
      if (state.nextBlink < 0) { api.blink(); state.nextBlink = 2.5 + Math.random() * 4; }
      if (state.blink > 0) {
        state.blink += dt;
        const p = state.blink / 0.28;
        const closed = p < 1 ? Math.sin(p * Math.PI) : 0;
        if (p >= 1) state.blink = 0;
        lids.forEach((lid, i) => {
          lid.scale.y = 0.1 + closed * 0.95;
          lid.position.y = eyes[i].position.y + 0.026 - closed * 0.024;
        });
      }
      // head follows the reader's cursor
      const target = group.worldToLocal(state.look.clone());
      const yaw = clamp(Math.atan2(target.x, target.z + 0.6), -0.55, 0.55);
      const pitch = clamp(-Math.atan2(target.y - 0.34, Math.hypot(target.x, target.z + 0.6)), -0.35, 0.35);
      head.rotation.y += (yaw - head.rotation.y) * Math.min(1, dt * 6);
      head.rotation.x += (pitch - head.rotation.x) * Math.min(1, dt * 6);
      // idle breathing
      const breathe = 1 + Math.sin(t * 2.1 + state.bob) * 0.015;
      body.scale.set(1 * breathe, 1.12, 0.92 * breathe);
      const s = state.pose;
      const swing = Math.sin(t * 1.6 + state.bob);
      if (s === "float") {
        limbs.armR.rotation.z = -2.6 + Math.sin(t * 2) * 0.05;
        limbs.armR.rotation.x = 0.1;
        limbs.armL.rotation.z = 0.35 + Math.sin(t * 1.4) * 0.15;
        limbs.legL.rotation.x = 0.25 + swing * 0.25;
        limbs.legR.rotation.x = 0.25 - swing * 0.25;
      } else if (s === "sleep") {
        limbs.armL.rotation.z = 0.5;
        limbs.armR.rotation.z = -0.5;
        limbs.legL.rotation.x = 0;
        limbs.legR.rotation.x = 0;
        lids.forEach((lid, i) => { lid.scale.y = 1; lid.position.y = eyes[i].position.y + 0.004; });
      } else if (s === "peek") {
        limbs.armL.rotation.z = 1.2;
        limbs.armR.rotation.z = -2.4;
        limbs.legL.rotation.x = 0.4 + swing * 0.2;
        limbs.legR.rotation.x = 0.4 - swing * 0.2;
      } else {
        limbs.armL.rotation.z = 0.25 + swing * 0.08;
        limbs.armR.rotation.z = -0.25 - swing * 0.08;
        limbs.legL.rotation.x = 0;
        limbs.legR.rotation.x = 0;
      }
      if (state.hold != null && s !== "sleep") limbs.armR.rotation.z = state.hold;
      if (state.wave > 0) {
        state.wave -= dt;
        limbs.armL.rotation.z = 2.5 + Math.sin(state.wave * 18) * 0.5;
      }
    },
  };
  return api;
}

/* ---------- Otto from the generated, rigged GLB ---------- */

const _v = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => new THREE.Vector3());
const _q = [0, 1, 2, 3, 4].map(() => new THREE.Quaternion());
const _identity = new THREE.Quaternion();

/** Rotate `bone` in world space so the line from the bone to `tip` points at `target`. */
function aimBone(bone, tip, target, strength = 1) {
  const from = bone.getWorldPosition(_v[0]);
  const tipPos = tip.getWorldPosition(_v[1]);
  const cur = _v[2].subVectors(tipPos, from).normalize();
  const want = _v[3].subVectors(target, from).normalize();
  if (cur.lengthSq() < 1e-6 || want.lengthSq() < 1e-6) return;
  const delta = _q[0].setFromUnitVectors(cur, want);
  if (strength < 1) delta.slerp(_identity, 1 - strength);
  const worldQ = bone.getWorldQuaternion(_q[1]);
  const parentQ = bone.parent.getWorldQuaternion(_q[2]);
  const newWorld = _q[3].copy(delta).multiply(worldQ);
  bone.quaternion.copy(parentQ.invert().multiply(newWorld));
  bone.updateWorldMatrix(false, true);
}

/** Same API as makeOtto, driven by the rigged, textured GLB generated from the character sheet. */
export function makeOttoModel(gltf, clips = {}) {
  const group = new THREE.Group();
  const model = skeletonClone(gltf.scene);
  model.scale.setScalar(0.86);
  group.add(model);
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const m = o.material;
      m.metalness = 0;
      m.roughness = 0.72;
      if (m.emissive) m.emissive.setHex(0x000000);
      m.emissiveMap = null;
      if (m.sheen !== undefined) { m.sheen = 0.5; m.sheenRoughness = 0.6; m.sheenColor = new THREE.Color(0xffe0b0); }
      m.needsUpdate = true;
    }
  });
  // animation: a looping base clip per pose (idle / hang / doze) and one-shots (wave, look, jump)
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  const addClip = (name, clip, loop = true) => {
    if (!clip) return;
    const a = mixer.clipAction(clip);
    if (!loop) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[name] = a;
  };
  addClip("idle", gltf.animations[0]);
  // looping poses and one-shot gestures; a book declares whichever clips its hero has
  const LOOPS = new Set(["idle", "hang", "doze", "run", "swim", "sit", "float"]);
  for (const [name, clip] of Object.entries(clips)) addClip(name, clip, LOOPS.has(name));
  const idle = actions.idle || null;
  const state = { pose: "stand", look: new THREE.Vector3(0, 0.4, 2), wave: 0, blink: 0, nextBlink: 2 + Math.random() * 3, hold: null, holdSide: "left", yaw: 0, pitch: 0, seed: Math.random() * 6, base: null, oneShot: null };
  const playBase = (name, fade = 0.4) => {
    const a = actions[name] || idle;
    if (!a) return;
    if (state.base === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (state.base) state.base.fadeOut(fade);
    state.base = a;
  };
  const playOnce = (name, fade = 0.2) => {
    const a = actions[name];
    if (!a) return false;
    if (state.oneShot) { state.oneShot.fadeOut(0.1); }
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (state.base) state.base.fadeOut(fade);
    state.oneShot = a;
    return true;
  };
  mixer.addEventListener("finished", (e) => {
    if (e.action !== state.oneShot) return;
    state.oneShot = null;
    if (state.base) { state.base.reset().setEffectiveWeight(1).fadeIn(0.35).play(); }
    e.action.fadeOut(0.35);
  });
  playBase("idle", 0);
  if (idle) idle.time = Math.random() * idle.getClip().duration;
  const head = bones.Head;
  const neck = bones.neck || (head ? head.parent : null);
  model.updateMatrixWorld(true);
  const headRestWorld = head ? head.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  const headRestWorldInv = headRestWorld.clone().invert();
  const headFromNeck = neck ? neck.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(headRestWorld) : new THREE.Quaternion();
  const restLocal = {};
  for (const name of ["Head", "neck"]) if (bones[name]) restLocal[name] = bones[name].quaternion.clone();
  // POSTURE RULE: the shared idle (and some retargeted clips) fold the neck, spine and hips far
  // beyond the rest pose: two seconds in, every hero bows 30 to 45 degrees (Pong 100), which from
  // the reading camera hides the face and shows the top of the head. Each frame the torso chain is
  // pulled back to within a friendly angle of its rest pose (the hips by tilt only, so turning and
  // walking are untouched) and a standing hero's legs stay near rest too. The limits open up for
  // swimming, floating and sleeping, and for one-shot gestures (wave, look, jump, walk).
  // (radians; the reading camera looks down at about 45 degrees, so even a modest bow of the
  // chain hides a face: standing heroes keep to a few degrees per joint)
  const POSTURE = {
    stand: { hips: 0.09, spine: 0.09, neck: 0.11, upLeg: 0.22, leg: 0.28 },
    peek: { hips: 0.09, spine: 0.09, neck: 0.11, upLeg: 0.22, leg: 0.28 },
    run: { hips: 0.25, spine: 0.2, neck: 0.2 },
    swim: { hips: 0.3, spine: 0.18, neck: 0.18 },
    float: { hips: 0.25, spine: 0.18, neck: 0.18 },
    sleep: { hips: 0.12, spine: 0.15, neck: 0.3, upLeg: 0.3, leg: 0.4 },
  };
  for (const name of ["Hips", "Spine", "Spine1", "Spine2", "Neck", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg"]) if (bones[name]) restLocal[name] = bones[name].quaternion.clone();
  const _mq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _fq = new THREE.Quaternion(), _sq = new THREE.Quaternion();
  const _up = new THREE.Vector3();
  // the character's up axis expressed in the hips' rest frame (the hips bone's own axes are not
  // upright on these rigs); tilt is how far that axis has swung from the group's up since rest
  const GROUP_UP = new THREE.Vector3(0, 1, 0);
  const hipsRestUp = bones.Hips ? GROUP_UP.clone().applyQuaternion(group.getWorldQuaternion(_mq).invert().multiply(bones.Hips.getWorldQuaternion(_pq)).invert()) : null;
  const limitLocal = (name, max) => {
    const bone = bones[name], rest = restLocal[name];
    if (!bone || !rest || max == null) return;
    const ang = 2 * Math.acos(Math.min(1, Math.abs(_bq.copy(rest).invert().multiply(bone.quaternion).w)));
    if (ang > max) bone.quaternion.slerp(rest, 1 - max / ang);
  };
  const limitHipsTilt = (max) => {
    const hips = bones.Hips;
    if (!hips || !hipsRestUp || max == null) return;
    const groupInv = group.getWorldQuaternion(_mq).invert();
    const local = _bq.copy(groupInv).multiply(hips.getWorldQuaternion(_pq));   // hips in group space
    const up = _up.copy(hipsRestUp).applyQuaternion(local);                      // where the character's up axis went
    const ang = Math.acos(clamp(up.y, -1, 1));
    if (ang <= max) return;
    // swing the up axis back toward upright by the excess (shortest arc), then rebuild the local pose
    const fix = _sq.copy(_identity).slerp(_fq.setFromUnitVectors(up, GROUP_UP), 1 - max / ang);
    const newWorld = _mq.invert().multiply(fix.multiply(local));
    hips.quaternion.copy(hips.parent.getWorldQuaternion(_pq).invert().multiply(newWorld));
    hips.updateWorldMatrix(false, true);
  };
  const posture = (s) => {
    const p = POSTURE[s.pose] || POSTURE.stand;
    const k = s.oneShot ? 1.6 : 1;
    limitHipsTilt(p.hips * k);
    for (const name of ["Spine", "Spine1", "Spine2"]) limitLocal(name, p.spine * k);
    for (const name of ["neck", "Neck"]) limitLocal(name, p.neck * k);
    if (!s.oneShot && p.upLeg != null) {
      for (const name of ["LeftUpLeg", "RightUpLeg"]) limitLocal(name, p.upLeg);
      for (const name of ["LeftLeg", "RightLeg"]) limitLocal(name, p.leg);
    }
    model.updateMatrixWorld(true);
  };
  const api = {
    group,
    head,
    bones,
    state,
    actions,
    mixer,
    restLocal,
    posture: { limits: POSTURE, restUp: hipsRestUp },
    setPose(pose) {
      state.pose = pose;
      model.rotation.x = pose === "float" ? -0.16 : pose === "peek" ? -0.08 : 0;
      const base = { float: "hang", sleep: "doze", run: "run", swim: "swim" }[pose] || "idle";
      playBase(actions[base] ? base : "idle");
    },
    blink() { state.blink = 0.001; },
    wave() { if (!playOnce("wave")) state.wave = 1.6; },
    look() { if (!playOnce("look")) state.blink = 0.001; },
    jump() { playOnce("jump"); },
    /** play any one-shot clip the hero has (falls back to a wave) */
    play(name) { if (!playOnce(name)) state.wave = 1.2; },
    has(name) { return !!actions[name]; },
    lookAt(p) { state.look.copy(p); },
    /** hold a world point with one paw ("left" = the paw on the viewer's right when he faces us) */
    hold(worldPoint, side = "left") { state.hold = (state.hold || new THREE.Vector3()).copy(worldPoint); state.holdSide = side; },
    paw() { const hand = state.holdSide === "right" ? bones.RightHand : bones.LeftHand; return hand ? hand.getWorldPosition(new THREE.Vector3()) : group.getWorldPosition(new THREE.Vector3()); },
    update(dt, t) {
      const s = state;
      if (idle && s.base === idle && !s.oneShot) idle.setEffectiveWeight(s.pose === "sleep" ? 0.12 : s.pose === "float" ? 0.6 : 1);
      mixer.update(dt);
      model.updateMatrixWorld(true);
      posture(s);
      // HEAD RULE: every frame the head is rebuilt from the neck's current pose (its rest offset)
      // plus a small, clamped look toward the reader. It is never derived from its own previous
      // orientation, so it cannot drift, accumulate or twist; targets behind him are ignored.
      if (head && neck) {
        const neckWorld = neck.getWorldQuaternion(_q[0]);
        const headBase = _q[1].copy(neckWorld).multiply(headFromNeck);
        const bodyDelta = _q[2].copy(headBase).multiply(headRestWorldInv);
        const forward = _v[0].set(0, 0, 1).applyQuaternion(bodyDelta);
        const up = _v[1].set(0, 1, 0).applyQuaternion(bodyDelta);
        const right = _v[2].set(1, 0, 0).applyQuaternion(bodyDelta);
        let yawT = 0, pitchT = 0;
        if (s.pose !== "sleep") {
          const to = _v[3].subVectors(s.look, head.getWorldPosition(_v[4]));
          const lx = right.dot(to), ly = up.dot(to), lz = forward.dot(to);
          const yaw = Math.atan2(lx, lz);
          const pitch = Math.atan2(ly, Math.hypot(lx, lz));
          // the reader looks down at the page, so the head follows the hand sideways and upward but
          // only a touch downward: a face pitched down is a face hidden from above
          if (Math.abs(yaw) < 1.25) { yawT = clamp(yaw, -0.55, 0.55); pitchT = clamp(pitch, -0.1, 0.3); }
        }
        s.yaw += (yawT - s.yaw) * Math.min(1, dt * 4.5);
        s.pitch += (pitchT - s.pitch) * Math.min(1, dt * 4.5);
        const look = _q[3].setFromAxisAngle(up, s.yaw).multiply(_q[4].setFromAxisAngle(right, -s.pitch));
        let desired = look.multiply(headBase);
        if (s.oneShot) {
          // a one-shot clip may move the head, but never further than a friendly angle from the body
          const clipWorld = head.getWorldQuaternion(_q[0]);
          const delta = _q[2].copy(clipWorld).multiply(_q[3].copy(headBase).invert());
          const ang = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
          if (ang > 0.6) delta.slerp(_identity, 1 - 0.6 / ang);
          desired = delta.multiply(headBase);
        }
        const parentQ = head.parent.getWorldQuaternion(_q[4]);
        head.quaternion.copy(parentQ.invert().multiply(desired));
        head.updateWorldMatrix(false, true);
      }
      // blink: the model has no lids, so give a quick friendly head squash
      s.nextBlink -= dt;
      if (s.nextBlink < 0) { api.blink(); s.nextBlink = 2.5 + Math.random() * 4; }
      if (s.blink > 0 && head) {
        s.blink += dt;
        const p = s.blink / 0.3;
        const k = p < 1 ? Math.sin(p * Math.PI) : 0;
        if (p >= 1) s.blink = 0;
        head.scale.set(1 + k * 0.06, 1 - k * 0.1, 1 + k * 0.06);
      }
      // hold the balloon string with one paw, out to the side so the arm never crosses the face
      const holdLeft = s.holdSide !== "right";
      const holdArm = holdLeft ? bones.LeftArm : bones.RightArm, holdFore = holdLeft ? bones.LeftForeArm : bones.RightForeArm, holdHand = holdLeft ? bones.LeftHand : bones.RightHand;
      const freeArm = holdLeft ? bones.RightArm : bones.LeftArm, freeHand = holdLeft ? bones.RightHand : bones.LeftHand;
      const freeSign = holdLeft ? -1 : 1;
      if (s.hold && holdArm && holdHand && s.pose !== "sleep") {
        // never behind the body: a held point past the shoulder plane (a kite on the wind behind
        // her) is brought forward, so the arm reaches out to the side instead of into the back
        const shoulder = holdArm.getWorldPosition(_v[5]);
        const fwd = _v[6].set(0, 0, 1).transformDirection(group.matrixWorld).normalize();
        const depth = fwd.dot(_v[7].subVectors(s.hold, shoulder));
        const target = depth < 0.05 ? _v[8].copy(s.hold).addScaledVector(fwd, 0.05 - depth) : s.hold;
        aimBone(holdArm, holdHand, target, 1);
        if (holdFore) aimBone(holdFore, holdHand, target, 0.6);
      }
      // the free paw hangs relaxed beside him while floating (the hang clip would raise it to the
      // rope); the upper arm and forearm are both aimed so the paw is not left twisted
      const freeFore = holdLeft ? bones.RightForeArm : bones.LeftForeArm;
      if (s.hold && s.pose === "float" && !s.oneShot && s.wave <= 0 && freeArm && freeHand) {
        const shoulder = freeArm.getWorldPosition(_v[0]);
        const target = _v[1].set(freeSign * 0.16, -0.34, 0.12).transformDirection(group.matrixWorld).multiplyScalar(group.scale.x).add(shoulder);
        aimBone(freeArm, freeHand, target, 1);
        if (freeFore) aimBone(freeFore, freeHand, target, 0.7);
      }
      // procedural wave with the free paw (used when there is no wave clip)
      if (s.wave > 0 && freeArm && freeHand) {
        s.wave -= dt;
        const shoulder = freeArm.getWorldPosition(_v[0]);
        const target = _v[1].set(freeSign * 0.28, 0.3 + Math.sin(s.wave * 16) * 0.12, 0.12).transformDirection(group.matrixWorld).multiplyScalar(group.scale.x).add(shoulder);
        aimBone(freeArm, freeHand, target, 1);
      }
      // dangling legs while floating (softer when the hang clip already swings them)
      if (s.pose === "float" && bones.LeftUpLeg && bones.RightUpLeg && bones.LeftFoot && bones.RightFoot) {
        const swing = Math.sin(t * 1.6 + s.seed) * 0.12;
        const strength = actions.hang ? 0.25 : 0.55;
        for (const [leg, foot, sign] of [[bones.LeftUpLeg, bones.LeftFoot, 1], [bones.RightUpLeg, bones.RightFoot, -1]]) {
          const hip = leg.getWorldPosition(_v[0]);
          const target = _v[1].set(sign * 0.05, -0.28, 0.16 + swing * sign).transformDirection(group.matrixWorld).multiplyScalar(group.scale.x).add(hip);
          aimBone(leg, foot, target, strength);
        }
      }
    },
  };
  group.userData.otto = api;
  return api;
}

/* ---------- balloon ---------- */

export function makeBalloon(color = PALETTE.balloon) {
  const group = new THREE.Group();
  const skin = glossy(color, { transmission: 0.08, thickness: 0.2, ior: 1.3, roughness: 0.15 });
  const bulb = sphere(0.16, skin, 40);
  bulb.scale.set(1, 1.18, 1);
  bulb.position.y = 0.19;
  group.add(bulb);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 12), glossy(color));
  knot.position.y = -0.005;
  knot.rotation.x = Math.PI;
  group.add(knot);
  const highlight = sphere(0.035, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }), 12);
  highlight.scale.set(1, 1.6, 0.4);
  highlight.position.set(-0.06, 0.29, 0.13);
  group.add(highlight);
  const stringMat = new THREE.MeshStandardMaterial({ color: 0xf0e2c3, roughness: 0.9 });
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 1, 6), stringMat);
  string.castShadow = false;
  const state = { vel: new THREE.Vector3(), offset: new THREE.Vector3(), rest: new THREE.Vector3(), drag: null, seed: Math.random() * 10 };
  const api = {
    group,
    string,
    state,
    poke(dir) {
      state.vel.add(dir);
    },
    /** attach the string between the balloon knot and a world point (Otto's paw) */
    tether(anchor, parent) {
      if (!string.parent) parent.add(string);
      // fresh world matrices: while a page pops in, its scale changes every frame, and a knot read
      // from last frame's matrix against a paw read from this one stretched the string across the scene
      group.updateWorldMatrix(true, false);
      parent.updateWorldMatrix(true, false);
      const knotWorld = group.localToWorld(new THREE.Vector3(0, -0.03, 0));
      const a = parent.worldToLocal(knotWorld.clone());
      const b = parent.worldToLocal(anchor.clone());
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const len = a.distanceTo(b);
      string.position.copy(mid);
      string.scale.y = Math.max(0.01, len);
      string.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    },
    update(dt, t) {
      // spring back toward the rest position, with a gentle breeze
      const s = state;
      const wind = new THREE.Vector3(Math.sin(t * 0.7 + s.seed) * 0.012, Math.sin(t * 1.1 + s.seed) * 0.008, Math.cos(t * 0.5 + s.seed) * 0.008);
      const target = s.drag || wind;
      const force = target.clone().sub(s.offset).multiplyScalar(s.drag ? 18 : 3.2);
      s.vel.add(force.multiplyScalar(dt));
      s.vel.multiplyScalar(Math.max(0, 1 - dt * (s.drag ? 6 : 1.4)));
      s.offset.add(s.vel.clone().multiplyScalar(dt));
      group.position.copy(s.rest).add(s.offset);
      group.rotation.z = -s.offset.x * 1.6 + Math.sin(t * 0.9) * 0.03;
      group.rotation.x = s.offset.z * 1.6;
    },
  };
  return api;
}

/* ---------- clouds ---------- */

export function makeCloud(size = 0.3, seed = 1, options = {}) {
  const group = new THREE.Group();
  const mat = felt(options.color || PALETTE.cloud, { sheen: 1, sheenRoughness: 0.4, roughness: 0.98 });
  let r = seed * 12.9898;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const puffs = [];
  const count = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const radius = size * (0.55 + Math.sin(t * Math.PI) * 0.55 + rand() * 0.2);
    const puff = sphere(radius, mat, 24);
    puff.position.set((t - 0.5) * size * 2.4 + (rand() - 0.5) * size * 0.3, radius * 0.35 + rand() * size * 0.25, (rand() - 0.5) * size * 0.7);
    group.add(puff);
    puffs.push(puff);
  }
  const base = sphere(size * 1.1, mat, 24);
  base.scale.set(1.3, 0.55, 0.9);
  base.position.y = size * 0.25;
  group.add(base);
  let face = null;
  if (options.face) {
    face = new THREE.Group();
    face.position.set(0, size * 0.55, size * 0.95);
    const dark = new THREE.MeshStandardMaterial({ color: 0x3f3a5a });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(size * 0.12, size * 0.02, 6, 12, Math.PI), dark);
      eye.rotation.z = Math.PI;
      eye.position.set(side * size * 0.3, size * 0.1, 0);
      face.add(eye);
      const cheek = sphere(size * 0.09, felt(0xf3b3c0, { transparent: true, opacity: 0.6 }), 12);
      cheek.scale.set(1, 0.6, 0.3);
      cheek.position.set(side * size * 0.5, -size * 0.1, 0);
      face.add(cheek);
    }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(size * 0.08, 12, 8), dark);
    mouth.scale.set(1, 0.5, 0.5);
    mouth.position.set(0, -size * 0.18, 0);
    face.add(mouth);
    face.userData.mouth = mouth;
    group.add(face);
  }
  // `base` is the cloud's home position (informational once a pop-up pivot holds it);
  // `shift` and `vel` move the cloud relative to that home.
  const state = { bounce: 0, yawn: 0, drift: rand() * 6, base: new THREE.Vector3(), shift: new THREE.Vector3(), push: new THREE.Vector3(), vel: new THREE.Vector3() };
  const api = {
    group,
    state,
    puff() {
      state.bounce = 1;
    },
    yawn() {
      state.yawn = 1.8;
    },
    nudge(dir) {
      state.vel.add(dir);
    },
    update(dt, t) {
      const s = state;
      if (s.bounce > 0) s.bounce = Math.max(0, s.bounce - dt * 2.2);
      const squash = Math.sin(s.bounce * Math.PI) * 0.12;
      group.scale.set(1 + squash, 1 - squash * 0.8, 1 + squash);
      s.vel.add(s.push.clone().sub(s.vel).multiplyScalar(dt * 2));
      s.push.multiplyScalar(Math.max(0, 1 - dt * 2.5));
      s.vel.multiplyScalar(Math.max(0, 1 - dt * 2));
      group.position.copy(s.shift).add(s.vel);
      group.position.y += Math.sin(t * 0.8 + s.drift) * size * 0.08;
      if (face) {
        const mouth = face.userData.mouth;
        if (s.yawn > 0) {
          s.yawn -= dt;
          const open = Math.sin(Math.min(1, (1.8 - s.yawn) / 1.8) * Math.PI);
          mouth.scale.set(1 + open * 0.4, 0.5 + open * 1.4, 0.5);
          face.position.y = size * 0.55 - open * size * 0.06;
        } else mouth.scale.set(1, 0.5, 0.5);
      }
    },
  };
  return api;
}

/* ---------- moon ---------- */

export function makeMoon(radius = 0.22) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.moon, emissive: 0xffe08a, emissiveIntensity: 0.25, roughness: 0.7 });
  const body = sphere(radius, mat, 48);
  group.add(body);
  const halo = glowSprite(0xffe9a8, radius * 6, 0.55);
  group.add(halo);
  const light = new THREE.PointLight(0xffe4a0, 0.4, 3, 1.6);
  group.add(light);
  const face = new THREE.Group();
  face.position.z = radius * 0.86;
  group.add(face);
  const dark = new THREE.MeshStandardMaterial({ color: 0x6b4d2c });
  const eyesClosed = [];
  const eyesOpen = [];
  for (const side of [-1, 1]) {
    const closed = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.11, radius * 0.02, 6, 14, Math.PI), dark);
    closed.rotation.z = Math.PI;
    closed.position.set(side * radius * 0.32, radius * 0.16, radius * 0.1);
    face.add(closed);
    eyesClosed.push(closed);
    const open = sphere(radius * 0.075, glossy(0x3a2b1a), 16);
    open.position.set(side * radius * 0.32, radius * 0.14, radius * 0.12);
    open.visible = false;
    face.add(open);
    eyesOpen.push(open);
    const cheek = sphere(radius * 0.11, felt(0xf3a3a0, { transparent: true, opacity: 0.7 }), 12);
    cheek.scale.set(1, 0.65, 0.35);
    cheek.position.set(side * radius * 0.5, -radius * 0.05, radius * 0.05);
    face.add(cheek);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.16, radius * 0.022, 6, 16, Math.PI), dark);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -radius * 0.12, radius * 0.12);
  face.add(smile);
  const shy = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.05, 10, 8), dark);
  shy.scale.set(1.6, 0.5, 0.3);
  shy.position.set(0, -radius * 0.2, radius * 0.14);
  shy.visible = false;
  face.add(shy);

  const state = { glow: 0.2, target: 0.2, mood: "sleepy", pulse: 0 };
  const api = {
    group,
    light,
    state,
    setGlow(v) { state.target = clamp(v, 0, 1); },
    setMood(mood) {
      state.mood = mood;
      const open = mood === "happy";
      eyesOpen.forEach((e) => { e.visible = open; });
      eyesClosed.forEach((e) => { e.visible = !open; });
      smile.visible = mood !== "shy";
      shy.visible = mood === "shy";
    },
    pulse() { state.pulse = 1; },
    update(dt, t) {
      const s = state;
      s.glow += (s.target - s.glow) * Math.min(1, dt * 2.2);
      if (s.pulse > 0) s.pulse = Math.max(0, s.pulse - dt * 1.5);
      const pulse = Math.sin(s.pulse * Math.PI) * 0.4;
      const g = s.glow + pulse;
      mat.emissiveIntensity = 0.12 + g * 1.05;
      mat.emissive.setHex(g > 0.5 ? 0xfff0b0 : 0xffe08a);
      halo.material.opacity = 0.18 + g * 0.5;
      halo.scale.setScalar(radius * (4 + g * 6 + Math.sin(t * 1.3) * 0.2));
      light.intensity = 0.2 + g * 2.6;
      group.rotation.z = Math.sin(t * 0.6) * 0.04;
    },
  };
  api.setMood("sleepy");
  return api;
}

/* ---------- stars ---------- */

export function makeStar(size = 0.05, options = {}) {
  const geometry = new THREE.ExtrudeGeometry(starShape(size, size * 0.45), { depth: size * 0.35, bevelEnabled: true, bevelThickness: size * 0.08, bevelSize: size * 0.06, bevelSegments: 2 });
  geometry.center();
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: 0xffc94a, emissiveIntensity: options.lit === false ? 0.12 : 0.45, roughness: 0.5 });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  const halo = glowSprite(0xffe9a8, size * 5, options.lit === false ? 0.15 : 0.5);
  group.add(halo);
  const state = { twinkle: Math.random() * 6, lit: options.lit !== false, burst: 0 };
  const api = {
    group,
    mesh,
    state,
    setLit(lit) { state.lit = lit; },
    twinkle() { state.burst = 1; },
    update(dt, t) {
      const s = state;
      if (s.burst > 0) s.burst = Math.max(0, s.burst - dt * 1.8);
      const burst = Math.sin(s.burst * Math.PI);
      const tw = 0.5 + Math.sin(t * 2.4 + s.twinkle) * 0.5;
      const base = s.lit ? 0.32 + tw * 0.32 : 0.1;
      mat.emissiveIntensity = base + burst * 1.2;
      halo.material.opacity = (s.lit ? 0.18 + tw * 0.2 : 0.08) + burst * 0.4;
      const sc = 1 + burst * 0.6 + (s.lit ? tw * 0.08 : 0);
      mesh.scale.setScalar(sc);
      mesh.rotation.z += dt * (0.3 + burst * 4);
    },
  };
  return api;
}

/* ---------- houses (3D) ---------- */

export function makeHouse(w = 0.22, h = 0.28, d = 0.2, color = 0x384a7d, roofColor = 0x7d4c6e) {
  const group = new THREE.Group();
  const wallMat = felt(color, { sheen: 0.3 });
  const walls = box(w, h, d, wallMat, 0.006);
  walls.position.y = h / 2;
  group.add(walls);
  const roofGeo = new THREE.CylinderGeometry(0, w * 0.78, h * 0.55, 4, 1);
  const roof = new THREE.Mesh(roofGeo, felt(roofColor, { sheen: 0.3 }));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + h * 0.27;
  roof.scale.set(1, 1, d / w);
  roof.castShadow = true;
  group.add(roof);
  const chimney = box(0.035, 0.09, 0.035, felt(0x5a4358, { sheen: 0.2 }), 0.004);
  chimney.position.set(w * 0.28, h + h * 0.36, 0);
  group.add(chimney);
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffd48a, emissive: 0xffb84d, emissiveIntensity: 0.2, roughness: 0.4 });
  const windows = [];
  const cols = w > 0.24 ? 2 : 1;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.06), winMat.clone());
      win.position.set((c - (cols - 1) / 2) * 0.09, h * 0.35 + r * h * 0.32, d / 2 + 0.002);
      group.add(win);
      windows.push(win);
    }
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0x2b3560, roughness: 0.8 }));
  door.position.set(cols === 2 ? 0 : 0.0, 0.04, d / 2 + 0.002);
  if (cols === 2) door.position.x = -0.001;
  group.add(door);
  const state = { lit: 0, target: 0.25, flicker: Math.random() * 6 };
  const api = {
    group,
    chimney,
    state,
    windows,
    light(on = true) { state.target = on ? 1 : 0.25; },
    update(dt, t) {
      const s = state;
      s.lit += (s.target - s.lit) * Math.min(1, dt * 4);
      windows.forEach((w, i) => {
        w.material.emissiveIntensity = 0.15 + s.lit * (1.2 + Math.sin(t * 3 + s.flicker + i) * 0.15);
      });
    },
  };
  return api;
}

/* ---------- tree + owl ---------- */

export function makeTree(height = 0.9) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, height * 0.6, 10), felt(0x6b4a2e, { sheen: 0.2 }));
  trunk.position.y = height * 0.3;
  trunk.castShadow = true;
  group.add(trunk);
  const canopy = new THREE.Group();
  canopy.position.y = height * 0.62;
  group.add(canopy);
  const leaf = felt(PALETTE.leaf, { sheen: 0.6 });
  const leafDark = felt(PALETTE.leafDark, { sheen: 0.6 });
  const blobs = [
    [0, 0.12, 0, 0.2], [-0.16, 0.02, 0.04, 0.15], [0.17, 0.05, -0.03, 0.16], [0.05, 0.28, 0.02, 0.15], [-0.08, 0.24, -0.06, 0.13], [0.0, 0.05, 0.14, 0.13],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    const b = sphere(r, i % 2 ? leafDark : leaf, 20);
    b.position.set(x, y, z);
    canopy.add(b);
  });
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.3, 8), felt(0x6b4a2e, { sheen: 0.2 }));
  branch.rotation.z = Math.PI / 2 - 0.25;
  branch.position.set(0.2, height * 0.5, 0.06);
  group.add(branch);
  return { group, canopy, branch, perch: new THREE.Vector3(0.3, height * 0.53, 0.06), update(dt, t) { canopy.rotation.z = Math.sin(t * 0.8) * 0.02; } };
}

export function makeOwl(scale = 1) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  const body = sphere(0.09, felt(PALETTE.owl), 24);
  body.scale.set(1, 1.25, 0.95);
  body.position.y = 0.11;
  group.add(body);
  const belly = sphere(0.062, felt(PALETTE.owlBelly), 20);
  belly.scale.set(1, 1.3, 0.55);
  belly.position.set(0, 0.09, 0.055);
  group.add(belly);
  const head = new THREE.Group();
  head.position.y = 0.22;
  group.add(head);
  const skull = sphere(0.085, felt(PALETTE.owl), 24);
  skull.scale.set(1.1, 0.9, 0.95);
  head.add(skull);
  for (const side of [-1, 1]) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 8), felt(PALETTE.owl));
    tuft.position.set(side * 0.07, 0.08, 0);
    tuft.rotation.z = -side * 0.5;
    head.add(tuft);
  }
  const eyes = [];
  const pupils = [];
  const lids = [];
  for (const side of [-1, 1]) {
    const disc = sphere(0.036, new THREE.MeshStandardMaterial({ color: 0xfff8e6, roughness: 0.5 }), 18);
    disc.position.set(side * 0.04, 0.005, 0.065);
    disc.scale.z = 0.5;
    head.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 8, 20), felt(0xe6b45a));
    ring.position.copy(disc.position);
    head.add(ring);
    const pupil = sphere(0.02, glossy(0x1f1408, { roughness: 0.1 }), 14);
    pupil.position.set(side * 0.04, 0.005, 0.088);
    head.add(pupil);
    const shine = sphere(0.006, new THREE.MeshBasicMaterial({ color: 0xffffff }), 8);
    shine.position.set(side * 0.034, 0.014, 0.106);
    head.add(shine);
    const lid = sphere(0.04, felt(PALETTE.owl), 16);
    lid.scale.set(1, 0.1, 0.6);
    lid.position.set(side * 0.04, 0.045, 0.07);
    head.add(lid);
    eyes.push(disc); pupils.push(pupil); lids.push(lid);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 8), felt(0xe8a24a));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.02, 0.095);
  head.add(beak);
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.08, 0.16, 0);
    const w = sphere(0.045, felt(0x6e4528), 16);
    w.scale.set(0.5, 1.5, 0.9);
    w.position.y = -0.06;
    wing.add(w);
    group.add(wing);
    wings.push(wing);
  }
  const state = { look: new THREE.Vector3(0, 0.2, 2), blink: 0, nextBlink: 3, hoot: 0 };
  const api = {
    group,
    head,
    state,
    lookAt(p) { state.look.copy(p); },
    blink() { state.blink = 0.001; },
    hoot() { state.hoot = 1; },
    update(dt, t) {
      const s = state;
      s.nextBlink -= dt;
      if (s.nextBlink < 0) { api.blink(); s.nextBlink = 3 + Math.random() * 4; }
      if (s.blink > 0) {
        s.blink += dt;
        const p = s.blink / 0.3;
        const closed = p < 1 ? Math.sin(p * Math.PI) : 0;
        if (p >= 1) s.blink = 0;
        lids.forEach((lid) => { lid.scale.y = 0.1 + closed * 0.9; lid.position.y = 0.045 - closed * 0.035; });
      }
      const target = group.worldToLocal(s.look.clone());
      const yaw = clamp(Math.atan2(target.x, target.z + 0.5), -0.7, 0.7);
      const pitch = clamp(-Math.atan2(target.y - 0.22, Math.hypot(target.x, target.z + 0.5)), -0.3, 0.3);
      head.rotation.y += (yaw - head.rotation.y) * Math.min(1, dt * 5);
      head.rotation.x += (pitch - head.rotation.x) * Math.min(1, dt * 5);
      pupils.forEach((p, i) => {
        p.position.x = eyes[i].position.x + yaw * 0.012;
        p.position.y = eyes[i].position.y + pitch * -0.012;
      });
      if (s.hoot > 0) {
        s.hoot = Math.max(0, s.hoot - dt * 1.2);
        const k = Math.sin(s.hoot * Math.PI);
        group.position.y = k * 0.03;
        wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * k * 1.1; });
        body.scale.set(1 + k * 0.1, 1.25 - k * 0.1, 0.95);
      } else {
        group.position.y = Math.sin(t * 1.5) * 0.004;
        body.scale.set(1, 1.25 + Math.sin(t * 2) * 0.02, 0.95);
        wings.forEach((w) => { w.rotation.z *= 0.9; });
      }
    },
  };
  return api;
}

/* ---------- cat ---------- */

export function makeCat() {
  const group = new THREE.Group();
  const fur = felt(PALETTE.cat, { sheen: 0.7 });
  const body = capsule(0.045, 0.1, fur);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.05;
  group.add(body);
  const head = new THREE.Group();
  head.position.set(0.08, 0.1, 0);
  group.add(head);
  head.add(sphere(0.045, fur, 20));
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.035, 6), fur);
    ear.position.set(0, 0.045, side * 0.025);
    ear.rotation.x = side * 0.3;
    head.add(ear);
    const eye = sphere(0.009, new THREE.MeshStandardMaterial({ color: 0xaaff88, emissive: 0x88ff66, emissiveIntensity: 1.2 }), 8);
    eye.scale.set(0.6, 1, 0.6);
    eye.position.set(0.035, 0.008, side * 0.018);
    head.add(eye);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.09, 0.06, 0);
  group.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.05, 0.03, 0.01), new THREE.Vector3(-0.08, 0.1, 0.0), new THREE.Vector3(-0.06, 0.16, -0.01)]);
  const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.012, 8, false), fur);
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  const state = { meow: 0 };
  const api = {
    group,
    state,
    meow() { state.meow = 1; },
    update(dt, t) {
      const s = state;
      tail.rotation.x = Math.sin(t * 1.2) * 0.25 + (s.meow > 0 ? Math.sin(s.meow * 20) * 0.5 : 0);
      if (s.meow > 0) {
        s.meow = Math.max(0, s.meow - dt);
        head.rotation.z = Math.sin(s.meow * Math.PI) * 0.4;
        head.rotation.x = -Math.sin(s.meow * Math.PI) * 0.3;
      } else {
        head.rotation.z *= 0.9;
        head.rotation.x = Math.sin(t * 0.9) * 0.05;
      }
    },
  };
  return api;
}

/* ---------- bedroom pieces ---------- */

export function makeBed() {
  const group = new THREE.Group();
  const frame = box(0.5, 0.06, 0.32, wood(), 0.01);
  frame.position.y = 0.09;
  group.add(frame);
  for (const [x, z] of [[-0.22, -0.13], [0.22, -0.13], [-0.22, 0.13], [0.22, 0.13]]) {
    const leg = box(0.03, 0.09, 0.03, wood(true), 0.004);
    leg.position.set(x, 0.045, z);
    group.add(leg);
  }
  const headboard = box(0.06, 0.3, 0.34, wood(), 0.012);
  headboard.position.set(-0.25, 0.22, 0);
  group.add(headboard);
  const mattress = box(0.46, 0.07, 0.28, felt(PALETTE.pillow, { sheen: 0.4 }), 0.02);
  mattress.position.y = 0.155;
  group.add(mattress);
  const blanket = box(0.32, 0.05, 0.29, felt(PALETTE.blanket), 0.02);
  blanket.position.set(0.06, 0.21, 0);
  group.add(blanket);
  const pillow = box(0.12, 0.05, 0.2, felt(PALETTE.pillow, { sheen: 0.6 }), 0.02);
  pillow.position.set(-0.16, 0.21, 0);
  group.add(pillow);
  return { group, headboard, blanket, pillow, sleepSpot: new THREE.Vector3(-0.1, 0.2, 0) };
}

export function makeWindow(width = 0.42, height = 0.5) {
  const group = new THREE.Group();
  const frameMat = wood();
  const t = 0.03;
  const parts = [
    [0, height / 2, width + t, t], [0, -height / 2, width + t, t], [-width / 2, 0, t, height], [width / 2, 0, t, height], [0, 0, t * 0.7, height], [0, 0, width, t * 0.7],
  ];
  for (const [x, y, w, h] of parts) {
    const bar = box(w, h, t, frameMat, 0.004);
    bar.position.set(x, y, 0);
    group.add(bar);
  }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ color: 0x0f1636, emissive: 0x0f1636, emissiveIntensity: 0.6, roughness: 1 }));
  sky.position.z = -0.012;
  group.add(sky);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshPhysicalMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0.12, roughness: 0.05, transmission: 0.2 }));
  glass.position.z = 0.0;
  group.add(glass);
  const sill = box(width + 0.1, 0.03, 0.08, frameMat, 0.006);
  sill.position.set(0, -height / 2 - 0.02, 0.03);
  group.add(sill);
  const curtains = [];
  for (const side of [-1, 1]) {
    const curtain = box(0.09, height + 0.08, 0.02, felt(0xd97a6a, { sheen: 0.5 }), 0.01);
    curtain.position.set(side * (width / 2 + 0.06), 0.02, 0.035);
    group.add(curtain);
    curtains.push(curtain);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, width + 0.34, 8), wood(true));
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, height / 2 + 0.07, 0.035);
  group.add(rod);
  return { group, sky, curtains };
}

export function makeLamp(model = null) {
  const group = new THREE.Group();
  if (model) return makeModelLamp(group, model);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, 0.022, 28), wood(true));
  base.position.y = 0.011;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.02, 20), brass());
  foot.position.y = 0.03;
  group.add(foot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.2, 14), brass());
  stem.position.y = 0.13;
  stem.castShadow = true;
  group.add(stem);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.03, 14), brass());
  collar.position.y = 0.235;
  group.add(collar);
  // fabric shade, lit from inside
  const shadeMat = new THREE.MeshPhysicalMaterial({ color: 0xffe9c8, emissive: 0xffc272, emissiveIntensity: 0.55, roughness: 0.92, side: THREE.DoubleSide, sheen: 0.6, sheenColor: new THREE.Color(0xfff1d8) });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.1, 0.115, 32, 1, true), shadeMat);
  shade.position.y = 0.285;
  shade.castShadow = true;
  group.add(shade);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc98a4a, roughness: 0.7 });
  for (const [r, y] of [[0.058, 0.3425], [0.1, 0.2275]]) {
    const trim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 8, 40), trimMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = y;
    group.add(trim);
  }
  const bulbMesh = sphere(0.016, glow(0xfff2d0, 2.2), 16);
  bulbMesh.position.y = 0.27;
  bulbMesh.castShadow = false;
  group.add(bulbMesh);
  const bulb = new THREE.PointLight(0xffc98a, 6, 9, 2);
  bulb.position.y = 0.27;
  bulb.castShadow = false;
  group.add(bulb);
  // a warm pool that reaches the book (aimed after placement with api.aim)
  const pool = new THREE.SpotLight(0xffd39a, 16, 8, 0.62, 0.85, 1.4);
  pool.position.y = 0.25;
  pool.target.position.set(0.6, 0, 0.5);
  group.add(pool, pool.target);
  const halo = glowSprite(0xffd9a0, 0.36, 0.2);
  halo.position.y = 0.27;
  group.add(halo);
  const state = { on: true, level: 1 };
  const api = {
    group,
    state,
    toggle() { state.on = !state.on; return state.on; },
    set(on) { state.on = on; },
    /** point the light pool at a world position (call once the lamp is placed) */
    aim(world) { group.updateMatrixWorld(true); pool.target.position.copy(group.worldToLocal(world.clone())); },
    update(dt, t) {
      const s = state;
      s.level += ((s.on ? 1 : 0) - s.level) * Math.min(1, dt * 6);
      const flicker = 1 + Math.sin(t * 9) * 0.015;
      shadeMat.emissiveIntensity = 0.04 + s.level * 0.55 * flicker;
      bulbMesh.material.emissiveIntensity = 0.1 + s.level * 2.2;
      bulb.intensity = s.level * 6 * flicker;
      pool.intensity = s.level * 16 * flicker;
      halo.material.opacity = s.level * 0.2;
    },
  };
  return api;
}

/** The lamp's light rig around a generated lamp model (normalised to 0.35 units tall). */
function makeModelLamp(group, model) {
  const H = 0.35;
  fitModel(model, { height: H, upright: true });
  group.add(model);
  const mats = [];
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { const m = o.material; m.emissiveMap = m.map || null; m.emissive = new THREE.Color(0xffd9a0); m.emissiveIntensity = 0; m.needsUpdate = true; mats.push(m); } } });
  const bulbY = H * 0.74;
  const bulb = new THREE.PointLight(0xffc98a, 6, 9, 2);
  bulb.position.y = bulbY;
  group.add(bulb);
  const pool = new THREE.SpotLight(0xffd39a, 16, 8, 0.62, 0.85, 1.4);
  pool.position.y = bulbY - 0.02;
  pool.target.position.set(0.6, 0, 0.5);
  group.add(pool, pool.target);
  const halo = glowSprite(0xffd9a0, 0.4, 0.2);
  halo.position.y = bulbY;
  group.add(halo);
  const state = { on: true, level: 1 };
  return {
    group,
    state,
    toggle() { state.on = !state.on; return state.on; },
    set(on) { state.on = on; },
    aim(world) { group.updateMatrixWorld(true); pool.target.position.copy(group.worldToLocal(world.clone())); },
    update(dt, t) {
      const s = state;
      s.level += ((s.on ? 1 : 0) - s.level) * Math.min(1, dt * 6);
      const flicker = 1 + Math.sin(t * 9) * 0.015;
      for (const m of mats) m.emissiveIntensity = s.level * 0.38 * flicker;
      bulb.intensity = s.level * 6 * flicker;
      pool.intensity = s.level * 16 * flicker;
      halo.material.opacity = s.level * 0.2;
    },
  };
}

/** Scale, orient and ground a loaded model: upright keeps its tallest axis vertical, flat lays
    its thinnest axis vertical; the result sits on y = 0 centred on x/z. */
export function fitModel(model, { height = null, length = null, upright = true, flat = false, keep = false } = {}) {
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  let size = box.getSize(new THREE.Vector3());
  if (keep) {
    // trust the model's own orientation
  } else if (flat) {
    const min = Math.min(size.x, size.y, size.z);
    if (size.y !== min) { if (size.z === min) model.rotation.x = -Math.PI / 2; else model.rotation.z = Math.PI / 2; }
  } else if (upright) {
    const max = Math.max(size.x, size.y, size.z);
    if (size.y !== max) { if (size.z === max) model.rotation.x = Math.PI / 2; else model.rotation.z = -Math.PI / 2; }
  }
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  size = box.getSize(new THREE.Vector3());
  const k = height ? height / size.y : length ? length / Math.max(size.x, size.z) : 1;
  model.scale.multiplyScalar(k);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);
  return model;
}

/** Wrap a generated toy model with the same tap/update API as the procedural toys. */
export function makeModelToy(model, { height = null, length = null, flat = false, keep = false, kind = "toy" } = {}) {
  const group = new THREE.Group();
  fitModel(model, { height, length, upright: !flat && !keep, flat, keep });
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.map) o.material.map.anisotropy = 8; } });
  group.add(model);
  const state = { roll: 0, bounce: 0 };
  return {
    group,
    tap() { if (kind === "train") state.roll = 1.6; else state.bounce = 1; },
    update(dt) {
      if (state.roll > 0) {
        state.roll = Math.max(0, state.roll - dt);
        const speed = Math.sin(Math.min(1, state.roll / 1.6) * Math.PI) * 4;
        group.position.x += Math.cos(group.rotation.y) * speed * 0.012 * dt;
        group.position.z -= Math.sin(group.rotation.y) * speed * 0.012 * dt;
        model.rotation.z = Math.sin(state.roll * 20) * 0.02;
      }
      if (state.bounce > 0) {
        state.bounce = Math.max(0, state.bounce - dt * 1.4);
        const k = Math.sin(state.bounce * Math.PI);
        group.position.y = k * 0.05;
        group.rotation.y += dt * 0.6 * k;
      }
    },
  };
}

export function makeBlocks(letters = ["A", "B", "C"]) {
  const group = new THREE.Group();
  const colors = [0xe1574a, 0x4c78c2, 0x6fa35a];
  const items = [];
  letters.forEach((letter, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f6ebd2";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#" + colors[i % colors.length].toString(16).padStart(6, "0");
    ctx.font = "bold 84px 'Baloo 2', 'Fredoka', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mats = [];
    for (let f = 0; f < 6; f++) mats.push(f === 4 || f === 2 ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }) : felt(colors[i % colors.length], { sheen: 0.2, roughness: 0.6 }));
    const cube = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.07, 0.07, 2, 0.008), mats);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.position.set(i * 0.075 - 0.075 + (i === 1 ? 0.0 : 0), 0.035 + (i === 1 ? 0.07 : 0), i === 1 ? 0.0 : 0.01 * i);
    if (i === 1) cube.position.x = -0.03;
    cube.rotation.y = (i - 1) * 0.3;
    group.add(cube);
    items.push({ mesh: cube, wobble: 0, base: cube.position.clone(), rot: cube.rotation.y });
  });
  const api = {
    group,
    wobble() { items.forEach((it, i) => { it.wobble = 1 + i * 0.1; }); },
    update(dt) {
      items.forEach((it) => {
        if (it.wobble > 0) {
          it.wobble = Math.max(0, it.wobble - dt * 1.5);
          const k = Math.sin(it.wobble * Math.PI);
          it.mesh.position.y = it.base.y + k * 0.05;
          it.mesh.rotation.z = Math.sin(it.wobble * 12) * 0.2 * k;
          it.mesh.rotation.y = it.rot + k * 0.6;
        }
      });
    },
  };
  return api;
}

/* ---------- backdrops ---------- */

export function skyTexture(top = "#0d1230", mid = "#1c2454", bottom = "#3b3f7a", stars = 140) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < stars; i++) {
    const x = rand() * 512, y = rand() * 400, r = 0.5 + rand() * 1.6;
    ctx.fillStyle = `rgba(255,${230 + Math.floor(rand() * 25)},${180 + Math.floor(rand() * 70)},${0.4 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A curved pop-up backdrop card standing along the far edge of the page. */
export function makeBackdrop(width = 1.1, height = 0.9, texture = null) {
  // A gently curved card: chord width = 1.62 R, depth = 0.41 R, so R = width / 1.62.
  const radius = width / 1.62;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 40, 1, true, Math.PI * 0.7, Math.PI * 0.6);
  const material = new THREE.MeshStandardMaterial({ map: texture || skyTexture(), roughness: 1, side: THREE.BackSide, emissive: 0x1a1f45, emissiveIntensity: 0.45 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  mesh.receiveShadow = false;
  const group = new THREE.Group();
  group.add(mesh);
  return { group, mesh, material, radius };
}

export function makePaperStrip(texture, width = 1.2) {
  const aspect = texture.image ? texture.image.height / texture.image.width : 0.3;
  const height = width * aspect;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.2, roughness: 0.95, side: THREE.DoubleSide }));
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return { group, mesh, height };
}

/* ---------- particles ---------- */

export class Burst {
  constructor(parent, count = 60, color = 0xffe9a8, size = 0.03) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    if (!Burst.texture) Burst.texture = radialSprite("rgba(255,255,255,1)", "rgba(255,255,255,0)", 64);
    const material = new THREE.PointsMaterial({ color, size, map: Burst.texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.next = 0;
    parent.add(this.points);
    for (let i = 0; i < count; i++) this.positions[i * 3 + 1] = -100;
  }
  emit(origin, n = 8, speed = 0.4, spread = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.count;
      this.positions[i * 3] = origin.x;
      this.positions[i * 3 + 1] = origin.y;
      this.positions[i * 3 + 2] = origin.z;
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.3) * Math.PI;
      this.velocities[i * 3] = Math.cos(a) * Math.cos(b) * speed * spread;
      this.velocities[i * 3 + 1] = Math.sin(b) * speed + speed * 0.4;
      this.velocities[i * 3 + 2] = Math.sin(a) * Math.cos(b) * speed * spread;
      this.life[i] = 0.7 + Math.random() * 0.6;
    }
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.velocities[i * 3 + 1] -= dt * 0.35;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      if (this.life[i] <= 0) this.positions[i * 3 + 1] = -100;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

/* ---------- illustrated pop-up cards ---------- */

export function makeCard(art, { width = 1, cutout = art.cutout, paperNormal = null } = {}) {
  const tex = art.texture;
  const img = tex && tex.image;
  const w = art.width || (img && (img.naturalWidth || img.width)) || 1200;
  const h = art.height || (img && (img.naturalHeight || img.height)) || 900;
  const aspect = (w > 0 && h > 0) ? (h / w) : 0.75;
  const height = width * aspect;
  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
  geometry.translate(0, height / 2, 0);
  const material = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.94,
    metalness: 0,
    transparent: !!cutout,
    alphaTest: cutout ? 0.45 : 0,
    side: THREE.DoubleSide,
    emissive: 0x000000,
  });
  if (paperNormal) { material.normalMap = paperNormal; material.normalScale.set(0.2, 0.2); }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (cutout) mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
  const group = new THREE.Group();
  group.add(mesh);
  const state = { bounce: 0, sway: Math.random() * 6, tilt: 0, targetTilt: 0, lift: 0, targetLift: 0 };
  const api = {
    group,
    mesh,
    material,
    width,
    height,
    state,
    /** local point on the card from normalised (0..1) coordinates, bottom-left origin */
    point(nx, ny, dz = 0.012) {
      return new THREE.Vector3((nx - 0.5) * width, ny * height, dz);
    },
    worldPoint(nx, ny, dz = 0.012) {
      return group.localToWorld(api.point(nx, ny, dz));
    },
    /** invisible touch target over a region of the card (normalised rect) */
    hotspot(rect) {
      const [x, y, w, h] = rect;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w * width, h * height), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      m.position.set((x + w / 2 - 0.5) * width, (y + h / 2) * height, 0.006);
      m.renderOrder = -1;
      group.add(m);
      return m;
    },
    /** a soft glow lying flat on the card (a plane parallel to it, never a billboard that would
        cut into the tilted card and leave a hard edge) */
    glow(nx, ny, color = 0xffd98a, size = 0.2, opacity = 0.5) {
      const s = glowPlane(color, size, opacity);
      s.position.copy(api.point(nx, ny, 0.02));
      group.add(s);
      return s;
    },
    bounce() { state.bounce = 1; },
    lift(on) { state.targetLift = on ? 1 : 0; },
    update(dt, t) {
      const s = state;
      if (s.bounce > 0) s.bounce = Math.max(0, s.bounce - dt * 2);
      const k = Math.sin(s.bounce * Math.PI);
      s.lift += (s.targetLift - s.lift) * Math.min(1, dt * 6);
      s.tilt += (s.targetTilt - s.tilt) * Math.min(1, dt * 5);
      mesh.scale.set(1 + k * 0.05 + s.lift * 0.02, 1 - k * 0.04 + s.lift * 0.03, 1);
      mesh.rotation.y = s.tilt + Math.sin(t * 0.7 + s.sway) * 0.008;
      mesh.rotation.z = k * 0.03;
    },
  };
  return api;
}

/* ---------- table decorations ---------- */

function brass() {
  return new THREE.MeshStandardMaterial({ color: 0xd2a85c, metalness: 0.85, roughness: 0.32 });
}

/** A brass magnifying glass with a real glass lens, lying on the table. */
export function makeMagnifier() {
  const group = new THREE.Group();
  const R = 0.1;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.009, 14, 48), brass());
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  ring.receiveShadow = true;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.004, R - 0.004, 0.006, 48), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transmission: 0.96, thickness: 0.04, roughness: 0.04, ior: 1.5, metalness: 0, transparent: true, opacity: 1, clearcoat: 1, clearcoatRoughness: 0.05,
  }));
  lens.receiveShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.05, 16), brass());
  collar.rotation.z = Math.PI / 2;
  collar.position.x = -R - 0.02;
  collar.castShadow = true;
  const handle = capsule(0.015, 0.16, wood(true));
  handle.rotation.z = Math.PI / 2;
  handle.position.x = -R - 0.13;
  const cap = sphere(0.018, brass(), 16);
  cap.position.x = -R - 0.225;
  const head = new THREE.Group();
  head.add(ring, lens, collar, handle, cap);
  head.position.y = 0.019; // resting on the handle and ring
  head.rotation.x = -0.05;
  group.add(head);
  return { group, tap() { /* no-op */ } };
}

/** A small wooden toy train: engine and one carriage. */
export function makeTrain() {
  const group = new THREE.Group();
  const red = felt(0xd8483a, { roughness: 0.6, sheen: 0.2 });
  const blue = felt(0x3f6fb5, { roughness: 0.6, sheen: 0.2 });
  const green = felt(0x5f9a5a, { roughness: 0.6, sheen: 0.2 });
  const dark = wood(true);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2c2a33, roughness: 0.7 });
  const engine = new THREE.Group();
  const chassis = box(0.2, 0.03, 0.08, dark, 0.006);
  chassis.position.y = 0.035;
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.12, 24), blue);
  boiler.rotation.z = Math.PI / 2;
  boiler.position.set(0.03, 0.078, 0);
  boiler.castShadow = true;
  const cab = box(0.07, 0.085, 0.076, red, 0.008);
  cab.position.set(-0.062, 0.09, 0);
  const roof = box(0.082, 0.014, 0.09, dark, 0.004);
  roof.position.set(-0.062, 0.14, 0);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.011, 0.045, 16), dark);
  chimney.position.set(0.07, 0.125, 0);
  chimney.castShadow = true;
  const dome = sphere(0.02, brass(), 16);
  dome.position.set(0.02, 0.108, 0);
  engine.add(chassis, boiler, cab, roof, chimney, dome);
  const wheels = [];
  for (const x of [-0.065, 0.005, 0.065]) for (const z of [-0.046, 0.046]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 20), wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.024, z);
    w.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 12), brass());
    hub.rotation.x = Math.PI / 2;
    hub.position.copy(w.position);
    engine.add(w, hub);
    wheels.push(w);
  }
  group.add(engine);
  const car = new THREE.Group();
  const bed = box(0.13, 0.05, 0.08, green, 0.006);
  bed.position.y = 0.055;
  const load = box(0.07, 0.04, 0.05, felt(0xf3d36b, { roughness: 0.6 }), 0.008);
  load.position.set(0, 0.1, 0);
  load.rotation.y = 0.3;
  car.add(bed, load);
  for (const x of [-0.04, 0.04]) for (const z of [-0.046, 0.046]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 20), wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.022, z);
    w.castShadow = true;
    car.add(w);
    wheels.push(w);
  }
  car.position.x = -0.2;
  group.add(car);
  const link = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 8), brass());
  link.rotation.z = Math.PI / 2;
  link.position.set(-0.115, 0.04, 0);
  group.add(link);
  const state = { roll: 0, puff: 0 };
  const puffs = [];
  return {
    group,
    state,
    tap() { state.roll = 1.6; state.puff = 1; },
    update(dt, t) {
      if (state.roll > 0) {
        state.roll = Math.max(0, state.roll - dt);
        const speed = Math.sin(Math.min(1, state.roll / 1.6) * Math.PI) * 4;
        for (const w of wheels) w.rotation.y += speed * dt;
        group.position.x += Math.cos(group.rotation.y) * speed * 0.012 * dt;
        group.position.z -= Math.sin(group.rotation.y) * speed * 0.012 * dt;
      }
    },
  };
}

/** A striped rubber ball. */
export function makeBall(radius = 0.085) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d94a3a";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#f6e4b8";
  ctx.fillRect(0, 96, 512, 64);
  ctx.fillStyle = "#3d6db4";
  ctx.fillRect(0, 108, 512, 40);
  ctx.fillStyle = "#f6e4b8";
  for (let i = 0; i < 4; i++) {
    const cx = 64 + i * 128, cy = 128;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 ? 6 : 14;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const ball = sphere(radius, mat, 40);
  ball.position.y = radius;
  const group = new THREE.Group();
  group.add(ball);
  const state = { bounce: 0 };
  return {
    group,
    tap() { state.bounce = 1; },
    update(dt) {
      if (state.bounce > 0) {
        state.bounce = Math.max(0, state.bounce - dt * 1.1);
        const k = Math.sin(state.bounce * Math.PI);
        ball.position.y = radius + Math.abs(Math.sin(state.bounce * Math.PI * 3)) * 0.12 * k;
        ball.rotation.z += dt * 3 * k;
      }
    },
  };
}

/** A ceramic cup of wax crayons. */
export function makeCrayonCup() {
  const group = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.043, 0.1, 28, 1, true), glossy(0xf2e6d0, { side: THREE.DoubleSide, roughness: 0.35 }));
  cup.position.y = 0.05;
  cup.castShadow = true;
  cup.receiveShadow = true;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.043, 28), glossy(0xf2e6d0, { roughness: 0.35 }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.001;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0505, 0.0505, 0.014, 28, 1, true), felt(0x3d6db4, { roughness: 0.5 }));
  band.position.y = 0.08;
  group.add(cup, bottom, band);
  const colors = [0xd94a3a, 0xf3b23a, 0x5f9a5a, 0x3d6db4, 0x8b5cc7, 0xf28fb1, 0x3a2f2a];
  colors.forEach((c, i) => {
    const a = (i / colors.length) * Math.PI * 2;
    const crayon = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.15, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.016, 10), crayon.material);
    tip.position.y = 0.083;
    crayon.add(tip);
    crayon.position.set(Math.cos(a) * 0.028, 0.085, Math.sin(a) * 0.028);
    crayon.rotation.z = Math.cos(a) * 0.22;
    crayon.rotation.x = -Math.sin(a) * 0.22;
    crayon.castShadow = true;
    group.add(crayon);
  });
  return { group, tap() {} };
}

/** A small stack of closed picture books. */
export function makeBookStack() {
  const group = new THREE.Group();
  const specs = [
    { w: 0.42, h: 0.05, d: 0.32, color: 0x8a3b48, rot: 0.08 },
    { w: 0.36, h: 0.04, d: 0.28, color: 0x3f6f5a, rot: -0.14 },
    { w: 0.3, h: 0.035, d: 0.24, color: 0xd8a24a, rot: 0.2 },
  ];
  let y = 0;
  const edge = new THREE.MeshStandardMaterial({ color: 0xe9dcc4, roughness: 0.95 });
  for (const s of specs) {
    const cover = felt(s.color, { roughness: 0.85, sheen: 0.4 });
    const geo = new RoundedBoxGeometry(s.w, s.h, s.d, 2, 0.004);
    const m = new THREE.Mesh(geo, [edge, cover, cover, cover, edge, edge]);
    m.position.y = y + s.h / 2;
    m.rotation.y = s.rot;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    y += s.h;
  }
  return { group, tap() {} };
}

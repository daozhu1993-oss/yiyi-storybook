/* Shooting stars for the loading screen: every second or two a comet streaks down across the night
   sky. Drawn by three.js on its own transparent canvas over the sky shader, in two layers:
   - the streak: one instanced quad per comet, stretched along its path and reaching a little past
     the head, with a shader that paints a hot core, a soft halo and a gold tail that thins and
     glints toward its end; everything fades out well inside the quad, so no edge ever shows;
   - the dust: a cloud of tiny sparkles shed along each tail (three.js Points with their own
     shader), each drifting off the path, twinkling with four rays and dying in its own time.
   The whole streak fades in for a blink and out over its last third. It runs only while the
   loading screen is up (play/stop). */
import * as THREE from "three";

const COUNT = 6;          // comets that can be in the sky at once
const DUST = 28;          // sparkles shed by each comet
const LIFE = 1.15;        // seconds a comet takes to cross and fade

const STREAK_VERT = /* glsl */ `
attribute float aBirth;
attribute vec2 aStart;
attribute vec2 aDir;
attribute float aLen;
attribute float aSpeed;
attribute float aSeed;
uniform float uTime;
varying float vAlong;
varying float vAcross;
varying float vAge;
varying float vSeed;
void main() {
  float age = (uTime - aBirth) / ${LIFE.toFixed(2)};
  vAge = age;
  vSeed = aSeed;
  // the quad runs from the tail (along 0) past the head (along 1) to 1.18, so the head's halo has room
  vAlong = (position.x + 0.5) * 1.18;
  vAcross = position.y;
  vec2 dir = normalize(aDir);
  vec2 across = vec2(-dir.y, dir.x);
  vec2 head = aStart + dir * aSpeed * clamp(age, 0.0, 1.0);
  vec2 p = head - dir * (1.0 - vAlong) * aLen + across * vAcross * aLen * 0.3;
  if (age < 0.0 || age > 1.0) p = vec2(-10.0);   // not yet born, or spent: nothing to draw
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
}`;

const STREAK_FRAG = /* glsl */ `
precision highp float;
varying float vAlong;
varying float vAcross;
varying float vAge;
varying float vSeed;
void main() {
  if (vAge < 0.0 || vAge > 1.0) discard;
  float along = clamp(vAlong, 0.0, 1.0);
  // the tail thins toward its end and glows brightest near the head (across runs -0.5..0.5)
  float width = mix(0.05, 0.26, pow(along, 1.6));
  float body = exp(-(vAcross * vAcross) / (width * width * 0.5)) * pow(along, 2.4) * (1.0 - smoothstep(0.98, 1.06, vAlong));
  // the head: a small hot core with a soft halo, both dying well inside the quad
  float d = length(vec2((vAlong - 1.0) * 1.6, vAcross * 1.9));
  float core = exp(-d * d * 120.0);
  float halo = exp(-d * d * 12.0) * 0.8;
  // a few glints riding the tail
  float glint = pow(max(0.0, sin(along * 60.0 + vSeed * 20.0 + vAge * 12.0)), 12.0) * pow(along, 3.0) * exp(-(vAcross * vAcross) * 220.0) * 0.5;
  // nothing reaches the quad's edges: a soft window across, at the tail's end and past the head
  float window = smoothstep(0.5, 0.3, abs(vAcross)) * smoothstep(0.0, 0.05, vAlong) * smoothstep(1.18, 1.08, vAlong);
  // in for a blink, out over the last third
  float fade = smoothstep(0.0, 0.08, vAge) * (1.0 - smoothstep(0.6, 1.0, vAge)) * window;
  vec3 tail = mix(vec3(1.0, 0.72, 0.30), vec3(1.0, 0.95, 0.80), along);
  vec3 col = tail * (body * 1.1 + glint) + vec3(1.0, 0.98, 0.92) * (core * 1.6 + halo);
  float a = clamp(body * 0.85 + core + halo * 0.8 + glint, 0.0, 1.0) * fade;
  gl_FragColor = vec4(col * fade, a);
}`;

const DUST_VERT = /* glsl */ `
attribute float aBirth;
attribute vec2 aStart;
attribute vec2 aDir;
attribute float aLen;
attribute float aSpeed;
attribute float aOffset;     // where on the tail this sparkle was shed (0 tail .. 1 head)
attribute vec2 aDrift;       // its own little push off the path
attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform float uHeight;
varying float vLife;
varying float vPhase;
void main() {
  float age = (uTime - aBirth) / ${LIFE.toFixed(2)};
  vec2 dir = normalize(aDir);
  vec2 across = vec2(-dir.y, dir.x);
  vec2 head = aStart + dir * aSpeed * clamp(age, 0.0, 1.0);
  // shed where the tail was a moment ago, then drifting off it and sinking a little
  float shed = clamp(age - aOffset * 0.35, 0.0, 1.0);
  vec2 p = head - dir * aOffset * aLen + across * aDrift.x * aLen * 0.35 + aDrift * shed * 0.06 + vec2(0.0, -0.03) * shed * shed;
  vLife = (age < 0.0 || age > 1.0) ? -1.0 : age;
  vPhase = aPhase;
  if (vLife < 0.0) p = vec2(-10.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  float twinkle = 0.7 + 0.5 * sin(uTime * 9.0 + aPhase * 6.28);
  gl_PointSize = aSize * uHeight * (1.0 - 0.5 * age) * twinkle;
}`;

const DUST_FRAG = /* glsl */ `
precision highp float;
varying float vLife;
varying float vPhase;
void main() {
  if (vLife < 0.0) discard;
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  // a soft mote with four thin rays
  float mote = exp(-r * r * 6.0);
  float rays = (exp(-abs(q.x) * 18.0) * exp(-abs(q.y) * 3.0) + exp(-abs(q.y) * 18.0) * exp(-abs(q.x) * 3.0)) * 0.55 * (1.0 - r);
  float fade = smoothstep(0.0, 0.1, vLife) * (1.0 - smoothstep(0.45, 1.0, vLife));
  vec3 col = mix(vec3(1.0, 0.85, 0.5), vec3(1.0, 0.98, 0.9), fract(vPhase * 3.0));
  float a = clamp(mote + rays, 0.0, 1.0) * fade * smoothstep(1.0, 0.7, r);
  gl_FragColor = vec4(col * a, a);
}`;

export class Comets {
  constructor(canvas) {
    this.canvas = canvas;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "default", premultipliedAlpha: true });
    } catch (error) { this.renderer = null; return; }
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    this.uniforms = { uTime: { value: 0 }, uHeight: { value: 600 } };
    // the streaks
    const base = new THREE.PlaneGeometry(1, 1);
    const streak = new THREE.InstancedBufferGeometry();
    streak.index = base.index;
    streak.setAttribute("position", base.attributes.position);
    streak.setAttribute("uv", base.attributes.uv);
    this.comet = { birth: new Float32Array(COUNT).fill(-100), start: new Float32Array(COUNT * 2), dir: new Float32Array(COUNT * 2), len: new Float32Array(COUNT), speed: new Float32Array(COUNT), seed: new Float32Array(COUNT) };
    this.cometAttr = {};
    for (const [name, size] of [["birth", 1], ["start", 2], ["dir", 2], ["len", 1], ["speed", 1], ["seed", 1]]) {
      this.cometAttr[name] = new THREE.InstancedBufferAttribute(this.comet[name], size);
      streak.setAttribute("a" + name[0].toUpperCase() + name.slice(1), this.cometAttr[name]);
    }
    streak.instanceCount = COUNT;
    const streakMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const streakMesh = new THREE.Mesh(streak, streakMat);
    streakMesh.frustumCulled = false;
    this.scene.add(streakMesh);
    // the dust: every comet slot owns DUST sparkles, each carrying its comet's path
    const n = COUNT * DUST;
    this.dust = { birth: new Float32Array(n).fill(-100), start: new Float32Array(n * 2), dir: new Float32Array(n * 2), len: new Float32Array(n), speed: new Float32Array(n), offset: new Float32Array(n), drift: new Float32Array(n * 2), phase: new Float32Array(n), size: new Float32Array(n) };
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.dustAttr = {};
    for (const [name, size] of [["birth", 1], ["start", 2], ["dir", 2], ["len", 1], ["speed", 1], ["offset", 1], ["drift", 2], ["phase", 1], ["size", 1]]) {
      this.dustAttr[name] = new THREE.BufferAttribute(this.dust[name], size);
      dustGeo.setAttribute("a" + name[0].toUpperCase() + name.slice(1), this.dustAttr[name]);
    }
    const dustMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    dustPoints.frustumCulled = false;
    this.scene.add(dustPoints);
    this.time = 0;
    this.last = 0;
    this.next = 0.15;   // the first one falls almost at once: a loading screen can be short
    this.slot = 0;
    this.running = false;
    this.aspect = 1;
    this.frame = this.frame.bind(this);
  }

  /** A comet is born: from somewhere in the upper sky, falling shallowly to the left or the right,
      and its dust is shed along the way. */
  spawn() {
    const i = this.slot;
    this.slot = (this.slot + 1) % COUNT;
    const aspect = this.aspect;
    const left = Math.random() < 0.5;
    const angle = (20 + Math.random() * 20) * Math.PI / 180;    // 20 to 40 degrees below the horizontal
    const dx = (left ? -1 : 1) * Math.cos(angle), dy = -Math.sin(angle);
    const c = this.comet;
    c.start[i * 2] = (left ? 0.45 + Math.random() * 0.55 : Math.random() * 0.55) * aspect;
    c.start[i * 2 + 1] = 0.72 + Math.random() * 0.33;
    c.dir[i * 2] = dx; c.dir[i * 2 + 1] = dy;
    c.len[i] = 0.24 + Math.random() * 0.18;
    c.speed[i] = 0.55 + Math.random() * 0.35;                    // of the sky's height, over its life
    c.seed[i] = Math.random() * 10;
    c.birth[i] = this.time;
    for (const a of Object.values(this.cometAttr)) a.needsUpdate = true;
    const d = this.dust;
    for (let k = 0; k < DUST; k++) {
      const j = i * DUST + k;
      d.birth[j] = this.time;
      d.start[j * 2] = c.start[i * 2]; d.start[j * 2 + 1] = c.start[i * 2 + 1];
      d.dir[j * 2] = dx; d.dir[j * 2 + 1] = dy;
      d.len[j] = c.len[i]; d.speed[j] = c.speed[i];
      d.offset[j] = Math.pow(Math.random(), 0.7);                // more of them near the head
      d.drift[j * 2] = (Math.random() - 0.5) * 2; d.drift[j * 2 + 1] = (Math.random() - 0.5) * 2;
      d.phase[j] = Math.random();
      d.size[j] = 0.006 + Math.random() * 0.012;                 // of the sky's height
    }
    for (const a of Object.values(this.dustAttr)) a.needsUpdate = true;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.camera.right = this.aspect;
    this.camera.updateProjectionMatrix();
    this.uniforms.uHeight.value = h * dpr;
  }

  frame(now) {
    if (!this.running || !this.renderer) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.time += dt;
    this.resize();
    if (this.time > this.next) { this.spawn(); this.next = this.time + 0.9 + Math.random() * 1.6; }
    this.uniforms.uTime.value = this.time;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  }

  play() { if (!this.renderer || this.running) return; this.running = true; this.last = 0; requestAnimationFrame(this.frame); }
  stop() { this.running = false; }
}

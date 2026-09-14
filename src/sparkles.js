/* Cursor magic: a GPU particle overlay of glowing, twinkling stars drawn with a custom shader
   on top of the finished frame. Positions are CSS pixels. */
import * as THREE from "three";

const MAX = 640;

const vertexShader = /* glsl */ `
  attribute vec2 aVel;
  attribute float aBirth;
  attribute float aLife;
  attribute float aSize;
  attribute float aSeed;
  attribute float aKind;
  uniform float uTime;
  uniform float uDpr;
  varying float vAlpha;
  varying float vSeed;
  varying float vKind;
  void main() {
    float age = uTime - aBirth;
    vSeed = aSeed;
    vKind = aKind;
    if (age < 0.0 || age > aLife) {
      gl_PointSize = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vAlpha = 0.0;
      return;
    }
    float t = age / aLife;
    float drift = aKind > 2.5 ? -90.0 : 26.0;
    vec2 p = position.xy + aVel * age + vec2(sin(uTime * 3.0 + aSeed * 20.0) * 6.0 * t, drift * age * age);
    if (aKind < 0.5) p = position.xy;
    float twinkle = 0.7 + 0.3 * sin(uTime * (11.0 + aSeed * 9.0) + aSeed * 40.0);
    float pop = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.5, 1.0, t));
    if (aKind < 0.5) pop = 1.0;
    vAlpha = pop * twinkle;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
    gl_PointSize = aSize * uDpr * (0.55 + 0.75 * pop);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying float vAlpha;
  varying float vSeed;
  varying float vKind;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    float ang = vSeed * 6.2832 + uTime * (0.6 + vSeed * 1.2);
    float c = cos(ang), s = sin(ang);
    vec2 q = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
    float glow = exp(-r * r * 26.0);
    float core = exp(-r * r * 160.0);
    float star = pow(max(0.0, 1.0 - (abs(q.x) + abs(q.y)) * 2.4), 3.0);
    float rays = pow(max(0.0, 1.0 - abs(abs(q.x) - abs(q.y)) * 7.0), 8.0) * (1.0 - smoothstep(0.08, 0.5, r));
    float a = glow * 0.7 + core * 1.5 + star * 1.2 + rays * 0.7;
    if (vKind < 0.5) a = glow * 1.1 + core * 0.2;
    vec3 gold = vec3(1.0, 0.84, 0.46);
    vec3 pink = vec3(1.0, 0.62, 0.78);
    vec3 sky = vec3(0.62, 0.84, 1.0);
    vec3 tint = vSeed < 0.3 ? pink : (vSeed < 0.55 ? sky : gold);
    vec3 col = mix(gold, tint, 0.65);
    col = mix(col, vec3(1.0), core * 0.9);
    float alpha = a * vAlpha * (vKind < 0.5 ? 0.34 : 1.0);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

export class Sparkles {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
    this.time = 0;
    this.next = 1; // slot 0 is the cursor halo
    this.height = 1;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 2);
    this.birth = new Float32Array(MAX).fill(-100);
    this.life = new Float32Array(MAX).fill(1);
    this.size = new Float32Array(MAX);
    this.seed = new Float32Array(MAX);
    this.kind = new Float32Array(MAX);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aVel", new THREE.BufferAttribute(this.vel, 2));
    g.setAttribute("aBirth", new THREE.BufferAttribute(this.birth, 1));
    g.setAttribute("aLife", new THREE.BufferAttribute(this.life, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(this.seed, 1));
    g.setAttribute("aKind", new THREE.BufferAttribute(this.kind, 1));
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uDpr: { value: 1 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  resize(w, h, dpr) {
    this.height = h;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.updateProjectionMatrix();
    this.material.uniforms.uDpr.value = dpr;
  }

  dirty() {
    for (const name of ["position", "aVel", "aBirth", "aLife", "aSize", "aSeed", "aKind"]) this.geometry.attributes[name].needsUpdate = true;
  }

  /** anything to draw: the cursor halo, or a particle born in the last couple of seconds */
  get alive() { return !!this.cursorOn || (this.time - (this.lastSpawn == null ? -10 : this.lastSpawn)) < 2.2; }

  /** kind 1: cursor trail, 2: dragging, 3: burst (tap, word) */
  spawn(x, y, n = 1, kind = 1) {
    this.lastSpawn = this.time;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = this.next + 1 >= MAX ? 1 : this.next + 1;
      const spread = kind === 3 ? 26 : 8;
      this.pos[i * 3] = x + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 1] = this.height - y + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 2] = 0;
      const speed = kind === 3 ? 90 : 40;
      const a = Math.random() * Math.PI * 2;
      this.vel[i * 2] = Math.cos(a) * speed * Math.random();
      this.vel[i * 2 + 1] = Math.sin(a) * speed * Math.random() + (kind === 3 ? 50 : 24);
      this.birth[i] = this.time + Math.random() * 0.05;
      this.life[i] = kind === 3 ? 0.9 + Math.random() * 0.7 : 0.7 + Math.random() * 0.6;
      this.size[i] = kind === 3 ? 34 + Math.random() * 40 : 20 + Math.random() * 26;
      this.seed[i] = Math.random();
      this.kind[i] = kind;
    }
    this.dirty();
  }

  /** A soft glow that rides on the cursor. */
  setCursor(x, y, on) {
    this.cursorOn = !!on;
    this.pos[0] = x;
    this.pos[1] = this.height - y;
    this.birth[0] = on ? this.time - 1 : -100;
    this.life[0] = 1e6;
    this.size[0] = 220;
    this.seed[0] = 0.8;
    this.kind[0] = 0;
    this.dirty();
  }

  clear() {
    this.birth.fill(-100);
    this.dirty();
  }

  update(dt) {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
  }

  render() {
    const r = this.renderer;
    const auto = r.autoClear;
    r.autoClear = false;
    r.render(this.scene, this.camera);
    r.autoClear = auto;
  }
}

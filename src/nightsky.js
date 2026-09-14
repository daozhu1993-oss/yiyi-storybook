/* The loading screen's sky: a fullscreen shader behind the card. Under everything, the painted
   night sky (public/ui/sky.jpg) when there is one, otherwise a deep blue that breathes with cloth
   folded in from noise and drifting clouds; the cards' paper grain folded in as texture; a few
   hundred stars that twinkle at their own pace, slow drifting dust, gold four-ray sparkles rising
   near the moon, and a warm glow around wherever the moon sits (the painted moon PNG floats above
   this canvas, moved by the same clock). Runs only while the loading screen shows. */

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 res;
uniform float time;
uniform vec2 moon;        // moon centre in uv (0..1, y up)
uniform float moonR;      // moon radius in uv (of the height)
uniform float zoom;       // >1 draws the stars, dust and sparkles bigger (small canvases)
uniform sampler2D bg;     // a painted night sky (public/ui/sky.jpg), when there is one
uniform float hasBg;
uniform vec2 bgSize;      // its pixel size, to cover the canvas without stretching
uniform sampler2D paper;  // the paper grain the cards use, folded in as texture
uniform float hasPaper;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

// a star layer: cells of scale across the screen, one star per cell at a random spot
vec3 stars(vec2 uv, float scale, float size, float bright, float seed) {
  vec2 g = uv * scale;
  vec2 cell = floor(g), f = fract(g);
  vec3 sum = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 c = cell + o;
    float h = hash(c + seed);
    if (h < 0.42) continue;                                   // not every cell has a star
    vec2 pos = o + vec2(hash(c + 1.3 + seed), hash(c + 7.7 + seed));
    float d = length(f - pos) / size;
    float tw = 0.65 + 0.35 * sin(time * (0.8 + 2.4 * hash(c + 3.1)) + h * 40.0);   // each at its own pace
    float core = exp(-d * d * 3.0);
    float rays = exp(-d * 1.4) * (0.35 + 0.65 * abs(sin(atan(f.y - pos.y, f.x - pos.x) * 2.0)));
    vec3 col = mix(vec3(1.0, 0.95, 0.85), vec3(0.85, 0.92, 1.0), hash(c + 9.9));
    sum += col * (core + rays * 0.25) * tw * bright * smoothstep(0.42, 0.6, h);
  }
  return sum;
}

// magic sparkles: rare, a bright core with thin four-point rays, each blooming and fading on its own
vec3 sparkles(vec2 uv, float scale, float size, float bright, float seed) {
  vec2 g = uv * scale;
  vec2 cell = floor(g), f = fract(g);
  vec3 sum = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 c = cell + o;
    float h = hash(c + seed);
    if (h < 0.86) continue;
    vec2 pos = o + vec2(hash(c + 1.3 + seed), hash(c + 7.7 + seed));
    vec2 dlt = (f - pos) / size;
    float r = length(dlt);
    float core = exp(-r * r * 5.0);
    float rays = (exp(-abs(dlt.x) * 10.0) * exp(-dlt.y * dlt.y * 0.7) + exp(-abs(dlt.y) * 10.0) * exp(-dlt.x * dlt.x * 0.7)) * 0.8;
    float life = fract(time * (0.1 + 0.12 * hash(c + 5.0)) + h * 7.0);
    float env = pow(sin(life * 3.14159), 2.0);
    sum += vec3(1.0, 0.88, 0.55) * (core + rays) * env * bright;
  }
  return sum;
}

// soft round motes (no rays), for the drifting dust
vec3 motes(vec2 uv, float scale, float size, float bright, float seed) {
  vec2 g = uv * scale;
  vec2 cell = floor(g), f = fract(g);
  vec3 sum = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 c = cell + o;
    float h = hash(c + seed);
    if (h < 0.7) continue;
    vec2 pos = o + vec2(hash(c + 1.3 + seed), hash(c + 7.7 + seed));
    float d = length(f - pos) / size;
    float tw = 0.5 + 0.5 * sin(time * (0.5 + 1.5 * hash(c + 3.1)) + h * 40.0);
    sum += vec3(1.0, 0.93, 0.75) * exp(-d * d * 2.2) * tw * bright;
  }
  return sum;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / res.y;      // aspect-true, centred
  vec3 sky;
  if (hasBg > 0.5) {
    // the painted sky, fitted to cover the screen, drifting a breath sideways
    float ca = res.x / res.y, ia = bgSize.x / bgSize.y;
    vec2 t = uv - 0.5;
    if (ia > ca) t.x *= ca / ia; else t.y *= ia / ca;
    t = t * 0.96 + 0.5 + vec2(sin(time * 0.05) * 0.01, 0.0);
    sky = texture2D(bg, vec2(t.x, 1.0 - t.y)).rgb;
    sky *= 0.96 + 0.04 * sin(time * 0.25);
  } else {
    // the sky: deep indigo, lighter toward the moon and the bottom, a slow breathing
    sky = mix(vec3(0.05, 0.07, 0.19), vec3(0.11, 0.15, 0.33), uv.y * 0.6 + 0.2);
    sky *= 0.94 + 0.06 * sin(time * 0.25);
    // cloth: fine folded noise, like the wallpaper behind the shelf
    float cloth = fbm(q * 9.0 + vec2(time * 0.01, 0.0)) * 0.5 + fbm(q * 40.0) * 0.18;
    sky += (cloth - 0.4) * 0.09;
    // soft night clouds drifting through
    float cl = fbm(q * 2.2 + vec2(time * 0.02, time * 0.004));
    sky += smoothstep(0.55, 0.85, cl) * vec3(0.10, 0.12, 0.22);
  }
  // paper grain, soft-light, tiled at hand size
  if (hasPaper > 0.5) {
    float g = texture2D(paper, fract(gl_FragCoord.xy / 520.0)).r;
    sky = mix(sky, sky * (0.55 + g * 0.9), 0.35);
  }
  // the moon's glow, warm and wide (the painted moon sits on top of it)
  vec2 mq = (moon - 0.5) * vec2(res.x / res.y, 1.0);
  float md = length(q - mq);
  sky += vec3(1.0, 0.86, 0.55) * (0.45 * exp(-pow(md / (moonR * 1.5), 2.0)) + 0.10 * exp(-md / (moonR * 2.6)));
  // stars: three layers, the far ones small and many, the near ones bigger and rarer
  vec2 qs = q / zoom;
  vec3 st = stars(qs + vec2(time * 0.0015, 0.0), 26.0, 0.06, 0.55, 1.0);
  st += stars(qs + vec2(time * 0.003, 0.0), 12.0, 0.09, 0.85, 2.0);
  st += stars(qs + vec2(time * 0.005, 0.0), 5.0, 0.13, 1.0, 3.0);
  st *= 1.0 - smoothstep(moonR * 0.9, moonR * 1.4, md);   // none over the moon's face
  // dust: slow motes rising, blurred and faint
  vec3 dust = motes(qs + vec2(sin(time * 0.1) * 0.02, -time * 0.012), 11.0, 0.16, 0.10, 5.0) + motes(qs + vec2(0.0, -time * 0.02), 6.0, 0.24, 0.05, 8.0);
  // magic: a few gold four-ray sparkles rising slowly, brighter near the moon
  vec3 magic = sparkles(qs + vec2(sin(time * 0.15) * 0.02, -time * 0.025), 6.0, 0.09, 1.1, 11.0);
  magic *= 0.4 + 0.6 * exp(-md / (moonR * 3.0));
  // vignette so the card sits in a pool of light
  float vig = 1.0 - smoothstep(0.55, 1.15, length(qs * vec2(0.85, 1.0)));
  vec3 col = (sky + st + dust + magic) * (0.72 + 0.28 * vig);
  gl_FragColor = vec4(col, 1.0);
}`;

export class NightSky {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
    this.gl = gl;
    if (!gl) return;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { this.gl = null; return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = { res: gl.getUniformLocation(prog, "res"), time: gl.getUniformLocation(prog, "time"), moon: gl.getUniformLocation(prog, "moon"), moonR: gl.getUniformLocation(prog, "moonR"), bg: gl.getUniformLocation(prog, "bg"), hasBg: gl.getUniformLocation(prog, "hasBg"), bgSize: gl.getUniformLocation(prog, "bgSize"), paper: gl.getUniformLocation(prog, "paper"), hasPaper: gl.getUniformLocation(prog, "hasPaper"), zoom: gl.getUniformLocation(prog, "zoom") };
    gl.uniform1i(this.u.bg, 0);
    gl.uniform1i(this.u.paper, 1);
    this.textures = { bg: null, paper: null, bgSize: [1, 1] };
    this.moon = { x: 0.72, y: 0.72, r: 0.14 };
    this.zoom = 1;
    this.start = performance.now();
    this.running = false;
    this.frame = this.frame.bind(this);
  }

  /** Load an image into one of the shader's slots: "bg" (the painted sky) or "paper" (the grain).
      A missing file simply leaves the slot empty. */
  setImage(slot, url) {
    const gl = this.gl;
    if (!gl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";   // the pictures come from Storage on the site; WebGL needs CORS to read them
    img.onload = () => {
      const tex = gl.createTexture();
      gl.activeTexture(slot === "bg" ? gl.TEXTURE0 : gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      const pot = (n) => (n & (n - 1)) === 0;
      const wrap = slot === "paper" && pot(img.width) && pot(img.height) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.textures[slot] = tex;
      if (slot === "bg") this.textures.bgSize = [img.width, img.height];
    };
    img.src = url;
  }

  /** Where the moon is, in canvas fractions (y up), so the glow follows the painted moon. */
  setMoon(x, y, r) { this.moon = { x, y, r }; }

  /** How big the stars, dust and sparkles draw, relative to the canvas height (a small canvas wants 3 or so). */
  setZoom(zoom) { this.zoom = Math.max(0.25, zoom || 1); }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  frame(now) {
    if (!this.running || !this.gl) return;
    const gl = this.gl;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.time, (now - this.start) / 1000);
    gl.uniform2f(this.u.moon, this.moon.x, this.moon.y);
    gl.uniform1f(this.u.moonR, this.moon.r);
    gl.uniform1f(this.u.zoom, this.zoom);
    gl.uniform1f(this.u.hasBg, this.textures.bg ? 1 : 0);
    gl.uniform2f(this.u.bgSize, this.textures.bgSize[0], this.textures.bgSize[1]);
    gl.uniform1f(this.u.hasPaper, this.textures.paper ? 1 : 0);
    if (this.textures.bg) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.textures.bg); }
    if (this.textures.paper) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.textures.paper); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (this.running && !this.snapping) requestAnimationFrame(this.frame);
  }

  play() { if (!this.gl || this.running) return; this.running = true; requestAnimationFrame(this.frame); }
  stop() { this.running = false; }

  /** One frame drawn now and returned as a JPEG data URL (for checks; the buffer is not kept otherwise). */
  snapshot(quality = 0.8) {
    if (!this.gl) return null;
    const was = this.running;
    this.running = true; this.snapping = true;
    this.frame(performance.now());
    this.snapping = false; this.running = was;
    return this.canvas.toDataURL("image/jpeg", quality);
  }
}

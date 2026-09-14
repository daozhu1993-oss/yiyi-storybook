/* Souvenir pins: chunky enamel badges that hover over the page so nobody misses them. The pin
   art (a cut-out PNG) is traced into an outline and extruded into a thick, bevelled body: the
   enamel face on the caps, polished gold around the rim. The badge floats, sways and turns so
   the rim and the clearcoat catch the light, and a warm light and a glow pulse under it. The
   twinkling stars around it are the cursor's own sparkle shader, fed from main.js (placePins).
   Tap handling and scoring stay in main.js. */
import * as THREE from "three";
import * as P from "./props.js";

const GOLD = 0xf6c75c;
const THICKNESS = 0.014;     // metal body, before the bevel on each face
const HOVER = 0.05;          // how high the badge floats over the page

// 8 neighbours clockwise on a y-down grid: E, SE, S, SW, W, NW, N, NE
const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Trace the opaque regions of a cut-out image into outline polygons (unit square, y up). */
export function traceOutline(image, maxSize = 160, threshold = 110) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return [];
  const scale = maxSize / Math.max(iw, ih);
  const gw = Math.max(8, Math.round(iw * scale));
  const gh = Math.max(8, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, gw, gh);
  const data = ctx.getImageData(0, 0, gw, gh).data;
  // a one pixel background border, so every outline closes
  const W = gw + 2, H = gh + 2;
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) solid[(y + 1) * W + x + 1] = data[(y * gw + x) * 4 + 3] > threshold ? 1 : 0;
  const seen = new Uint8Array(W * H);
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && solid[y * W + x] === 1;
  const polygons = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!solid[i] || seen[i] || solid[i - 1]) continue;
      // Moore neighbour tracing from a pixel entered from the west; stops when it would leave
      // the start pixel the same way twice (Jacob's criterion)
      const pts = [[x, y]];
      let cx = x, cy = y, back = 4, first = -1, guard = 0;
      while (guard++ < W * H * 4) {
        let found = -1;
        for (let k = 1; k <= 8; k++) {
          const nd = (back + k) % 8;
          if (inside(cx + N8[nd][0], cy + N8[nd][1])) { found = nd; break; }
        }
        if (found < 0) break;
        if (cx === x && cy === y && first >= 0 && found === first) break;
        if (first < 0) first = found;
        cx += N8[found][0];
        cy += N8[found][1];
        back = ((found >> 1) * 2 + 6) % 8;
        if (cx !== x || cy !== y) pts.push([cx, cy]);
      }
      // flood the component so its other edge pixels do not start a second trace
      const queue = [i];
      seen[i] = 1;
      while (queue.length) {
        const j = queue.pop();
        const jx = j % W, jy = (j - jx) / W;
        for (const [dx, dy] of N8) {
          const nx = jx + dx, ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (solid[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
        }
      }
      if (pts.length < 6) continue;
      const simple = simplify(pts, 0.9);
      if (simple.length < 6) continue;
      polygons.push({ area: Math.abs(area(simple)), points: simple });
    }
  }
  if (!polygons.length) return [];
  const largest = Math.max(...polygons.map((p) => p.area));
  return polygons
    .filter((p) => p.area >= largest * 0.02)
    .map((p) => p.points.map(([px, py]) => [(px - 0.5) / gw, 1 - (py - 0.5) / gh]));
}

function area(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/** Ramer-Douglas-Peucker on a closed polygon. */
function simplify(pts, epsilon) {
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const dist = len === 1 && dx === 0 && dy === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (dist > far) { far = dist; best = i; }
    }
    if (best >= 0 && far > epsilon) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const outlines = new WeakMap();
function outlineOf(image) {
  if (!outlines.has(image)) outlines.set(image, traceOutline(image));
  return outlines.get(image);
}

/** A thick enamel pin from its cut-out art: extruded body, gold rim, glow and light. The
    light is shared (one PointLight the scene keeps, so the light count never changes and no
    shader recompiles when a pin appears): the badge moves it and sets its intensity each frame. */
export function makePinBadge(tex, { size = 0.13, reducedMotion = false, light = null } = {}) {
  const image = tex.image;
  const aspect = image.height / image.width;
  const w = size, h = size * aspect;
  const object = new THREE.Group();
  const badge = new THREE.Group();
  object.add(badge);

  const enamel = new THREE.MeshPhysicalMaterial({
    map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide,
    roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 2.6,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1,
  });
  const metal = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.24, envMapIntensity: 3, clearcoat: 0.6, clearcoatRoughness: 0.2 });

  let body;
  const polygons = outlineOf(image);
  if (polygons.length) {
    const shapes = polygons.map((poly) => {
      const s = new THREE.Shape();
      poly.forEach(([u, v], i) => { const x = (u - 0.5) * w, y = (v - 0.5) * h; if (i) s.lineTo(x, y); else s.moveTo(x, y); });
      s.closePath();
      return s;
    });
    const geometry = new THREE.ExtrudeGeometry(shapes, { depth: THICKNESS, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0028, bevelSegments: 3, curveSegments: 4 });
    // the caps take the art: extrude UVs are the shape's own x/y, so map them back onto the image
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
    geometry.translate(0, 0, -THICKNESS / 2);
    body = new THREE.Mesh(geometry, [enamel, metal]);
  } else {
    body = new THREE.Mesh(new THREE.PlaneGeometry(w, h), enamel);
  }
  body.castShadow = true;
  body.position.y = h / 2;
  badge.add(body);

  // the warmth under it: a glow disc on the page and a small light that pulses with it
  const glow = P.glowPlane(0xffe2a8, w * 3.4, 0);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.006;
  object.add(glow);
  const halo = P.glowSprite(0xfff1c8, w * 2.6, 0);
  halo.raycast = () => {};
  halo.position.y = h / 2;
  badge.add(halo);

  const phase = Math.random() * 6;
  const anchorPoint = new THREE.Vector3();
  return {
    object,
    width: w,
    height: h,
    /** The floating badge's centre, in world space (for hover tips and the flight to the counter). */
    anchor() { return badge.localToWorld(anchorPoint.set(0, h / 2, 0)); },
    update(dt, t) {
      if (object.parent && !object.parent.visible) return;   // collected: the pop-up pivot is hidden
      const k = reducedMotion ? 0.35 : 1;
      // float: hover, a slow circle, sway and tilt so the rim keeps catching the light
      badge.position.set(Math.cos(t * 0.6 + phase) * 0.014 * k, HOVER + Math.sin(t * 1.7 + phase) * 0.012 * k, Math.sin(t * 0.6 + phase) * 0.014 * k);
      badge.rotation.set(-0.28 + Math.sin(t * 1.3 + phase) * 0.1 * k, Math.sin(t * 0.9 + phase) * 0.6 * k, Math.sin(t * 0.7 + phase) * 0.07 * k);
      // shine: the glow, light and emissive breathe together, with a sharper glint on top
      const breath = 0.5 + 0.5 * Math.sin(t * 1.6 + phase);
      const glint = Math.pow(Math.max(0, Math.sin(t * 2.3 + phase * 1.7)), 8);
      glow.material.opacity = 0.16 + breath * 0.3 + glint * 0.25;
      halo.material.opacity = 0.08 + breath * 0.14 + glint * 0.35;
      if (light) { light.intensity = 0.02 + breath * 0.035 + glint * 0.05; this.anchor(); light.position.copy(anchorPoint); }
      enamel.emissiveIntensity = 0.04 + breath * 0.08 + glint * 0.25;
    },
  };
}

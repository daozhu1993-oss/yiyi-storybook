/* Progress bookmarks: a fat fabric ribbon in the book's own theme (painted strips in
   public/bookmarks/<id>.png) with the reading percentage printed near its top. One canvas per
   (book, percent) so the shelf and the open book share textures. */
import * as THREE from "three";
import { assetUrl } from "./assets.js";

const cache = new Map();
const images = new Map();

function loadImage(id) {
  if (!images.has(id)) {
    images.set(id, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";   // the strip comes from Storage: without this the canvas is tainted and WebGL refuses the texture
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      // through the asset map: on the deployed site the strips live in Storage (a bare path 404s there
      // and every ribbon fell back to a plain colour)
      img.src = assetUrl(`public/bookmarks/${id}.png`);
    }));
  }
  return images.get(id);
}

/** Draws a plain ribbon when a book has no painted strip yet. */
function fallbackRibbon(ctx, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.9); ctx.lineTo(w / 2, h); ctx.lineTo(0, h * 0.9); ctx.closePath();
  ctx.fill();
}

/**
 * A CanvasTexture of the ribbon with `percent` written on it. Resolves once the strip image is in.
 * The strip keeps its own proportions (about 1:11); the canvas is 128 x 1024.
 */
export async function bookmarkTexture(id, percent, color = "#c8202e") {
  const key = `${id}:${percent}`;
  if (cache.has(key)) return cache.get(key);
  const img = await loadImage(id);
  const W = 160, H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (img) {
    // the painted strips are slender (about 1:11); stretch them to fill the ribbon so it reads fat
    const w = W - 12;
    ctx.drawImage(img, (W - w) / 2, 0, w, H);
  } else {
    fallbackRibbon(ctx, W, H, color);
  }
  // the label: a small cream tag stitched across the ribbon near the top
  const label = percent >= 100 ? "✓" : `${percent}%`;
  const tagY = H * 0.075, tagH = 78, pad = 14;
  ctx.font = `700 ${percent >= 100 ? 56 : 44}px "Fredoka", "Baloo 2", system-ui, sans-serif`;
  const tw = Math.min(W - 16, ctx.measureText(label).width + pad * 2);
  const x = (W - tw) / 2;
  ctx.fillStyle = "#00000033";
  roundRect(ctx, x + 2, tagY + 4, tw, tagH, 16); ctx.fill();
  ctx.fillStyle = "#fff6e2";
  roundRect(ctx, x, tagY, tw, tagH, 16); ctx.fill();
  ctx.strokeStyle = "#d9a45c"; ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  roundRect(ctx, x + 5, tagY + 5, tw - 10, tagH - 10, 12); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#2c2a3e";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, W / 2, tagY + tagH / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A ribbon mesh (width x height in world units) whose texture is swapped as progress changes. */
export function makeBookmark(width = 0.09, height = 0.6) {
  const mat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.2, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, depthWrite: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.userData.bookmark = { id: null, percent: -1, enabled: true };
  const show = () => { const d = mesh.userData.bookmark; mesh.visible = d.enabled && d.percent > 0 && !!mat.map; };
  mesh.setProgress = async (id, percent, color) => {
    const d = mesh.userData.bookmark;
    if (percent <= 0) { d.percent = 0; show(); return; }
    if (d.id === id && d.percent === percent) { show(); return; }
    d.id = id; d.percent = percent;
    const tex = await bookmarkTexture(id, percent, color);
    if (d.id !== id || d.percent !== percent) return;   // superseded while loading
    mat.map = tex;
    mat.needsUpdate = true;
    show();
  };
  /** The table ribbon only shows while its book is open (the closed book carries its own). */
  mesh.setEnabled = (on) => { mesh.userData.bookmark.enabled = !!on; show(); };
  return mesh;
}

/** Reading progress for a book: 0 when untouched, 100 once the last page was reached. */
export function readPercent(progress, pages) {
  if (!progress) return 0;
  if (progress.finished) return 100;
  // a page counts once its text has been read to the end (its star); skipping ahead earns nothing
  if (Array.isArray(progress.read)) return pages ? Math.min(99, Math.round(100 * progress.read.length / pages)) : 0;
  const furthest = progress.max != null ? progress.max : progress.page;
  if (furthest == null || furthest < 0) return 0;
  return Math.min(99, Math.max(5, Math.round(100 * (furthest + 1) / (pages + 1))));
}

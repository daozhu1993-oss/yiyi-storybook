/* The physical book, built the way a case-bound picture book is built: two cloth boards, a flat
   cloth spine strip joined to them by hinges, a sewn page block whose folds sit over the spine,
   a bending page that turns, and anchors on both page surfaces.

   Closed: the spine stands on the left, full height, flush with both covers. Opening: the front
   board swings about its hinge at the top of the spine, which stays a vertical wall beside the
   block, and comes to rest sloping gently from the top of the spine down to the table, art side
   down. Open: the block sits on the back board, the turned pages lie on the sloping cover, and a
   wall of folds at the spine joins the two sides so nothing gaps. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { easeInOut } from "./props.js";

export const PAGE_W = 1.0;
export const PAGE_H = 1.3;
const BOARD = 0.03;          // board thickness
const BLOCK = 0.08;          // page block thickness
const SQUARE = 0.025;        // how far the boards overhang the pages at head, tail and fore-edge
const STRIP_T = 0.012;       // spine strip thickness
const STRIP_X = -0.018;      // x of the spine strip's outer face
const JOINT = 0.03;          // hinge width from the spine's top corner to the front board's edge
const BOARD_X0 = STRIP_X + JOINT;   // 0.012: spine edge of both boards
const STRIP_H = BOARD + BLOCK;      // 0.11: the rigid part of the spine (back board + block)
const SEGX = 48;
const SEGZ = 8;

function endpaperTexture({ base = "#1e2752", ink = "rgba(255, 214, 120, 1)", pattern = "stars" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  let seed = 3;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const withAlpha = (a) => { const c = new THREE.Color(ink); return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`; };
  for (let i = 0; i < 120; i++) {
    const x = rand() * 512, y = rand() * 512, r = 1 + rand() * 2.2;
    ctx.fillStyle = withAlpha(0.35 + rand() * 0.6);
    ctx.beginPath();
    if (pattern === "kites") {
      // a tiny diamond with a wisp of tail
      const k = r * 2.2;
      ctx.moveTo(x, y - k); ctx.lineTo(x + k * 0.7, y); ctx.lineTo(x, y + k); ctx.lineTo(x - k * 0.7, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = withAlpha(0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + k); ctx.quadraticCurveTo(x - k, y + k * 2, x - k * 0.4, y + k * 3); ctx.stroke();
      continue;
    }
    if (pattern === "planets" && i % 4 === 0) {
      // a tiny ringed planet among the stars
      ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = withAlpha(0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, r * 3, r * 0.9, -0.4, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    if (pattern === "snow") {
      // a six-armed snowflake
      ctx.strokeStyle = withAlpha(0.35 + rand() * 0.5); ctx.lineWidth = 1;
      const k = r * 2.4;
      for (let a = 0; a < 6; a++) { const th = (a / 6) * Math.PI * 2; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(th) * k, y + Math.sin(th) * k); }
      ctx.stroke();
      continue;
    }
    if (pattern === "petals") {
      // a five-petal blossom
      for (let q = 0; q < 5; q++) { const th = (q / 5) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(th) * r * 1.4, y + Math.sin(th) * r * 1.4, r * 1.3, r * 0.8, th, 0, Math.PI * 2); ctx.fill(); }
      continue;
    }
    if (pattern === "rain") {
      // slanting rain dashes
      ctx.strokeStyle = withAlpha(0.3 + rand() * 0.5); ctx.lineWidth = 1.2;
      ctx.moveTo(x, y); ctx.lineTo(x - r * 1.5, y + r * 4); ctx.stroke();
      continue;
    }
    if (pattern === "splash") {
      // a ring with a little drop above it
      ctx.strokeStyle = withAlpha(0.35 + rand() * 0.5); ctx.lineWidth = 1.2;
      ctx.ellipse(x, y, r * 2.2, r * 0.9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - r * 2.6, r * 0.7, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (pattern === "fish") {
      // a tiny fish: a body, a tail and a dot for the eye
      ctx.ellipse(x, y, r * 2.4, r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + r * 2.2, y); ctx.lineTo(x + r * 3.6, y - r * 1.2); ctx.lineTo(x + r * 3.6, y + r * 1.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = base; ctx.beginPath(); ctx.arc(x - r * 1.1, y - r * 0.2, r * 0.3, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (pattern === "bubbles") {
      ctx.strokeStyle = withAlpha(0.35 + rand() * 0.5); ctx.lineWidth = 1.2;
      ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - r * 0.6, y - r * 0.6, r * 0.5, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 ? r * 0.45 : r;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (pattern === "stars") for (let i = 0; i < 9; i++) {
    const x = rand() * 512, y = rand() * 512;
    ctx.strokeStyle = withAlpha(0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0.4, Math.PI * 1.6);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2.6);
  return tex;
}

/** Soft, blurred rounded rectangle used as the book's contact shadow on the table. */
function contactShadowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const steps = 26;
  for (let i = 0; i < steps; i++) {
    const inset = 8 + (i / steps) * 52;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.075})`;
    const r = 26 - i * 0.6;
    ctx.beginPath();
    ctx.roundRect(inset, inset, size - inset * 2, size - inset * 2, r);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/** Paper page texture with a page number, drawn over the scanned paper, shaded toward the gutter. */
export function pageTexture(paperImage, number, side = "right") {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (paperImage) ctx.drawImage(paperImage, 0, 0, canvas.width, canvas.height);
  else { ctx.fillStyle = "#f3e8cf"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  // a warm beige wash so the paper reads as cream under the lights, not white
  ctx.fillStyle = "rgba(196, 164, 112, 0.2)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const g = ctx.createLinearGradient(side === "right" ? 0 : canvas.width, 0, side === "right" ? 140 : canvas.width - 140, 0);
  g.addColorStop(0, "rgba(80, 52, 18, 0.36)");
  g.addColorStop(0.5, "rgba(80, 52, 18, 0.13)");
  g.addColorStop(1, "rgba(80, 52, 18, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const v = ctx.createLinearGradient(side === "right" ? canvas.width : 0, 0, side === "right" ? canvas.width - 60 : 60, 0);
  v.addColorStop(0, "rgba(120, 90, 40, 0.10)");
  v.addColorStop(1, "rgba(120, 90, 40, 0)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (number != null) {
    ctx.fillStyle = "#a58d66";
    ctx.font = "600 26px 'Fredoka', sans-serif";
    ctx.textAlign = side === "right" ? "right" : "left";
    ctx.fillText(String(number), side === "right" ? canvas.width - 60 : 60, canvas.height - 48);
    ctx.fillStyle = "rgba(217, 164, 92, 0.55)";
    ctx.beginPath();
    const cx = side === "right" ? canvas.width - 74 - ctx.measureText(String(number)).width : 74 + ctx.measureText(String(number)).width;
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 ? 3 : 7;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(cx + Math.cos(a) * rr, canvas.height - 56 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function prepRepeat(texture, x, y) {
  const t = texture.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Replace zero-length normals (from degenerate triangles) so the lit shader never sees NaN. */
function fixNormals(geometry) {
  const n = geometry.attributes.normal;
  if (!n) return;
  const a = n.array;
  for (let i = 0; i < a.length; i += 3) {
    if (a[i] * a[i] + a[i + 1] * a[i + 1] + a[i + 2] * a[i + 2] < 1e-8) { a[i] = 0; a[i + 1] = 1; a[i + 2] = 0; }
  }
  n.needsUpdate = true;
}

/** Break Chinese or mixed text into clean poetic lines suitable for children's hardcover picture books */
export function formatStoryLines(text) {
  if (!text) return [];
  if (text.includes("\n")) return text.split("\n").map(l => l.trim()).filter(Boolean);
  const clean = String(text).replace(/\{([^}:]+)(?::[^}]+)?\}/g, "$1").trim();
  const parts = [];
  let cur = "";
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    cur += ch;
    if ("。！？".includes(ch)) {
      parts.push(cur.trim());
      cur = "";
    } else if ("，；".includes(ch) && cur.length >= 6) {
      parts.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) parts.push(cur.trim());

  const result = [];
  for (const part of parts) {
    if (part.length <= 18) {
      result.push(part);
    } else {
      let sub = "";
      for (const c of part) {
        sub += c;
        if (sub.length >= 15 && "，、".includes(c)) {
          result.push(sub);
          sub = "";
        }
      }
      if (sub) result.push(sub);
    }
  }
  return result.length > 0 ? result : [clean];
}

/** Render a high-DPI full-page printed spread (illustration + typography + paper grain) */
export function renderSpreadCanvasTexture({ story, artTextures, paperImage, pageIndex, side = "right" }) {
  const canvas = document.createElement("canvas");
  const W = 1200;
  const H = 1560; // 1200:1560 = 1.0:1.3 matching PAGE_W:PAGE_H
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 1. Warm parchment base paper
  ctx.fillStyle = "#faf6ed";
  ctx.fillRect(0, 0, W, H);

  // 2. Blend subtle scanned paper grain if available
  if (paperImage) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.drawImage(paperImage, 0, 0, W, H);
    ctx.restore();
  }

  // 3. Realistic book spine gutter shadow & edge gradient
  if (side === "right") {
    // Spine shadow on left edge
    const gSpine = ctx.createLinearGradient(0, 0, 180, 0);
    gSpine.addColorStop(0, "rgba(65, 45, 18, 0.36)");
    gSpine.addColorStop(0.3, "rgba(65, 45, 18, 0.14)");
    gSpine.addColorStop(1, "rgba(65, 45, 18, 0)");
    ctx.fillStyle = gSpine;
    ctx.fillRect(0, 0, 180, H);

    // Subtle edge shadow on right edge
    const gEdge = ctx.createLinearGradient(W, 0, W - 50, 0);
    gEdge.addColorStop(0, "rgba(100, 75, 35, 0.12)");
    gEdge.addColorStop(1, "rgba(100, 75, 35, 0)");
    ctx.fillStyle = gEdge;
    ctx.fillRect(W - 50, 0, 50, H);
  } else {
    // Spine shadow on right edge
    const gSpine = ctx.createLinearGradient(W, 0, W - 180, 0);
    gSpine.addColorStop(0, "rgba(65, 45, 18, 0.36)");
    gSpine.addColorStop(0.3, "rgba(65, 45, 18, 0.14)");
    gSpine.addColorStop(1, "rgba(65, 45, 18, 0)");
    ctx.fillStyle = gSpine;
    ctx.fillRect(W - 180, 0, 180, H);

    // Subtle edge shadow on left edge
    const gEdge = ctx.createLinearGradient(0, 0, 50, 0);
    gEdge.addColorStop(0, "rgba(100, 75, 35, 0.12)");
    gEdge.addColorStop(1, "rgba(100, 75, 35, 0)");
    ctx.fillStyle = gEdge;
    ctx.fillRect(0, 0, 50, H);
  }

  const pages = (story && story.pages) || [];
  const isDedication = pageIndex < 0;
  const isEnd = pageIndex >= pages.length;

  if (isDedication) {
    // Inside cover / Dedication & Title Spread
    ctx.strokeStyle = "rgba(180, 140, 80, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.strokeRect(68, 68, W - 136, H - 136);

    ctx.fillStyle = "#3d2f22";
    ctx.textAlign = "center";
    ctx.font = "bold 52px 'Noto Serif SC', 'Songti SC', 'STSong', serif";
    ctx.fillText(story ? story.title : "一一与芽芽兽绘本", W / 2, 480);

    ctx.font = "500 32px 'Noto Serif SC', 'Songti SC', serif";
    ctx.fillStyle = "#8a755d";
    ctx.fillText(story ? (story.subtitle || "成长伴读绘本") : "成长伴读绘本", W / 2, 560);

    ctx.font = "36px serif";
    ctx.fillStyle = "#c5a880";
    ctx.fillText("✦ · ✧ · ✦", W / 2, 650);

    ctx.font = "italic 32px 'Noto Serif SC', 'Songti SC', serif";
    ctx.fillStyle = "#6a5744";
    ctx.fillText("献给最珍贵的一一与芽芽兽", W / 2, 770);
    ctx.fillText("愿每一个成长的瞬间，都被温暖珍藏。", W / 2, 830);

    ctx.font = "24px 'Fredoka', 'Noto Serif SC', sans-serif";
    ctx.fillStyle = "#a89070";
    ctx.fillText("· 扉页 ·", W / 2, H - 70);
  } else if (isEnd) {
    // End of book congratulations spread
    ctx.strokeStyle = "rgba(180, 140, 80, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, W - 120, H - 120);

    ctx.fillStyle = "#3d2f22";
    ctx.textAlign = "center";
    ctx.font = "bold 58px 'Noto Serif SC', 'Songti SC', 'STSong', serif";
    ctx.fillText("全 书 完", W / 2, 490);

    ctx.font = "42px 'Fredoka', sans-serif";
    ctx.fillStyle = "#d49a38";
    ctx.fillText("★ ★ ★ ★ ★", W / 2, 580);

    ctx.font = "500 34px 'Noto Serif SC', 'Songti SC', serif";
    ctx.fillStyle = "#6a5744";
    ctx.fillText("恭喜读完全部绘本故事！", W / 2, 680);
    ctx.fillText("宝宝又收获了新的一天成长 ✨", W / 2, 750);

    ctx.font = "24px 'Fredoka', 'Noto Serif SC', sans-serif";
    ctx.fillStyle = "#a89070";
    ctx.fillText("· 完 ·", W / 2, H - 70);
  } else if (pages[pageIndex]) {
    const page = pages[pageIndex];

    // Find image element
    let img = null;
    const candidates = [page.id, `page-${pageIndex + 1}`, page.scene, "cover"];
    for (const key of candidates) {
      if (artTextures && artTextures[key] && artTextures[key].texture && artTextures[key].texture.image) {
        img = artTextures[key].texture.image;
        break;
      }
    }

    const marginSide = 64;
    const marginTop = 64;
    const availW = W - marginSide * 2;
    const maxImgH = 740;

    let imgX = marginSide;
    let imgY = marginTop;
    let imgW = availW;
    let imgH = maxImgH;

    if (img && (img.naturalWidth || img.width)) {
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      const aspect = nw / nh;
      imgW = availW;
      imgH = imgW / aspect;
      if (imgH > maxImgH) {
        imgH = maxImgH;
        imgW = imgH * aspect;
      }
      imgX = (W - imgW) / 2;

      // Soft drop shadow behind painting
      ctx.save();
      ctx.shadowColor = "rgba(60, 40, 15, 0.16)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#f5efe6";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(imgX, imgY, imgW, imgH, 16);
      else ctx.rect(imgX, imgY, imgW, imgH);
      ctx.fill();
      ctx.restore();

      // Clip with rounded corners and draw the painting
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(imgX, imgY, imgW, imgH, 16);
      else ctx.rect(imgX, imgY, imgW, imgH);
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, imgW, imgH);
      // Delicate 1px frame
      ctx.strokeStyle = "rgba(0, 0, 0, 0.07)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Delicate paper framing rule
    ctx.strokeStyle = "rgba(180, 140, 80, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(32, 32, W - 64, H - 64);

    // Story Chinese Text Section below painting
    const textStartY = imgY + imgH + 48;
    const lines = formatStoryLines(page.text);

    ctx.fillStyle = "#18120c"; // deep warm ink
    ctx.textAlign = "center";
    ctx.font = "bold 44px 'Noto Serif SC', 'Songti SC', 'STSong', 'KaiTi', 'Source Han Serif CN', serif";

    const lineHeight = 76;
    const totalTextH = lines.length * lineHeight;
    const remainAreaTop = textStartY;
    const remainAreaBottom = H - 90;
    const centerTextY = remainAreaTop + Math.max(0, (remainAreaBottom - remainAreaTop - totalTextH) / 2);

    lines.forEach((line, idx) => {
      ctx.fillText(line, W / 2, centerTextY + idx * lineHeight + 44);
    });

    // Page Number
    ctx.font = "600 26px 'Fredoka', 'Noto Serif SC', sans-serif";
    ctx.fillStyle = "#a89070";
    const pageNumStr = `· 第 ${pageIndex + 1} 页 ·`;
    if (side === "right") {
      ctx.textAlign = "right";
      ctx.fillText(pageNumStr, W - 64, H - 54);
    } else {
      ctx.textAlign = "left";
      ctx.fillText(pageNumStr, 64, H - 54);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class Book {
  constructor({ story = null, artTextures = null, coverTexture, paperImage, clothTexture, edgesTexture, paperNormal, sheets, clothColor = 0x1b2450, endpaper = {} }) {
    this.sheets = sheets;
    this.group = new THREE.Group();
    this.story = story;
    this.artTextures = artTextures || {};
    this.isSpreadMode = !!(story && (story.series === 'yiyi' || story.series === 'yayashou' || story.spreadMode));
    this.spreadCache = new Map();
    this.paperImage = paperImage;
    this.paperNormal = paperNormal || null;
    this.turned = 0;
    this.resting = 0; // sheets lying on the left cover (a page still in the air is not one of them)
    this.openAmount = 0;
    this.flip = null;
    this.opening = null;

    if (clothTexture) { clothTexture.colorSpace = THREE.SRGBColorSpace; }
    const clothMap = clothTexture ? prepRepeat(clothTexture, 5, 6.5) : null;
    const clothBump = clothTexture ? prepRepeat(clothTexture, 6, 7.8) : null;
    const clothTint = new THREE.Color(clothColor);
    const cloth = new THREE.MeshPhysicalMaterial({
      color: clothTint,
      map: clothMap,
      bumpMap: clothMap,
      bumpScale: clothMap ? 0.014 : 0,
      roughness: 0.9,
      sheen: 0.55,
      sheenRoughness: 0.65,
      sheenColor: clothTint.clone().lerp(new THREE.Color(0xffffff), 0.45),
      envMapIntensity: 0.7,
    });
    const clothBoth = cloth.clone();
    clothBoth.side = THREE.DoubleSide;
    const inside = new THREE.MeshStandardMaterial({ map: endpaperTexture(endpaper), roughness: 0.95, side: THREE.DoubleSide });
    if (paperNormal) { inside.normalMap = prepRepeat(paperNormal, 2, 2.6); inside.normalScale.set(0.7, 0.7); }
    const lining = new THREE.MeshStandardMaterial({ color: 0xcdb48c, roughness: 0.97 });
    // a book whose cover art has not arrived yet still opens (the cloth shows through)
    if (coverTexture) { coverTexture.colorSpace = THREE.SRGBColorSpace; coverTexture.anisotropy = 8; }
    // printed, lightly laminated cover: catches the lamp with a soft, textured sheen
    const coverArt = new THREE.MeshPhysicalMaterial({ map: coverTexture, roughness: 0.58, metalness: 0.02, bumpMap: clothBump, bumpScale: clothBump ? 0.012 : 0, envMapIntensity: 0.9, clearcoat: 0.35, clearcoatRoughness: 0.45, specularIntensity: 0.8 });
    this.materials = { cloth, inside, lining, coverArt };

    const boardW = PAGE_W - BOARD_X0 + SQUARE + 0.006; // spine edge at BOARD_X0, a small square past the fore-edge
    const boardD = PAGE_H + SQUARE * 2;
    this.boardW = boardW;
    this.boardD = boardD;
    const boardGeo = new RoundedBoxGeometry(boardW, BOARD, boardD, 4, 0.006);

    // back board, lying on the table
    const back = new THREE.Mesh(boardGeo, [cloth, cloth, inside, cloth, cloth, cloth]);
    back.position.set(BOARD_X0 + boardW / 2, BOARD / 2, 0);
    back.castShadow = true;
    back.receiveShadow = true;
    this.group.add(back);
    this.back = back;

    // spine: a vertical cloth wall beside the block, back board + block tall; the top 3 cm is the
    // flexible hinge that carries the front board
    const strip = new THREE.Mesh(new THREE.BoxGeometry(STRIP_T, STRIP_H, boardD), [lining, cloth, cloth, cloth, cloth, cloth]);
    strip.position.set(STRIP_X + STRIP_T / 2, STRIP_H / 2, 0);
    strip.castShadow = true;
    strip.receiveShadow = true;
    this.group.add(strip);
    this.spine = strip;

    // hinge cloth between the back board and the spine, flat on the table (under the block)
    const bottomHinge = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_X0 - STRIP_X, boardD).rotateX(-Math.PI / 2), cloth);
    bottomHinge.position.set((STRIP_X + BOARD_X0) / 2, 0.0006, 0);
    this.group.add(bottomHinge);

    // the front board hangs from the top outer corner of the spine
    this.hinge = new THREE.Vector3(STRIP_X, STRIP_H, 0);
    this.frontJoint = new THREE.Group();
    this.frontJoint.position.copy(this.hinge);
    this.group.add(this.frontJoint);
    const front = new THREE.Mesh(boardGeo, [cloth, cloth, coverArt, inside, cloth, cloth]);
    front.position.set(JOINT + boardW / 2, BOARD / 2, 0);
    front.castShadow = true;
    front.receiveShadow = true;
    this.frontJoint.add(front);
    this.front = front;
    // outer cloth of the joint: up the last 3 cm of the spine, then across to the board
    const jointUp = new THREE.Mesh(new THREE.PlaneGeometry(boardD, BOARD).rotateY(-Math.PI / 2), clothBoth);
    jointUp.position.set(0, BOARD / 2, 0);
    const jointTop = new THREE.Mesh(new THREE.PlaneGeometry(JOINT, boardD).rotateX(-Math.PI / 2), clothBoth);
    jointTop.position.set(JOINT / 2, BOARD, 0);
    // inner hinge: the endpaper runs from the spine across the joint onto the board
    const jointInner = new THREE.Mesh(new THREE.PlaneGeometry(JOINT, boardD).rotateX(-Math.PI / 2), inside);
    jointInner.position.set(JOINT / 2, 0.0008, 0);
    this.frontJoint.add(jointUp, jointTop, jointInner);
    for (const m of [jointUp, jointTop, jointInner]) { m.receiveShadow = true; }

    // how far the cover slopes when open: its far corner rests on the table
    const L = JOINT + boardW;
    let sigma = Math.asin((STRIP_H - BOARD) / L);
    for (let i = 0; i < 6; i++) sigma = Math.asin((STRIP_H - BOARD * Math.cos(sigma)) / L);
    this.sigma = sigma;
    this.openAngle = Math.PI + sigma;

    // page block: the right slab on the back board, the left slab on the sloping cover, and a
    // wall of folds at the spine between them
    const edgesMap = edgesTexture ? prepRepeat(edgesTexture, 2.5, 0.42) : null;
    if (edgesTexture) edgesTexture.colorSpace = THREE.SRGBColorSpace;
    const edgeMat = new THREE.MeshStandardMaterial({ color: edgesMap ? 0xd8c9ab : 0xdccaa8, map: edgesMap, roughness: 0.96 });
    const edgeMatZ = edgesMap ? new THREE.MeshStandardMaterial({ color: 0xd8c9ab, map: prepRepeat(edgesTexture, 1.9, 0.42), roughness: 0.96 }) : edgeMat;
    const under = new THREE.MeshStandardMaterial({ color: 0xd9c9a9, roughness: 1 });
    const foldFace = new THREE.MeshStandardMaterial({ color: 0xcfbd9a, roughness: 1 });
    const blockGeo = new THREE.BoxGeometry(1, 1, PAGE_H);
    this.rightBlock = new THREE.Mesh(blockGeo, [edgeMat, foldFace, under, under, edgeMatZ, edgeMatZ]);
    this.rightBlock.receiveShadow = true;
    this.rightBlock.castShadow = true;
    this.group.add(this.rightBlock);

    // the top sheet on the right carries the page content / spread
    const initRightTex = this.isSpreadMode ? this.getSpreadTexture(0, "right") : pageTexture(paperImage, null, "right");
    const initLeftTex = this.isSpreadMode ? this.getSpreadTexture(-1, "left") : pageTexture(paperImage, null, "left");
    this.rightTop = this.paperMaterial(initRightTex, THREE.DoubleSide);
    this.leftTop = this.paperMaterial(initLeftTex, THREE.DoubleSide);
    this.rightSheet = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H).rotateX(-Math.PI / 2), this.rightTop);
    this.rightSheet.receiveShadow = true;
    this.rightSheet.castShadow = true;
    this.group.add(this.rightSheet);

    // the turned pages: one continuous stack that rises from the fold, rolls over a rounded
    // shoulder at the spine and lies down the sloping cover (rebuilt whenever a page turns)
    // body: a standard extrusion of the cross-section (caps = page edges, sides = cream);
    // the top page is its own smooth strip with the page texture
    this.stackMaterials = [edgeMatZ, under];
    this.leftStack = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), this.stackMaterials);
    this.leftStack.receiveShadow = true;
    this.leftStack.castShadow = true;
    this.leftStack.frustumCulled = false;
    this.leftSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), this.leftTop);
    this.leftSheet.receiveShadow = true;
    this.leftSheet.castShadow = false; // the body casts; a sheet a millimetre above it would only self-shadow
    this.leftSheet.frustumCulled = false;
    this.group.add(this.leftStack, this.leftSheet);
    this.leftProfile = { pts: [], cum: [], top: STRIP_H };

    // flipping page
    this.flipGeometry = new THREE.BufferGeometry();
    const verts = new Float32Array((SEGX + 1) * (SEGZ + 1) * 3);
    const uvs = new Float32Array((SEGX + 1) * (SEGZ + 1) * 2);
    const index = [];
    for (let j = 0; j <= SEGZ; j++) {
      for (let i = 0; i <= SEGX; i++) {
        const k = j * (SEGX + 1) + i;
        uvs[k * 2] = i / SEGX;
        uvs[k * 2 + 1] = 1 - j / SEGZ;
        if (i < SEGX && j < SEGZ) {
          const a = k, b = k + 1, c = k + SEGX + 1, d = k + SEGX + 2;
          index.push(a, c, b, b, c, d);
        }
      }
    }
    this.flipGeometry.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    this.flipGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    this.flipGeometry.setIndex(index);
    const initFlipFrontTex = this.isSpreadMode ? this.getSpreadTexture(0, "right") : pageTexture(paperImage, null, "right");
    const initFlipBackTex = this.isSpreadMode ? this.getSpreadTexture(0, "left") : pageTexture(paperImage, null, "left");
    this.flipFront = this.paperMaterial(initFlipFrontTex, THREE.FrontSide);
    this.flipBack = this.paperMaterial(initFlipBackTex, THREE.BackSide);
    this.flipMeshA = new THREE.Mesh(this.flipGeometry, this.flipFront);
    this.flipMeshB = new THREE.Mesh(this.flipGeometry, this.flipBack);
    this.flipMeshA.castShadow = true;
    this.flipMeshB.castShadow = true;
    this.flipMeshA.frustumCulled = this.flipMeshB.frustumCulled = false;
    this.flipMeshA.visible = this.flipMeshB.visible = false;
    this.group.add(this.flipMeshA, this.flipMeshB);

    this.leftAnchor = new THREE.Group();
    this.rightAnchor = new THREE.Group();
    this.spreadAnchor = new THREE.Group();
    this.group.add(this.leftAnchor, this.rightAnchor, this.spreadAnchor);

    // soft contact shadow on the table
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.8 });
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMat);
    this.contact.position.y = 0.0004;
    this.contact.renderOrder = -1;
    this.group.add(this.contact);

    this.pageNumbers = { left: null, right: null };
    this.layout();
    this.setOpen(0);
  }

  paperMaterial(map, side = THREE.FrontSide) {
    const matColor = this.isSpreadMode ? 0xffffff : 0xe6d8bd;
    const m = new THREE.MeshStandardMaterial({ map, color: matColor, roughness: 0.94, metalness: 0, side, envMapIntensity: 0.35 });
    if (this.paperNormal) { m.normalMap = prepRepeat(this.paperNormal, 1.6, 2.1); m.normalScale.set(1.1, 1.1); }
    return m;
  }

  getSpreadTexture(pageIndex, side = "right") {
    const key = `${pageIndex}_${side}`;
    if (this.spreadCache.has(key)) return this.spreadCache.get(key);
    const tex = renderSpreadCanvasTexture({
      story: this.story,
      artTextures: this.artTextures,
      paperImage: this.paperImage,
      pageIndex,
      side
    });
    this.spreadCache.set(key, tex);
    return tex;
  }

  layout() {
    const total = Math.max(1, this.sheets);
    const leftFrac = this.turned / total;
    const lh = Math.max(0.003, BLOCK * leftFrac);
    const rh = Math.max(0.003, BLOCK * (1 - leftFrac));
    this.lh = lh;
    this.rh = rh;
    this.rightTopY = BOARD + rh;
    this.leftTopY = STRIP_H + lh;
    this.foldY = BOARD + rh + 0.0015;

    // right slab on the back board, its spine face at x = 0
    this.rightBlock.scale.set(PAGE_W, rh, 1);
    this.rightBlock.position.set(PAGE_W / 2, BOARD + rh / 2, 0);
    this.rightSheet.position.set(PAGE_W / 2, BOARD + rh + 0.0012, 0);

    if (!this.flip) this.resting = this.turned;
    if (this.openAmount > 0.95) this.buildLeftStack();
    // nothing turned yet: the inside of the cover shows, no page on it
    const showLeft = this.openAmount > 0.95 && this.resting > 0;
    this.leftStack.visible = showLeft;
    this.leftSheet.visible = showLeft;

    this.rightAnchor.position.set(PAGE_W / 2, BOARD + rh + 0.002, 0);
    this.leftAnchor.position.set(-PAGE_W / 2, this.leftProfile.top + 0.002, 0);
    this.spreadAnchor.position.set(0, this.foldY, 0);
  }

  /** Build the turned-pages stack: a closed cross-section (top page, fore-edge, underside, inner
      face) extruded along the page height, with caps at head and tail. */
  buildLeftStack() {
    const total = Math.max(1, this.sheets);
    // where the turning page lands: the top of the stack once it has arrived (this.turned)
    this.leftProfile = this.leftProfileFor(this.lh);
    // what lies there now: the sheets at rest (this.resting), which lag one behind during a flip
    const shown = this.resting === this.turned ? this.leftProfile : this.leftProfileFor(Math.max(0.003, BLOCK * this.resting / total));
    this.buildLeftGeometry(shown);
  }

  /** Cross-section of a turned-pages stack of thickness `lh`: the top polyline (fold, vertical
      rise, rounded shoulder, slope down the cover), its cumulative length, and the closed outline. */
  leftProfileFor(lh) {
    const rh = this.rh, sig = this.sigma;
    const x0 = -0.003;                                  // the folds sit just inside the spine
    const y0 = BOARD + rh + 0.0012;                     // fold height: top of the right block
    const thick = lh + 0.0015;
    const yTop = STRIP_H + thick * Math.cos(sig);       // stack top where it crosses the spine
    let r = THREE.MathUtils.clamp(lh * 0.9 + 0.008, 0.008, 0.032);
    if (yTop - r < y0) r = Math.max(0.002, yTop - y0);
    const top = [[x0, y0]];
    const vertLen = Math.max(0, yTop - r - y0);
    if (vertLen > 0) top.push([x0, y0 + vertLen]);
    const cx = x0 - r, cy = yTop - r;
    const N = 10;
    for (let i = 1; i <= N; i++) { const a = (i / N) * Math.PI / 2; top.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    const arc = vertLen + (Math.PI / 2) * r;
    const slopeLen = Math.max(0.3, PAGE_W - arc);
    const [ex, ey] = top[top.length - 1];
    const dx = -Math.cos(sig), dy = -Math.sin(sig);
    const M = 8;
    for (let i = 1; i <= M; i++) top.push([ex + dx * slopeLen * (i / M), ey + dy * slopeLen * (i / M)]);
    // cumulative arc length along the top (for the turning page to land on)
    const cum = [0];
    for (let i = 1; i < top.length; i++) cum.push(cum[i - 1] + Math.hypot(top[i][0] - top[i - 1][0], top[i][1] - top[i - 1][1]));
    // the rest of the outline: fore-edge down to the cover, back along the cover to the hinge
    // (no needle-thin slivers: a zero-area triangle shades to NaN and the bloom smears it into a black block)
    const D = top[top.length - 1];
    const E = [D[0] + Math.sin(sig) * thick, D[1] - Math.cos(sig) * thick];
    const H = [STRIP_X, STRIP_H];
    return { pts: top, cum, top: yTop, outline: [...top, E, H] };
  }

  /** Rebuild the stack meshes (top sheet strip + extruded body) from a profile. */
  buildLeftGeometry({ pts: top, cum, outline }) {
    const hz = PAGE_H / 2;
    // top page strip (smooth, u runs from the fore-edge (0) to the fold (1) like the left page texture)
    {
      const n = top.length;
      const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
      for (let i = 0; i < n; i++) {
        const u = 1 - cum[i] / PAGE_W;
        // lift the sheet off the body along the local outward normal (not just upward), so the
        // vertical part of the shoulder never shares a plane with the body and z-fights
        const p0 = top[Math.max(0, i - 1)], p1 = top[Math.min(n - 1, i + 1)];
        let tx = p1[0] - p0[0], ty = p1[1] - p0[1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const ox = ty * 0.0014, oy = -tx * 0.0014;
        for (let j = 0; j < 2; j++) {
          const k = i * 2 + j;
          pos[k * 3] = top[i][0] + ox; pos[k * 3 + 1] = top[i][1] + oy; pos[k * 3 + 2] = j === 0 ? hz : -hz;
          uv[k * 2] = u; uv[k * 2 + 1] = j === 0 ? 0 : 1;
        }
        if (i < n - 1) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      fixNormals(g);
      const old = this.leftSheet.geometry;
      this.leftSheet.geometry = g;
      if (old) old.dispose();
    }
    // body: extrude the closed cross-section along the page height
    {
      const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
      const body = new THREE.ExtrudeGeometry(shape, { depth: PAGE_H, bevelEnabled: false, curveSegments: 1, steps: 1 });
      body.translate(0, 0, -hz);
      body.computeVertexNormals();
      fixNormals(body);
      const old = this.leftStack.geometry;
      this.leftStack.geometry = body;
      if (old) old.dispose();
    }
  }

  /** Group-space point on the turned-pages stack at distance u (0..1) from the fold. */
  landingLeft(u, out) {
    const { pts, cum } = this.leftProfile;
    if (!pts.length) return out.set(-u * PAGE_W, STRIP_H, 0);
    const s = u * PAGE_W;
    let i = 1;
    while (i < pts.length - 1 && cum[i] < s) i++;
    const s0 = cum[i - 1], s1 = cum[i];
    const t = s1 > s0 ? THREE.MathUtils.clamp((s - s0) / (s1 - s0), 0, 1) : 0;
    const x = THREE.MathUtils.lerp(pts[i - 1][0], pts[i][0], t);
    const y = THREE.MathUtils.lerp(pts[i - 1][1], pts[i][1], t);
    // a hair above the surface, pushed out along the segment normal
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    const len = Math.hypot(dx, dy) || 1;
    return out.set(x + (dy / len) * 0.002, y - (dx / len) * 0.002, 0);
  }

  /** World-space x of the middle of the right page (the camera follows it). */
  get pageCenterX() { return this.group.position.x + PAGE_W / 2; }

  setPageNumbers(left, right) {
    if (this.isSpreadMode && this.story) {
      const currentIndex = right != null ? Math.round((right - 2) / 2) : (this.story.pages ? this.story.pages.length : 0);
      const leftIndex = currentIndex > 0 ? currentIndex - 1 : -1;
      this.leftTop.map = this.getSpreadTexture(leftIndex, "left");
      this.leftTop.needsUpdate = true;
      this.rightTop.map = this.getSpreadTexture(currentIndex, "right");
      this.rightTop.needsUpdate = true;
      this.pageNumbers = { left, right };
      return;
    }
    if (left !== this.pageNumbers.left) {
      this.leftTop.map = pageTexture(this.paperImage, left, "left");
      this.leftTop.needsUpdate = true;
    }
    if (right !== this.pageNumbers.right) {
      this.rightTop.map = pageTexture(this.paperImage, right, "right");
      this.rightTop.needsUpdate = true;
    }
    this.pageNumbers = { left, right };
  }

  setOpen(amount) {
    this.openAmount = amount;
    this.frontJoint.rotation.z = this.openAngle * amount;
    this.group.position.x = -PAGE_W / 2 * (1 - amount);
    // contact shadow follows the footprint
    const x0 = THREE.MathUtils.lerp(STRIP_X, STRIP_X - JOINT - this.boardW, Math.max(0, (amount - 0.55) / 0.45));
    const x1 = BOARD_X0 + this.boardW;
    const pad = 0.2;
    this.contact.scale.set(x1 - x0 + pad * 2, 1, this.boardD + pad * 2);
    this.contact.position.x = (x0 + x1) / 2;
    this.layout();
  }

  open(duration = 2.1) {
    return new Promise((resolve) => { this.opening = { from: this.openAmount, to: 1, t: 0, duration, resolve }; });
  }

  close(duration = 1.6) {
    return new Promise((resolve) => { this.opening = { from: this.openAmount, to: 0, t: 0, duration, resolve }; });
  }

  turn(dir = 1, { frontNumber, backNumber, duration = 1.3 } = {}) {
    if (this.flip) return Promise.resolve(false);
    if (dir > 0 && this.turned >= this.sheets) return Promise.resolve(false);
    if (dir < 0 && this.turned <= 0) return Promise.resolve(false);
    if (this.isSpreadMode && this.story) {
      const cur = this.turned;
      if (dir > 0) {
        this.flipFront.map = this.getSpreadTexture(cur, "right");
        this.flipBack.map = this.getSpreadTexture(cur, "left");
      } else {
        this.flipFront.map = this.getSpreadTexture(cur - 1, "right");
        this.flipBack.map = this.getSpreadTexture(cur - 1, "left");
      }
      this.flipFront.needsUpdate = true;
      this.flipBack.needsUpdate = true;
    } else {
      if (frontNumber !== undefined) { this.flipFront.map = pageTexture(this.paperImage, frontNumber, "right"); this.flipFront.needsUpdate = true; }
      if (backNumber !== undefined) { this.flipBack.map = pageTexture(this.paperImage, backNumber, "left"); this.flipBack.needsUpdate = true; }
    }
    return new Promise((resolve) => {
      this.flip = { dir, t: 0, duration, resolve };
      this.flipMeshA.visible = this.flipMeshB.visible = true;
      const before = this.turned;
      if (dir > 0) this.turned = Math.min(this.sheets, this.turned + 1);
      else this.turned = Math.max(0, this.turned - 1);
      // forward: the page in the air joins the left stack only when it lands; back: it lifts off at once
      this.resting = dir > 0 ? before : this.turned;
      this.layout();
      this.deform(dir > 0 ? 0 : Math.PI);
    });
  }

  /** Bend the turning page: a curl about the fold; as it comes down on the left it climbs the
      fold wall and settles onto the sloping stack. */
  deform(theta) {
    const pos = this.flipGeometry.attributes.position.array;
    const k = 0.62;
    const s = Math.sin(theta);
    const ks = k * s;
    const half = Math.max(0, (theta - Math.PI / 2) / (Math.PI / 2));
    const climb = half * half * (3 - 2 * half);
    const wallTop = this.leftProfile.top + 0.0035;
    const pivotY = this.foldY + (wallTop - this.foldY) * climb;
    const settle = Math.pow(Math.max(0, (theta - Math.PI * 0.62) / (Math.PI * 0.38)), 2);
    const target = _tmpA;
    for (let j = 0; j <= SEGZ; j++) {
      const z = (0.5 - j / SEGZ) * PAGE_H;
      for (let i = 0; i <= SEGX; i++) {
        const u = i / SEGX;
        let x, y;
        if (Math.abs(ks) < 1e-4) {
          x = PAGE_W * u * Math.cos(theta);
          y = PAGE_W * u * Math.sin(theta);
        } else {
          const a = theta + ks * u;
          x = (PAGE_W * (Math.sin(a) - Math.sin(theta))) / ks;
          y = (-PAGE_W * (Math.cos(a) - Math.cos(theta))) / ks;
        }
        y += Math.sin(Math.min(Math.PI, theta)) * 0.012;
        let px = x, py = pivotY + y;
        if (settle > 0) {
          this.landingLeft(u, target);
          px = THREE.MathUtils.lerp(px, target.x, settle);
          py = THREE.MathUtils.lerp(py, target.y, settle);
        }
        const idx = (j * (SEGX + 1) + i) * 3;
        pos[idx] = px;
        pos[idx + 1] = py;
        pos[idx + 2] = z;
      }
    }
    this.flipGeometry.attributes.position.needsUpdate = true;
    this.flipGeometry.computeVertexNormals();
    this.flipGeometry.computeBoundingSphere();
  }

  get busy() {
    return !!this.flip || !!this.opening;
  }

  /** 0..1 progress of the current flip, for camera bobs and sound timing. */
  get flipProgress() {
    return this.flip ? Math.min(1, this.flip.t / this.flip.duration) : 0;
  }

  update(dt) {
    if (this.opening) {
      const o = this.opening;
      o.t += dt;
      const p = Math.min(1, o.t / o.duration);
      this.setOpen(THREE.MathUtils.lerp(o.from, o.to, easeInOut(p)));
      if (p >= 1) { this.opening = null; o.resolve(); }
    }
    if (this.flip) {
      const f = this.flip;
      f.t += dt;
      const p = Math.min(1, f.t / f.duration);
      const e = easeInOut(p);
      const theta = f.dir > 0 ? e * Math.PI : (1 - e) * Math.PI;
      this.deform(theta);
      if (p >= 1) {
        this.flipMeshA.visible = this.flipMeshB.visible = false;
        this.flip = null;
        this.resting = this.turned;
        this.layout();
        f.resolve(true);
      }
    }
  }
}

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();

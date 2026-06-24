import { useState, useRef, useEffect, useCallback } from "react";

// ---------- Константы ----------
const W = 1080;
const H = 1350;
const PAD = 110;
const STORAGE_KEY = "carousel-state-v5";
const GOLD_DEFAULT = "#D8BC74";
// Текущий акцент (золото по умолчанию). Меняется перед отрисовкой слайда.
let GOLD = GOLD_DEFAULT;
let GOLD_SOFT = "rgba(216,188,116,0.9)";
function hexToRgba(hex, a) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}
function setAccent(hex) {
  GOLD = hex || GOLD_DEFAULT;
  GOLD_SOFT = hexToRgba(GOLD, 0.9);
}

const THEMES = [
  { id: "notebook", name: "Блокнот", dark: false, notebook: true, bgTop: "#FCFBF7", bgBottom: "#F1EEE4", text: "#2A2824", muted: "rgba(42,40,36,0.5)", font: "Georgia, serif", serif: true },
  { id: "malachite", name: "Малахит", dark: true, bgTop: "#16604A", bgBottom: "#06231A", text: "#F2EFE6", muted: "rgba(242,239,230,0.55)", font: "Georgia, serif", serif: true },
  { id: "paper", name: "Бумага", dark: false, bgTop: "#FBF9F4", bgBottom: "#E8E0CF", text: "#23211D", muted: "rgba(35,33,29,0.55)", font: "Georgia, serif", serif: true },
  { id: "powder", name: "Пудра", dark: false, bgTop: "#F7EDE8", bgBottom: "#E7D2C8", text: "#4A3A33", muted: "rgba(74,58,51,0.5)", font: "Georgia, serif", serif: true },
  { id: "sage", name: "Шалфей", dark: false, bgTop: "#EEF1E8", bgBottom: "#D2DAC4", text: "#3A4233", muted: "rgba(58,66,51,0.5)", font: '"Segoe UI", Arial, sans-serif', serif: false },
  { id: "mist", name: "Туман", dark: false, bgTop: "#EEF1F4", bgBottom: "#CDD6DE", text: "#2E3A42", muted: "rgba(46,58,66,0.5)", font: '"Segoe UI", Arial, sans-serif', serif: false },
  { id: "sand", name: "Песок", dark: false, bgTop: "#F7F2E9", bgBottom: "#E5D8C0", text: "#4A4233", muted: "rgba(74,66,51,0.5)", font: "Georgia, serif", serif: true },
  { id: "sky", name: "Небо", dark: false, bgTop: "#F4F8FE", bgBottom: "#CCDDF4", text: "#15263F", muted: "rgba(21,38,63,0.55)", font: '"Segoe UI", Arial, sans-serif', serif: false },
];

const PATTERNS = [
  { id: "smoke", name: "Дымка" },
  { id: "bolts", name: "Молнии" },
  { id: "marble", name: "Разводы" },
  { id: "none", name: "Чисто" },
];

const FONTS = [
  { id: "theme", name: "Как в теме" },
  { id: "sans", name: "Без засечек", font: '"Segoe UI", Arial, sans-serif', serif: false },
  { id: "serif", name: "С засечками", font: "Georgia, serif", serif: true },
  { id: "mono", name: "Моноширинный", font: '"Courier New", monospace', serif: false },
  { id: "round", name: "Округлый", font: '"Trebuchet MS", "Segoe UI", sans-serif', serif: false },
];

// Тёмность цвета (для авто-градиента из одного цвета): возвращает hex чуть темнее
function darkenHex(hex, amount) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const f = (v) => Math.max(0, Math.round(v * (1 - amount))).toString(16).padStart(2, "0");
  return "#" + f(r) + f(g) + f(b);
}
function isLightHex(hex) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

// ---------- ZIP ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, f.data.length, true);
    lh.setUint32(22, f.data.length, true);
    lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, f.data.length, true);
    ch.setUint32(24, f.data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(eocd.buffer)], { type: "application/zip" });
}

function dataURLtoBytes(u) {
  const b = atob(u.split(",")[1]);
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- Разбивка текста ----------
function splitTextSimple(raw, targetSlides = 7) {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return [];
  let parts = text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  for (const p of parts) {
    if (p.length <= 340) {
      chunks.push(p);
    } else {
      const sentences = p.match(/[^.!?…]+[.!?…]+["»)]?\s*|[^.!?…]+$/g) || [p];
      let buf = "";
      for (const s of sentences) {
        if ((buf + s).length > 300 && buf) {
          chunks.push(buf.trim());
          buf = s;
        } else {
          buf += s;
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
    }
  }
  let merged = [...chunks];
  while (merged.length > Math.max(targetSlides, 8)) {
    let bestIdx = 0;
    let bestLen = Infinity;
    for (let i = 0; i < merged.length - 1; i++) {
      const len = merged[i].length + merged[i + 1].length;
      if (len < bestLen) {
        bestLen = len;
        bestIdx = i;
      }
    }
    merged.splice(bestIdx, 2, merged[bestIdx] + "\n\n" + merged[bestIdx + 1]);
  }
  return merged;
}

// ---------- Утилиты рисования ----------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapLines(ctx, text, maxWidth) {
  const out = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function fitText(ctx, text, { maxWidth, maxHeight, baseSize, minSize, weight, family, lh = 1.35 }) {
  let size = baseSize;
  while (size > minSize) {
    ctx.font = weight + " " + size + "px " + family;
    const lines = wrapLines(ctx, text, maxWidth);
    const height = lines.length * size * lh;
    if (height <= maxHeight) return { size, lines, lineHeight: size * lh };
    size -= 4;
  }
  ctx.font = weight + " " + minSize + "px " + family;
  return { size: minSize, lines: wrapLines(ctx, text, maxWidth), lineHeight: minSize * lh };
}

function drawNotebook(ctx, theme) {
  // лёгкая бумажная текстура поверх градиента
  const ruleColor = "rgba(120,150,200,0.32)";   // голубые линии
  const marginColor = "rgba(210,120,120,0.45)";  // красная поля-линия
  const lineGap = 92;
  const startY = 250;
  // горизонтальные линии
  ctx.save();
  ctx.strokeStyle = ruleColor;
  ctx.lineWidth = 2;
  for (let y = startY; y < H - 120; y += lineGap) {
    ctx.beginPath();
    ctx.moveTo(150, y);
    ctx.lineTo(W - 70, y);
    ctx.stroke();
  }
  // вертикальная красная линия поля
  ctx.strokeStyle = marginColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(170, 90);
  ctx.lineTo(170, H - 80);
  ctx.stroke();
  ctx.restore();

  // металлическая спираль слева
  const spiralX = 78;
  const rings = 13;
  const ringGap = (H - 120) / rings;
  for (let i = 0; i < rings; i++) {
    const cy = 90 + ringGap * (i + 0.5);
    // отверстие
    ctx.beginPath();
    ctx.arc(spiralX, cy, 15, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fill();
    // виток спирали — дуга с металлическим градиентом
    const g = ctx.createLinearGradient(spiralX - 40, cy - 18, spiralX + 50, cy + 18);
    g.addColorStop(0, "#9a9a9a");
    g.addColorStop(0.45, "#e8e8e8");
    g.addColorStop(0.55, "#f4f4f4");
    g.addColorStop(1, "#8c8c8c");
    ctx.strokeStyle = g;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(spiralX - 34, cy - 16);
    ctx.bezierCurveTo(spiralX + 48, cy - 26, spiralX + 48, cy + 26, spiralX - 34, cy + 16);
    ctx.stroke();
    // блик
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(spiralX - 28, cy - 12);
    ctx.bezierCurveTo(spiralX + 30, cy - 18, spiralX + 30, cy - 4, spiralX + 4, cy - 2);
    ctx.stroke();
  }
}

function drawBackdrop(ctx, theme, seed, pattern, opts) {
  const o = opts || {};
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.bgTop);
  grad.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // фон-блокнот рисуется вместо абстрактных узоров
  if (theme.notebook) {
    drawNotebook(ctx, theme);
    return;
  }

  if (!pattern || pattern === "none") return;

  const rng = mulberry32(seed * 7919 + 13);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (pattern === "bolts") {
    const col = theme.dark ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.09)";
    for (let b = 0; b < 3; b++) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 5 + rng() * 8;
      let x = rng() * W;
      let y = -60;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < H + 60) {
        y += 130 + rng() * 170;
        x += (rng() - 0.5) * 360;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (pattern === "smoke") {
    drawSmoke(ctx, theme, rng, o.smokeSide || "left", o.smokeIntensity == null ? 0.5 : o.smokeIntensity);
  } else if (pattern === "marble") {
    const c = theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    ctx.strokeStyle = c;
    for (let i = 0; i < 8; i++) {
      ctx.lineWidth = 1.5 + rng() * 3.5;
      let x = -60;
      let y = rng() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (x < W + 60) {
        const nx = x + 180 + rng() * 220;
        const ny = y + (rng() - 0.5) * 170;
        ctx.bezierCurveTo(x + 90, y + (rng() - 0.5) * 220, nx - 90, ny + (rng() - 0.5) * 220, nx, ny);
        x = nx;
        y = ny;
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Реалистичный струящийся дым: тонкие изгибающиеся ленты у одного края,
// растворяются к центру. intensity 0..1 — общая видимость (контраст).
function drawSmoke(ctx, theme, rng, side, intensity) {
  const ink = theme.dark ? "255,255,255" : "20,20,20";
  const sign = side === "right" ? -1 : 1;
  const edge = side === "right" ? W : 0;
  const limit = side === "right" ? W * 0.38 : W * 0.62;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ribbons = 4;
  const baseA = (theme.dark ? 0.17 : 0.14) * (0.4 + intensity);

  for (let r = 0; r < ribbons; r++) {
    // базовая ось ленты: медленно дрейфует от края внутрь
    let x = edge + sign * (20 + rng() * 70);
    let y = -60 + rng() * 100;
    // параметры завитков — у каждой ленты свои, чтобы вились по-разному
    const swirlAmp = 70 + rng() * 90;        // размах завитка
    const swirlFreq = 2.2 + rng() * 2.6;     // частота завитков по высоте
    const phase = rng() * Math.PI * 2;
    const drift = 0.18 + rng() * 0.22;       // насколько уходит к центру
    const loopAt = 0.25 + rng() * 0.5;       // где будет петля
    const pts = [];
    const steps = 60;                         // много точек = плавные кудри
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const baseX = x + sign * drift * W * t;
      // основной завиток — синус с нарастающей амплитудой к середине ленты
      const env = Math.sin(t * Math.PI);      // 0 по краям, 1 в центре
      let px = baseX + Math.sin(t * Math.PI * swirlFreq + phase) * swirlAmp * env;
      // добавляем «петлю»: рядом с loopAt лента закручивается колечком
      const dl = t - loopAt;
      if (Math.abs(dl) < 0.12) {
        const loopT = (dl + 0.12) / 0.24;     // 0..1 в зоне петли
        px += sign * Math.sin(loopT * Math.PI * 2) * 55;
      }
      const py = -60 + t * (H + 120) + (Math.abs(dl) < 0.12 ? Math.cos((dl + 0.12) / 0.24 * Math.PI * 2) * 40 : 0);
      // не залезаем за центр
      const cx = side === "right" ? Math.max(px, limit) : Math.min(px, limit);
      pts.push({ x: cx, y: py });
    }
    // несколько проходов разной толщины — объём дыма
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineWidth = (1.5 + pass * 7) + rng() * 5;
      const a = baseA * (pass === 0 ? 1 : 0.45 / pass);
      const gx = ctx.createLinearGradient(edge, 0, edge + sign * W * 0.62, 0);
      gx.addColorStop(0, "rgba(" + ink + "," + a.toFixed(3) + ")");
      gx.addColorStop(0.55, "rgba(" + ink + "," + (a * 0.4).toFixed(3) + ")");
      gx.addColorStop(1, "rgba(" + ink + ",0)");
      ctx.strokeStyle = gx;
      ctx.stroke();
    }
  }
  ctx.restore();
}


// Фото на весь слайд + затемнение, чтобы текст был главнее.
// strength — общая сила (0..1) из ползунка; align — где сидит текст (для усиления затемнения под ним)
function drawPhotoBase(ctx, photo, strength, align, shiftX) {
  const scale = Math.max(W / photo.width, H / photo.height);
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  // shiftX в долях (-1..1): сколько свободного по ширине отдать сдвигу
  const slack = Math.max(0, dw - W);
  const ox = (W - dw) / 2 + (shiftX || 0) * (slack / 2);
  ctx.drawImage(photo, ox, (H - dh) / 2, dw, dh);
  ctx.fillStyle = "rgba(7,8,10," + strength + ")";
  ctx.fillRect(0, 0, W, H);
  const fx = align === "left" ? W * 0.33 : align === "right" ? W * 0.67 : W / 2;
  const rg = ctx.createRadialGradient(fx, H / 2, 80, fx, H / 2, 780);
  rg.addColorStop(0, "rgba(7,8,10,0.45)");
  rg.addColorStop(1, "rgba(7,8,10,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
}

function drawFlourish(ctx, cx, cy, w) {
  const g = ctx.createLinearGradient(cx - w / 2, cy, cx + w / 2, cy);
  g.addColorStop(0, hexToRgba(GOLD, 0));
  g.addColorStop(0.5, GOLD);
  g.addColorStop(1, hexToRgba(GOLD, 0));
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.bezierCurveTo(cx - w / 4, cy - 14, cx - w / 8, cy + 14, cx - 16, cy);
  ctx.moveTo(cx + 16, cy);
  ctx.bezierCurveTo(cx + w / 8, cy - 14, cx + w / 4, cy + 14, cx + w / 2, cy);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx, cy + 8);
  ctx.lineTo(cx - 8, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Шапка: ник с золотой линией слева, счётчик-пилюля справа
function drawHeader(ctx, theme, handle, pos, total, onPhoto) {
  const topColor = onPhoto ? "rgba(255,255,255,0.9)" : theme.text;
  if (handle) {
    const name = (handle.startsWith("@") ? handle : "@" + handle).toUpperCase();
    ctx.font = "600 30px " + theme.font;
    ctx.fillStyle = topColor;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(name, PAD, 128);
    const tw = ctx.measureText(name).width;
    const lineEnd = Math.max(PAD + tw + 60, PAD + 420);
    const g = ctx.createLinearGradient(PAD, 0, lineEnd, 0);
    g.addColorStop(0, GOLD);
    g.addColorStop(1, hexToRgba(GOLD, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(PAD, 152);
    ctx.lineTo(lineEnd, 152);
    ctx.stroke();
  }
  // пилюля-счётчик
  const label = pos + "/" + total;
  ctx.font = "600 32px " + theme.font;
  const lw = ctx.measureText(label).width;
  const pw = lw + 56;
  const px = W - PAD - pw;
  ctx.fillStyle = "rgba(12,12,16,0.55)";
  ctx.beginPath();
  ctx.roundRect(px, 84, pw, 64, 32);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(label, px + 28, 128);
}

// Низ: золотой шеврон справа (счётчик внизу убран — он есть в пилюле сверху)
function drawFooter(ctx, theme, pos, total, onPhoto, isLast) {
  if (isLast) return;
  ctx.strokeStyle = GOLD_SOFT;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const y = H - 104;
  for (let k = 0; k < 2; k++) {
    const x = W - PAD - 44 + k * 32;
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + 20, y);
    ctx.lineTo(x, y + 18);
    ctx.stroke();
  }
}

function drawCenteredBlock(ctx, fit, color, shadow, yShift, align) {
  const a = align || "center";
  const blockH = fit.lines.length * fit.lineHeight;
  let y = (H - blockH) / 2 + fit.size * 0.4 + (yShift || 0);
  let x, anchor;
  if (a === "left") { x = PAD; anchor = "left"; }
  else if (a === "right") { x = W - PAD; anchor = "right"; }
  else { x = W / 2; anchor = "center"; }
  ctx.save();
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 3;
  }
  ctx.fillStyle = color;
  ctx.textAlign = anchor;
  for (const line of fit.lines) {
    ctx.fillText(line, x, y);
    y += fit.lineHeight;
  }
  ctx.restore();
  ctx.textAlign = "left";
  return y;
}

function drawCover(ctx, { photo, headline, handle, theme, pattern, total, darken, smokeIntensity, yShift, textScale, photoShiftX }) {
  const onPhoto = !!photo;
  const ts = textScale || 1;
  if (photo) {
    drawPhotoBase(ctx, photo, darken == null ? 0.42 : darken, "center", photoShiftX);
  } else {
    drawBackdrop(ctx, theme, 1, pattern, { smokeSide: "right", smokeIntensity });
  }
  drawHeader(ctx, theme, handle, 1, total, onPhoto);

  const fit = fitText(ctx, headline || "Заголовок карусели", {
    maxWidth: W - PAD * 2,
    maxHeight: 560,
    baseSize: 84 * ts,
    minSize: 46,
    weight: theme.serif ? "700" : "800",
    family: theme.font,
    lh: 1.22,
  });
  drawCenteredBlock(ctx, fit, onPhoto ? "#FFFFFF" : theme.text, onPhoto, yShift || 0, "center");

  drawFooter(ctx, theme, 1, total, onPhoto, false);
}

function drawContent(ctx, { text, index, total, theme, handle, pattern, photo, darken, smokeIntensity, textScale, photoShiftX }) {
  const onPhoto = !!photo;
  const ts = textScale || 1;
  const side = index % 2 ? "left" : "right"; // дым чередует стороны для разнообразия
  if (photo) {
    drawPhotoBase(ctx, photo, darken == null ? 0.58 : darken, "center", photoShiftX);
  } else {
    drawBackdrop(ctx, theme, index + 2, pattern, { smokeSide: side, smokeIntensity });
  }
  const pos = index + 1;
  drawHeader(ctx, theme, handle, pos, total, onPhoto);

  const fit = fitText(ctx, text, {
    maxWidth: W - PAD * 2,
    maxHeight: H - 600,
    baseSize: 58 * ts,
    minSize: 34,
    weight: theme.serif ? "600" : "700",
    family: theme.font,
    lh: 1.42,
  });
  const yEnd = drawCenteredBlock(ctx, fit, onPhoto ? "#FFFFFF" : theme.text, onPhoto, 0, "center");
  drawFlourish(ctx, W / 2, yEnd + 50, 170);

  drawFooter(ctx, theme, pos, total, onPhoto, false);
}

function drawFinal(ctx, { cta, handle, theme, total, pattern, photo, darken, smokeIntensity, textScale, photoShiftX }) {
  const onPhoto = !!photo;
  const ts = textScale || 1;
  if (photo) {
    drawPhotoBase(ctx, photo, darken == null ? 0.58 : darken, "center", photoShiftX);
  } else {
    drawBackdrop(ctx, theme, 999, pattern, { smokeSide: "left", smokeIntensity });
  }
  drawHeader(ctx, theme, handle, total, total, onPhoto);

  const fit = fitText(ctx, cta || "Сохраните, чтобы вернуться", {
    maxWidth: W - PAD * 2 - 80,
    maxHeight: 420,
    baseSize: 58 * ts,
    minSize: 38,
    weight: theme.serif ? "600" : "700",
    family: theme.font,
    lh: 1.4,
  });
  const blockH = fit.lines.length * fit.lineHeight;
  const top = (H - blockH) / 2;
  drawFlourish(ctx, W / 2, top - 84, 280);
  const textColor = onPhoto ? "#FFFFFF" : theme.text;
  let yEnd = drawCenteredBlock(ctx, fit, textColor, onPhoto, 0);

  if (handle) {
    ctx.save();
    if (onPhoto) {
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = 20;
    }
    ctx.font = "600 34px " + theme.font;
    ctx.fillStyle = GOLD_SOFT;
    ctx.textAlign = "center";
    ctx.fillText(handle.startsWith("@") ? handle : "@" + handle, W / 2, yEnd + 44);
    ctx.textAlign = "left";
    ctx.restore();
    yEnd += 44;
  }
  drawFlourish(ctx, W / 2, yEnd + 84, 280);

  ctx.font = "500 30px " + theme.font;
  ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.65)" : theme.muted;
  ctx.textAlign = "center";
  ctx.fillText("Сохранить  ·  Поделиться  ·  Подписаться", W / 2, H - 92);
  ctx.textAlign = "left";
}

// ---------- Компонент ----------
export default function CarouselGenerator() {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [handle, setHandle] = useState("");
  const [themeId, setThemeId] = useState("malachite");
  const [pattern, setPattern] = useState("smoke");
  const [photoEverywhere, setPhotoEverywhere] = useState(true);
  const [darken, setDarken] = useState(0.5);
  const [coverShift, setCoverShift] = useState(0); // сдвиг заголовка обложки по вертикали, доля высоты (-0.35..0.35)
  const [smokeIntensity, setSmokeIntensity] = useState(0.5);
  const [slideCount, setSlideCount] = useState(7);
  const [accentColor, setAccentColor] = useState(GOLD_DEFAULT);
  const [fontId, setFontId] = useState("theme");
  const [textScale, setTextScale] = useState(1);
  const [photoShiftX, setPhotoShiftX] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dragShift, setDragShift] = useState(null); // временный сдвиг при перетаскивании (доля высоты)
  const [showStyling, setShowStyling] = useState(false);
  const [isMobile] = useState(() => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const [canShareFiles] = useState(() => typeof navigator !== "undefined" && !!navigator.canShare);
  const [photo, setPhoto] = useState(null);
  const [photoSrc, setPhotoSrc] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [slides, setSlides] = useState([]);
  const [imgs, setImgs] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const canvasRefs = useRef([]);
  const fileRef = useRef(null);
  const topRef = useRef(null);

  const baseTheme = THEMES.find((t) => t.id === themeId);
  // эффективная тема с учётом выбранного шрифта
  const theme = (() => {
    let t = { ...baseTheme };
    const f = FONTS.find((x) => x.id === fontId);
    if (f && f.id !== "theme") {
      t.font = f.font;
      t.serif = f.serif;
    }
    return t;
  })();

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res && res.value) {
          const s = JSON.parse(res.value);
          setHeadline(s.headline || "");
          setBody(s.body || "");
          setCta(s.cta || "");
          setHandle(s.handle || "");
          setThemeId(s.themeId || "malachite");
          setPattern(s.pattern || "smoke");
          setPhotoEverywhere(s.photoEverywhere !== false);
          if (s.darken != null) setDarken(s.darken);
          if (s.coverShift != null) setCoverShift(s.coverShift);
          if (s.slideCount) setSlideCount(s.slideCount);
          if (s.accentColor) setAccentColor(s.accentColor);
          if (s.fontId) setFontId(s.fontId);
          if (s.textScale != null) setTextScale(s.textScale);
          if (s.photoShiftX != null) setPhotoShiftX(s.photoShiftX);
          if (s.smokeIntensity != null) setSmokeIntensity(s.smokeIntensity);
          if (s.photoSrc) {
            setPhotoSrc(s.photoSrc);
            setPhotoName(s.photoName || "фото");
            const img = new Image();
            img.onload = () => setPhoto(img);
            img.src = s.photoSrc;
          }
          if (s.slides && s.slides.length) setSlides(s.slides);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        await window.storage.set(
          STORAGE_KEY,
          JSON.stringify({ headline, body, cta, handle, themeId, pattern, photoEverywhere, darken, coverShift, smokeIntensity, slideCount, accentColor, fontId, textScale, photoShiftX, photoSrc, photoName, slides })
        );
        setSavedAt(new Date());
      } catch (e) {
        console.error("save failed", e);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [headline, body, cta, handle, themeId, pattern, photoEverywhere, darken, coverShift, smokeIntensity, slideCount, accentColor, fontId, textScale, photoShiftX, photoSrc, photoName, slides, loaded]);

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const src = c.toDataURL("image/jpeg", 0.85);
        setPhotoSrc(src);
        setPhotoName(file.name);
        const small = new Image();
        small.onload = () => setPhoto(small);
        small.src = src;
      };
      img.src = reader.result;
    };
    if (e.target) e.target.value = "";
    reader.readAsDataURL(file);
  };

  const buildSlides = useCallback((chunks, headlineText, ctaText) => {
    if (!chunks.length) {
      setError("Добавь текст — пока нечего разбивать на слайды.");
      return;
    }
    setError("");
    const total = chunks.length + 2;
    setSlides([
      { type: "cover", headline: headlineText, total },
      ...chunks.map((c, i) => ({ type: "content", text: c, index: i + 1, total })),
      { type: "final", cta: ctaText, total },
    ]);
  }, []);

  // Ручное редактирование уже сгенерированных слайдов
  const editSlideField = (i, field, value) => {
    setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  };
  const deleteSlide = (i) => {
    setSlides((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      const total = next.length;
      let ci = 0;
      return next.map((s) => {
        if (s.type === "content") { ci += 1; return { ...s, index: ci, total }; }
        return { ...s, total };
      });
    });
  };
  const addSlideAfter = (i) => {
    setSlides((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, { type: "content", text: "Новый слайд — впиши текст", index: 0, total: 0 });
      const total = next.length;
      let ci = 0;
      return next.map((s) => {
        if (s.type === "content") { ci += 1; return { ...s, index: ci, total }; }
        return { ...s, total };
      });
    });
  };
  const addSlideBefore = (i) => {
    setSlides((prev) => {
      const next = [...prev];
      next.splice(i, 0, { type: "content", text: "Новый слайд — впиши текст", index: 0, total: 0 });
      const total = next.length;
      let ci = 0;
      return next.map((s) => {
        if (s.type === "content") { ci += 1; return { ...s, index: ci, total }; }
        return { ...s, total };
      });
    });
  };
  const duplicateSlide = (i) => {
    setSlides((prev) => {
      const next = [...prev];
      const copy = { ...next[i] };
      next.splice(i + 1, 0, copy);
      const total = next.length;
      let ci = 0;
      return next.map((s) => {
        if (s.type === "content") { ci += 1; return { ...s, index: ci, total }; }
        return { ...s, total };
      });
    });
  };
  // Перемещение текстового слайда вверх/вниз (внутри зоны контента: после обложки, до финала)
  const moveSlide = (i, dir) => {
    setSlides((prev) => {
      const j = i + dir;
      // нельзя залезть на обложку (0) или на финал (последний)
      if (j <= 0 || j >= prev.length - 1) return prev;
      if (i <= 0 || i >= prev.length - 1) return prev;
      const next = [...prev];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      const total = next.length;
      let ci = 0;
      return next.map((s) => {
        if (s.type === "content") { ci += 1; return { ...s, index: ci, total }; }
        return { ...s, total };
      });
    });
  };

  const loadExample = () => {
    setHeadline("");
    setCta("");
    setBody(
      "Как мужчины незаметно разрушают отношения\n\n" +
      "Это происходит не за один день. Сначала пропадают мелкие знаки внимания, потом исчезает интерес к твоим делам.\n\n" +
      "Ты начинаешь сомневаться в себе. Кажется, что проблема в тебе, хотя на самом деле меняется его поведение.\n\n" +
      "Появляется холодность, которую списывают на усталость. Разговоры становятся короче, а молчание — длиннее.\n\n" +
      "Со временем ты привыкаешь к этому и перестаёшь замечать, как много потеряла.\n\n" +
      "Самое важное — вовремя увидеть эти сигналы и поговорить, пока чувства ещё живы.\n\n" +
      "Сохрани, чтобы вернуться к этому позже"
    );
  };

  const generateSimple = () => {
    let h = headline.trim();
    let c = cta.trim();
    // разбиваем тело на абзацы, чтобы при необходимости забрать первый/последний
    let paras = body.replace(/\r/g, "").split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);

    // если заголовок не задан вручную — берём первый абзац
    if (!h && paras.length > 1) {
      h = paras.shift();
    }
    // если призыв не задан вручную — берём последний абзац
    if (!c && paras.length > 1) {
      c = paras.pop();
    }
    const middle = paras.join("\n\n");
    buildSlides(splitTextSimple(middle, slideCount), h, c);
  };

  const generateAI = async () => {
    if (!body.trim()) {
      setError("Добавь текст — AI нужен материал для работы.");
      return;
    }
    setAiBusy(true);
    setError("");
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content:
                'Ты редактор Instagram-каруселей. Разбей текст ровно на ' + slideCount + ' коротких слайдов (каждый до 280 символов, законченная мысль, можно слегка переформулировать для ритма). Придумай цепляющий заголовок до 60 символов и спокойный, лаконичный призыв к действию до 70 символов (без капса и лишних восклицаний, тон сдержанный и дорогой).\n\nОтветь ТОЛЬКО валидным JSON без пояснений и без markdown:\n{"headline": "...", "slides": ["...", "..."], "cta": "..."}\n\nТекст:\n' + body,
            },
          ],
        }),
      });
      const data = await response.json();
      const textOut = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("\n");
      const clean = textOut.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const chunks = (parsed.slides || []).map((s) => String(s).trim()).filter(Boolean);
      if (!chunks.length) throw new Error("empty");
      if (parsed.headline && !headline.trim()) setHeadline(parsed.headline);
      if (parsed.cta && !cta.trim()) setCta(parsed.cta);
      buildSlides(chunks, headline.trim() || parsed.headline || "", cta.trim() || parsed.cta || "");
    } catch (err) {
      console.error("AI split error:", err);
      setError("AI-разбивка не сработала, использую обычную.");
      generateSimple();
    } finally {
      setAiBusy(false);
    }
  };

  useEffect(() => {
    if (!slides.length) {
      setImgs([]);
      return;
    }
    const innerPhoto = photoEverywhere ? photo : null;
    setAccent(accentColor);
    const urls = [];
    slides.forEach((spec, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      if (spec.type === "cover") {
        drawCover(ctx, { photo, headline: spec.headline, handle, theme, pattern, total: spec.total, darken, smokeIntensity, yShift: coverShift * H, textScale, photoShiftX });
      } else if (spec.type === "content") {
        drawContent(ctx, { text: spec.text, index: spec.index, total: spec.total, theme, handle, pattern, photo: innerPhoto, darken, smokeIntensity, textScale, photoShiftX });
      } else {
        drawFinal(ctx, { cta: spec.cta, handle, theme, total: spec.total, pattern, photo: innerPhoto, darken, smokeIntensity, textScale, photoShiftX });
      }
      urls[i] = canvas.toDataURL("image/png");
    });
    setImgs(urls);
  }, [slides, photo, theme, handle, pattern, photoEverywhere, darken, coverShift, smokeIntensity, accentColor, textScale, photoShiftX]);

  const downloadOne = (i) => {
    if (!imgs[i]) return;
    const bytes = dataURLtoBytes(imgs[i]);
    triggerDownload(new Blob([bytes], { type: "image/png" }), "slide-" + String(i + 1).padStart(2, "0") + ".png");
  };

  const downloadZip = () => {
    if (!imgs.length) return;
    try {
      const files = imgs.map((src, i) => ({
        name: "slide-" + String(i + 1).padStart(2, "0") + ".png",
        data: dataURLtoBytes(src),
      }));
      triggerDownload(buildZip(files), "carousel.zip");
      setNotice("ZIP скачан. Распакуй — внутри все слайды по порядку. Этот же файл удобно переслать себе в «Избранное» в Telegram.");
    } catch (e) {
      console.error(e);
      setError("Не получилось собрать ZIP. Скачай слайды по одному кнопкой ↓ PNG.");
    }
  };

  const shareAll = async () => {
    if (!imgs.length) return;
    try {
      const files = imgs.map((src, i) => {
        const bytes = dataURLtoBytes(src);
        return new File([bytes], "slide-" + String(i + 1).padStart(2, "0") + ".png", { type: "image/png" });
      });
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: "Карусель", text: "Слайды карусели" });
        setNotice("Открылось меню «Поделиться». На айфоне выбери «Сохранить изображения», на Android — «Сохранить в галерею» или «Google Фото» — все слайды лягут в галерею разом.");
      } else {
        setNotice("Этот браузер не поддерживает отправку картинок. Сохрани слайды по одному: зажми палец на слайде → «Скачать изображение».");
      }
    } catch (e) {
      if (e && e.name !== "AbortError") {
        setNotice("Не удалось открыть меню. Сохрани слайды по одному: зажми палец на слайде → «Скачать изображение».");
      }
    }
  };

  const newCarousel = () => {
    setHeadline("");
    setBody("");
    setCta("");
    setPhoto(null);
    setPhotoSrc("");
    setPhotoName("");
    setSlides([]);
    setImgs([]);
    setError("");
    setNotice("");
    if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth" });
  };

  const resetAll = async () => {
    newCarousel();
    setHandle("");
    setThemeId("malachite");
    setPattern("smoke");
    setPhotoEverywhere(true);
    setDarken(0.5);
    setCoverShift(0);
    setSlideCount(7);
    setAccentColor(GOLD_DEFAULT);
    setFontId("theme");
    setTextScale(1);
    setPhotoShiftX(0);
    setSmokeIntensity(0.5);
    try { await window.storage.delete(STORAGE_KEY); } catch (e) {}
  };

  // Перетаскивание заголовка на обложке (по вертикали).
  // Во время движения обновляем только лёгкий dragShift (CSS-сдвиг надписи),
  // а тяжёлую перерисовку canvas делаем один раз, когда отпустили палец.
  const coverDragRef = useRef(null);
  const dragShiftRef = useRef(0);
  const onCoverPointerDown = (e) => {
    e.preventDefault();
    coverDragRef.current = e.currentTarget.parentElement;
    dragShiftRef.current = coverShift;
    setDragShift(coverShift);
    setDragging(true);
  };
  useEffect(() => {
    if (!dragging) return;
    const move = (ev) => {
      const box = coverDragRef.current;
      if (!box) return;
      if (ev.cancelable) ev.preventDefault();
      const rect = box.getBoundingClientRect();
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const frac = (clientY - rect.top) / rect.height;
      let shift = (frac - 0.5) * 0.95;
      shift = Math.max(-0.32, Math.min(0.32, shift));
      dragShiftRef.current = shift;
      setDragShift(shift); // лёгкое обновление — двигается только надпись-превью
    };
    const up = () => {
      setDragging(false);
      setCoverShift(dragShiftRef.current); // тяжёлая перерисовка один раз
      setDragShift(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [dragging]);

  // Стрелки и Esc в крупном предпросмотре
  useEffect(() => {
    if (zoomIndex == null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setZoomIndex(null);
      else if (e.key === "ArrowRight") setZoomIndex((z) => (z < imgs.length - 1 ? z + 1 : z));
      else if (e.key === "ArrowLeft") setZoomIndex((z) => (z > 0 ? z - 1 : z));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIndex, imgs.length]);

  const inputCls =
    "w-full rounded-xl bg-white border border-emerald-200 px-4 py-3 text-sm text-emerald-950 placeholder-emerald-400/60 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-100 text-emerald-950" style={{ fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
      <div className="max-w-6xl mx-auto px-4 py-8" ref={topRef}>
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Генератор каруселей</h1>
            <p className="text-emerald-700 mt-2 text-sm font-semibold tracking-wide">
              Автор приложения — Артёмов Сергей
            </p>
          </div>
          <button onClick={resetAll} className="text-xs text-emerald-700/60 hover:text-emerald-800 border border-emerald-200 rounded-lg px-3 py-1.5 shrink-0">
            Сбросить всё
          </button>
        </header>

        <div className="grid lg:grid-cols-[380px_1fr] gap-8">
          <div className="space-y-4 bg-white/70 backdrop-blur rounded-2xl p-5 border border-emerald-200 shadow-sm self-start">
            <div>
              <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Заголовок (обложка)</label>
              <input className={inputCls} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="5 ошибок, которые убивают охваты" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-emerald-700/70 uppercase tracking-wide">Текст поста</label>
                <button onClick={loadExample} className="text-[11px] text-emerald-700 border border-emerald-200 rounded-md px-2 py-0.5 hover:border-emerald-400 transition-colors">Показать пример</button>
              </div>
              <textarea className={inputCls + " min-h-[340px] resize-y leading-relaxed"} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Вставь сюда свой текст. Первый абзац станет заголовком, последний — призывом, остальное разобьётся на слайды. Или нажми «Показать пример»." />
              <p className="text-[11px] text-emerald-700/50 mt-1">💡 Совет: разделяй абзацы пустой строкой. Настройки оформления можно менять и после генерации — слайды обновятся сами.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Призыв в конце</label>
                <input className={inputCls} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Сохраните, чтобы вернуться" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Твой ник</label>
                <input className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Фото</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              <div className="flex gap-2">
                <button onClick={() => fileRef.current && fileRef.current.click()} className="flex-1 rounded-xl border border-dashed border-emerald-300 px-4 py-3 text-sm text-emerald-800 hover:border-emerald-500 hover:text-emerald-700 transition-colors">
                  {photoName ? "✓ " + photoName : "Загрузить фото"}
                </button>
                {photoName && (
                  <button onClick={() => { setPhoto(null); setPhotoSrc(""); setPhotoName(""); }} className="rounded-xl border border-emerald-200 px-3 text-sm text-emerald-700/70 hover:text-red-400 hover:border-red-400/50 transition-colors" title="Убрать фото">
                    ✕
                  </button>
                )}
              </div>
              {photoName && (
                <button onClick={() => setPhotoEverywhere(!photoEverywhere)} className="mt-2 w-full flex items-center justify-between rounded-xl border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800 hover:border-emerald-400 transition-colors">
                  <span>Фото на всех слайдах</span>
                  <span className={"w-10 h-6 rounded-full relative transition-colors " + (photoEverywhere ? "bg-emerald-500" : "bg-emerald-200")}>
                    <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all " + (photoEverywhere ? "left-[18px]" : "left-0.5")} />
                  </span>
                </button>
              )}
            </div>

            <button onClick={() => setShowStyling(!showStyling)} className="w-full flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:border-emerald-400 transition-colors">
              <span>🎨 Оформление {showStyling ? "" : "— тема, цвет, шрифт, размер"}</span>
              <span className="text-emerald-600">{showStyling ? "▲" : "▼"}</span>
            </button>

            {showStyling && (
            <div className="space-y-4 pl-1 border-l-2 border-emerald-100">
            <div>
              <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Тема (для слайдов без фото)</label>
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((t) => (
                  <button key={t.id} onClick={() => setThemeId(t.id)} className={"rounded-xl p-1.5 border text-center transition-colors " + (themeId === t.id ? "border-emerald-500" : "border-emerald-200 hover:border-emerald-400")}>
                    <div className="w-full h-9 rounded-lg mb-1 flex items-center justify-center text-[10px] font-bold" style={{ background: "linear-gradient(180deg, " + t.bgTop + ", " + t.bgBottom + ")", color: t.text }}>Aa</div>
                    <div className="text-[10px] text-emerald-800 leading-tight">{t.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Цвет акцента (вензеля, линии)</label>
              <div className="flex items-center gap-3">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-10 rounded-lg border border-emerald-200 cursor-pointer bg-white" />
                <button onClick={() => setAccentColor(GOLD_DEFAULT)} className="text-xs text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 hover:border-emerald-400 transition-colors">Золото по умолчанию</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Шрифт текста</label>
              <div className="grid grid-cols-3 gap-2">
                {FONTS.map((f) => (
                  <button key={f.id} onClick={() => setFontId(f.id)} className={"rounded-xl border px-2 py-2 text-xs transition-colors " + (fontId === f.id ? "border-emerald-500 text-emerald-700" : "border-emerald-200 text-emerald-800 hover:border-emerald-400")} style={f.font ? { fontFamily: f.font } : undefined}>
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">
                Размер текста — {Math.round(textScale * 100)}%
              </label>
              <input type="range" min="0.8" max="1.3" step="0.05" value={textScale} onChange={(e) => setTextScale(parseFloat(e.target.value))} className="w-full accent-emerald-600" />
            </div>

            {photoName && photoEverywhere && (
              <div>
                <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Сдвиг фото по горизонтали</label>
                <input type="range" min="-1" max="1" step="0.05" value={photoShiftX} onChange={(e) => setPhotoShiftX(parseFloat(e.target.value))} className="w-full accent-emerald-600" />
                <p className="text-[11px] text-emerald-700/50 mt-1">Двигает кадр влево-вправо, если лицо обрезается. Работает на вертикальных фото.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">Узор на фоне</label>
              <div className="grid grid-cols-4 gap-2">
                {PATTERNS.map((p) => (
                  <button key={p.id} onClick={() => setPattern(p.id)} className={"rounded-xl border px-2 py-2 text-xs transition-colors " + (pattern === p.id ? "border-emerald-500 text-emerald-700" : "border-emerald-200 text-emerald-800 hover:border-emerald-400")}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {pattern === "smoke" && (
              <div>
                <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">
                  Видимость дыма — {Math.round(smokeIntensity * 100)}%
                </label>
                <input type="range" min="0" max="1" step="0.05" value={smokeIntensity} onChange={(e) => setSmokeIntensity(parseFloat(e.target.value))} className="w-full accent-emerald-600" />
                <p className="text-[11px] text-emerald-700/50 mt-1">Дым рисуется с края напротив текста и тает к центру.</p>
              </div>
            )}

            {photoName && (
              <div>
                <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">
                  Затемнение фото — {Math.round(darken * 100)}%
                </label>
                <input type="range" min="0.1" max="0.85" step="0.03" value={darken} onChange={(e) => setDarken(parseFloat(e.target.value))} className="w-full accent-emerald-600" />
                <p className="text-[11px] text-emerald-700/50 mt-1">Левее — фото светлее, правее — текст читается лучше.</p>
              </div>
            )}
            </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-emerald-700/70 mb-1.5 uppercase tracking-wide">
                Сколько слайдов с текстом — {slideCount}
              </label>
              <input type="range" min="3" max="10" step="1" value={slideCount} onChange={(e) => setSlideCount(parseInt(e.target.value))} className="w-full accent-emerald-600" />
              <p className="text-[11px] text-emerald-700/50 mt-1">Плюс обложка и финал — итого {slideCount + 2} слайда.</p>
            </div>

            <div className="pt-2 space-y-2">
              <button onClick={generateSimple} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 text-sm transition-colors">
                Сформировать слайды
              </button>
              <button onClick={generateAI} disabled={aiBusy} className="w-full rounded-xl border border-emerald-500/60 text-emerald-700 hover:bg-emerald-500/10 font-semibold py-3 text-sm transition-colors disabled:opacity-50">
                {aiBusy ? "AI думает…" : "✦ Умная разбивка (AI)"}
              </button>
              {error && <p className="text-amber-400 text-xs">{error}</p>}
              {savedAt && (
                <p className="text-emerald-700/50 text-[11px]">
                  ✓ Черновик сохранён {savedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>

          <div>
            {slides.length === 0 ? (
              <div className="h-full min-h-[400px] rounded-2xl border border-dashed border-emerald-200 flex items-center justify-center text-emerald-700/50 text-sm">
                Здесь появятся слайды
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <div className="text-sm text-emerald-700/70">{slides.length} слайдов · 1080×1350</div>
                  <div className="flex gap-2 flex-wrap">
                    {isMobile && canShareFiles ? (
                      <>
                        <button onClick={shareAll} className="rounded-xl bg-emerald-700 text-white font-semibold px-4 py-2.5 text-sm hover:bg-emerald-600 transition-colors">
                          ↗ Сохранить все в галерею
                        </button>
                        <button onClick={downloadZip} className="rounded-xl border border-emerald-200 text-emerald-800 font-semibold px-4 py-2.5 text-sm hover:border-emerald-400 transition-colors">
                          ↓ ZIP
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={downloadZip} className="rounded-xl bg-emerald-700 text-white font-semibold px-4 py-2.5 text-sm hover:bg-emerald-600 transition-colors">
                          ↓ Скачать всё (ZIP)
                        </button>
                        <button onClick={shareAll} className="rounded-xl border border-emerald-200 text-emerald-800 font-semibold px-4 py-2.5 text-sm hover:border-emerald-400 transition-colors">
                          ↗ Поделиться
                        </button>
                      </>
                    )}
                    <button onClick={newCarousel} className="rounded-xl border border-emerald-500/60 text-emerald-700 font-semibold px-4 py-2.5 text-sm hover:bg-emerald-500/10 transition-colors">
                      + Новая карусель
                    </button>
                  </div>
                </div>
                <p className="text-xs text-emerald-700/60 mb-1">
                  {isMobile
                    ? "📱 «Сохранить все в галерею» → в меню выбери «Сохранить изображения» (айфон) или «Сохранить в галерею» / «Google Фото» (Android). Или зажми палец на слайде, чтобы сохранить по одному."
                    : "💻 «Скачать всё (ZIP)» — один файл со всеми слайдами. 📱 На телефоне будет кнопка сохранения сразу в галерею."}
                </p>
                <p className="text-xs text-emerald-700/60 mb-3">
                  ✏️ Текст под каждым слайдом можно править вручную — картинка перерисуется. 🔍 Клик по слайду — крупный предпросмотр.
                </p>
                {notice && <p className="text-xs text-emerald-700 mb-3">{notice}</p>}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-1">
                  {slides.map((s, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="group relative">
                        <canvas ref={(el) => (canvasRefs.current[i] = el)} width={W} height={H} style={{ display: "none" }} />
                        {imgs[i] ? (
                          <img src={imgs[i]} alt={"Слайд " + (i + 1)} onClick={() => setZoomIndex(i)} className="w-full rounded-xl border border-emerald-200 cursor-zoom-in" draggable={false} />
                        ) : (
                          <div className="w-full aspect-[4/5] rounded-xl border border-emerald-200 bg-emerald-50" />
                        )}
                        {i === 0 && photo && (
                          <div
                            onMouseDown={onCoverPointerDown}
                            onTouchStart={onCoverPointerDown}
                            className="absolute inset-0 cursor-grab active:cursor-grabbing flex items-end justify-center pb-3"
                            title="Потяни, чтобы подвинуть заголовок"
                            style={{ touchAction: "none" }}
                          >
                            {dragging && dragShift != null && (
                              <div
                                className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
                                style={{ top: (50 + dragShift * 100) + "%", transform: "translateY(-50%)" }}
                              >
                                <div className="w-full border-t-2 border-dashed border-white/80" />
                                <span className="absolute bg-black/70 text-white text-[10px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap">сюда ляжет заголовок</span>
                              </div>
                            )}
                            <span className="rounded-full bg-black/55 backdrop-blur px-3 py-1 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              ↕ потяни — двигать заголовок
                            </span>
                          </div>
                        )}
                        <button onClick={() => downloadOne(i)} className="absolute bottom-2 right-2 rounded-lg bg-black/70 backdrop-blur px-3 py-1.5 text-xs font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          ↓ PNG
                        </button>
                        <div className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none">
                          {i + 1}
                        </div>
                      </div>
                      {/* редактор текста слайда */}
                      {s.type === "cover" ? (
                        <input value={s.headline || ""} onChange={(e) => editSlideField(i, "headline", e.target.value)} placeholder="Заголовок обложки" className="w-full rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500" />
                      ) : s.type === "final" ? (
                        <div className="flex flex-col gap-1">
                          <input value={s.cta || ""} onChange={(e) => editSlideField(i, "cta", e.target.value)} placeholder="Призыв" className="w-full rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500" />
                          <button onClick={() => addSlideBefore(i)} className="w-full rounded-md border border-emerald-200 text-emerald-700 text-[11px] py-1 hover:border-emerald-400 transition-colors" title="Добавить слайд перед финальным">+ слайд перед финалом</button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <textarea value={s.text || ""} onChange={(e) => editSlideField(i, "text", e.target.value)} className="w-full rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500 resize-y min-h-[64px]" />
                          <div className={"text-[10px] " + ((s.text || "").length > 300 ? "text-amber-600 font-semibold" : "text-emerald-700/50")}>
                            {(s.text || "").length} символов{(s.text || "").length > 300 ? " — многовато, шрифт сильно уменьшится" : ""}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <button onClick={() => moveSlide(i, -1)} disabled={i <= 1} className="rounded-md border border-emerald-200 text-emerald-700 text-[11px] px-2 py-1 hover:border-emerald-400 transition-colors disabled:opacity-30" title="Передвинуть выше">↑</button>
                            <button onClick={() => moveSlide(i, 1)} disabled={i >= slides.length - 2} className="rounded-md border border-emerald-200 text-emerald-700 text-[11px] px-2 py-1 hover:border-emerald-400 transition-colors disabled:opacity-30" title="Передвинуть ниже">↓</button>
                            <button onClick={() => addSlideAfter(i)} className="flex-1 rounded-md border border-emerald-200 text-emerald-700 text-[11px] py-1 hover:border-emerald-400 transition-colors" title="Добавить слайд после этого">+ слайд</button>
                            <button onClick={() => duplicateSlide(i)} className="flex-1 rounded-md border border-emerald-200 text-emerald-700 text-[11px] py-1 hover:border-emerald-400 transition-colors" title="Дублировать этот слайд">⎘ копия</button>
                            <button onClick={() => deleteSlide(i)} className="flex-1 rounded-md border border-emerald-200 text-red-500 text-[11px] py-1 hover:border-red-400 transition-colors" title="Удалить этот слайд">× удалить</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Предпросмотр со свайпом — как в Instagram */}
      {zoomIndex != null && imgs[zoomIndex] && (
        <div
          onClick={() => setZoomIndex(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur flex items-center justify-center p-4"
          onTouchStart={(e) => { window.__swipeX = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - (window.__swipeX || 0);
            if (dx < -40 && zoomIndex < imgs.length - 1) setZoomIndex(zoomIndex + 1);
            else if (dx > 40 && zoomIndex > 0) setZoomIndex(zoomIndex - 1);
          }}
        >
          <img src={imgs[zoomIndex]} alt="Предпросмотр" onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-[90vw] rounded-2xl shadow-2xl select-none" draggable={false} />

          {/* стрелка влево */}
          {zoomIndex > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setZoomIndex(zoomIndex - 1); }} className="absolute left-3 md:left-8 top-1/2 -translate-y-1/2 rounded-full bg-white/15 hover:bg-white/30 text-white w-12 h-12 text-2xl flex items-center justify-center">‹</button>
          )}
          {/* стрелка вправо */}
          {zoomIndex < imgs.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setZoomIndex(zoomIndex + 1); }} className="absolute right-3 md:right-8 top-1/2 -translate-y-1/2 rounded-full bg-white/15 hover:bg-white/30 text-white w-12 h-12 text-2xl flex items-center justify-center">›</button>
          )}

          {/* точки-индикаторы как в Instagram */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-2">
            {imgs.map((_, k) => (
              <button key={k} onClick={(e) => { e.stopPropagation(); setZoomIndex(k); }} className={"rounded-full transition-all " + (k === zoomIndex ? "bg-white w-2.5 h-2.5" : "bg-white/40 w-2 h-2")} />
            ))}
          </div>

          <div className="absolute top-5 left-0 right-0 text-center text-white/70 text-sm pointer-events-none">
            {zoomIndex + 1} из {imgs.length} · листай свайпом или стрелками
          </div>
          <button onClick={() => setZoomIndex(null)} className="absolute top-4 right-4 rounded-full bg-white/15 hover:bg-white/30 text-white w-10 h-10 text-xl">✕</button>
        </div>
      )}
    </div>
  );
}

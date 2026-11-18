import Phaser from 'phaser';
import { COLORS, HeroId } from '../config';

// Procedural "cartoon puppet" renderer. Everything is drawn facing RIGHT with the feet at (0,0);
// entities flip/scale the Graphics object. Swap this file for sprite sheets later without touching gameplay.

type G = Phaser.GameObjects.Graphics;

export type PoseState =
  | 'idle' | 'run' | 'jump' | 'fall' | 'crouch' | 'punch' | 'kick' | 'airkick' | 'dash'
  | 'hurt' | 'flex' | 'windup' | 'swipe' | 'pound' | 'throw' | 'slash' | 'pounce';

export interface Pose {
  state: PoseState;
  t: number; // running animation clock (s)
  p: number; // 0..1 progress through the current action
  crouch?: boolean;
}

export interface Look {
  outline: number;
  skin: number;
  skinShade: number;
  top: number;
  topShade: number;
  sleeve: number; // upper-arm colour
  bottom: number;
  bottomShade: number;
  feet: number;
  thigh: number; shin: number; torso: number; torsoW: number;
  upper: number; fore: number; armW: number; legW: number;
  headR: number; hunch: number; fistR: number; footR: number;
  eye: number; eyeGlow: boolean;
  head?: (g: G, x: number, y: number, r: number, pose: Pose) => void;
  back?: (g: G, x: number, y: number, r: number, pose: Pose) => void;
  chest?: (g: G, hx: number, hy: number, sx: number, sy: number, w: number) => void;
}

const PI = Math.PI;
const HALF = PI / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function pt(x: number, y: number, a: number, l: number) {
  return { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l };
}

function capsule(g: G, x1: number, y1: number, x2: number, y2: number, w: number, color: number) {
  g.lineStyle(w, color, 1);
  g.lineBetween(x1, y1, x2, y2);
  g.fillStyle(color, 1);
  g.fillCircle(x1, y1, w / 2);
  g.fillCircle(x2, y2, w / 2);
}

function limb(
  g: G, L: Look, x: number, y: number, a1: number, l1: number, rel: number, l2: number,
  w: number, c1: number, c2: number, end: 'fist' | 'foot', endR: number, endC: number,
) {
  const k = pt(x, y, a1, l1);
  const e = pt(k.x, k.y, a1 + rel, l2);
  const o = 5;
  // outline pass
  capsule(g, x, y, k.x, k.y, w + o, L.outline);
  capsule(g, k.x, k.y, e.x, e.y, w * 0.9 + o, L.outline);
  if (end === 'fist') g.fillCircle(e.x, e.y, endR + o / 2);
  else g.fillEllipse(e.x + endR * 0.55, e.y - endR * 0.2, endR * 2.6 + o, endR * 1.3 + o);
  // fill pass
  capsule(g, x, y, k.x, k.y, w, c1);
  capsule(g, k.x, k.y, e.x, e.y, w * 0.9, c2);
  g.fillStyle(endC, 1);
  if (end === 'fist') g.fillCircle(e.x, e.y, endR);
  else g.fillEllipse(e.x + endR * 0.55, e.y - endR * 0.2, endR * 2.6, endR * 1.3);
  return e;
}

export function drawHumanoid(g: G, L: Look, pose: Pose) {
  g.clear();
  const { t, p } = pose;
  const legLen = L.thigh + L.shin;
  let hipY = -legLen * 0.96;
  let lean = L.hunch;
  let bob = 0;
  // legs: front thigh/shin, back thigh/shin (angles in radians, down = PI/2)
  let fT = HALF - 0.12, fS = 0.12, bT = HALF + 0.14, bS = 0.14;
  // arms: front upper/fore, back upper/fore
  let fU = HALF - 0.25, fF = -1.25, bU = HALF + 0.35, bF = -0.95;
  let headDX = 0;

  const crouchLegs = () => {
    hipY = -legLen * 0.6; fT = 0.35; fS = 1.7; bT = 0.9; bS = 1.9; lean += 6;
  };

  switch (pose.state) {
    case 'idle':
      bob = Math.sin(t * 3) * 1.5;
      fF = -1.25 + Math.sin(t * 3) * 0.08;
      break;
    case 'run': {
      const ph = t * 11, s = Math.sin(ph), c = Math.cos(ph);
      fT = HALF - s * 0.75; fS = 0.25 + 0.95 * Math.max(0, c);
      bT = HALF + s * 0.75; bS = 0.25 + 0.95 * Math.max(0, -c);
      fU = HALF + s * 0.85; fF = -1.3; bU = HALF - s * 0.85; bF = -1.3;
      lean += L.torso * 0.14; bob = -Math.abs(Math.sin(ph)) * 4;
      break;
    }
    case 'jump':
      hipY = -legLen * 0.92; fT = HALF - 0.95; fS = 1.6; bT = HALF + 0.2; bS = 1.1;
      fU = -HALF + 0.5; fF = -0.3; bU = PI + 0.5; bF = 0.4;
      break;
    case 'fall':
      hipY = -legLen * 0.94; fT = HALF - 0.45; fS = 0.7; bT = HALF + 0.3; bS = 0.6;
      fU = -0.4; fF = -0.5; bU = PI + 0.4; bF = 0.5;
      break;
    case 'crouch':
      crouchLegs(); fU = 0.4; fF = -1.6; bU = 1.1; bF = -1.5;
      break;
    case 'punch': {
      if (pose.crouch) crouchLegs();
      const w = p < 0.25 ? p / 0.25 : 0;
      const ext = p < 0.25 ? 0 : p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      if (p < 0.25) { fU = HALF + 0.5 * w; fF = -1.25 - 1.0 * w; }
      else { fU = lerp(HALF - 0.25, -0.1, ext); fF = lerp(-1.3, 0, ext); }
      bU = HALF + 0.5; bF = -1.7; lean += 7 * ext;
      break;
    }
    case 'kick': {
      if (pose.crouch) {
        crouchLegs();
        const ext = p < 0.3 ? 0 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        fT = lerp(0.35, 0.08, ext); fS = lerp(1.7, 0.0, ext); lean -= 4 * ext;
        fU = 0.6; fF = -1.5; bU = 1.4; bF = -1.2;
        break;
      }
      const w = p < 0.3 ? p / 0.3 : 0;
      const ext = p < 0.3 ? 0 : p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
      if (p < 0.3) { fT = HALF - 1.1 * w; fS = 1.8 * w; }
      else { fT = lerp(HALF - 1.1, -0.12, ext); fS = lerp(1.8, 0, ext); }
      bT = HALF + 0.2; bS = 0.15;
      lean -= 10 * Math.max(ext, w * 0.5);
      fU = HALF - 0.7; fF = -1.9; bU = HALF + 1.0; bF = -0.6;
      break;
    }
    case 'airkick':
      hipY = -legLen * 0.9; fT = 0.15; fS = 0.05; bT = HALF + 0.7; bS = 1.6;
      lean -= 8; fU = -0.9; fF = -0.6; bU = PI + 0.3; bF = 0.6;
      break;
    case 'dash':
      lean += 20; fT = HALF - 0.7; fS = 0.7; bT = HALF + 0.9; bS = 0.7;
      fU = HALF + 1.1; fF = -0.3; bU = HALF + 1.25; bF = -0.3; hipY = -legLen * 0.86;
      break;
    case 'hurt':
      lean -= 12; headDX = -4; fU = -0.9; fF = -0.6; bU = PI + 0.8; bF = 0.6;
      fT = HALF - 0.3; bT = HALF + 0.3;
      break;
    case 'flex': {
      const s = Math.sin(t * 18) * 0.06;
      fU = -0.25 + s; fF = -2.3; bU = PI + 0.25 - s; bF = 2.3; lean = L.hunch * 0.3;
      bob = Math.sin(t * 24) * 1.5;
      fT = HALF - 0.25; bT = HALF + 0.25;
      break;
    }
    case 'windup':
      fU = lerp(HALF - 0.25, -HALF - 0.3, p); fF = -0.4;
      bU = lerp(HALF + 0.35, -HALF - 0.6, p); bF = -0.4; lean -= 6 * p;
      break;
    case 'swipe':
      fU = lerp(-1.8, 0.7, clamp01(p * 2)); fF = -0.25;
      bU = lerp(-2.1, 1.0, clamp01(p * 2)); bF = -0.25; lean += 14 * clamp01(p * 2);
      break;
    case 'pound': {
      if (p < 0.45) {
        const w = p / 0.45;
        fU = lerp(HALF - 0.25, -HALF - 0.25, w); fF = -0.3; bU = lerp(HALF + 0.35, -HALF - 0.45, w); bF = -0.3;
        lean -= 8 * w; hipY = -legLen * (0.96 + 0.03 * w);
      } else {
        const s = clamp01((p - 0.45) / 0.12);
        fU = lerp(-HALF - 0.25, 1.05, s); fF = 0; bU = lerp(-HALF - 0.45, 1.2, s); bF = 0;
        lean += 22 * s; hipY = -legLen * lerp(0.99, 0.72, s);
        fT = lerp(HALF - 0.12, 0.5, s); fS = lerp(0.12, 1.4, s); bT = lerp(HALF + 0.14, 1.1, s); bS = lerp(0.14, 1.2, s);
      }
      break;
    }
    case 'throw':
      if (p < 0.4) { const w = p / 0.4; fU = lerp(HALF, PI + 0.6, w); fF = -0.6 * w; lean -= 8 * w; }
      else { const s = clamp01((p - 0.4) / 0.15); fU = lerp(PI + 0.6, -0.15, s); fF = 0; lean += 14 * s; }
      bU = HALF + 0.3; bF = -1.0;
      break;
  }

  const hx = 0, hy = hipY + bob;
  const sx = lean, sy = hy - L.torso;
  const headX = sx + L.headR * 0.25 + lean * 0.25 + headDX;
  const headY = sy - L.headR * 0.95;

  // back limbs (shaded)
  limb(g, L, sx - 3, sy + 4, bU, L.upper, bF, L.fore, L.armW, shade(L.sleeve), L.skinShade, 'fist', L.fistR, L.skinShade);
  limb(g, L, hx - 3, hy, bT, L.thigh, bS, L.shin, L.legW, L.bottomShade, L.bottomShade, 'foot', L.footR, shade(L.feet));

  L.back?.(g, headX, headY, L.headR, pose);

  // torso
  capsule(g, hx, hy, sx, sy, L.torsoW + 5, L.outline);
  g.fillStyle(L.outline, 1); g.fillCircle(hx, hy + 2, L.legW * 0.95 + 2.5);
  capsule(g, hx, hy, sx, sy, L.torsoW, L.top);
  g.fillStyle(L.bottom, 1); g.fillCircle(hx, hy + 2, L.legW * 0.95);
  // belt line
  g.fillStyle(L.bottomShade, 1); g.fillRect(hx - L.torsoW / 2, hy - 4, L.torsoW, 5);
  L.chest?.(g, hx, hy, sx, sy, L.torsoW);

  // front leg
  limb(g, L, hx + 2, hy, fT, L.thigh, fS, L.shin, L.legW, L.bottom, L.bottom, 'foot', L.footR, L.feet);

  // head
  g.fillStyle(L.outline, 1); g.fillCircle(headX, headY, L.headR + 2.5);
  g.fillStyle(L.skin, 1); g.fillCircle(headX, headY, L.headR);
  // eye
  const ex = headX + L.headR * 0.5, ey = headY - L.headR * 0.12;
  if (L.eyeGlow) {
    g.fillStyle(L.eye, 0.35); g.fillCircle(ex, ey, L.headR * 0.42);
    g.fillStyle(L.eye, 1); g.fillEllipse(ex, ey, L.headR * 0.42, L.headR * 0.26);
  } else {
    g.fillStyle(0xffffff, 1); g.fillCircle(ex, ey, L.headR * 0.2);
    g.fillStyle(L.eye, 1); g.fillCircle(ex + 1, ey, L.headR * 0.12);
  }
  L.head?.(g, headX, headY, L.headR, pose);

  // front arm
  limb(g, L, sx + 2, sy + 4, fU, L.upper, fF, L.fore, L.armW, L.sleeve, L.skin, 'fist', L.fistR, L.skin);
}

export function shade(c: number, f = 0.72) {
  const r = ((c >> 16) & 255) * f, gg = ((c >> 8) & 255) * f, b = (c & 255) * f;
  return (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b);
}

/** A copy of a look with every fill colour washed to white (hit flash). */
export function flashLook(L: Look): Look {
  const w = 0xffffff, s = 0xe8e8ff;
  return { ...L, skin: w, skinShade: s, top: w, topShade: s, sleeve: w, bottom: s, bottomShade: s, feet: w };
}

// ---------------------------------------------------------------- hero looks

const BASE_DIMS = {
  thigh: 27, shin: 27, torso: 38, torsoW: 25, upper: 22, fore: 22, armW: 9, legW: 11,
  headR: 13, hunch: 2, fistR: 6, footR: 7,
};

export function heroLook(id: HeroId, form: number): Look {
  const bulk = [1, 1.35, 1.75][form] ?? 1;
  const dims = {
    ...BASE_DIMS,
    armW: BASE_DIMS.armW * bulk,
    legW: BASE_DIMS.legW * (1 + (bulk - 1) * 0.6),
    torsoW: BASE_DIMS.torsoW * (1 + (bulk - 1) * 0.65),
    fistR: BASE_DIMS.fistR * (1 + (bulk - 1) * 0.7),
    torso: BASE_DIMS.torso * (form === 2 ? 1.08 : 1),
    hunch: form === 2 ? 6 : 2,
  };
  const glow = form > 0;
  if (id === 'mara') {
    const skin = 0xf1c27d;
    return {
      outline: COLORS.outline, skin, skinShade: shade(skin, 0.82),
      top: form === 2 ? 0xb08e57 : 0xc9a46a, topShade: 0x8f7346,
      sleeve: form === 0 ? 0xc9a46a : skin, bottom: 0x4c6340, bottomShade: 0x35472d, feet: 0x3a2a1e,
      ...dims, eye: glow ? COLORS.spirit : 0x2b1b12, eyeGlow: glow,
      back: (g, x, y, r, pose) => {
        // ponytail
        const sw = Math.sin(pose.t * 8) * 3;
        g.fillStyle(COLORS.outline, 1);
        g.fillCircle(x - r * 0.95, y + r * 0.1, r * 0.5 + 2.5);
        g.fillCircle(x - r * 1.35, y + r * 0.6 + sw * 0.3, r * 0.42 + 2.5);
        g.fillCircle(x - r * 1.55 + sw * 0.3, y + r * 1.05 + sw * 0.5, r * 0.32 + 2.5);
        g.fillStyle(0x8b3a1a, 1);
        g.fillCircle(x - r * 0.95, y + r * 0.1, r * 0.5);
        g.fillCircle(x - r * 1.35, y + r * 0.6 + sw * 0.3, r * 0.42);
        g.fillCircle(x - r * 1.55 + sw * 0.3, y + r * 1.05 + sw * 0.5, r * 0.32);
      },
      head: (g, x, y, r) => {
        // hair fringe + ranger campaign hat
        g.fillStyle(0x8b3a1a, 1);
        g.fillEllipse(x - r * 0.25, y - r * 0.45, r * 1.7, r * 0.8);
        g.fillStyle(COLORS.outline, 1);
        g.fillEllipse(x, y - r * 0.72, r * 3.0 + 5, r * 0.55 + 5);
        g.fillRoundedRect(x - r * 0.75 - 2.5, y - r * 1.75 - 2.5, r * 1.5 + 5, r * 1.1 + 5, 5);
        g.fillStyle(0x7a5a36, 1);
        g.fillEllipse(x, y - r * 0.72, r * 3.0, r * 0.55);
        g.fillRoundedRect(x - r * 0.75, y - r * 1.75, r * 1.5, r * 1.1, 4);
        g.fillStyle(0x4a3620, 1);
        g.fillRect(x - r * 0.75, y - r * 0.98, r * 1.5, r * 0.22);
      },
      chest: (g, _hx, _hy, sx, sy, w) => {
        // ranger badge + pocket
        g.fillStyle(0xffd34d, 1); g.fillCircle(sx + w * 0.18, sy + 12, 3.2);
        if (form === 2) {
          g.lineStyle(2, COLORS.outline, 0.8);
          g.lineBetween(sx - w * 0.3, sy + 22, sx - w * 0.05, sy + 30);
          g.lineBetween(sx + w * 0.1, sy + 6, sx + w * 0.3, sy + 16);
        }
      },
    };
  }
  const skin = 0x8d5524;
  return {
    outline: COLORS.outline, skin, skinShade: shade(skin, 0.8),
    top: 0xe0702e, topShade: 0xa94f1d,
    sleeve: form === 0 ? 0xe0702e : skin, bottom: 0x33476e, bottomShade: 0x24334f, feet: 0xeeeeee,
    ...dims, eye: glow ? COLORS.spirit : 0x1a0f08, eyeGlow: glow,
    head: (g, x, y, r) => {
      // beard
      g.fillStyle(0x2a1a10, 1);
      g.fillEllipse(x + r * 0.35, y + r * 0.62, r * 1.2, r * 0.6);
      // beanie with pom
      g.fillStyle(COLORS.outline, 1);
      g.fillEllipse(x - r * 0.1, y - r * 0.55, r * 2.2 + 5, r * 1.3 + 5);
      g.fillCircle(x - r * 0.3, y - r * 1.3, r * 0.38 + 2.5);
      g.fillStyle(0x2bb3a6, 1);
      g.fillEllipse(x - r * 0.1, y - r * 0.55, r * 2.2, r * 1.3);
      g.fillStyle(0x1f8a80, 1);
      g.fillRect(x - r * 1.15, y - r * 0.35, r * 2.1, r * 0.3);
      g.fillStyle(0xfff3d6, 1);
      g.fillCircle(x - r * 0.3, y - r * 1.3, r * 0.38);
    },
    chest: (g, _hx, _hy, sx, sy, w) => {
      if (form === 0) {
        // action cam on chest strap
        g.lineStyle(3, 0x222222, 1);
        g.lineBetween(sx - w * 0.45, sy + 2, sx + w * 0.4, sy + 26);
        g.fillStyle(0x222222, 1); g.fillRoundedRect(sx + 2, sy + 10, 10, 8, 2);
        g.fillStyle(0xff3355, 1); g.fillCircle(sx + 10, sy + 12, 1.5);
      } else {
        // hoodie pocket + tear
        g.fillStyle(0xa94f1d, 1); g.fillRoundedRect(sx - w * 0.3, sy + 18, w * 0.6, 9, 3);
      }
    },
  };
}

// ---------------------------------------------------------------- beast + enemy looks

export function bigfootLook(): Look {
  const fur = 0x7b3f1f, furShade = 0x5a2b14, face = 0xc28a62;
  return {
    outline: COLORS.outline, skin: face, skinShade: shade(face, 0.8),
    top: fur, topShade: furShade, sleeve: fur, bottom: fur, bottomShade: furShade, feet: 0x3e2414,
    thigh: 36, shin: 34, torso: 62, torsoW: 56, upper: 42, fore: 42, armW: 21, legW: 25,
    headR: 19, hunch: 16, fistR: 14, footR: 16,
    eye: COLORS.beast, eyeGlow: true,
    back: (g, x, y, r) => {
      // shaggy crest of fur behind the head
      g.fillStyle(COLORS.outline, 1);
      g.fillTriangle(x - r * 1.6, y + r * 1.6, x - r * 0.4, y - r * 1.1, x - r * 0.2, y + r * 1.4);
      g.fillStyle(0x6b3519, 1);
      g.fillTriangle(x - r * 1.45, y + r * 1.45, x - r * 0.45, y - r * 0.85, x - r * 0.3, y + r * 1.3);
    },
    head: (g, x, y, r) => {
      // fur cap + heavy brow + muzzle
      g.fillStyle(0x7b3f1f, 1);
      g.fillEllipse(x - r * 0.25, y - r * 0.35, r * 1.9, r * 1.4);
      g.fillStyle(0xc28a62, 1);
      g.fillEllipse(x + r * 0.45, y + r * 0.2, r * 1.2, r * 1.1);
      g.fillStyle(0x3b1d0e, 1);
      g.fillRoundedRect(x + r * 0.05, y - r * 0.42, r * 1.0, r * 0.22, 3);
      g.fillStyle(COLORS.beast, 0.4); g.fillCircle(x + r * 0.55, y - r * 0.12, r * 0.38);
      g.fillStyle(COLORS.beast, 1); g.fillEllipse(x + r * 0.55, y - r * 0.12, r * 0.4, r * 0.24);
      g.fillStyle(0x3b1d0e, 1); g.fillEllipse(x + r * 0.85, y + r * 0.42, r * 0.4, r * 0.18);
    },
    chest: (g, hx, hy, sx, sy, w) => {
      g.fillStyle(0xa86f4a, 1);
      g.fillEllipse((hx + sx) / 2 + 8, (hy + sy) / 2 - 4, w * 0.55, (hy - sy) * 0.75);
      // fur tufts along the back
      g.fillStyle(0x5a2b14, 1);
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const x = lerp(hx, sx, t) - w * 0.5, y = lerp(hy, sy, t);
        g.fillTriangle(x + 4, y - 8, x - 9, y, x + 4, y + 8);
      }
    },
  };
}

export function huskLook(): Look {
  const skin = 0x7a7090;
  return {
    outline: COLORS.outline, skin, skinShade: shade(skin, 0.8),
    top: 0x4a4060, topShade: 0x352d47, sleeve: skin, bottom: 0x2f2940, bottomShade: 0x221d2f, feet: 0x1d1828,
    thigh: 25, shin: 25, torso: 36, torsoW: 24, upper: 24, fore: 24, armW: 8, legW: 10,
    headR: 12, hunch: 14, fistR: 6, footR: 6,
    eye: COLORS.hollow, eyeGlow: true,
    head: (g, x, y, r) => {
      // twisted antler nubs
      g.lineStyle(4, COLORS.outline, 1);
      g.lineBetween(x - r * 0.2, y - r * 0.8, x - r * 0.6, y - r * 1.8);
      g.lineBetween(x - r * 0.6, y - r * 1.8, x - r * 1.2, y - r * 2.0);
      g.lineBetween(x + r * 0.3, y - r * 0.85, x + r * 0.5, y - r * 1.7);
      g.lineStyle(2, 0xcfc4a8, 1);
      g.lineBetween(x - r * 0.2, y - r * 0.8, x - r * 0.6, y - r * 1.8);
      g.lineBetween(x - r * 0.6, y - r * 1.8, x - r * 1.2, y - r * 2.0);
      g.lineBetween(x + r * 0.3, y - r * 0.85, x + r * 0.5, y - r * 1.7);
      // mouth gash
      g.lineStyle(2, COLORS.hollow, 0.9);
      g.lineBetween(x + r * 0.2, y + r * 0.5, x + r * 0.85, y + r * 0.35);
    },
    chest: (g, hx, hy, sx, sy) => {
      g.lineStyle(2, COLORS.hollow, 0.85);
      const mx = (hx + sx) / 2, my = (hy + sy) / 2;
      g.lineBetween(mx - 4, my - 10, mx + 3, my);
      g.lineBetween(mx + 3, my, mx - 2, my + 9);
      g.lineBetween(mx + 3, my, mx + 9, my + 3);
    },
  };
}

// ---------------------------------------------------------------- non-humanoids

export function drawCrow(g: G, t: number, swoop: boolean, flash: boolean) {
  g.clear();
  const body = flash ? 0xffffff : 0x1d1a24, wing = flash ? 0xeeeeff : 0x2c2638, o = COLORS.outline;
  const flap = swoop ? -0.2 : Math.sin(t * 14);
  // far wing
  g.fillStyle(o, 1);
  g.fillTriangle(-6, -4, 10, -2, -18, -30 * flap - 6);
  g.fillStyle(wing, 1);
  g.fillTriangle(-4, -4, 8, -2, -16, -28 * flap - 6);
  // tail
  g.fillStyle(o, 1); g.fillTriangle(-20, -2, -40, -12, -38, 8);
  g.fillStyle(body, 1); g.fillTriangle(-20, -2, -37, -10, -35, 5);
  // body + head
  g.fillStyle(o, 1); g.fillEllipse(0, 0, 50, 26); g.fillCircle(22, -6, 12);
  g.fillStyle(body, 1); g.fillEllipse(0, 0, 45, 21); g.fillCircle(22, -6, 9.5);
  // beak
  g.fillStyle(0x9a9080, 1); g.fillTriangle(29, -9, 44, -3, 29, -1);
  // eye
  g.fillStyle(COLORS.hollow, 0.4); g.fillCircle(25, -8, 6);
  g.fillStyle(COLORS.hollow, 1); g.fillCircle(25, -8, 2.8);
  // near wing
  g.fillStyle(o, 1);
  g.fillTriangle(-10, -2, 14, 0, -8, 34 * -flap + 2);
  g.fillStyle(wing, 1);
  g.fillTriangle(-8, -1, 12, 0, -7, 31 * -flap + 2);
}

export function drawWolf(g: G, t: number, running: boolean, lunge: boolean, flash: boolean) {
  g.clear();
  const fur = flash ? 0xffffff : 0xd9f4ff, shadeC = flash ? 0xeeeeff : 0x9cc8e0, o = 0x2a5a78;
  const ph = running ? t * 14 : 0;
  // spirit glow
  g.fillStyle(COLORS.spirit, 0.12); g.fillEllipse(0, -40, 150, 90);
  g.fillStyle(COLORS.spirit, 0.12); g.fillEllipse(0, -40, 110, 64);
  const leg = (x: number, a: number, c: number) => {
    const k = pt(x, -40, HALF + a, 20);
    const e = pt(k.x, k.y, HALF + a * 0.3 + 0.2, 20);
    capsule(g, x, -40, k.x, k.y, 11, o); capsule(g, k.x, k.y, e.x, e.y, 9, o);
    capsule(g, x, -40, k.x, k.y, 7, c); capsule(g, k.x, k.y, e.x, e.y, 5.5, c);
  };
  leg(-26, Math.sin(ph) * 0.6, shadeC);
  leg(24, -Math.sin(ph) * 0.6, shadeC);
  // tail
  const tw = Math.sin(t * 6) * 6;
  capsule(g, -36, -48, -62, -60 + tw, 13, o); capsule(g, -36, -48, -62, -60 + tw, 8, fur);
  // body
  const lean = lunge ? 6 : 0;
  g.fillStyle(o, 1); g.fillEllipse(0, -48 + lean * 0.3, 84, 38);
  g.fillStyle(fur, 1); g.fillEllipse(0, -48 + lean * 0.3, 79, 33);
  // orb in chest
  g.fillStyle(COLORS.spirit, 0.5); g.fillCircle(14, -46, 10 + Math.sin(t * 6) * 2);
  g.fillStyle(0xffffff, 1); g.fillCircle(14, -46, 5);
  leg(-18, -Math.sin(ph) * 0.6, fur);
  leg(30, Math.sin(ph) * 0.6, fur);
  // head
  const hx = 40, hy = -62 + lean;
  g.fillStyle(o, 1); g.fillCircle(hx, hy, 16); g.fillTriangle(hx + 4, hy - 6, hx + 32, hy + 4, hx + 4, hy + 12);
  g.fillTriangle(hx - 10, hy - 10, hx - 4, hy - 30, hx + 4, hy - 10);
  g.fillStyle(fur, 1); g.fillCircle(hx, hy, 13); g.fillTriangle(hx + 4, hy - 4, hx + 28, hy + 4, hx + 4, hy + 9);
  g.fillTriangle(hx - 8, hy - 9, hx - 4, hy - 26, hx + 2, hy - 9);
  g.fillStyle(0x10283a, 1); g.fillCircle(hx + 28, hy + 3, 3);
  g.fillStyle(COLORS.spirit, 1); g.fillEllipse(hx + 6, hy - 3, 6, 4);
  if (lunge) { g.fillStyle(0x10283a, 1); g.fillTriangle(hx + 8, hy + 8, hx + 26, hy + 8, hx + 10, hy + 15); }
}

export type MooseState = 'idle' | 'walk' | 'windup' | 'charge' | 'stunned' | 'rear' | 'slam' | 'summon';

export function drawMoose(g: G, t: number, state: MooseState, p: number, flash: boolean, enraged: boolean) {
  g.clear();
  const o = COLORS.outline;
  const hide = flash ? 0xffffff : 0x4a3346, hideShade = flash ? 0xe6e6ff : 0x33223a, antler = flash ? 0xffffff : 0xd8cbb0;
  const glow = enraged ? 0xff5ad0 : COLORS.hollow;
  const walking = state === 'walk' || state === 'charge';
  const ph = t * (state === 'charge' ? 16 : 7);
  const headLow = state === 'windup' || state === 'charge' ? 1 : state === 'stunned' ? 0.7 : 0;

  // legs
  const leg = (x: number, a: number, c: number) => {
    const k = pt(x, -120, HALF + a, 58);
    const e = pt(k.x, k.y, HALF - a * 0.5 + 0.05, 62);
    capsule(g, x, -120, k.x, k.y, 26, o); capsule(g, k.x, k.y, e.x, e.y, 20, o);
    capsule(g, x, -120, k.x, k.y, 20, c); capsule(g, k.x, k.y, e.x, e.y, 14, c);
    g.fillStyle(o, 1); g.fillRoundedRect(e.x - 13, e.y - 6, 28, 12, 4);
  };
  const sw = walking ? Math.sin(ph) * 0.5 : state === 'windup' ? Math.sin(t * 20) * 0.25 : 0;
  leg(-70, sw, hideShade);
  leg(60, -sw, hideShade);

  // body
  g.fillStyle(o, 1); g.fillEllipse(0, -150, 236, 120);
  g.fillStyle(hide, 1); g.fillEllipse(0, -150, 228, 112);
  // hump + mane
  g.fillStyle(hideShade, 1); g.fillEllipse(40, -192, 120, 50);
  // corruption cracks
  g.lineStyle(4, glow, 0.9);
  g.lineBetween(-40, -170, -10, -140); g.lineBetween(-10, -140, -30, -112);
  g.lineBetween(-10, -140, 20, -132); g.lineBetween(-80, -150, -60, -128);
  g.fillStyle(glow, 0.25); g.fillCircle(-10, -140, 22 + Math.sin(t * 5) * 3);

  leg(-50, -sw, hide);
  leg(80, sw, hide);

  // neck + head
  const hx = 128, hy = lerp(-188, -120, headLow);
  capsule(g, 70, -170, hx - 10, hy, 56, o); capsule(g, 70, -170, hx - 10, hy, 48, hide);
  g.fillStyle(o, 1); g.fillEllipse(hx + 18, hy + 10, 92, 50);
  g.fillStyle(hide, 1); g.fillEllipse(hx + 18, hy + 10, 86, 44);
  g.fillStyle(hideShade, 1); g.fillEllipse(hx + 52, hy + 16, 30, 28); // muzzle
  g.fillStyle(o, 1); g.fillCircle(hx + 60, hy + 12, 4);
  // dewlap
  g.fillStyle(hideShade, 1); g.fillTriangle(hx + 2, hy + 28, hx + 18, hy + 28, hx + 6, hy + 52);
  // eye
  g.fillStyle(glow, 0.45); g.fillCircle(hx + 14, hy - 2, 10);
  g.fillStyle(state === 'stunned' ? 0xffffff : glow, 1); g.fillEllipse(hx + 14, hy - 2, 11, 7);

  // antlers (palmate)
  const antlerAt = (bx: number, by: number, dir: number, scale: number) => {
    const ax = bx - 10 * dir, ay = by - 30 * scale;
    capsule(g, bx, by, ax, ay, 12, o);
    g.fillStyle(o, 1);
    g.fillEllipse(ax - 24 * dir, ay - 22 * scale, 86 * scale + 6, 40 * scale + 6);
    for (let i = 0; i < 5; i++) {
      const tx = ax - 60 * dir * scale + i * 22 * dir * scale, ty = ay - 40 * scale - (i % 2) * 10;
      g.fillTriangle(tx - 7, ty + 18, tx + 7, ty + 18, tx, ty - 10);
    }
    capsule(g, bx, by, ax, ay, 7, antler);
    g.fillStyle(antler, 1);
    g.fillEllipse(ax - 24 * dir, ay - 22 * scale, 86 * scale, 40 * scale);
    for (let i = 0; i < 5; i++) {
      const tx = ax - 60 * dir * scale + i * 22 * dir * scale, ty = ay - 40 * scale - (i % 2) * 10;
      g.fillTriangle(tx - 5, ty + 16, tx + 5, ty + 16, tx, ty - 6);
      g.fillStyle(glow, 0.9); g.fillCircle(tx, ty - 6, 2.5); g.fillStyle(antler, 1);
    }
  };
  const tilt = headLow * 24;
  antlerAt(hx - 4 + tilt, hy - 16, 1, 1.0);
  antlerAt(hx + 18 + tilt, hy - 18, -0.6, 0.8);

  if (state === 'stunned') {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * PI * 2) / 3;
      const x = hx + Math.cos(a) * 34, y = hy - 50 + Math.sin(a) * 10;
      g.fillStyle(0xffe066, 1); g.fillCircle(x, y, 6); g.fillStyle(0xffffff, 1); g.fillCircle(x, y, 2.5);
    }
  }
  if (state === 'summon') {
    g.lineStyle(4, glow, 1 - p);
    g.strokeCircle(hx + 60, hy + 12, 20 + p * 120);
  }
}

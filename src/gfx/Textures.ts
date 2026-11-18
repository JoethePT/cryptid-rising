import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';

// Procedural textures (canvas 2D) for the Old-Growth Forest stage. Horizontal layers tile seamlessly.

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.context);
  tex.refresh();
}

/** Draw something at x and its horizontal wrap-around copies so the strip tiles. */
function wrap(w: number, x: number, fn: (x: number) => void) {
  fn(x); fn(x - w); fn(x + w);
}

function pine(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, color: string) {
  const w = h * 0.36;
  ctx.fillStyle = color;
  ctx.fillRect(x - w * 0.06, base - h * 0.15, w * 0.12, h * 0.16);
  for (let i = 0; i < 4; i++) {
    const tierTop = base - h + i * h * 0.2;
    const tierBot = base - h * 0.12 - (3 - i) * h * 0.12;
    const tw = w * (0.45 + i * 0.2);
    ctx.beginPath();
    ctx.moveTo(x, tierTop);
    ctx.lineTo(x + tw, tierBot);
    ctx.lineTo(x - tw, tierBot);
    ctx.closePath();
    ctx.fill();
  }
}

export function makeForestTextures(scene: Phaser.Scene) {
  // Sky: gradient, stars and a big moon.
  canvasTex(scene, 'bg-sky', GAME_W, GAME_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
    g.addColorStop(0, '#0b1626');
    g.addColorStop(0.55, '#16364a');
    g.addColorStop(1, '#2f5d63');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_W, GAME_H);
    const r = rng(7);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,240,${0.2 + r() * 0.6})`;
      const s = r() < 0.1 ? 2 : 1;
      ctx.fillRect(r() * GAME_W, r() * GAME_H * 0.55, s, s);
    }
    const mx = 980, my = 150;
    const halo = ctx.createRadialGradient(mx, my, 40, mx, my, 260);
    halo.addColorStop(0, 'rgba(220,255,250,0.35)'); halo.addColorStop(1, 'rgba(220,255,250,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.fillStyle = '#f4f1dc'; ctx.beginPath(); ctx.arc(mx, my, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,190,170,0.35)';
    [[-18, -14, 14], [20, 8, 10], [-6, 24, 8], [26, -22, 6]].forEach(([dx, dy, rr]) => {
      ctx.beginPath(); ctx.arc(mx + dx, my + dy, rr, 0, Math.PI * 2); ctx.fill();
    });
  });

  const W = 2048;

  canvasTex(scene, 'bg-mountains', W, GAME_H, (ctx) => {
    const ridge = (base: number, amp: number, k: number[], color: string) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, GAME_H);
      for (let x = 0; x <= W; x += 8) {
        let y = base;
        k.forEach((kk, i) => { y -= Math.sin((x / W) * Math.PI * 2 * kk + i * 1.7) * amp / (i + 1); });
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, GAME_H); ctx.closePath(); ctx.fill();
    };
    ridge(360, 90, [3, 7, 13], '#1f4253');
    ridge(420, 60, [5, 11, 17], '#183544');
  });

  canvasTex(scene, 'bg-pines-far', W, GAME_H, (ctx) => {
    const r = rng(21);
    for (let i = 0; i < 70; i++) {
      const x = r() * W, h = 140 + r() * 110;
      wrap(W, x, (xx) => pine(ctx, xx, 560 + r() * 0, h, '#13303d'));
    }
    ctx.fillStyle = '#13303d'; ctx.fillRect(0, 556, W, GAME_H - 556);
    const fog = ctx.createLinearGradient(0, 400, 0, 600);
    fog.addColorStop(0, 'rgba(120,170,170,0)'); fog.addColorStop(1, 'rgba(120,170,170,0.14)');
    ctx.fillStyle = fog; ctx.fillRect(0, 400, W, 200);
  });

  canvasTex(scene, 'bg-pines-near', W, GAME_H, (ctx) => {
    const r = rng(42);
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * W + r() * 80, h = 380 + r() * 200;
      wrap(W, x, (xx) => {
        ctx.fillStyle = '#0c1d26';
        ctx.fillRect(xx - 14, 300, 28, 360);
        pine(ctx, xx, 640, h, '#0e222c');
      });
    }
    // dark undergrowth so the forest floor reads as solid
    ctx.fillStyle = '#0a1a21';
    ctx.fillRect(0, 610, W, GAME_H - 610);
    for (let x = 0; x < W; x += 36) {
      const rr = 24 + ((x * 13) % 22);
      ctx.beginPath(); ctx.arc(x, 612, rr, Math.PI, 0); ctx.fill();
    }
  });

  canvasTex(scene, 'bg-fog', W, GAME_H, (ctx) => {
    const r = rng(5);
    for (let i = 0; i < 24; i++) {
      const x = r() * W, y = 520 + r() * 120, rx = 160 + r() * 220;
      wrap(W, x, (xx) => {
        const g = ctx.createRadialGradient(xx, y, 0, xx, y, rx);
        g.addColorStop(0, 'rgba(190,230,225,0.22)'); g.addColorStop(1, 'rgba(190,230,225,0)');
        ctx.fillStyle = g; ctx.fillRect(xx - rx, y - rx, rx * 2, rx * 2);
      });
    }
  });

  canvasTex(scene, 'ground', 512, 96, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#3d2c22'); g.addColorStop(1, '#1d140f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 96);
    const r = rng(9);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(20,14,10,${0.3 + r() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(r() * 512, 24 + r() * 70, 4 + r() * 10, 3 + r() * 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#3f6b3a'; ctx.fillRect(0, 0, 512, 12);
    ctx.fillStyle = '#5c8f47'; ctx.fillRect(0, 0, 512, 4);
    for (let x = 0; x < 512; x += 6) {
      const h = 6 + ((x * 37) % 11);
      ctx.fillStyle = x % 12 === 0 ? '#5c8f47' : '#3f6b3a';
      ctx.fillRect(x, 12, 3, h * 0.6);
    }
  });

  canvasTex(scene, 'fg-ferns', W, 220, (ctx) => {
    const r = rng(77);
    ctx.fillStyle = '#060d10';
    for (let i = 0; i < 12; i++) {
      const x = r() * W, s = 0.35 + r() * 0.45;
      wrap(W, x, (xx) => {
        for (let f = -3; f <= 3; f++) {
          ctx.save(); ctx.translate(xx, 220); ctx.rotate(f * 0.28);
          ctx.beginPath(); ctx.ellipse(0, -90 * s, 14 * s, 95 * s, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      });
    }
  });

  // Small shared textures
  canvasTex(scene, 'dot', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16);
  });

  canvasTex(scene, 'orb', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(160,250,255,1)');
    g.addColorStop(0.5, 'rgba(90,220,255,0.6)');
    g.addColorStop(1, 'rgba(90,220,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
}

/** Fossil Canyon: badlands at dusk, a blood moon over mesas, hoodoos and a dig site. */
export function makeCanyonTextures(scene: Phaser.Scene) {
  canvasTex(scene, 'cy-sky', GAME_W, GAME_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
    g.addColorStop(0, '#140f26');
    g.addColorStop(0.45, '#4a2340');
    g.addColorStop(0.75, '#a8473f');
    g.addColorStop(1, '#e08a52');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_W, GAME_H);
    const r = rng(11);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,240,230,${0.15 + r() * 0.5})`;
      ctx.fillRect(r() * GAME_W, r() * GAME_H * 0.4, 1, 1);
    }
    const mx = 300, my = 170;
    const halo = ctx.createRadialGradient(mx, my, 50, mx, my, 300);
    halo.addColorStop(0, 'rgba(255,140,110,0.35)'); halo.addColorStop(1, 'rgba(255,140,110,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.fillStyle = '#f2a07a'; ctx.beginPath(); ctx.arc(mx, my, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,70,60,0.35)';
    [[-20, -10, 16], [24, 14, 11], [5, 30, 8]].forEach(([dx, dy, rr]) => { ctx.beginPath(); ctx.arc(mx + dx, my + dy, rr, 0, Math.PI * 2); ctx.fill(); });
  });

  const W = 2048;
  // flat-topped mesas far away
  canvasTex(scene, 'cy-mesas', W, GAME_H, (ctx) => {
    const r = rng(31);
    const band = (base: number, color: string, count: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, base, W, GAME_H - base);
      for (let i = 0; i < count; i++) {
        const x = r() * W, w = 140 + r() * 260, h = 60 + r() * 140;
        wrap(W, x, (xx) => {
          ctx.beginPath();
          ctx.moveTo(xx - w / 2 - 40, base);
          ctx.lineTo(xx - w / 2, base - h);
          ctx.lineTo(xx + w / 2, base - h);
          ctx.lineTo(xx + w / 2 + 40, base);
          ctx.closePath(); ctx.fill();
        });
      }
    };
    band(470, '#6e3340', 9);
    band(520, '#55283a', 7);
  });
  // eroded spires/hoodoos with strata lines
  canvasTex(scene, 'cy-spires', W, GAME_H, (ctx) => {
    const r = rng(47);
    for (let i = 0; i < 16; i++) {
      const x = (i / 16) * W + r() * 60, w = 50 + r() * 70, h = 160 + r() * 200, base = 600;
      wrap(W, x, (xx) => {
        ctx.fillStyle = '#3f1f2c';
        ctx.beginPath();
        ctx.moveTo(xx - w / 2, base);
        ctx.lineTo(xx - w * 0.35, base - h * 0.6);
        ctx.lineTo(xx - w * 0.45, base - h * 0.75);
        ctx.lineTo(xx - w * 0.2, base - h);
        ctx.lineTo(xx + w * 0.25, base - h * 0.95);
        ctx.lineTo(xx + w * 0.4, base - h * 0.7);
        ctx.lineTo(xx + w * 0.3, base - h * 0.55);
        ctx.lineTo(xx + w / 2, base);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(120,60,60,0.5)'; ctx.lineWidth = 2;
        for (let k = 1; k < 6; k++) {
          const y = base - (h * k) / 6;
          ctx.beginPath(); ctx.moveTo(xx - w * 0.4, y); ctx.lineTo(xx + w * 0.35, y + 3); ctx.stroke();
        }
      });
    }
    ctx.fillStyle = '#3f1f2c'; ctx.fillRect(0, 596, W, GAME_H - 596);
  });
  canvasTex(scene, 'cy-dust', W, GAME_H, (ctx) => {
    const r = rng(8);
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = 500 + r() * 140, rx = 180 + r() * 240;
      wrap(W, x, (xx) => {
        const g = ctx.createRadialGradient(xx, y, 0, xx, y, rx);
        g.addColorStop(0, 'rgba(240,160,110,0.18)'); g.addColorStop(1, 'rgba(240,160,110,0)');
        ctx.fillStyle = g; ctx.fillRect(xx - rx, y - rx, rx * 2, rx * 2);
      });
    }
  });
  // near canyon walls: big dark rock masses and a natural arch
  canvasTex(scene, 'cy-near', W, GAME_H, (ctx) => {
    const r = rng(53);
    ctx.fillStyle = '#26131b';
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * W + r() * 120, w = 160 + r() * 140, h = 260 + r() * 180;
      wrap(W, x, (xx) => {
        ctx.beginPath();
        ctx.moveTo(xx - w / 2, 660);
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          ctx.lineTo(xx - w / 2 + w * t, 660 - h * (0.75 + 0.25 * Math.sin(t * Math.PI)) + (r() - 0.5) * 30);
        }
        ctx.lineTo(xx + w / 2, 660);
        ctx.closePath(); ctx.fill();
      });
    }
    // arch
    wrap(W, 1500, (xx) => {
      ctx.beginPath();
      ctx.moveTo(xx - 200, 660); ctx.lineTo(xx - 190, 330); ctx.quadraticCurveTo(xx, 220, xx + 190, 330);
      ctx.lineTo(xx + 200, 660); ctx.lineTo(xx + 130, 660); ctx.lineTo(xx + 120, 420);
      ctx.quadraticCurveTo(xx, 320, xx - 120, 420); ctx.lineTo(xx - 130, 660); ctx.closePath(); ctx.fill();
    });
    ctx.fillRect(0, 620, W, GAME_H - 620);
  });
  canvasTex(scene, 'cy-ground', 512, 96, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#9a5636'); g.addColorStop(1, '#3b1d17');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 96);
    const r = rng(19);
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = `rgba(60,25,18,${0.3 + r() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(r() * 512, 20 + r() * 74, 3 + r() * 9, 2 + r() * 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(50,20,14,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      let x = r() * 512, y = 14;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 30; y += 8 + r() * 10; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = '#c47a4c'; ctx.fillRect(0, 0, 512, 6);
    ctx.fillStyle = '#e09a62'; ctx.fillRect(0, 0, 512, 2);
  });
  canvasTex(scene, 'cy-fg', W, 220, (ctx) => {
    const r = rng(91);
    ctx.fillStyle = '#120a0c';
    for (let i = 0; i < 10; i++) {
      const x = r() * W, s = 0.4 + r() * 0.5;
      wrap(W, x, (xx) => {
        // dry brush: thin spiky blades
        for (let f = 0; f < 14; f++) {
          const a = -Math.PI / 2 + (f / 13 - 0.5) * 1.6;
          const len = (60 + r() * 70) * s;
          ctx.beginPath(); ctx.moveTo(xx - 4, 220); ctx.lineTo(xx + Math.cos(a) * len, 220 + Math.sin(a) * len); ctx.lineTo(xx + 4, 220); ctx.fill();
        }
      });
    }
  });
}

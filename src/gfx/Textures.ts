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

/** Storm Peak: a mountain summit in a night thunderstorm — jagged snowy peaks, rolling clouds, rain. */
export function makeStormTextures(scene: Phaser.Scene) {
  canvasTex(scene, 'st-sky', GAME_W, GAME_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
    g.addColorStop(0, '#05070f');
    g.addColorStop(0.5, '#141d33');
    g.addColorStop(1, '#2c3b55');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_W, GAME_H);
    // heavy cloud banks lit from inside
    const r = rng(61);
    for (let i = 0; i < 26; i++) {
      const x = r() * GAME_W, y = 40 + r() * 260, rx = 120 + r() * 220;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, rx);
      cg.addColorStop(0, `rgba(${90 + r() * 40},${100 + r() * 40},${150 + r() * 40},0.35)`);
      cg.addColorStop(1, 'rgba(40,50,80,0)');
      ctx.fillStyle = cg; ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    }
  });

  const W = 2048;
  canvasTex(scene, 'st-peaks', W, GAME_H, (ctx) => {
    const r = rng(73);
    const range = (base: number, amp: number, color: string, snow: string, count: number) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, GAME_H); ctx.lineTo(0, base);
      const pts: [number, number][] = [];
      for (let i = 0; i <= count; i++) {
        const x = (i / count) * W;
        const y = i === 0 || i === count ? base : base - amp * (0.4 + r() * 0.6);
        pts.push([x, y]);
        const mx = x + W / count / 2;
        pts.push([mx, base - amp * 0.15 * r()]);
      }
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(W, GAME_H); ctx.closePath(); ctx.fill();
      // snow caps
      ctx.fillStyle = snow;
      for (let i = 0; i < pts.length; i += 2) {
        const [x, y] = pts[i];
        if (y > base - amp * 0.5) continue;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 26, y + 40); ctx.lineTo(x - 8, y + 30); ctx.lineTo(x + 6, y + 44); ctx.lineTo(x + 28, y + 38); ctx.closePath(); ctx.fill();
      }
    };
    range(470, 260, '#1b2438', 'rgba(190,205,230,0.55)', 9);
    range(540, 180, '#141b2b', 'rgba(170,185,215,0.45)', 13);
  });
  canvasTex(scene, 'st-clouds', W, GAME_H, (ctx) => {
    const r = rng(29);
    for (let i = 0; i < 30; i++) {
      const x = r() * W, y = 180 + r() * 300, rx = 140 + r() * 200;
      wrap(W, x, (xx) => {
        const g = ctx.createRadialGradient(xx, y, 0, xx, y, rx);
        g.addColorStop(0, 'rgba(120,135,170,0.28)'); g.addColorStop(1, 'rgba(120,135,170,0)');
        ctx.fillStyle = g; ctx.fillRect(xx - rx, y - rx, rx * 2, rx * 2);
      });
    }
  });
  canvasTex(scene, 'st-mist', W, GAME_H, (ctx) => {
    const r = rng(5);
    for (let i = 0; i < 20; i++) {
      const x = r() * W, y = 540 + r() * 110, rx = 200 + r() * 240;
      wrap(W, x, (xx) => {
        const g = ctx.createRadialGradient(xx, y, 0, xx, y, rx);
        g.addColorStop(0, 'rgba(170,190,220,0.2)'); g.addColorStop(1, 'rgba(170,190,220,0)');
        ctx.fillStyle = g; ctx.fillRect(xx - rx, y - rx, rx * 2, rx * 2);
      });
    }
  });
  // near cliffs: dark crags and a few dead, wind-bent pines
  canvasTex(scene, 'st-near', W, GAME_H, (ctx) => {
    const r = rng(83);
    ctx.fillStyle = '#0b0f1a';
    for (let i = 0; i < 7; i++) {
      const x = (i / 7) * W + r() * 100, w = 150 + r() * 160, h = 200 + r() * 220;
      wrap(W, x, (xx) => {
        ctx.beginPath(); ctx.moveTo(xx - w / 2, 660);
        for (let k = 0; k <= 6; k++) {
          const t = k / 6;
          ctx.lineTo(xx - w / 2 + w * t + (r() - 0.5) * 30, 660 - h * (0.55 + 0.45 * Math.sin(t * Math.PI)) + (r() - 0.5) * 50);
        }
        ctx.lineTo(xx + w / 2, 660); ctx.closePath(); ctx.fill();
        // bent pine on top
        const tx = xx + (r() - 0.5) * w * 0.4, ty = 660 - h * 0.95;
        ctx.strokeStyle = '#0b0f1a'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(tx, ty + 10); ctx.lineTo(tx + 6, ty - 70); ctx.stroke();
        for (let b = 0; b < 4; b++) {
          ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx + 4, ty - 20 - b * 14); ctx.lineTo(tx + 40 - b * 6, ty - 30 - b * 14); ctx.stroke();
        }
      });
    }
    ctx.fillRect(0, 630, W, GAME_H - 630);
  });
  canvasTex(scene, 'st-ground', 512, 96, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#3a4252'); g.addColorStop(1, '#141822');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 96);
    const r = rng(41);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(15,18,28,${0.3 + r() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(r() * 512, 18 + r() * 76, 4 + r() * 12, 2 + r() * 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // snow crust on top
    ctx.fillStyle = '#c9d4e6'; ctx.fillRect(0, 0, 512, 7);
    ctx.fillStyle = '#eef3fb';
    for (let x = 0; x < 512; x += 18) ctx.fillRect(x, 0, 10 + ((x * 7) % 9), 3);
    ctx.fillStyle = '#9fadc4';
    for (let x = 4; x < 512; x += 23) ctx.fillRect(x, 7, 8, 3 + ((x * 13) % 5));
  });
  canvasTex(scene, 'st-fg', W, 220, (ctx) => {
    const r = rng(97);
    ctx.fillStyle = '#05070c';
    for (let i = 0; i < 9; i++) {
      const x = r() * W, s = 0.5 + r() * 0.6;
      wrap(W, x, (xx) => {
        ctx.beginPath(); ctx.moveTo(xx - 90 * s, 220);
        ctx.lineTo(xx - 50 * s, 220 - 70 * s); ctx.lineTo(xx - 10 * s, 220 - 110 * s); ctx.lineTo(xx + 40 * s, 220 - 60 * s); ctx.lineTo(xx + 100 * s, 220);
        ctx.closePath(); ctx.fill();
      });
    }
  });
  canvasTex(scene, 'raindrop', 4, 28, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 28);
    g.addColorStop(0, 'rgba(200,215,255,0)'); g.addColorStop(1, 'rgba(200,215,255,0.8)');
    ctx.fillStyle = g; ctx.fillRect(1, 0, 2, 28);
  });
}

// ---------------------------------------------------------------------------------------------
// Stage 4: Ember Mill. A Hollow-haunted lumber mill at night, the forest behind it smouldering.
export function makeMillTextures(scene: Phaser.Scene) {
  canvasTex(scene, 'mi-sky', GAME_W, GAME_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
    g.addColorStop(0, '#07060a');
    g.addColorStop(0.45, '#1c1016');
    g.addColorStop(0.78, '#4a1f14');
    g.addColorStop(1, '#7a3416');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_W, GAME_H);
    // smoke banks lit orange from below
    const r = rng(404);
    for (let i = 0; i < 24; i++) {
      const x = r() * GAME_W, y = 60 + r() * 300, rx = 120 + r() * 220;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, rx);
      cg.addColorStop(0, `rgba(${110 + r() * 50},${50 + r() * 30},${40 + r() * 20},0.25)`);
      cg.addColorStop(1, 'rgba(60,30,30,0)');
      ctx.fillStyle = cg; ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    }
    // a blood-orange moon through the smoke
    const mg = ctx.createRadialGradient(330, 150, 10, 330, 150, 150);
    mg.addColorStop(0, 'rgba(255,170,90,0.45)'); mg.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = mg; ctx.fillRect(180, 0, 300, 300);
    ctx.fillStyle = '#f2a35e'; ctx.beginPath(); ctx.arc(330, 150, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,80,40,0.35)';
    ctx.beginPath(); ctx.arc(316, 140, 10, 0, Math.PI * 2); ctx.arc(346, 166, 7, 0, Math.PI * 2); ctx.fill();
  });

  const W = 2048;
  // distant ridge of burnt pines with fire glowing along it
  canvasTex(scene, 'mi-ridge', W, GAME_H, (ctx) => {
    const r = rng(411);
    const glow = ctx.createLinearGradient(0, 380, 0, 520);
    glow.addColorStop(0, 'rgba(255,110,40,0)'); glow.addColorStop(1, 'rgba(255,110,40,0.35)');
    ctx.fillStyle = glow; ctx.fillRect(0, 380, W, 140);
    ctx.fillStyle = '#1a0e10';
    ctx.beginPath(); ctx.moveTo(0, GAME_H); ctx.lineTo(0, 500);
    for (let x = 0; x <= W; x += 64) ctx.lineTo(x, 470 + Math.sin(x / 260) * 25 + r() * 10);
    ctx.lineTo(W, GAME_H); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 70; i++) {
      const x = r() * W, h = 50 + r() * 70;
      wrap(W, x, (xx) => pine(ctx, xx, 490 + r() * 10, h, '#1a0e10'));
    }
    // flickers of fire along the ridge
    for (let i = 0; i < 28; i++) {
      const x = r() * W, y = 470 + r() * 30;
      wrap(W, x, (xx) => {
        const fg = ctx.createRadialGradient(xx, y, 0, xx, y, 26);
        fg.addColorStop(0, 'rgba(255,190,90,0.8)'); fg.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = fg; ctx.fillRect(xx - 26, y - 26, 52, 52);
      });
    }
  });
  // the mill: sheds, smokestacks, a water wheel and lit windows
  canvasTex(scene, 'mi-mill', W, GAME_H, (ctx) => {
    const r = rng(433);
    const sil = '#120a0c';
    const shed = (x: number, w: number, h: number) => {
      const base = 600;
      ctx.fillStyle = sil;
      ctx.fillRect(x, base - h, w, h);
      ctx.beginPath(); ctx.moveTo(x - 14, base - h); ctx.lineTo(x + w / 2, base - h - w * 0.32); ctx.lineTo(x + w + 14, base - h); ctx.closePath(); ctx.fill();
      // windows
      for (let k = 0; k < Math.floor(w / 60); k++) {
        const wx = x + 24 + k * 60, wy = base - h + 30 + (k % 2) * 6;
        const lit = r() < 0.6;
        ctx.fillStyle = lit ? `rgba(255,${150 + r() * 60},70,${0.6 + r() * 0.35})` : '#24161a';
        ctx.fillRect(wx, wy, 22, 26);
        ctx.fillStyle = sil; ctx.fillRect(wx + 10, wy, 2, 26); ctx.fillRect(wx, wy + 12, 22, 2);
      }
    };
    const stack = (x: number, h: number) => {
      ctx.fillStyle = sil; ctx.fillRect(x, 600 - h, 30, h); ctx.fillRect(x - 5, 600 - h, 40, 12);
      ctx.fillStyle = 'rgba(255,120,50,0.6)'; ctx.fillRect(x + 4, 600 - h - 4, 22, 5);
    };
    const wheel = (x: number, y: number, rad: number) => {
      ctx.strokeStyle = sil; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 5;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); ctx.stroke();
        ctx.fillStyle = sil; ctx.fillRect(x + Math.cos(a) * rad - 8, y + Math.sin(a) * rad - 8, 16, 16);
      }
    };
    const layout = [0, 520, 1040, 1540];
    layout.forEach((x0, i) => {
      shed(x0 + 40, 260 + (i % 2) * 60, 140 + (i % 3) * 30);
      stack(x0 + 360 + (i % 2) * 40, 260 + i * 20);
      if (i % 2 === 0) wheel(x0 + 30, 560, 70);
      // conveyor ramp
      ctx.strokeStyle = sil; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(x0 + 300, 600); ctx.lineTo(x0 + 470, 470); ctx.stroke();
    });
    ctx.fillStyle = sil; ctx.fillRect(0, 596, W, GAME_H - 596);
  });
  canvasTex(scene, 'mi-smoke', W, GAME_H, (ctx) => {
    const r = rng(447);
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = 420 + r() * 220, rx = 180 + r() * 220;
      wrap(W, x, (xx) => {
        const g = ctx.createRadialGradient(xx, y, 0, xx, y, rx);
        g.addColorStop(0, 'rgba(120,70,60,0.22)'); g.addColorStop(1, 'rgba(120,70,60,0)');
        ctx.fillStyle = g; ctx.fillRect(xx - rx, y - rx, rx * 2, rx * 2);
      });
    }
  });
  // near layer: log piles, lumber stacks and fence posts
  canvasTex(scene, 'mi-near', W, GAME_H, (ctx) => {
    const r = rng(459);
    const sil = '#0c0708';
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * W + r() * 80;
      wrap(W, x, (xx) => {
        if (i % 3 === 0) {
          // pyramid of log ends
          const rows = 4;
          for (let row = 0; row < rows; row++) {
            for (let k = 0; k < rows - row; k++) {
              const cx = xx + k * 46 + row * 23, cy = 640 - 22 - row * 40;
              ctx.fillStyle = sil; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = 'rgba(120,60,30,0.45)'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.stroke();
            }
          }
        } else if (i % 3 === 1) {
          // lumber stack
          ctx.fillStyle = sil;
          for (let k = 0; k < 6; k++) ctx.fillRect(xx, 640 - 18 - k * 18, 170 - (k % 2) * 10, 14);
        } else {
          // fence
          ctx.fillStyle = sil;
          for (let k = 0; k < 6; k++) ctx.fillRect(xx + k * 34, 560, 8, 80);
          ctx.fillRect(xx - 6, 580, 200, 7); ctx.fillRect(xx - 6, 610, 200, 7);
        }
      });
    }
    ctx.fillStyle = sil; ctx.fillRect(0, 630, W, GAME_H - 630);
  });
  canvasTex(scene, 'mi-ground', 512, 96, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#5a3a24'); g.addColorStop(1, '#1e120c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 96);
    const r = rng(467);
    // sawdust and wood chips
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(${190 + r() * 50},${140 + r() * 40},${80 + r() * 30},${0.15 + r() * 0.3})`;
      ctx.fillRect(r() * 512, 6 + r() * 88, 2 + r() * 5, 1 + r() * 2);
    }
    // plank walkway on top
    ctx.fillStyle = '#6e4a2c'; ctx.fillRect(0, 0, 512, 12);
    ctx.fillStyle = '#3a2416';
    for (let x = 0; x < 512; x += 64) ctx.fillRect(x, 0, 3, 12);
    ctx.fillStyle = 'rgba(255,200,140,0.25)'; ctx.fillRect(0, 0, 512, 2);
  });
  canvasTex(scene, 'mi-fg', W, 220, (ctx) => {
    const r = rng(479);
    ctx.fillStyle = '#050304';
    for (let i = 0; i < 10; i++) {
      const x = r() * W, s = 0.6 + r() * 0.6;
      wrap(W, x, (xx) => {
        if (i % 2) {
          // sawn stump
          ctx.fillRect(xx - 40 * s, 220 - 70 * s, 80 * s, 70 * s);
          ctx.beginPath(); ctx.ellipse(xx, 220 - 70 * s, 40 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          // tufts of dry grass
          for (let k = 0; k < 9; k++) {
            ctx.beginPath(); ctx.moveTo(xx + (k - 4) * 9 * s, 220); ctx.lineTo(xx + (k - 4) * 14 * s, 220 - (60 + r() * 50) * s); ctx.lineTo(xx + (k - 3.6) * 9 * s, 220); ctx.fill();
          }
        }
      });
    }
  });
  canvasTex(scene, 'ember', 8, 8, (ctx) => {
    const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, 'rgba(255,230,160,1)'); g.addColorStop(0.5, 'rgba(255,140,50,0.8)'); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 8);
  });
}

// ---------------------------------------------------------------------------------------------
// Stage 5: Tar Pit Bayou. Cypress swamp at night, hanging moss, tar seeping up through the water.
export function makeBayouTextures(scene: Phaser.Scene) {
  canvasTex(scene, 'ba-sky', GAME_W, GAME_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
    g.addColorStop(0, '#040a0a'); g.addColorStop(0.5, '#0d1c1a'); g.addColorStop(1, '#1e3330');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_W, GAME_H);
    const r = rng(501);
    for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(220,240,230,${0.2 + r() * 0.5})`; ctx.fillRect(r() * GAME_W, r() * 300, 1.5, 1.5); }
    // a hazy green-tinged moon low over the swamp
    const mg = ctx.createRadialGradient(960, 170, 10, 960, 170, 170);
    mg.addColorStop(0, 'rgba(200,240,200,0.35)'); mg.addColorStop(1, 'rgba(160,220,180,0)');
    ctx.fillStyle = mg; ctx.fillRect(790, 0, 340, 340);
    ctx.fillStyle = '#d8ecd0'; ctx.beginPath(); ctx.arc(960, 170, 52, 0, Math.PI * 2); ctx.fill();
  });
  const W = 2048;
  const cypress = (ctx: CanvasRenderingContext2D, x: number, base: number, h: number, col: string, moss: string, r: () => number) => {
    ctx.fillStyle = col;
    // flared buttress trunk
    ctx.beginPath(); ctx.moveTo(x - h * 0.12, base); ctx.quadraticCurveTo(x - h * 0.03, base - h * 0.3, x - h * 0.025, base - h * 0.85);
    ctx.lineTo(x + h * 0.025, base - h * 0.85); ctx.quadraticCurveTo(x + h * 0.03, base - h * 0.3, x + h * 0.12, base); ctx.closePath(); ctx.fill();
    // flat-topped crown
    for (let k = 0; k < 5; k++) {
      ctx.beginPath(); ctx.ellipse(x + (k - 2) * h * 0.09, base - h * (0.85 + (k % 2) * 0.06), h * 0.16, h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    }
    // hanging moss
    ctx.strokeStyle = moss; ctx.lineWidth = 2;
    for (let k = 0; k < 12; k++) {
      const mx = x + (r() - 0.5) * h * 0.5, my = base - h * (0.78 + r() * 0.08), len = h * (0.1 + r() * 0.2);
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo(mx + 6, my + len / 2, mx - 2, my + len); ctx.stroke();
    }
  };
  canvasTex(scene, 'ba-far', W, GAME_H, (ctx) => {
    const r = rng(511);
    for (let i = 0; i < 16; i++) { const x = r() * W; wrap(W, x, (xx) => cypress(ctx, xx, 520, 260 + r() * 120, '#0f1f1d', 'rgba(70,100,85,0.5)', r)); }
    ctx.fillStyle = '#0f1f1d'; ctx.fillRect(0, 515, W, GAME_H - 515);
  });
  canvasTex(scene, 'ba-mid', W, GAME_H, (ctx) => {
    const r = rng(523);
    for (let i = 0; i < 9; i++) { const x = (i / 9) * W + r() * 120; wrap(W, x, (xx) => cypress(ctx, xx, 600, 380 + r() * 140, '#081311', 'rgba(90,120,100,0.7)', r)); }
    ctx.fillStyle = '#081311'; ctx.fillRect(0, 596, W, GAME_H - 596);
    // glints of water with tar slicks
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() < 0.3 ? 'rgba(196,107,255,0.25)' : 'rgba(170,220,200,0.18)';
      ctx.fillRect(r() * W, 600 + r() * 30, 20 + r() * 50, 2);
    }
  });
  canvasTex(scene, 'ba-mist', W, GAME_H, (ctx) => {
    const r = rng(531);
    for (let i = 0; i < 24; i++) {
      const x = r() * W, y = 470 + r() * 180, rx = 180 + r() * 240;
      wrap(W, x, (xx) => {
        const g = ctx.createRadialGradient(xx, y, 0, xx, y, rx);
        g.addColorStop(0, 'rgba(150,200,180,0.2)'); g.addColorStop(1, 'rgba(150,200,180,0)');
        ctx.fillStyle = g; ctx.fillRect(xx - rx, y - rx, rx * 2, rx * 2);
      });
    }
  });
  canvasTex(scene, 'ba-near', W, GAME_H, (ctx) => {
    const r = rng(541);
    ctx.fillStyle = '#040908';
    for (let i = 0; i < 10; i++) {
      const x = (i / 10) * W + r() * 90;
      wrap(W, x, (xx) => {
        if (i % 2) {
          // cypress knees poking out of the water
          for (let k = 0; k < 5; k++) { const kx = xx + k * 26, kh = 30 + r() * 50; ctx.beginPath(); ctx.moveTo(kx - 9, 640); ctx.quadraticCurveTo(kx, 640 - kh * 1.4, kx + 9, 640); ctx.fill(); }
        } else {
          // reeds and cattails
          for (let k = 0; k < 14; k++) {
            const rx = xx + k * 9, rh = 70 + r() * 80;
            ctx.fillRect(rx, 640 - rh, 3, rh);
            if (k % 3 === 0) { ctx.beginPath(); ctx.ellipse(rx + 1.5, 640 - rh - 10, 5, 14, 0, 0, Math.PI * 2); ctx.fill(); }
          }
        }
      });
    }
    ctx.fillRect(0, 630, W, GAME_H - 630);
  });
  canvasTex(scene, 'ba-ground', 512, 96, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#2e3a26'); g.addColorStop(1, '#0e140c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 96);
    const r = rng(553);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(10,14,8,${0.3 + r() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(r() * 512, 14 + r() * 80, 6 + r() * 16, 2 + r() * 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // mossy, muddy bank on top
    ctx.fillStyle = '#4a5e34'; ctx.fillRect(0, 0, 512, 8);
    ctx.fillStyle = '#6a7e44'; for (let x = 0; x < 512; x += 14) ctx.fillRect(x, 0, 8 + ((x * 7) % 6), 3);
  });
  canvasTex(scene, 'ba-fg', W, 220, (ctx) => {
    const r = rng(563);
    ctx.fillStyle = '#020403';
    for (let i = 0; i < 10; i++) {
      const x = r() * W, s = 0.6 + r() * 0.6;
      wrap(W, x, (xx) => {
        for (let k = 0; k < 8; k++) {
          ctx.beginPath(); ctx.moveTo(xx + (k - 4) * 10 * s, 220); ctx.quadraticCurveTo(xx + (k - 4) * 16 * s, 220 - 90 * s, xx + (k - 4) * 22 * s + 20, 220 - (100 + r() * 60) * s); ctx.lineTo(xx + (k - 3.5) * 10 * s, 220); ctx.fill();
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Stage 6: The Hollow Rift. The meteor's crater: void sky torn open, purple crystal spires, floating rocks.
export function makeRiftTextures(scene: Phaser.Scene) {
  canvasTex(scene, 'ri-sky', GAME_W, GAME_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
    g.addColorStop(0, '#05020a'); g.addColorStop(0.55, '#170a26'); g.addColorStop(1, '#2c1240');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_W, GAME_H);
    const r = rng(601);
    for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(230,210,255,${0.2 + r() * 0.6})`; ctx.fillRect(r() * GAME_W, r() * GAME_H * 0.7, 1.5, 1.5); }
    // the rift: a jagged tear of light in the sky
    const cx = 760, cy = 170;
    const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 300);
    rg.addColorStop(0, 'rgba(196,107,255,0.55)'); rg.addColorStop(1, 'rgba(196,107,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(cx - 300, cy - 300, 600, 600);
    ctx.fillStyle = '#f2e0ff';
    ctx.beginPath(); ctx.moveTo(cx - 180, cy + 20);
    const pts = [[-120, -14], [-70, 12], [-20, -22], [30, 8], [80, -18], [140, 6], [190, -10]];
    pts.forEach(([x, y]) => ctx.lineTo(cx + x, cy + y - 6));
    pts.slice().reverse().forEach(([x, y]) => ctx.lineTo(cx + x - 6, cy + y + 10));
    ctx.closePath(); ctx.fill();
  });
  const W = 2048;
  const crystal = (ctx: CanvasRenderingContext2D, x: number, base: number, h: number, w: number, lean: number, col: string, glow: string) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - w / 2, base); ctx.lineTo(x - w * 0.3 + lean, base - h * 0.8); ctx.lineTo(x + lean, base - h); ctx.lineTo(x + w * 0.3 + lean, base - h * 0.8); ctx.lineTo(x + w / 2, base); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = glow; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + lean * 0.5, base - 4); ctx.lineTo(x + lean, base - h + 6); ctx.stroke();
  };
  canvasTex(scene, 'ri-far', W, GAME_H, (ctx) => {
    const r = rng(611);
    // crater rim
    ctx.fillStyle = '#150a20';
    ctx.beginPath(); ctx.moveTo(0, GAME_H); ctx.lineTo(0, 470);
    for (let x = 0; x <= W; x += 64) ctx.lineTo(x, 450 + Math.sin(x / 300) * 30 + r() * 16);
    ctx.lineTo(W, GAME_H); ctx.closePath(); ctx.fill();
    // floating rocks
    for (let i = 0; i < 14; i++) {
      const x = r() * W, y = 120 + r() * 240, s = 14 + r() * 30;
      wrap(W, x, (xx) => {
        ctx.fillStyle = '#1e1030';
        ctx.beginPath(); ctx.moveTo(xx - s, y); ctx.lineTo(xx + s, y - s * 0.2); ctx.lineTo(xx + s * 0.4, y + s * 1.2); ctx.lineTo(xx - s * 0.5, y + s * 0.9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(196,107,255,0.6)'; ctx.fillRect(xx - s * 0.3, y + s * 0.2, 3, 3);
      });
    }
  });
  canvasTex(scene, 'ri-mid', W, GAME_H, (ctx) => {
    const r = rng(623);
    for (let i = 0; i < 18; i++) {
      const x = r() * W;
      wrap(W, x, (xx) => crystal(ctx, xx, 610, 120 + r() * 220, 40 + r() * 50, (r() - 0.5) * 40, '#241038', 'rgba(196,107,255,0.7)'));
    }
    ctx.fillStyle = '#1a0c28'; ctx.fillRect(0, 600, W, GAME_H - 600);
  });
  canvasTex(scene, 'ri-haze', W, GAME_H, (ctx) => {
    const r = rng(631);
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = 420 + r() * 230, rx = 180 + r() * 220;
      wrap(W, x, (xx) => {
        const g = ctx.createRadialGradient(xx, y, 0, xx, y, rx);
        g.addColorStop(0, 'rgba(160,90,220,0.2)'); g.addColorStop(1, 'rgba(160,90,220,0)');
        ctx.fillStyle = g; ctx.fillRect(xx - rx, y - rx, rx * 2, rx * 2);
      });
    }
  });
  canvasTex(scene, 'ri-near', W, GAME_H, (ctx) => {
    const r = rng(641);
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * W + r() * 120;
      wrap(W, x, (xx) => {
        for (let k = 0; k < 3; k++) crystal(ctx, xx + k * 34, 640, 140 + r() * 200, 34 + r() * 26, (k - 1) * 20, '#0c0614', 'rgba(220,160,255,0.85)');
      });
    }
    ctx.fillStyle = '#0c0614'; ctx.fillRect(0, 630, W, GAME_H - 630);
  });
  canvasTex(scene, 'ri-ground', 512, 96, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#2a1838'); g.addColorStop(1, '#0c0614');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 96);
    const r = rng(653);
    // glowing cracks
    ctx.strokeStyle = 'rgba(196,107,255,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      let x = r() * 512, y = 10 + r() * 20;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 40; y += 10 + r() * 14; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = '#4a2c60'; ctx.fillRect(0, 0, 512, 6);
    ctx.fillStyle = '#c46bff'; for (let x = 6; x < 512; x += 37) ctx.fillRect(x, 0, 6, 2);
  });
  canvasTex(scene, 'ri-fg', W, 220, (ctx) => {
    const r = rng(661);
    for (let i = 0; i < 9; i++) {
      const x = r() * W, s = 0.6 + r() * 0.6;
      wrap(W, x, (xx) => crystal(ctx, xx, 220, 120 * s, 50 * s, (r() - 0.5) * 30, '#030106', 'rgba(196,107,255,0.4)'));
    }
  });
}

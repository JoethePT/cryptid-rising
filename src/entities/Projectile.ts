import Phaser from 'phaser';
import { COLORS, GROUND_Y } from '../config';

export type ProjKind = 'log' | 'pwave' | 'ewave' | 'spike' | 'shard';

const SPIKE_WARN = 0.75;

/** Lightweight manually-simulated projectile (no physics body). Position is the rect centre. */
export class Projectile {
  readonly g: Phaser.GameObjects.Graphics;
  x: number; y: number; vx: number; vy = 0;
  w: number; h: number;
  dmg: number; knock: number; heavy = true;
  owner: 'player' | 'enemy';
  life: number; grav = 0; pierce = false;
  hit = new Set<object>();
  dead = false;
  private age = 0;

  constructor(scene: Phaser.Scene, readonly kind: ProjKind, x: number, y: number, readonly dir: number, dmgMul = 1) {
    this.x = x; this.y = y;
    this.g = scene.add.graphics().setDepth(12);
    switch (kind) {
      case 'log':
        this.owner = 'player'; this.vx = dir * 720; this.vy = -260; this.grav = 900;
        this.w = 64; this.h = 26; this.dmg = 34 * dmgMul; this.knock = 360; this.life = 2;
        break;
      case 'pwave':
        this.owner = 'player'; this.vx = dir * 640; this.w = 54; this.h = 48;
        this.dmg = 22 * dmgMul; this.knock = 300; this.life = 0.6; this.pierce = true;
        this.g.setBlendMode(Phaser.BlendModes.ADD);
        break;
      case 'spike':
        // erupts from the ground after a glowing warning crack
        this.owner = 'enemy'; this.vx = 0; this.w = 54; this.h = 110;
        this.dmg = 16 * dmgMul; this.knock = 0; this.life = SPIKE_WARN + 0.45; this.pierce = true;
        this.y = GROUND_Y - this.h / 2;
        break;
      case 'shard':
        // bone shard dropped from the sky; a shadow on the ground shows where it lands
        this.owner = 'enemy'; this.vx = 0; this.vy = 0; this.grav = 900; this.w = 34; this.h = 56;
        this.dmg = 14 * dmgMul; this.knock = 0; this.life = 3; this.pierce = false;
        break;
      case 'ewave':
        this.owner = 'enemy'; this.vx = dir * 470; this.w = 44; this.h = 46;
        this.dmg = 18 * dmgMul; this.knock = 0; this.life = 2.4; this.pierce = true;
        this.g.setBlendMode(Phaser.BlendModes.ADD);
        break;
    }
    this.draw();
  }

  /** Spikes are harmless while their warning is showing. */
  get harmless() { return this.kind === 'spike' && this.age < SPIKE_WARN; }

  rect() {
    return new Phaser.Geom.Rectangle(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
  }

  update(dt: number, fx: { burst: (x: number, y: number, c: number, n: number) => void }) {
    this.age += dt;
    this.life -= dt;
    this.vy += this.grav * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.kind === 'shard' && this.y >= GROUND_Y - this.h / 2) {
      fx.burst(this.x, GROUND_Y - 6, 0xe8dcc0, 12);
      this.kill();
      return;
    }
    if (this.kind === 'log' && this.y >= GROUND_Y - this.h / 2) {
      fx.burst(this.x, GROUND_Y - 10, 0x9a6a3a, 14);
      this.kill();
      return;
    }
    if (this.life <= 0) { this.kill(); return; }
    this.draw();
  }

  private draw() {
    const g = this.g;
    g.clear();
    g.setPosition(this.x, this.y);
    if (this.kind === 'spike') {
      g.rotation = 0;
      const base = this.h / 2;
      if (this.age < SPIKE_WARN) {
        const a = 0.4 + 0.5 * Math.abs(Math.sin(this.age * 18));
        g.fillStyle(COLORS.hollow, 0.25 * a); g.fillEllipse(0, base - 2, 90, 18);
        g.lineStyle(3, COLORS.hollow, a);
        g.lineBetween(-30, base - 2, -8, base - 6); g.lineBetween(-8, base - 6, 10, base); g.lineBetween(10, base, 30, base - 4);
        return;
      }
      const rise = Math.min(1, (this.age - SPIKE_WARN) / 0.08);
      const fade = this.life < 0.12 ? this.life / 0.12 : 1;
      const top = base - this.h * rise;
      g.fillStyle(COLORS.outline, fade);
      g.fillTriangle(-30, base, 30, base, 0, top - 4);
      g.fillStyle(0xe8dcc0, fade);
      g.fillTriangle(-24, base, 24, base, 0, top);
      g.fillStyle(0xbfae8a, fade);
      g.fillTriangle(4, base, 24, base, 0, top);
      g.fillStyle(COLORS.hollow, 0.6 * fade); g.fillCircle(0, base - this.h * 0.35 * rise, 5);
      return;
    }
    if (this.kind === 'shard') {
      g.rotation = 0;
      // shadow on the ground grows as the shard approaches
      const k = Phaser.Math.Clamp(1 - (GROUND_Y - this.y) / 700, 0.15, 1);
      g.fillStyle(0x000000, 0.45 * k); g.fillEllipse(0, GROUND_Y - this.y - 4, 60 * k, 12 * k);
      g.fillStyle(COLORS.hollow, 0.3 * k); g.fillEllipse(0, GROUND_Y - this.y - 4, 70 * k, 16 * k);
      g.fillStyle(COLORS.outline, 1);
      g.fillTriangle(-12, -26, 12, -26, 0, 30);
      g.fillStyle(0xe8dcc0, 1);
      g.fillTriangle(-9, -24, 9, -24, 0, 26);
      g.fillStyle(0xd4c29c, 1); g.fillCircle(0, -26, 9);
      return;
    }
    if (this.kind === 'log') {
      g.rotation = this.age * 14 * this.dir;
      g.fillStyle(COLORS.outline, 1); g.fillRoundedRect(-34, -15, 68, 30, 12);
      g.fillStyle(0x7a4e2a, 1); g.fillRoundedRect(-31, -12, 62, 24, 10);
      g.fillStyle(0x5c3a1f, 1); g.fillRect(-20, -6, 30, 3); g.fillRect(-8, 4, 26, 3);
      g.fillStyle(0xd9b07a, 1); g.fillEllipse(29, 0, 10, 22);
      g.lineStyle(2, 0x9a6a3a, 1); g.strokeEllipse(29, 0, 5, 12);
    } else {
      const col = this.kind === 'pwave' ? COLORS.beast : COLORS.hollow;
      const a = this.kind === 'pwave' ? Math.min(1, this.life * 3) : 1;
      const flick = Math.sin(this.age * 40) * 3;
      g.fillStyle(col, 0.35 * a); g.fillEllipse(0, 6, this.w * 1.5, this.h * 1.2);
      g.fillStyle(col, 0.85 * a);
      g.fillTriangle(-this.w / 2 * this.dir, this.h / 2, this.w / 2 * this.dir, this.h / 2, this.w * 0.15 * this.dir, -this.h / 2 - flick);
      g.fillStyle(0xffffff, 0.8 * a);
      g.fillTriangle(-this.w / 4 * this.dir, this.h / 2, this.w / 3 * this.dir, this.h / 2, this.w * 0.12 * this.dir, -this.h / 6);
    }
  }

  kill() {
    this.dead = true;
    this.g.destroy();
  }
}

/** Spirit orb dropped by carriers. Pops up, lands, bobs, and drifts toward a nearby player. */
export class Orb {
  readonly img: Phaser.GameObjects.Image;
  private vy = -520;
  private landed = false;
  private t = 0;
  private baseY = 0;
  dead = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.img = scene.add.image(x, y, 'orb').setBlendMode(Phaser.BlendModes.ADD).setDepth(11).setScale(1.1);
  }

  update(dt: number, px: number, py: number) {
    this.t += dt;
    const img = this.img;
    if (!this.landed) {
      this.vy += 1400 * dt;
      img.y += this.vy * dt;
      if (img.y >= GROUND_Y - 34) { img.y = GROUND_Y - 34; this.landed = true; this.baseY = img.y; }
    } else {
      img.y = this.baseY + Math.sin(this.t * 3) * 7;
    }
    img.setScale(1.05 + Math.sin(this.t * 8) * 0.12);
    const d = Phaser.Math.Distance.Between(img.x, img.y, px, py);
    if (this.t > 0.35 && d < 170) {
      const k = Math.min(1, (360 * dt) / d);
      img.x += (px - img.x) * k;
      if (this.landed) this.baseY += (py - this.baseY) * k * 0.5;
    }
    return this.t > 0.35 && d < 55;
  }

  destroy() {
    this.dead = true;
    this.img.destroy();
  }
}

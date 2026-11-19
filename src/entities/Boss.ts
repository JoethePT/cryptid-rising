import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { GROUND_Y } from '../config';
import { COLORS } from '../config';
import { drawMoose, MooseState } from '../gfx/Puppet';
import { audio } from '../systems/Audio';
import { Enemy } from './Enemies';

/**
 * Stage 1 boss. Attack loop:
 *  - CHARGE: paws the ground (telegraph), then rams across the arena. Hitting the wall stuns it (punish window).
 *  - REAR + SLAM: rears up and stomps, sending shockwaves both ways (jump them).
 *  - SUMMON: at 55% and 25% HP it bellows and calls in Husks.
 * Below 50% HP it is enraged: faster charges, shorter pauses.
 */
export class MooseTitan extends Enemy {
  private mode: MooseState | 'enter' = 'enter';
  private modeT = 0;
  private modeLen = 1;
  private summons = [0.55, 0.25];
  private slammed = false;

  constructor(gs: GameScene, x: number, private arenaL: number, private arenaR: number) {
    super(gs, x, GROUND_Y, 650, 250, 250);
    this.useSprites(['moose-walk', 'moose-charge'], COLORS.hollow, 2.5);
    this.isBoss = true;
    this.facing = -1;
    this.score = 5000;
    this.setDepth(8);
  }

  get enraged() { return this.hp < this.maxHp * 0.5; }

  private set(mode: MooseState | 'enter', len: number) {
    this.mode = mode; this.modeT = len; this.modeLen = len;
  }

  protected onHit() {
    // bosses don't get knocked around; a tiny shove sells the impact
    this.body.setVelocityX(this.body.velocity.x * 0.5);
  }

  protected think(dt: number) {
    const p = this.player;
    this.modeT -= dt;
    const b = this.body;
    const leftWall = this.arenaL + 150, rightWall = this.arenaR - 150;

    switch (this.mode) {
      case 'enter':
        b.setVelocityX(-130);
        if (this.x < this.arenaR - 230) this.set('idle', 1.0);
        break;
      case 'idle':
      case 'walk': {
        this.faceToward(p.x);
        const dist = Math.abs(p.x - this.x);
        b.setVelocityX(dist > 360 ? this.facing * 110 : 0);
        this.mode = dist > 360 ? 'walk' : 'idle';
        if (this.modeT <= 0) {
          const pending = this.summons.length && this.hp < this.maxHp * this.summons[0];
          if (pending) { this.summons.shift(); this.set('summon', 1.1); audio.sfx('roar'); b.setVelocityX(0); this.gs.events.emit('banner', 'THE TITAN BELLOWS!', '#d68bff', 40); }
          else if (Math.random() < (dist > 320 ? 0.65 : 0.4)) { this.set('windup', this.enraged ? 0.55 : 0.8); b.setVelocityX(0); }
          else { this.set('rear', 0.7); this.slammed = false; b.setVelocityX(0); }
        }
        break;
      }
      case 'windup':
        b.setVelocityX(0);
        if (this.modeT <= 0) { this.set('charge', 3); this.contactDmg = 22; }
        break;
      case 'charge':
        b.setVelocityX(this.facing * (this.enraged ? 700 : 560));
        if ((this.facing < 0 && this.x <= leftWall) || (this.facing > 0 && this.x >= rightWall)) {
          this.x = Phaser.Math.Clamp(this.x, leftWall, rightWall);
          b.setVelocityX(0);
          this.contactDmg = 0;
          this.set('stunned', this.enraged ? 1.1 : 1.6);
          this.gs.fx.shake(0.016, 300);
          this.gs.fx.burst(this.x + this.facing * 150, this.y - 160, 0xd8cbb0, 24);
          this.gs.bossWallImpact(this.facing < 0 ? leftWall - 90 : rightWall + 90);
        }
        break;
      case 'stunned':
        b.setVelocityX(0);
        if (this.modeT <= 0) this.set('idle', 0.6);
        break;
      case 'rear':
        b.setVelocityX(0);
        if (this.modeT <= 0) { this.set('slam', 0.5); }
        break;
      case 'slam':
        if (!this.slammed) {
          this.slammed = true;
          this.gs.bossSlam(this.x + this.facing * 170, this.enraged);
          this.contactDmg = 16;
        } else if (this.modeT < 0.35) {
          this.contactDmg = 0;
        }
        if (this.modeT <= 0) this.set('idle', this.enraged ? 0.6 : 1.0);
        break;
      case 'summon':
        if (this.modeT <= 0) {
          this.gs.spawnEnemy('husk', -1);
          this.gs.spawnEnemy('husk', 1);
          this.gs.spawnEnemy('crow', 1);
          this.set('idle', 0.8);
        }
        break;
    }
    // stay inside the arena
    this.x = Phaser.Math.Clamp(this.x, leftWall - 10, this.arenaR + 400);
  }

  protected render() {
    const p = 1 - this.modeT / this.modeLen;
    if (this.spr) {
      const t = this.animT, g = this.g;
      g.clear();
      const rear = this.mode === 'rear' ? Phaser.Math.Easing.Quadratic.Out(p) : this.mode === 'slam' ? Math.max(0, 1 - p * 4) : 0;
      const s = this.enraged ? 1.06 : 1;
      if (this.mode === 'charge') {
        const ph = t * 16;
        this.pose('moose-charge', { scale: s, dy: -Math.abs(Math.sin(ph)) * 8, rot: Math.sin(ph) * 0.03 });
      } else if (this.mode === 'windup') {
        this.pose('moose-charge', { scale: s, dx: Math.sin(t * 30) * 4, sy: 0.97 });
      } else if (this.mode === 'stunned') {
        this.pose('moose-walk', { scale: s, rot: 0.06, dy: 4 });
        for (let i = 0; i < 3; i++) {
          const a = t * 5 + (i * Math.PI * 2) / 3;
          const x = this.facing * 150 + Math.cos(a) * 40, y = -300 + Math.sin(a) * 12;
          g.fillStyle(0xffe066, 1).fillCircle(x, y, 7);
          g.fillStyle(0xffffff, 1).fillCircle(x, y, 3);
        }
      } else {
        const moving = Math.abs(this.body.velocity.x) > 5;
        const ph = t * 7;
        this.pose('moose-walk', {
          scale: s, rot: -rear * 0.4, dx: -rear * 40, dy: moving ? -Math.abs(Math.sin(ph)) * 5 : 0,
          sy: moving ? 1 : 1 + Math.sin(t * 2) * 0.01,
        });
      }
      if (this.mode === 'summon') {
        g.lineStyle(5, this.enraged ? 0xff5ad0 : COLORS.hollow, 1 - p);
        g.strokeCircle(this.facing * 200, -240, 30 + p * 160);
      }
      return;
    }
    let state: MooseState = this.mode === 'enter' ? 'walk' : this.mode;
    if (state === 'slam') state = 'idle';
    drawMoose(this.g, this.animT, state, p, this.flashT > 0, this.enraged);
    this.g.setScale(this.facing, 1);
    // rear up: rotate around the back hooves
    const rear = this.mode === 'rear' ? Phaser.Math.Easing.Quadratic.Out(p) : this.mode === 'slam' ? Math.max(0, 1 - p * 4) : 0;
    this.g.rotation = -rear * 0.42 * this.facing;
    this.g.x = -this.facing * rear * 30;
    this.g.y = -rear * 10;
  }
}

type GolemMode = 'enter' | 'idle' | 'walk' | 'windup' | 'lunge' | 'roar' | 'spikes' | 'recover' | 'summon';

/**
 * Stage 2 boss: a corrupted tyrannosaurus fossil.
 *  - LUNGE BITE: rears back (telegraph) then snaps forward fast across the floor.
 *  - BONE SPIKES: a row of spikes erupts toward the player; each glows first, so keep moving.
 *  - SHARD RAIN: roars at the sky and bone shards fall at the player's position (watch the shadows).
 *  - SUMMON at 55% / 25% HP. Enraged below 50%: more spikes and shards.
 */
export class FossilGolem extends Enemy {
  private mode: GolemMode = 'enter';
  private modeT = 0;
  private modeLen = 1;
  private summons = [0.55, 0.25];
  private didAct = false;

  constructor(gs: GameScene, x: number, private arenaL: number, private arenaR: number) {
    super(gs, x, GROUND_Y, 760, 260, 230);
    this.useSprites(['golem-walk', 'golem-roar', 'golem-lunge'], COLORS.hollow, 2.5);
    this.isBoss = true;
    this.facing = -1;
    this.score = 7000;
    this.setDepth(8);
  }

  get enraged() { return this.hp < this.maxHp * 0.5; }

  private set(mode: GolemMode, len: number) {
    this.mode = mode; this.modeT = len; this.modeLen = len; this.didAct = false;
  }

  protected onHit() {
    this.body.setVelocityX(this.body.velocity.x * 0.5);
  }

  protected think(dt: number) {
    const p = this.player, b = this.body;
    this.modeT -= dt;
    const leftWall = this.arenaL + 170, rightWall = this.arenaR - 170;
    switch (this.mode) {
      case 'enter':
        b.setVelocityX(-120);
        if (this.x < this.arenaR - 260) this.set('roar', 1.2);
        break;
      case 'idle':
      case 'walk': {
        this.faceToward(p.x);
        const dist = Math.abs(p.x - this.x);
        b.setVelocityX(dist > 380 ? this.facing * 100 : 0);
        this.mode = dist > 380 ? 'walk' : 'idle';
        if (this.modeT <= 0) {
          b.setVelocityX(0);
          if (this.summons.length && this.hp < this.maxHp * this.summons[0]) {
            this.summons.shift(); this.set('summon', 1.1); audio.sfx('roar');
            this.gs.events.emit('banner', 'THE BONES STIR!', '#d68bff', 40);
          } else {
            const r = Math.random();
            if (dist < 420 && r < 0.45) this.set('windup', this.enraged ? 0.5 : 0.75);
            else if (r < 0.75) this.set('spikes', 1.6);
            else this.set('roar', 1.4);
          }
        }
        break;
      }
      case 'windup':
        b.setVelocityX(-this.facing * 30);
        if (this.modeT <= 0) { audio.sfx('pounce'); this.set('lunge', 0.55); this.contactDmg = 20; b.setVelocityX(this.facing * (this.enraged ? 820 : 700)); }
        break;
      case 'lunge':
        b.setVelocityX(b.velocity.x * 0.96);
        if (this.x <= leftWall || this.x >= rightWall) { b.setVelocityX(0); this.x = Phaser.Math.Clamp(this.x, leftWall, rightWall); }
        if (this.modeT <= 0) { this.contactDmg = 0; this.set('recover', this.enraged ? 0.7 : 1.1); }
        break;
      case 'spikes':
        b.setVelocityX(0);
        if (!this.didAct) {
          this.didAct = true;
          this.gs.fx.shake(0.012, 250);
          const n = this.enraged ? 7 : 5;
          const dir = p.x < this.x ? -1 : 1;
          for (let i = 0; i < n; i++) {
            this.gs.time.delayedCall(i * 130, () => {
              if (this.dead) return;
              const x = this.x + dir * (170 + i * 120);
              if (x > this.arenaL + 20 && x < this.arenaR - 20) this.gs.spawnProjectile('spike', x, GROUND_Y, dir);
            });
          }
        }
        if (this.modeT <= 0) this.set('idle', this.enraged ? 0.6 : 1.0);
        break;
      case 'roar':
        b.setVelocityX(0);
        if (!this.didAct && this.modeT < this.modeLen - 0.4) {
          this.didAct = true;
          audio.sfx('roar');
          this.gs.fx.shake(0.01, 500);
          const n = this.enraged ? 9 : 6;
          for (let i = 0; i < n; i++) {
            this.gs.time.delayedCall(200 + i * 160, () => {
              if (this.dead) return;
              const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-220, 220), this.arenaL + 30, this.arenaR - 30);
              this.gs.spawnProjectile('shard', x, -60, 1);
            });
          }
        }
        if (this.modeT <= 0) this.set('idle', 0.9);
        break;
      case 'recover':
        b.setVelocityX(0);
        if (this.modeT <= 0) this.set('idle', 0.5);
        break;
      case 'summon':
        if (this.modeT <= 0) {
          this.gs.spawnEnemy('husk', -1);
          this.gs.spawnEnemy('husk', 1);
          this.gs.spawnEnemy('crow', -1);
          this.set('idle', 0.8);
        }
        break;
    }
    this.x = Phaser.Math.Clamp(this.x, leftWall - 10, this.arenaR + 400);
  }

  protected render() {
    const p = 1 - this.modeT / this.modeLen;
    const t = this.animT, s = this.enraged ? 1.06 : 1;
    this.g.clear();
    if (!this.spr) return;
    switch (this.mode) {
      case 'windup': this.pose('golem-roar', { scale: s, dx: -10 * p, rot: -0.05 * p }); break;
      case 'lunge': this.pose('golem-lunge', { scale: s, dx: 10 }); break;
      case 'roar': this.pose('golem-roar', { scale: s, dx: Math.sin(t * 40) * 2, sy: 1 + Math.sin(t * 30) * 0.01 }); break;
      case 'spikes': {
        const stomp = p < 0.15 ? 1 - p / 0.15 : 0;
        this.pose('golem-walk', { scale: s, sy: 1 - stomp * 0.05, sx: 1 + stomp * 0.04 });
        break;
      }
      case 'recover': this.pose('golem-lunge', { scale: s, rot: 0.04, dy: 4 }); break;
      case 'summon':
        this.pose('golem-roar', { scale: s });
        this.g.lineStyle(5, COLORS.hollow, 1 - p).strokeCircle(this.facing * 220, -230, 30 + p * 170);
        break;
      default: {
        const moving = Math.abs(this.body.velocity.x) > 5, ph = t * 6;
        this.pose('golem-walk', { scale: s, dy: moving ? -Math.abs(Math.sin(ph)) * 5 : 0, rot: moving ? Math.sin(ph) * 0.02 : 0, sy: moving ? 1 : 1 + Math.sin(t * 2) * 0.01 });
      }
    }
  }
}

type WyrmMode = 'enter' | 'hover' | 'strikes' | 'orbs' | 'sweepWind' | 'sweep' | 'swoop' | 'low' | 'rise' | 'summon';

/**
 * Stage 3 boss: a corrupted serpent of the storm. It flies, so a grounded fighter
 * can only reach it while it swoops low; the Storm Dragon can chase it into the sky.
 *  - LIGHTNING: columns flicker on the ground, then strike (move out of them).
 *  - STORM ORBS: aimed volleys of crackling orbs.
 *  - SWEEP: winds up at one side, then rakes across the arena at your height.
 *  - SWOOP: dives to bite near the ground, then rests low (your opening).
 *  - SUMMON at 55% / 25%: a flock of crows. Enraged below 50%.
 */
export class ThunderWyrm extends Enemy {
  private mode: WyrmMode = 'enter';
  private modeT = 0;
  private modeLen = 1;
  private summons = [0.55, 0.25];
  private didAct = false;
  private side: 1 | -1 = 1;
  private targetY = 260;

  constructor(gs: GameScene, x: number, private arenaL: number, private arenaR: number) {
    super(gs, x, 260, 700, 300, 110, true);
    this.useSprites(['wyrm-fly', 'wyrm-strike'], COLORS.hollow, 2.5);
    this.isBoss = true;
    this.facing = -1;
    this.score = 8000;
    this.setDepth(8);
  }

  get enraged() { return this.hp < this.maxHp * 0.5; }

  private set(mode: WyrmMode, len: number) {
    this.mode = mode; this.modeT = len; this.modeLen = len; this.didAct = false;
  }

  protected onHit() { /* too massive to knock around */ }

  private flyTo(x: number, y: number, k: number) {
    this.body.setVelocity((x - this.x) * k, (y - this.y) * k);
  }

  protected think(dt: number) {
    const p = this.player;
    this.modeT -= dt;
    const L = this.arenaL + 180, R = this.arenaR - 180;
    switch (this.mode) {
      case 'enter':
        this.flyTo(this.arenaR - 300, 260, 2);
        if (Math.abs(this.x - (this.arenaR - 300)) < 30) { audio.sfx('roar'); this.set('hover', 1.2); }
        break;
      case 'hover': {
        const tx = Phaser.Math.Clamp(p.x + this.side * 280, L, R);
        this.flyTo(tx, 240 + Math.sin(this.animT * 1.6) * 40, 1.6);
        this.faceToward(p.x);
        if (this.modeT <= 0) {
          if (this.summons.length && this.hp < this.maxHp * this.summons[0]) {
            this.summons.shift(); this.set('summon', 1.1); audio.sfx('roar');
            this.gs.events.emit('banner', 'THE SKY SCREAMS!', '#d68bff', 40);
            break;
          }
          const grounded = p.y > 560;
          const r = Math.random();
          if (r < 0.32) this.set('strikes', 1.8);
          else if (r < 0.58) this.set('orbs', 1.3);
          else if (r < 0.78 || !grounded) { this.set('sweepWind', this.enraged ? 0.6 : 0.85); this.side = this.x < p.x ? -1 : 1; }
          else this.set('swoop', 0.9);
        }
        break;
      }
      case 'strikes':
        this.body.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
        if (!this.didAct) {
          this.didAct = true;
          audio.sfx('thunder');
          const n = this.enraged ? 6 : 4;
          for (let i = 0; i < n; i++) {
            this.gs.time.delayedCall(i * 170, () => {
              if (this.dead) return;
              const off = i === 0 ? 0 : (i % 2 ? 1 : -1) * (90 + Math.ceil(i / 2) * 130);
              const x = Phaser.Math.Clamp(this.player.x + off, this.arenaL + 40, this.arenaR - 40);
              this.gs.spawnProjectile('strike', x, 0, 1);
            });
          }
        }
        if (this.modeT <= 0) this.set('hover', this.enraged ? 0.7 : 1.1);
        break;
      case 'orbs':
        this.body.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
        if (!this.didAct && this.modeT < this.modeLen - 0.35) {
          this.didAct = true;
          const n = this.enraged ? 5 : 3;
          const base = Math.atan2(p.centerY() - this.y, p.x - this.x);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.22;
            this.gs.spawnEnemyShot('orb', this.x + this.facing * 120, this.y + 10, Math.cos(a) * 380, Math.sin(a) * 380);
          }
          audio.sfx('zap');
        }
        if (this.modeT <= 0) this.set('hover', 0.9);
        break;
      case 'sweepWind': {
        // retreat to one side at the player's height, shaking
        const tx = this.side > 0 ? R + 60 : L - 60;
        this.targetY = Phaser.Math.Clamp(p.centerY(), 260, 560);
        this.flyTo(tx, this.targetY, 3);
        this.facing = this.side > 0 ? -1 : 1;
        if (this.modeT <= 0) { this.set('sweep', 2.2); this.contactDmg = 18; audio.sfx('roar'); }
        break;
      }
      case 'sweep': {
        this.body.setVelocity(this.facing * (this.enraged ? 900 : 760), (this.targetY - this.y) * 2);
        if ((this.facing > 0 && this.x > R + 40) || (this.facing < 0 && this.x < L - 40) || this.modeT <= 0) {
          this.contactDmg = 0; this.set('hover', 0.8);
        }
        break;
      }
      case 'swoop': {
        // dive down beside the player
        this.contactDmg = 16;
        const tx = Phaser.Math.Clamp(p.x + (this.x < p.x ? -120 : 120), L, R);
        this.flyTo(tx, GROUND_Y - 110, 4);
        this.faceToward(p.x);
        if (this.modeT <= 0 || this.y > GROUND_Y - 130) {
          this.contactDmg = 0;
          this.gs.fx.shake(0.012, 250);
          audio.sfx('boom');
          this.set('low', this.enraged ? 1.0 : 1.5);
        }
        break;
      }
      case 'low':
        // resting near the ground: the window for fighters on foot
        this.body.setVelocity(0, Math.sin(this.animT * 4) * 20);
        if (this.modeT <= 0) this.set('rise', 0.8);
        break;
      case 'rise':
        this.flyTo(this.x, 240, 2.5);
        if (this.modeT <= 0) this.set('hover', 0.6);
        break;
      case 'summon':
        this.body.setVelocity(0, 0);
        if (this.modeT <= 0) {
          for (const sd of [-1, 1, 1] as const) this.gs.spawnEnemy('crow', sd);
          this.set('hover', 0.8);
        }
        break;
    }
    this.y = Phaser.Math.Clamp(this.y, 150, GROUND_Y - 90);
  }

  protected render() {
    const p = 1 - this.modeT / this.modeLen;
    const t = this.animT;
    this.g.clear();
    if (!this.spr) { this.drawSerpent(t); return; }
    const s = this.enraged ? 1.06 : 1;
    // serpentine undulation, drawn around the body centre (flying sprites hang from the middle)
    const wave = Math.sin(t * 5);
    const vyRot = Phaser.Math.Clamp(this.body.velocity.y / 2000, -0.2, 0.2);
    switch (this.mode) {
      case 'strikes': case 'orbs': case 'summon': case 'sweepWind':
        this.pose('wyrm-strike', { scale: s, dy: 125, sy: 1 + wave * 0.02, dx: Math.sin(t * 30) * (this.mode === 'sweepWind' ? 3 : 0) });
        if (this.mode === 'summon') this.g.lineStyle(5, COLORS.hollow, 1 - p).strokeCircle(this.facing * 120, 0, 30 + p * 170);
        break;
      case 'sweep': case 'swoop':
        this.pose('wyrm-strike', { scale: s, dy: 125, rot: vyRot, sx: 1.06 });
        break;
      default:
        this.pose('wyrm-fly', { scale: s, dy: 115 + wave * 6, rot: vyRot + wave * 0.03, sy: 1 + wave * 0.03 });
    }
  }

  /** Drawn fallback (used until the painted sprite is available): a coiling storm serpent. */
  private drawSerpent(t: number) {
    const g = this.g, f = this.facing, flash = this.flashT > 0;
    const glow = this.enraged ? 0xff5ad0 : COLORS.hollow;
    const segs = 14;
    for (let i = segs; i >= 0; i--) {
      const x = -f * i * 22, y = Math.sin(t * 4 - i * 0.55) * 22;
      const r = 30 - i * 1.4;
      g.fillStyle(COLORS.outline, 1); g.fillCircle(x, y, r + 3);
      g.fillStyle(flash ? 0xffffff : i % 2 ? 0x4a5468 : 0x5a6680, 1); g.fillCircle(x, y, r);
      if (i % 3 === 0) { g.fillStyle(glow, 0.8); g.fillCircle(x, y - r * 0.5, 4); }
    }
    // head
    const hx = f * 40, hy = Math.sin(t * 4) * 22;
    g.fillStyle(COLORS.outline, 1); g.fillEllipse(hx, hy, 96, 54);
    g.fillStyle(flash ? 0xffffff : 0x5a6680, 1); g.fillEllipse(hx, hy, 90, 48);
    g.fillStyle(0x2a3040, 1); g.fillTriangle(hx + f * 20, hy + 8, hx + f * 60, hy + 4, hx + f * 22, hy + 22);
    g.fillStyle(glow, 1); g.fillEllipse(hx + f * 14, hy - 8, 14, 8);
    g.lineStyle(4, 0xcfd6e6, 1); g.lineBetween(hx - f * 20, hy - 18, hx - f * 50, hy - 46);
    // small wings
    g.fillStyle(0x3a4256, 0.9);
    g.fillTriangle(-f * 40, hy - 10, -f * 100, hy - 80 + Math.sin(t * 8) * 20, -f * 130, hy - 10);
  }
}

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
          if (pending) { this.summons.shift(); this.set('summon', 1.1); audio.sfx('moose'); b.setVelocityX(0); this.gs.events.emit('banner', 'THE TITAN BELLOWS!', '#d68bff', 40); }
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
            this.summons.shift(); this.set('summon', 1.1); audio.sfx('golem');
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
          audio.sfx('golem');
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
        if (Math.abs(this.x - (this.arenaR - 300)) < 30) { audio.sfx('wyrm'); this.set('hover', 1.2); }
        break;
      case 'hover': {
        const tx = Phaser.Math.Clamp(p.x + this.side * 280, L, R);
        this.flyTo(tx, 240 + Math.sin(this.animT * 1.6) * 40, 1.6);
        this.faceToward(p.x);
        if (this.modeT <= 0) {
          if (this.summons.length && this.hp < this.maxHp * this.summons[0]) {
            this.summons.shift(); this.set('summon', 1.1); audio.sfx('wyrm');
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
        if (this.modeT <= 0) { this.set('sweep', 2.2); this.contactDmg = 18; audio.sfx('wyrm'); }
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

type BehemothMode = 'enter' | 'idle' | 'walk' | 'sawWind' | 'sawCharge' | 'stuck' | 'hurl' | 'bellow' | 'summon';

/**
 * Stage 4 boss: a Hollow-possessed sawmill — a hulking giant of logs and iron with a circular saw for an arm.
 *  - SAW CHARGE: revs its blade (sparks), then barrels across the arena with the saw low. Jump it.
 *    It buries the saw in the wall and is STUCK for a moment (your opening).
 *  - HURL: flings spinning sawblades that roll along the ground (jump them).
 *  - BELLOW: its smokestack belches and iron-banded beams fall around you (watch the shadows).
 *  - SUMMON at 55% / 25%: Husks and a crow. Enraged below 50%.
 */
export class SawmillBehemoth extends Enemy {
  private mode: BehemothMode = 'enter';
  private modeT = 0;
  private modeLen = 1;
  private summons = [0.55, 0.25];
  private didAct = false;

  constructor(gs: GameScene, x: number, private arenaL: number, private arenaR: number) {
    super(gs, x, GROUND_Y, 820, 250, 250);
    this.useSprites(['behemoth-walk', 'behemoth-swing'], COLORS.hollow, 2.5);
    this.isBoss = true;
    this.facing = -1;
    this.score = 8000;
    this.setDepth(8);
  }

  get enraged() { return this.hp < this.maxHp * 0.5; }

  private set(mode: BehemothMode, len: number) {
    this.mode = mode; this.modeT = len; this.modeLen = len; this.didAct = false;
  }

  protected onHit() {
    this.body.setVelocityX(this.body.velocity.x * 0.5);
  }

  protected think(dt: number) {
    const p = this.player, b = this.body;
    this.modeT -= dt;
    const leftWall = this.arenaL + 150, rightWall = this.arenaR - 150;
    switch (this.mode) {
      case 'enter':
        b.setVelocityX(-110);
        if (this.x < this.arenaR - 260) { this.set('bellow', 1.6); audio.sfx('behemoth'); }
        break;
      case 'idle':
      case 'walk': {
        this.faceToward(p.x);
        const dist = Math.abs(p.x - this.x);
        b.setVelocityX(dist > 360 ? this.facing * 90 : 0);
        this.mode = dist > 360 ? 'walk' : 'idle';
        if (this.modeT <= 0) {
          b.setVelocityX(0);
          if (this.summons.length && this.hp < this.maxHp * this.summons[0]) {
            this.summons.shift(); this.set('summon', 1.2); audio.sfx('behemoth');
            this.gs.events.emit('banner', 'THE MILL AWAKENS!', '#d68bff', 40);
          } else {
            const r = Math.random();
            if (r < 0.4) { this.set('sawWind', this.enraged ? 0.7 : 0.95); audio.sfx('saw'); }
            else if (r < 0.72) this.set('hurl', this.enraged ? 1.5 : 1.3);
            else this.set('bellow', 1.6);
          }
        }
        break;
      }
      case 'sawWind':
        b.setVelocityX(-this.facing * 25);
        if (Math.random() < 0.5) this.gs.fx.burst(this.x + this.facing * 150, this.y - 70, 0xffd27a, 1);
        if (this.modeT <= 0) {
          audio.sfx('saw');
          this.set('sawCharge', 1.6); this.contactDmg = 22;
          b.setVelocityX(this.facing * (this.enraged ? 760 : 640));
        }
        break;
      case 'sawCharge':
        if (Math.random() < 0.6) this.gs.fx.burst(this.x + this.facing * 150, GROUND_Y - 20, 0xffc070, 1);
        if ((this.facing < 0 && this.x <= leftWall) || (this.facing > 0 && this.x >= rightWall) || this.modeT <= 0) {
          b.setVelocityX(0);
          this.x = Phaser.Math.Clamp(this.x, leftWall, rightWall);
          this.contactDmg = 0;
          audio.sfx('clang');
          this.gs.fx.shake(0.012, 250);
          this.gs.fx.burst(this.x + this.facing * 140, this.y - 60, 0xffd27a, 18);
          this.set('stuck', this.enraged ? 1.1 : 1.5);
        }
        break;
      case 'stuck':
        b.setVelocityX(0);
        if (this.modeT <= 0) this.set('idle', 0.6);
        break;
      case 'hurl': {
        b.setVelocityX(0);
        this.faceToward(p.x);
        const n = this.enraged ? 3 : 2;
        const step = this.modeLen / (n + 1);
        if (!this.didAct) {
          this.didAct = true;
          for (let i = 0; i < n; i++) {
            this.gs.time.delayedCall(300 + i * step * 1000, () => {
              if (this.dead) return;
              audio.sfx('saw');
              this.gs.spawnProjectile('saw', this.x + this.facing * 140, GROUND_Y, this.facing);
            });
          }
        }
        if (this.modeT <= 0) this.set('idle', this.enraged ? 0.7 : 1.0);
        break;
      }
      case 'bellow':
        b.setVelocityX(0);
        if (!this.didAct && this.modeT < this.modeLen - 0.4) {
          this.didAct = true;
          audio.sfx('behemoth');
          this.gs.fx.shake(0.01, 500);
          const n = this.enraged ? 7 : 5;
          for (let i = 0; i < n; i++) {
            this.gs.time.delayedCall(250 + i * 200, () => {
              if (this.dead) return;
              const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-260, 260), this.arenaL + 40, this.arenaR - 40);
              this.gs.spawnProjectile('timber', x, -60, 1);
            });
          }
        }
        if (Math.random() < 0.5) this.gs.fx.burst(this.x - this.facing * 60, this.y - 300, COLORS.hollow, 1);
        if (this.modeT <= 0) this.set('idle', 0.9);
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
    const moving = Math.abs(this.body.velocity.x) > 5;
    const sawRaised = this.mode === 'sawWind' || this.mode === 'hurl' || this.mode === 'summon';
    const sawLow = this.mode === 'sawCharge' || this.mode === 'stuck';
    this.g.clear();
    if (this.spr) {
      switch (this.mode) {
        case 'sawWind': this.pose('behemoth-swing', { scale: s, dx: -8 * p, dy: Math.sin(t * 50) * 1.5 }); break;
        case 'sawCharge': this.pose('behemoth-walk', { scale: s, rot: 0.08, dx: 10, dy: -Math.abs(Math.sin(t * 14)) * 6 }); break;
        case 'stuck': this.pose('behemoth-walk', { scale: s, rot: 0.12, dx: 16 + Math.sin(t * 40) * 2 }); break;
        case 'hurl': this.pose(p % 0.5 < 0.25 ? 'behemoth-swing' : 'behemoth-walk', { scale: s }); break;
        case 'bellow': this.pose('behemoth-swing', { scale: s, dx: Math.sin(t * 40) * 2, sy: 1 + Math.sin(t * 30) * 0.01 }); break;
        case 'summon': this.pose('behemoth-swing', { scale: s }); break;
        default: {
          const ph = t * 5;
          this.pose('behemoth-walk', { scale: s, dy: moving ? -Math.abs(Math.sin(ph)) * 5 : 0, rot: moving ? Math.sin(ph) * 0.02 : 0, sy: moving ? 1 : 1 + Math.sin(t * 2) * 0.01 });
        }
      }
      if (this.mode === 'summon') this.g.lineStyle(5, COLORS.hollow, 1 - p).strokeCircle(this.facing * 200, -230, 30 + p * 170);
      return;
    }
    // procedural fallback: drawn facing right with feet at (0,0)
    this.g.setScale(this.facing * s, s);
    drawBehemoth(this.g, t, { moving, sawRaised, sawLow, flash: this.flashT > 0, bellow: this.mode === 'bellow' });
    if (this.mode === 'summon') this.g.lineStyle(5, COLORS.hollow, 1 - p).strokeCircle(200, -230, 30 + p * 170);
  }
}

/** Procedural Sawmill Behemoth (used until/unless its painted sprites load). Faces right, feet at (0,0). */
function drawBehemoth(g: Phaser.GameObjects.Graphics, t: number, o: { moving: boolean; sawRaised: boolean; sawLow: boolean; flash: boolean; bellow: boolean }) {
  const O = COLORS.outline;
  const wood = o.flash ? 0xffffff : 0x6b4528, woodD = o.flash ? 0xeeeeee : 0x4a2e1a, iron = o.flash ? 0xffffff : 0x3d434a, ironL = 0x6a737c;
  const step = o.moving ? Math.sin(t * 5) : 0;
  const bob = o.moving ? -Math.abs(Math.sin(t * 5)) * 5 : Math.sin(t * 2) * 2;
  // legs: two stumps bound with iron
  const leg = (x: number, lift: number) => {
    g.fillStyle(O, 1); g.fillRoundedRect(x - 30, -110 - lift, 60, 112, 10);
    g.fillStyle(wood, 1); g.fillRoundedRect(x - 26, -106 - lift, 52, 104, 8);
    g.fillStyle(iron, 1); g.fillRect(x - 28, -70 - lift, 56, 10); g.fillRect(x - 28, -24 - lift, 56, 10);
  };
  leg(-50, Math.max(0, step) * 14); leg(50, Math.max(0, -step) * 14);
  g.translateCanvas(0, bob);
  // smokestack on the back
  g.fillStyle(O, 1); g.fillRect(-120, -330, 46, 140);
  g.fillStyle(iron, 1); g.fillRect(-116, -326, 38, 136);
  g.fillStyle(ironL, 1); g.fillRect(-122, -334, 50, 12);
  const puff = o.bellow ? 1.6 : 1;
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.8 + i / 3) % 1;
    g.fillStyle(COLORS.hollow, 0.35 * (1 - ph)); g.fillCircle(-97 - ph * 40, -340 - ph * 90, (14 + ph * 26) * puff);
  }
  // torso: a barrel of stacked logs, hunched forward
  g.fillStyle(O, 1); g.fillRoundedRect(-100, -270, 200, 170, 30);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(i % 2 ? woodD : wood, 1); g.fillRoundedRect(-94, -262 + i * 40, 188, 36, 16);
    g.fillStyle(0xd9b07a, 1); g.fillEllipse(92, -244 + i * 40, 16, 30);
    g.lineStyle(2, 0x9a6a3a, 1); g.strokeEllipse(92, -244 + i * 40, 8, 16);
  }
  // chains
  g.lineStyle(6, iron, 1); g.lineBetween(-90, -260, 90, -110); g.lineBetween(-90, -110, 60, -262);
  // glowing furnace core
  const glow = 0.6 + 0.4 * Math.sin(t * 6);
  g.fillStyle(COLORS.hollow, 0.35 * glow); g.fillCircle(10, -185, 46);
  g.fillStyle(O, 1); g.fillRoundedRect(-22, -212, 64, 54, 8);
  g.fillStyle(0x2a1830, 1); g.fillRoundedRect(-17, -207, 54, 44, 6);
  g.fillStyle(COLORS.hollow, glow); g.fillRect(-12, -200, 44, 30);
  g.fillStyle(iron, 1); for (let k = 0; k < 4; k++) g.fillRect(-12 + k * 13, -200, 4, 30);
  // head: a sawn stump with burning eyes
  g.fillStyle(O, 1); g.fillRoundedRect(60, -330, 86, 78, 14);
  g.fillStyle(wood, 1); g.fillRoundedRect(64, -326, 78, 70, 12);
  g.fillStyle(0xd9b07a, 1); g.fillEllipse(103, -326, 70, 14);
  g.fillStyle(COLORS.hollow, 1); g.fillCircle(118, -298, 8); g.fillCircle(96, -298, 6);
  g.fillStyle(0xffffff, 0.9); g.fillCircle(119, -299, 3);
  g.fillStyle(O, 1); g.fillRect(84, -274, 52, 8);
  // back arm: a heavy club of a log
  g.fillStyle(O, 1); g.fillRoundedRect(-140, -250, 50, 150, 16);
  g.fillStyle(woodD, 1); g.fillRoundedRect(-136, -246, 42, 142, 14);
  // saw arm
  const ang = o.sawRaised ? -0.9 + Math.sin(t * 30) * 0.05 : o.sawLow ? 0.5 : 0.1 + Math.sin(t * 2) * 0.05;
  const sx = 80 + Math.cos(ang) * 110, sy = -220 + Math.sin(ang) * 110;
  g.lineStyle(30, O, 1); g.lineBetween(70, -220, sx, sy);
  g.lineStyle(22, iron, 1); g.lineBetween(70, -220, sx, sy);
  const R = 62, spin = t * (o.sawRaised || o.sawLow ? 30 : 6);
  g.fillStyle(COLORS.hollow, 0.18); g.fillCircle(sx, sy, R + 14);
  g.fillStyle(O, 1); g.fillCircle(sx, sy, R + 4);
  g.fillStyle(0xaab3bc, 1); g.fillCircle(sx, sy, R - 4);
  g.fillStyle(0xd8e0e8, 1);
  for (let i = 0; i < 16; i++) {
    const a = spin + (i / 16) * Math.PI * 2;
    g.fillTriangle(sx + Math.cos(a) * (R - 6), sy + Math.sin(a) * (R - 6), sx + Math.cos(a + 0.3) * (R - 6), sy + Math.sin(a + 0.3) * (R - 6), sx + Math.cos(a + 0.08) * (R + 10), sy + Math.sin(a + 0.08) * (R + 10));
  }
  g.fillStyle(0x7d868f, 1); g.fillCircle(sx, sy, 18);
  g.fillStyle(COLORS.hollow, 0.9); g.fillCircle(sx, sy, 7);
  g.translateCanvas(0, -bob);
}

type LeviathanMode = 'enter' | 'surface' | 'spit' | 'lungeWind' | 'lunge' | 'dive' | 'hunt' | 'erupt' | 'summon';

/**
 * Stage 5 boss: a vast crocodilian serpent of living tar.
 *  - SPIT: lobs tar globs that splash into sticky puddles (they slow you down).
 *  - LUNGE: rears back, then snaps forward low across the ground. Jump or get out of reach.
 *  - DIVE + HUNT: sinks out of reach (it can't be hurt) and a ripple slides toward you…
 *    the ground bubbles under your feet, then it ERUPTS there. Move! Afterwards it rests on the
 *    surface for a moment: your opening.
 *  - SUMMON at 55% / 25%: Husks and a crow. Enraged below 50%.
 */
export class TarLeviathan extends Enemy {
  private mode: LeviathanMode = 'enter';
  private modeT = 0;
  private modeLen = 1;
  private summons = [0.55, 0.25];
  private didAct = false;
  private rise = 0; // 0 = under the tar, 1 = fully risen
  private huntX = 0;

  constructor(gs: GameScene, x: number, private arenaL: number, private arenaR: number) {
    super(gs, x, GROUND_Y, 780, 220, 230);
    this.useSprites(['leviathan-rise', 'leviathan-lunge'], COLORS.hollow, 2.5);
    this.isBoss = true;
    this.facing = -1;
    this.score = 9000;
    this.setDepth(8);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.y = GROUND_Y;
    this.untouchable = true;
  }

  get enraged() { return this.hp < this.maxHp * 0.5; }

  private set(mode: LeviathanMode, len: number) {
    this.mode = mode; this.modeT = len; this.modeLen = len; this.didAct = false;
  }

  protected onHit() { /* anchored in the tar */ }

  protected think(dt: number) {
    const p = this.player, b = this.body;
    this.modeT -= dt;
    b.setVelocity(0, 0);
    const L = this.arenaL + 160, R = this.arenaR - 160;
    const targetRise = this.mode === 'dive' || this.mode === 'hunt' ? 0 : this.mode === 'lunge' ? 0.85 : 1;
    this.rise += (targetRise - this.rise) * Math.min(1, dt * (this.mode === 'erupt' ? 14 : 4));
    this.untouchable = this.rise < 0.45;
    switch (this.mode) {
      case 'enter':
        if (!this.didAct) { this.didAct = true; this.x = this.arenaR - 300; this.rise = 0; }
        if (this.modeT <= 0 || this.rise > 0.95) { audio.sfx('leviathan'); this.gs.fx.shake(0.012, 500); this.set('surface', 1.2); }
        break;
      case 'surface':
        this.faceToward(p.x);
        if (this.modeT <= 0) {
          if (this.summons.length && this.hp < this.maxHp * this.summons[0]) {
            this.summons.shift(); this.set('summon', 1.2); audio.sfx('leviathan');
            this.gs.events.emit('banner', 'THE BAYOU STIRS!', '#d68bff', 40);
            break;
          }
          const dist = Math.abs(p.x - this.x), r = Math.random();
          if (dist < 380 && r < 0.4) this.set('lungeWind', this.enraged ? 0.5 : 0.7);
          else if (r < 0.7) this.set('spit', 1.3);
          else this.set('dive', 0.7);
        }
        break;
      case 'spit':
        this.faceToward(p.x);
        if (!this.didAct && this.modeT < this.modeLen - 0.35) {
          this.didAct = true;
          const n = this.enraged ? 4 : 3;
          for (let i = 0; i < n; i++) {
            this.gs.time.delayedCall(i * 220, () => {
              if (this.dead) return;
              audio.sfx('splash');
              // aim each glob to land around the player (simple ballistic guess)
              const dx = this.player.x + (i - (n - 1) / 2) * 110 - (this.x + this.facing * 90);
              this.gs.spawnEnemyShot('tar', this.x + this.facing * 90, this.y - 200, dx / 1.4, -520);
            });
          }
        }
        if (this.modeT <= 0) this.set('surface', this.enraged ? 0.7 : 1.0);
        break;
      case 'lungeWind':
        this.faceToward(p.x);
        if (this.modeT <= 0) { audio.sfx('pounce'); this.set('lunge', 0.5); this.contactDmg = 20; }
        break;
      case 'lunge':
        // the head snaps forward: widen the reach for the duration
        if (this.modeT <= 0) { this.contactDmg = 0; this.set('surface', this.enraged ? 0.9 : 1.3); }
        break;
      case 'dive':
        if (!this.didAct) { this.didAct = true; audio.sfx('splash'); this.gs.fx.burst(this.x, GROUND_Y - 20, 0x2a1c30, 24); }
        if (this.modeT <= 0) { this.set('hunt', this.enraged ? 1.2 : 1.6); this.huntX = this.x; }
        break;
      case 'hunt': {
        // a ripple slides under the ground toward the player
        this.huntX += Phaser.Math.Clamp(p.x - this.huntX, -520 * dt, 520 * dt);
        this.x = Phaser.Math.Clamp(this.huntX, L, R);
        if (Math.random() < 0.35) this.gs.fx.burst(this.x + Phaser.Math.Between(-40, 40), GROUND_Y - 4, 0x6a4a7a, 1);
        if (this.modeT <= 0) {
          this.gs.spawnProjectile('geyser', this.x, GROUND_Y, 1);
          this.set('erupt', 1.2);
        }
        break;
      }
      case 'erupt':
        // hold under the bubbles, then burst up through them
        if (this.modeT < this.modeLen - 0.8 && !this.didAct) {
          this.didAct = true; this.rise = 0.2; this.contactDmg = 22;
          audio.sfx('leviathan'); this.gs.fx.shake(0.016, 300);
          this.gs.fx.burst(this.x, GROUND_Y - 60, 0x1a1020, 30);
        }
        if (!this.didAct) this.rise = 0;
        if (this.modeT <= 0) { this.contactDmg = 0; this.set('surface', this.enraged ? 1.4 : 2.0); }
        break;
      case 'summon':
        if (this.modeT <= 0) {
          this.gs.spawnEnemy('husk', -1);
          this.gs.spawnEnemy('husk', 1);
          this.gs.spawnEnemy('crow', 1);
          this.set('surface', 0.8);
        }
        break;
    }
    this.x = Phaser.Math.Clamp(this.x, L, R);
    this.y = GROUND_Y;
  }

  hurtRect() {
    // the risen neck and head; the hitbox shrinks as it sinks, and reaches further during a lunge
    const painted = !!this.spr;
    const h = (painted ? 340 : 240) * Math.max(0.15, this.rise);
    const reach = this.mode === 'lunge' ? 170 : 0;
    const back = painted ? 80 : 100, w = (painted ? 320 : 200) + reach;
    const x = this.facing > 0 ? this.x - back : this.x + back - w;
    return new Phaser.Geom.Rectangle(x, this.y - h, w, h);
  }

  protected render() {
    const t = this.animT, s = this.enraged ? 1.06 : 1;
    const p = 1 - this.modeT / this.modeLen;
    const sink = (1 - this.rise) * 260;
    this.g.clear();
    // the tar pool it lives in (always drawn, so you can see where it is; drawn over the neck's base)
    const poolW = this.mode === 'hunt' ? 120 : 300;
    const pool = () => {
      this.g.fillStyle(0x07040a, 1); this.g.fillEllipse(0, 6, poolW, 34);
      this.g.fillStyle(0x07040a, 1); this.g.fillRect(-poolW / 2 + 10, 6, poolW - 20, 60);
      this.g.fillStyle(COLORS.hollow, 0.25 + 0.15 * Math.sin(t * 5)); this.g.fillEllipse(-poolW * 0.15, -2, poolW * 0.4, 6);
    };
    if (this.spr) {
      if (this.rise < 0.5) pool(); // the painted art brings its own pool
      const key = this.mode === 'lunge' || this.mode === 'lungeWind' || this.mode === 'erupt' ? 'leviathan-lunge' : 'leviathan-rise';
      this.pose(key, { scale: s, dy: sink, dx: this.mode === 'lunge' ? 40 : this.mode === 'lungeWind' ? -20 * p : 0, rot: this.mode === 'spit' ? -0.06 : 0 });
      this.spr.setAlpha(this.rise < 0.1 ? 0 : 1);
      // crop the part that's under the tar
      this.spr.setCrop(0, 0, this.spr.width, Math.max(0, this.spr.height - sink / Math.abs(this.spr.scaleY)));
      return;
    }
    this.g.setScale(this.facing * s, s);
    if (this.rise >= 0.05) drawLeviathan(this.g, t, this.rise, {
      mouth: this.mode === 'spit' ? Math.min(1, p * 3) : this.mode === 'lunge' || this.mode === 'erupt' ? 1 : this.mode === 'lungeWind' ? 0.4 : 0.1,
      reach: this.mode === 'lunge' ? 1 : this.mode === 'lungeWind' ? -0.3 * p : 0,
      flash: this.flashT > 0,
    });
    pool();
    if (this.mode === 'summon') this.g.lineStyle(5, COLORS.hollow, 1 - p).strokeCircle(120, -220, 30 + p * 170);
    this.g.setScale(1, 1);
  }
}

/** Procedural Tar Leviathan: a crocodilian head on a thick neck rising out of tar. Faces right, base at (0,0). */
function drawLeviathan(g: Phaser.GameObjects.Graphics, t: number, rise: number, o: { mouth: number; reach: number; flash: boolean }) {
  const O = COLORS.outline;
  const tar = o.flash ? 0xffffff : 0x140c1a, tarL = o.flash ? 0xffffff : 0x2c1e36, sheen = 0x6a4a8a;
  const H = 230 * rise;
  const sway = Math.sin(t * 1.8) * 10;
  const hx = 40 + o.reach * 150 + sway, hy = -H;
  // neck: a thick curve of tar from the pool up to the head
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    const x = -50 + (hx + 10) * k * k + Math.sin(t * 2 + k * 3) * 6 * (1 - k);
    const y = hy * Math.sin(k * Math.PI / 2) + 4;
    const r = 52 - k * 18;
    g.fillStyle(O, 1); g.fillCircle(x, y, r + 4);
    g.fillStyle(i % 2 ? tar : tarL, 1); g.fillCircle(x, y, r);
    if (i % 3 === 1) { g.fillStyle(sheen, 0.6); g.fillCircle(x - r * 0.3, y - r * 0.4, r * 0.25); }
  }
  // dorsal spines
  for (let i = 3; i < 11; i += 2) {
    const k = i / 12, x = -50 + (hx + 10) * k * k, y = hy * Math.sin(k * Math.PI / 2) - (52 - k * 18);
    g.fillStyle(O, 1); g.fillTriangle(x - 10, y + 8, x + 10, y + 8, x - 4, y - 22);
  }
  // head: long snout, lower jaw opens with `mouth`
  const jaw = o.mouth * 0.55;
  g.fillStyle(O, 1); g.fillRoundedRect(hx - 40, hy - 34, 170, 50, 18);
  g.fillStyle(tar, 1); g.fillRoundedRect(hx - 36, hy - 30, 162, 42, 16);
  // lower jaw (rotated)
  const jx = hx - 30, jy = hy + 8;
  const ex = jx + Math.cos(jaw) * 150, ey = jy + Math.sin(jaw) * 150;
  g.lineStyle(34, O, 1); g.lineBetween(jx, jy, ex, ey);
  g.lineStyle(26, tarL, 1); g.lineBetween(jx, jy, ex, ey);
  // teeth
  g.fillStyle(0xe8dcc8, 1);
  for (let i = 0; i < 7; i++) {
    const tx = hx - 10 + i * 20;
    g.fillTriangle(tx, hy + 10, tx + 8, hy + 10, tx + 4, hy + 24);
    const k = (i + 1) / 8, bx = jx + (ex - jx) * k, by = jy + (ey - jy) * k;
    g.fillTriangle(bx - 4, by - 10, bx + 4, by - 10, bx, by - 22);
  }
  if (o.mouth > 0.3) { g.fillStyle(COLORS.hollow, 0.6 * o.mouth); g.fillCircle(hx + 30, hy + 30 * o.mouth, 16 * o.mouth); }
  // eyes and brow
  g.fillStyle(O, 1); g.fillEllipse(hx + 6, hy - 34, 40, 24);
  g.fillStyle(COLORS.hollow, 1); g.fillEllipse(hx + 10, hy - 34, 18, 10);
  g.fillStyle(0xffffff, 0.9); g.fillCircle(hx + 13, hy - 36, 3);
  // tar drips
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.9 + i * 0.27) % 1;
    g.fillStyle(tar, 1 - ph); g.fillCircle(hx + i * 34, hy + 14 + ph * 60, 5 - ph * 3);
  }
}

type HeartMode = 'enter' | 'hover' | 'burst' | 'tendrils' | 'beam' | 'descend' | 'low' | 'rise' | 'summon';

/**
 * Final boss: the Hollow Heart — the meteor's corrupted core, a vast beating crystal heart.
 *  - BURST: a ring of Hollow orbs flung outward (more when enraged).
 *  - TENDRILS: the ground glows, then tendrils lash up under you, one after another.
 *  - BEAM: a thin line shows its aim at your height… then a full-width ray. Change height!
 *  - DESCEND: it sinks low and pulses (contact hurts), then rests near the ground: the window for
 *    fighters on foot. The Elder Dragon can reach it anywhere.
 *  - SUMMON at 66% / 33%: crows and a Spirit Wolf (orbs!). Enraged below 50%.
 */
export class HollowHeart extends Enemy {
  private mode: HeartMode = 'enter';
  private modeT = 0;
  private modeLen = 1;
  private summons = [0.66, 0.33];
  private didAct = false;
  private beat = 0;

  constructor(gs: GameScene, x: number, private arenaL: number, private arenaR: number) {
    super(gs, x, -120, 1100, 200, 200, true);
    this.useSprites(['heart-idle', 'heart-open'], COLORS.hollow, 3);
    this.isBoss = true;
    this.facing = -1;
    this.score = 15000;
    this.setDepth(8);
  }

  get enraged() { return this.hp < this.maxHp * 0.5; }

  private set(mode: HeartMode, len: number) {
    this.mode = mode; this.modeT = len; this.modeLen = len; this.didAct = false;
  }

  protected onHit() { /* immovable */ }

  private flyTo(x: number, y: number, k: number) {
    this.body.setVelocity((x - this.x) * k, (y - this.y) * k);
  }

  protected think(dt: number) {
    const p = this.player;
    this.modeT -= dt;
    const cx = (this.arenaL + this.arenaR) / 2;
    const L = this.arenaL + 200, R = this.arenaR - 200;
    this.beat += dt * (this.enraged ? 2.2 : 1.5);
    switch (this.mode) {
      case 'enter':
        this.flyTo(cx + 200, 290, 1.6);
        if (Math.abs(this.y - 290) < 20) { audio.sfx('heart'); this.gs.fx.shake(0.012, 700); this.set('hover', 1.4); }
        break;
      case 'hover': {
        this.flyTo(Phaser.Math.Clamp(cx + Math.sin(this.animT * 0.6) * 300, L, R), 280 + Math.sin(this.animT * 1.3) * 40, 1.2);
        this.faceToward(p.x);
        if (this.modeT <= 0) {
          if (this.summons.length && this.hp < this.maxHp * this.summons[0]) {
            this.summons.shift(); this.set('summon', 1.3); audio.sfx('heart');
            this.gs.events.emit('banner', 'THE HOLLOW CALLS ITS OWN!', '#d68bff', 40);
            break;
          }
          const grounded = p.y > 560, r = Math.random();
          if (r < 0.25) this.set('burst', 1.2);
          else if (r < 0.48) this.set('tendrils', 2.0);
          else if (r < 0.72) this.set('beam', 1.8);
          else if (grounded || r < 0.85) this.set('descend', 1.0);
          else this.set('burst', 1.2);
        }
        break;
      }
      case 'burst':
        this.body.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
        if (!this.didAct && this.modeT < this.modeLen - 0.45) {
          this.didAct = true;
          audio.sfx('zap'); this.gs.fx.shake(0.008, 200);
          const n = this.enraged ? 14 : 10, off = Math.random();
          for (let i = 0; i < n; i++) {
            const a = ((i + off) / n) * Math.PI * 2;
            this.gs.spawnEnemyShot('orb', this.x + Math.cos(a) * 70, this.y + Math.sin(a) * 70, Math.cos(a) * 330, Math.sin(a) * 330);
          }
        }
        if (this.modeT <= 0) this.set('hover', this.enraged ? 0.6 : 0.9);
        break;
      case 'tendrils':
        this.body.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
        if (!this.didAct) {
          this.didAct = true;
          const n = this.enraged ? 5 : 4;
          for (let i = 0; i < n; i++) {
            this.gs.time.delayedCall(i * 330, () => {
              if (this.dead) return;
              const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-30, 30), this.arenaL + 40, this.arenaR - 40);
              this.gs.spawnProjectile('tendril', x, GROUND_Y, 1);
            });
          }
        }
        if (this.modeT <= 0) this.set('hover', 0.8);
        break;
      case 'beam':
        this.body.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
        if (!this.didAct) {
          this.didAct = true;
          const y = Phaser.Math.Clamp(p.centerY(), 230, GROUND_Y - 40);
          this.gs.spawnProjectile('beam', cx, y, 1);
          if (this.enraged) {
            // a second ray a beat later, offset, so you can't just sit still
            const y2 = y < 420 ? y + 170 : y - 170;
            this.gs.time.delayedCall(700, () => { if (!this.dead) this.gs.spawnProjectile('beam', cx, y2, 1); });
          }
        }
        if (this.modeT <= 0) this.set('hover', 0.8);
        break;
      case 'descend':
        this.contactDmg = 18;
        this.flyTo(Phaser.Math.Clamp(p.x, L, R), GROUND_Y - 130, 3);
        if (this.modeT <= 0 || this.y > GROUND_Y - 150) {
          this.contactDmg = 0; audio.sfx('boom'); this.gs.fx.shake(0.014, 300);
          this.gs.fx.ring(this.x, GROUND_Y - 10, COLORS.hollow, 200, 420);
          this.set('low', this.enraged ? 1.6 : 2.2);
        }
        break;
      case 'low':
        this.body.setVelocity(0, Math.sin(this.animT * 4) * 15);
        if (this.modeT <= 0) this.set('rise', 0.9);
        break;
      case 'rise':
        this.flyTo(this.x, 280, 2.4);
        if (this.modeT <= 0) this.set('hover', 0.6);
        break;
      case 'summon':
        this.body.setVelocity(0, 0);
        if (this.modeT <= 0) {
          this.gs.spawnEnemy('crow', -1);
          this.gs.spawnEnemy('crow', 1);
          if (this.player.form < 3) this.gs.spawnEnemy('wolf', Math.random() < 0.5 ? 1 : -1);
          else this.gs.spawnEnemy('husk', -1);
          this.set('hover', 0.9);
        }
        break;
    }
    if (this.mode !== 'enter') this.y = Phaser.Math.Clamp(this.y, 170, GROUND_Y - 120);
  }

  protected render() {
    const t = this.animT, p = 1 - this.modeT / this.modeLen;
    // heartbeat: a quick double pump
    const ph = this.beat % 1;
    const pump = ph < 0.12 ? Math.sin(ph / 0.12 * Math.PI) : ph > 0.22 && ph < 0.34 ? 0.6 * Math.sin((ph - 0.22) / 0.12 * Math.PI) : 0;
    const s = (this.enraged ? 1.06 : 1) * (1 + pump * 0.06);
    const charging = (this.mode === 'burst' || this.mode === 'beam') && !this.didAct ? 1 : this.mode === 'burst' && p < 0.5 ? 1 - p * 2 : 0;
    this.g.clear();
    if (this.spr) {
      const opening = this.mode === 'burst' || this.mode === 'beam' || this.mode === 'summon';
      // sprites hang from their bottom edge: push down by half the height to centre on the body
      this.pose(opening ? 'heart-open' : 'heart-idle', { scale: s, dy: 175 * s, rot: Math.sin(t * 0.8) * 0.04, sx: 1 + charging * 0.04 });
      // a pulsing core glow over the art
      this.g.fillStyle(this.enraged ? 0xff5ad0 : COLORS.hollow, 0.06 + pump * 0.14 + charging * 0.14).fillCircle(0, -10, 60 + pump * 20);
    } else {
      drawHeart(this.g, t, { pump, charge: charging, flash: this.flashT > 0, enraged: this.enraged, scale: s });
    }
    if (this.mode === 'summon') this.g.lineStyle(5, COLORS.hollow, 1 - p).strokeCircle(0, 0, 40 + p * 200);
    if (this.mode === 'beam' && !this.didAct) this.g.lineStyle(3, COLORS.hollow, 0.6).strokeCircle(0, 0, 120 - p * 60);
  }
}

/** Procedural Hollow Heart: a beating crystal-and-flesh heart with orbiting shards. Centred on (0,0). */
function drawHeart(g: Phaser.GameObjects.Graphics, t: number, o: { pump: number; charge: number; flash: boolean; enraged: boolean; scale: number }) {
  const O = COLORS.outline, s = o.scale;
  const glowC = o.enraged ? 0xff5ad0 : COLORS.hollow;
  // aura
  g.fillStyle(glowC, 0.12 + o.pump * 0.12 + o.charge * 0.15); g.fillCircle(0, 0, 150 * s);
  g.fillStyle(glowC, 0.1); g.fillCircle(0, 0, 190 * s);
  // dangling tendrils
  for (let i = 0; i < 6; i++) {
    const x0 = (-60 + i * 24) * s;
    g.lineStyle(10, O, 1); g.beginPath(); g.moveTo(x0, 60 * s);
    for (let k = 1; k <= 5; k++) g.lineTo(x0 + Math.sin(t * 2 + i + k * 0.8) * 14, (60 + k * 24) * s);
    g.strokePath();
    g.lineStyle(6, 0x3a1850, 1); g.beginPath(); g.moveTo(x0, 60 * s);
    for (let k = 1; k <= 5; k++) g.lineTo(x0 + Math.sin(t * 2 + i + k * 0.8) * 14, (60 + k * 24) * s);
    g.strokePath();
  }
  // heart body: two lobes and a point, outlined
  const body = (c: number, grow: number) => {
    g.fillStyle(c, 1);
    g.fillCircle(-38 * s, -20 * s, (58 + grow) * s); g.fillCircle(38 * s, -20 * s, (58 + grow) * s);
    g.fillTriangle((-92 - grow) * s, -4 * s, (92 + grow) * s, -4 * s, 0, (100 + grow) * s);
  };
  body(O, 5);
  body(o.flash ? 0xffffff : 0x4a1a52, 0);
  // crystal growths
  const cryst = (x: number, y: number, h: number, a: number) => {
    const cx = x * s, cy = y * s, dx = Math.sin(a), dy = -Math.cos(a);
    g.fillStyle(O, 1); g.fillTriangle(cx - dy * 14, cy + dx * 14, cx + dy * 14, cy - dx * 14, cx + dx * (h + 6) * s, cy + dy * (h + 6) * s);
    g.fillStyle(o.flash ? 0xffffff : 0x9a5ad8, 1); g.fillTriangle(cx - dy * 10, cy + dx * 10, cx + dy * 10, cy - dx * 10, cx + dx * h * s, cy + dy * h * s);
  };
  cryst(-50, -60, 60, -0.5); cryst(-10, -70, 80, -0.1); cryst(40, -64, 66, 0.4); cryst(70, -30, 44, 1.0); cryst(-78, -24, 40, -1.1);
  // glowing veins
  g.lineStyle(4, glowC, 0.6 + o.pump * 0.4);
  g.beginPath(); g.moveTo(0, 80 * s); g.lineTo(-10 * s, 30 * s); g.lineTo(-40 * s, 0); g.lineTo(-60 * s, -30 * s); g.strokePath();
  g.beginPath(); g.moveTo(-10 * s, 30 * s); g.lineTo(30 * s, -10 * s); g.lineTo(60 * s, -20 * s); g.strokePath();
  // core
  g.fillStyle(glowC, 0.5 + o.pump * 0.5); g.fillCircle(0, -4 * s, (26 + o.pump * 8 + o.charge * 10) * s);
  g.fillStyle(0xffffff, 0.6 + o.charge * 0.4); g.fillCircle(0, -4 * s, (10 + o.charge * 8) * s);
  // orbiting shards
  for (let i = 0; i < 6; i++) {
    const a = t * (o.enraged ? 1.6 : 1) + i * (Math.PI / 3);
    const x = Math.cos(a) * 150 * s, y = Math.sin(a) * 60 * s;
    g.fillStyle(O, 1); g.fillTriangle(x - 10, y + 8, x + 10, y + 8, x, y - 20);
    g.fillStyle(0xb47cff, 1); g.fillTriangle(x - 7, y + 6, x + 7, y + 6, x, y - 16);
  }
}

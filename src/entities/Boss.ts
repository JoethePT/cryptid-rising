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

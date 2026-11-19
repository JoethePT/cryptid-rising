import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { GROUND_Y } from '../config';
import { COLORS } from '../config';
import { drawCrow, drawHumanoid, drawWolf, flashLook, huskLook, Look, Pose } from '../gfx/Puppet';
import { applySprite, spritesReady } from '../gfx/Sprites';
import { audio } from '../systems/Audio';

export type EnemyKind = 'husk' | 'crow' | 'wolf';

export abstract class Enemy extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;
  protected g: Phaser.GameObjects.Graphics;
  protected shadow: Phaser.GameObjects.Graphics;
  /** Painted sprite (when the art is loaded); `g` is then used only for overlays. */
  protected spr?: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  facing: 1 | -1 = -1;
  animT = Math.random() * 10;
  flashT = 0;
  stunT = 0;
  dead = false;
  carrier = false;
  isBoss = false;
  contactDmg = 0;
  score = 100;
  readonly flying: boolean;

  constructor(public gs: GameScene, x: number, y: number, hp: number, w: number, h: number, flying = false) {
    super(gs, x, y);
    this.flying = flying;
    this.maxHp = this.hp = Math.round(hp * gs.diff.enemyHp);
    this.shadow = gs.add.graphics();
    this.g = gs.add.graphics();
    this.add([this.shadow, this.g]);
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.body.setSize(w, h, false);
    this.body.setOffset(-w / 2, flying ? -h / 2 : -h);
    if (flying) this.body.setAllowGravity(false);
    this.setDepth(9);
  }

  get player() { return this.gs.player; }

  /** Switch this enemy to painted sprites if all its poses are loaded. */
  protected useSprites(keys: string[], glow?: number, glowStrength = 2) {
    if (!spritesReady(this.gs, keys)) return false;
    this.spr = this.gs.add.image(0, 0, keys[0]);
    this.addAt(this.spr, 1);
    if (glow !== undefined && this.spr.preFX) {
      this.spr.preFX.setPadding(14);
      this.spr.preFX.addGlow(glow, glowStrength, 0, false, 0.1, 10);
    }
    return true;
  }

  /** Show a pose: facing flip, extra scale, rotation and offset, plus white hit-flash. */
  protected pose(key: string, opts: { rot?: number; dx?: number; dy?: number; sx?: number; sy?: number; scale?: number } = {}) {
    const spr = this.spr!;
    applySprite(spr, key, this.facing, opts.scale ?? 1);
    spr.scaleX *= opts.sx ?? 1;
    spr.scaleY *= opts.sy ?? 1;
    spr.setRotation((opts.rot ?? 0) * this.facing);
    spr.setPosition((opts.dx ?? 0) * this.facing, opts.dy ?? 0);
    if (this.flashT > 0) spr.setTintFill(0xffffff);
    else spr.clearTint();
  }

  hurtRect() {
    const b = this.body;
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
  }

  get onGround() { return this.body.blocked.down || this.body.touching.down; }

  faceToward(x: number) { this.facing = x < this.x ? -1 : 1; }

  takeHit(dmg: number, dir: number, knock: number, heavy: boolean) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flashT = 0.1;
    this.onHit(dir, knock, heavy);
    if (this.hp <= 0) this.die(dir);
  }

  protected onHit(dir: number, knock: number, heavy: boolean) {
    this.stunT = heavy ? 0.5 : 0.25;
    this.facing = dir > 0 ? -1 : 1;
    this.body.setVelocity(dir * knock, heavy ? -260 : this.body.velocity.y);
  }

  die(dir: number) {
    this.dead = true;
    this.contactDmg = 0;
    this.body.enable = false;
    this.gs.onEnemyKilled(this);
    this.gs.tweens.add({
      targets: this, alpha: 0, angle: dir * 35, y: this.y - 24, duration: 450, ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  update(dt: number) {
    if (this.dead) return;
    this.animT += dt;
    this.flashT -= dt;
    if (this.stunT > 0) {
      this.stunT -= dt;
      if (this.onGround || this.flying) this.body.setVelocityX(this.body.velocity.x * 0.88);
      if (this.flying) this.body.setVelocityY(this.body.velocity.y * 0.9);
    } else {
      this.think(dt);
    }
    this.render();
    this.shadow.clear();
    const gy = this.flying ? GROUND_Y - this.y : 0;
    const a = this.flying ? Phaser.Math.Clamp(0.3 - (GROUND_Y - this.y) / 1500, 0.05, 0.3) : 0.35;
    this.shadow.fillStyle(0x000000, a);
    this.shadow.fillEllipse(0, gy + 2, this.body.width * 1.3, 12);
  }

  /** Called every frame while not stunned. */
  protected abstract think(dt: number): void;
  protected abstract render(): void;
}

// ------------------------------------------------------------------ Hollow Husk (melee walker)

export class Husk extends Enemy {
  private static look: Look = huskLook();
  private static flash: Look = flashLook(huskLook());
  private mode: 'walk' | 'windup' | 'strike' | 'recover' = 'walk';
  private modeT = 0;
  private cd = Phaser.Math.FloatBetween(0.4, 1.2);
  private speed = Phaser.Math.Between(85, 125);
  private struck = false;

  constructor(gs: GameScene, x: number) {
    super(gs, x, GROUND_Y, 30, 46, 128);
    this.score = 100;
    this.useSprites(['husk-walk', 'husk-windup', 'husk-swipe'], COLORS.hollow, 1.5);
  }

  protected onHit(dir: number, knock: number, heavy: boolean) {
    super.onHit(dir, knock, heavy);
    this.mode = 'walk'; // getting hit interrupts the swing
  }

  protected think(dt: number) {
    const p = this.player;
    const dx = p.x - this.x, dist = Math.abs(dx);
    this.cd -= dt;
    this.modeT -= dt;
    switch (this.mode) {
      case 'walk':
        if (p.alive) this.faceToward(p.x);
        this.body.setVelocityX(dist > 60 && p.alive ? this.facing * this.speed : 0);
        if (p.alive && dist < 90 && Math.abs(p.y - this.y) < 90 && this.cd <= 0) {
          this.mode = 'windup'; this.modeT = 0.45; this.body.setVelocityX(0);
          if (Math.random() < 0.6) audio.sfx('growl');
        }
        break;
      case 'windup':
        this.body.setVelocityX(0);
        if (this.modeT <= 0) { this.mode = 'strike'; this.modeT = 0.14; this.struck = false; this.body.setVelocityX(this.facing * 140); }
        break;
      case 'strike':
        if (!this.struck) {
          this.struck = true;
          // swing is at head/chest height: crouching ducks under it
          const r = new Phaser.Geom.Rectangle(this.x + this.facing * 58 - 40, this.y - 140, 80, 44);
          this.gs.enemyStrike(r, 10, this.x);
        }
        if (this.modeT <= 0) { this.mode = 'recover'; this.modeT = 0.45; }
        break;
      case 'recover':
        this.body.setVelocityX(this.body.velocity.x * 0.8);
        if (this.modeT <= 0) { this.mode = 'walk'; this.cd = Phaser.Math.FloatBetween(0.7, 1.4); }
        break;
    }
  }

  protected render() {
    if (this.spr) {
      this.g.clear();
      const t = this.animT;
      if (this.stunT > 0) this.pose('husk-walk', { rot: -0.18, dx: -6 });
      else if (this.mode === 'windup') {
        const shake = Math.sin(t * 50) * 1.5;
        this.pose('husk-windup', { dx: shake });
        // telegraph: flicker purple just before the swing lands
        if (this.flashT <= 0 && Math.floor(t * 16) % 2 === 0) this.spr.setTint(0xd9a6ff);
      } else if (this.mode === 'strike' || this.mode === 'recover') this.pose('husk-swipe', { dx: 10 });
      else if (Math.abs(this.body.velocity.x) > 5) {
        const ph = t * 7;
        this.pose('husk-walk', { dy: -Math.abs(Math.sin(ph)) * 4, rot: Math.sin(ph) * 0.05 });
      } else this.pose('husk-walk', { sy: 1 + Math.sin(t * 2.5) * 0.015 });
      return;
    }
    let pose: Pose;
    if (this.stunT > 0) pose = { state: 'hurt', t: this.animT, p: 0 };
    else if (this.mode === 'windup') pose = { state: 'windup', t: this.animT, p: 1 - this.modeT / 0.45 };
    else if (this.mode === 'strike' || this.mode === 'recover') pose = { state: 'swipe', t: this.animT, p: this.mode === 'strike' ? 1 - this.modeT / 0.14 : 1 };
    else if (Math.abs(this.body.velocity.x) > 5) pose = { state: 'run', t: this.animT * 0.6, p: 0 };
    else pose = { state: 'idle', t: this.animT, p: 0 };
    drawHumanoid(this.g, this.flashT > 0 ? Husk.flash : Husk.look, pose);
    this.g.setScale(this.facing, 1);
    // telegraph glow while winding up
    if (this.mode === 'windup') this.g.fillStyle(0xc46bff, 0.35).fillCircle(10, -112, 10 + Math.sin(this.animT * 40) * 3);
  }
}

// ------------------------------------------------------------------ Hollow Crow (flying swooper)

export class Crow extends Enemy {
  // hover low enough to be hit by a jump attack, and after every dive the crow is grounded for a moment
  private mode: 'hover' | 'swoop' | 'grounded' | 'rise' = 'hover';
  private modeT = Phaser.Math.FloatBetween(1.0, 1.8);
  private side = Math.random() < 0.5 ? -1 : 1;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 10, 92, 60, true);
    this.score = 150;
    this.useSprites(['crow-fly', 'crow-swoop'], COLORS.hollow, 1);
  }

  protected onHit(dir: number, knock: number, heavy: boolean) {
    this.stunT = 0.45;
    this.body.setVelocity(dir * knock, 60);
    this.mode = 'rise'; this.modeT = 0.6; this.contactDmg = 0;
    void heavy;
  }

  protected think(dt: number) {
    const p = this.player;
    this.modeT -= dt;
    switch (this.mode) {
      case 'hover': {
        const tx = p.x + this.side * 170, ty = 405 + Math.sin(this.animT * 2) * 18;
        this.body.setVelocity((tx - this.x) * 2.2, (ty - this.y) * 2.2);
        this.faceToward(p.x);
        if (this.modeT <= 0 && p.alive) {
          this.mode = 'swoop'; this.modeT = 1.0;
          audio.sfx('caw');
          const v = new Phaser.Math.Vector2(p.x - this.x, p.centerY() + 20 - this.y).normalize().scale(480);
          this.body.setVelocity(v.x, v.y);
          this.contactDmg = 8;
        }
        break;
      }
      case 'swoop':
        if (this.y > GROUND_Y - 70) {
          // skids along the ground, then sits stunned: the punish window
          this.mode = 'grounded'; this.modeT = 0.9; this.contactDmg = 0;
          this.body.setVelocity(this.body.velocity.x * 0.3, 0);
        } else if (this.modeT <= 0) { this.mode = 'rise'; this.modeT = 0.6; this.contactDmg = 0; }
        break;
      case 'grounded':
        this.body.setVelocity(this.body.velocity.x * 0.9, 0);
        if (this.modeT <= 0) { this.mode = 'rise'; this.modeT = 0.6; }
        break;
      case 'rise':
        this.body.setVelocity(this.body.velocity.x * 0.95, -220);
        if (this.modeT <= 0 || this.y < 400) {
          this.mode = 'hover'; this.modeT = Phaser.Math.FloatBetween(1.4, 2.2); this.side = -this.side;
        }
        break;
    }
    if (Math.abs(this.body.velocity.x) > 20) this.facing = this.body.velocity.x < 0 ? -1 : 1;
  }

  protected render() {
    if (this.spr) {
      // flying sprites hang from the body centre; flap by squashing the wings vertically
      if (this.mode === 'swoop') {
        const rot = Math.atan2(this.body.velocity.y, Math.abs(this.body.velocity.x)) * 0.5;
        this.pose('crow-swoop', { dy: 40, rot });
      } else {
        const flapRate = this.mode === 'grounded' ? 5 : 14;
        this.pose('crow-fly', { dy: 46, sy: 0.85 + Math.sin(this.animT * flapRate) * 0.2, rot: this.mode === 'grounded' ? 0.15 : 0 });
      }
      return;
    }
    drawCrow(this.g, this.animT, this.mode === 'swoop', this.flashT > 0);
    this.g.setScale(this.facing, 1);
    if (this.mode === 'swoop') this.g.rotation = Math.atan2(this.body.velocity.y, Math.abs(this.body.velocity.x)) * 0.6 * this.facing;
    else this.g.rotation = 0;
  }
}

// ------------------------------------------------------------------ Spirit Wolf (orb carrier)

export class SpiritWolf extends Enemy {
  private lungeCd = 1.2;
  private lunging = false;
  private turnCd = 0;

  constructor(gs: GameScene, x: number, dir: 1 | -1) {
    super(gs, x, GROUND_Y, 40, 120, 76);
    this.carrier = true;
    this.facing = dir;
    this.score = 300;
    this.useSprites(['wolf-run', 'wolf-lunge'], COLORS.spirit, 3);
    audio.sfx('howl'); // announces the orb carrier
  }

  protected think(dt: number) {
    const p = this.player;
    this.lungeCd -= dt;
    this.turnCd -= dt;
    if (this.lunging) {
      if (this.onGround && this.body.velocity.y >= 0) { this.lunging = false; this.contactDmg = 0; }
      return;
    }
    // run past the player, turn around once well beyond them
    const dx = p.x - this.x;
    if (this.turnCd <= 0 && Math.sign(dx) !== this.facing && Math.abs(dx) > 260) { this.facing = this.facing === 1 ? -1 : 1; this.turnCd = 0.8; }
    this.body.setVelocityX(this.facing * 250);
    if (this.lungeCd <= 0 && Math.abs(dx) < 170 && Math.sign(dx) === this.facing && p.alive && this.onGround) {
      this.lunging = true; this.lungeCd = 1.8; this.contactDmg = 10;
      audio.sfx('snarl');
      this.body.setVelocity(this.facing * 430, -430);
    }
  }

  protected render() {
    if (this.spr) {
      const ph = this.animT * 12;
      if (this.lunging) this.pose('wolf-lunge', { rot: -0.15 });
      else this.pose('wolf-run', { dy: -Math.abs(Math.sin(ph)) * 6, rot: Math.sin(ph) * 0.06, sx: 1 + Math.sin(ph) * 0.04 });
      this.spr.setAlpha(0.88 + Math.sin(this.animT * 5) * 0.08);
      return;
    }
    drawWolf(this.g, this.animT, Math.abs(this.body.velocity.x) > 5, this.lunging, this.flashT > 0);
    this.g.setScale(this.facing, 1);
  }
}

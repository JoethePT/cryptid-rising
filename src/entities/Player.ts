import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { BEASTS, BeastId, COLORS, FORMS, GROUND_Y, HEROES, HeroDef, HeroId } from '../config';
import { bigfootLook, drawHumanoid, heroLook, Look, Pose, PoseState } from '../gfx/Puppet';
import { applySprite, spritesReady, makeHalo, shaderFxOk, syncHalo } from '../gfx/Sprites';
import { audio } from '../systems/Audio';

/** Human attacks were tuned for a 108px-tall puppet; painted sprites are bigger. */
const HS = 1.3;

export type AttackKind = 'punch' | 'kick' | 'cpunch' | 'ckick' | 'airkick' | 'pound' | 'log' | 'charge' | 'slash' | 'pounce' | 'claw' | 'breath';

/** Highest the flying dragon may go (feet y). */
const FLY_CEILING = 210;

const BEAST_POSES: Record<BeastId, string[]> = {
  bigfoot: ['idle', 'walk', 'raise', 'slam', 'throw', 'charge'],
  raptor: ['idle', 'run', 'slash', 'pounce', 'roar'],
  dragon: ['hover', 'glide', 'claw', 'breath'],
};

export interface AttackDef {
  kind: AttackKind;
  pose: PoseState;
  crouch?: boolean;
  startup: number;
  active: number;
  recover: number;
  dmg: number;
  x: number; // hitbox centre, forward of the player
  y: number; // hitbox centre, relative to the feet (negative = up)
  w: number;
  h: number;
  knock: number;
  heavy: boolean;
}

interface ActiveAttack { def: AttackDef; t: number; fired: boolean; hit: Set<object> }

export interface Hitbox { rect: Phaser.Geom.Rectangle; def: AttackDef; hit: Set<object> }

export class Player extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;
  readonly hero: HeroDef;
  form = 0;
  hp: number;
  facing: 1 | -1 = 1;
  state: 'normal' | 'hurt' | 'dead' | 'cinematic' = 'normal';
  cinematicPose: PoseState | null = null;
  invulnUntil = 0;
  onGround = true;
  crouching = false;

  private g: Phaser.GameObjects.Graphics;
  private spr: Phaser.GameObjects.Image;
  private glow?: Phaser.FX.Glow;
  private halo?: Phaser.GameObjects.Image;
  private useSprites: boolean;
  private beastSprites: boolean;
  /** sprite-name prefix of the beast art (e.g. 'elder') */
  private beastArt: string;
  private ageTint = 0;
  private trailT = 0;
  private aura: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Graphics;
  private looks: Look[];
  private animT = 0;
  private atk?: ActiveAttack;
  private charge?: ActiveAttack;
  private dashT = 0;
  private dashCd = 0;
  private bufT = 0;
  private bufKey: 'punch' | 'kick' = 'punch';
  private hurtT = 0;
  private airKickUsed = false;

  constructor(private gs: GameScene, x: number, y: number, heroId: HeroId, readonly beast: BeastId = 'bigfoot', artId?: string) {
    super(gs, x, y);
    this.hero = HEROES[heroId];
    this.hp = this.hero.maxHp;
    this.beastArt = artId ?? beast;
    const beastLook = bigfootLook();
    if (this.isElderArt) Object.assign(beastLook, { top: 0x8c9096, topShade: 0x62666c, sleeve: 0x8c9096, bottom: 0x8c9096, bottomShade: 0x62666c, skin: 0x9a8a7a });
    this.looks = [heroLook(heroId, 0), heroLook(heroId, 1), heroLook(heroId, 2), beastLook];
    this.shadow = gs.add.graphics();
    this.aura = gs.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.g = gs.add.graphics();
    const sprKeys = ['idle', 'walk', 'punch', 'kick', 'crouch', 'jump', 'hurt'].map((p) => `${heroId}-${p}`);
    this.useSprites = spritesReady(gs, sprKeys);
    // the beast can fall back to the drawn puppet on its own if its art is missing
    this.beastSprites = spritesReady(gs, BEAST_POSES[beast].map((p) => `${this.beastArt}-${p}`));
    if (!this.beastSprites && this.beastArt !== beast && spritesReady(gs, BEAST_POSES[beast].map((p) => `${beast}-${p}`))) {
      // no painted Elder Bigfoot yet: wear the Bigfoot art, greyed with age
      this.beastArt = beast; this.beastSprites = true; this.ageTint = 0xb8bcc6;
    }
    this.spr = gs.add.image(0, 0, this.useSprites ? `${heroId}-idle` : '__DEFAULT').setVisible(this.useSprites);
    if (this.useSprites && this.spr.preFX && shaderFxOk()) {
      this.spr.preFX.setPadding(18);
      this.glow = this.spr.preFX.addGlow(COLORS.spirit, 0, 0, false, 0.1, 12);
    } else if (this.useSprites) {
      this.halo = makeHalo(gs, this.spr, COLORS.spirit);
    }
    this.g.setVisible(!this.useSprites);
    this.add([this.shadow, this.aura, ...(this.halo ? [this.halo] : []), this.spr, this.g]);
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocityY(1400);
    this.applyFormBody();
    this.setDepth(10);
  }

  get formDef() {
    const f = FORMS[this.form];
    return this.form === 3 ? { ...f, bodyW: BEASTS[this.beast].bodyW, bodyH: BEASTS[this.beast].bodyH } : f;
  }
  get isElderArt() { return this.beastArt === 'elder'; }
  /** Stage 4's Elder Bigfoot hits harder and throws burning logs */
  get isElder() { return this.isBeast && this.gs.stage.beastArt === 'elder'; }
  get isRaptor() { return this.isBeast && this.beast === 'raptor'; }
  get isDragon() { return this.isBeast && this.beast === 'dragon'; }
  private diveVy = 0;
  private stepT = 0;
  get isBeast() { return this.form === 3; }
  get alive() { return this.state !== 'dead'; }

  private applyFormBody() {
    const f = this.formDef;
    const h = this.crouching ? f.bodyH * 0.62 : f.bodyH;
    this.body.setSize(f.bodyW, h, false);
    this.body.setOffset(-f.bodyW / 2, -h);
  }

  private setCrouch(v: boolean) {
    if (v === this.crouching) return;
    this.crouching = v;
    this.applyFormBody();
  }

  setForm(n: number) {
    this.form = Phaser.Math.Clamp(n, 0, 3);
    this.crouching = false;
    this.atk = undefined;
    this.applyFormBody();
    // the dragon flies: no gravity while in that form
    this.body.setAllowGravity(!this.isDragon);
  }

  hurtRect() {
    const b = this.body;
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
  }

  centerY() { return this.y - this.body.height / 2; }

  private def(kind: AttackKind): AttackDef {
    const s = this.formDef.scale * HS;
    const m = this.hero.dmgMul * this.formDef.dmg;
    switch (kind) {
      case 'punch':
        return { kind, pose: 'punch', startup: 0.045, active: 0.1, recover: 0.08, dmg: 10 * m, x: 46 * s, y: -88 * s, w: 72 * s, h: 56 * s, knock: 140, heavy: false };
      case 'cpunch':
        return { kind, pose: 'punch', crouch: true, startup: 0.045, active: 0.1, recover: 0.08, dmg: 10 * m, x: 46 * s, y: -52 * s, w: 72 * s, h: 44 * s, knock: 140, heavy: false };
      case 'kick':
        return { kind, pose: 'kick', startup: 0.075, active: 0.11, recover: 0.12, dmg: 14 * m, x: 54 * s, y: -64 * s, w: 82 * s, h: 56 * s, knock: 280, heavy: true };
      case 'ckick':
        return { kind, pose: 'kick', crouch: true, startup: 0.06, active: 0.11, recover: 0.14, dmg: 12 * m, x: 52 * s, y: -18 * s, w: 82 * s, h: 36 * s, knock: 200, heavy: true };
      case 'airkick':
        return { kind, pose: 'airkick', startup: 0.03, active: 0.36, recover: 0.05, dmg: 15 * m, x: 40 * s, y: -50 * s, w: 76 * s, h: 72 * s, knock: 260, heavy: true };
      case 'pound':
        return { kind, pose: 'pound', startup: 0.22, active: 0.1, recover: 0.24, dmg: 42 * this.hero.dmgMul * (this.isElder ? 1.25 : 1), x: 80, y: -60, w: 190, h: 120, knock: 420, heavy: true };
      case 'log':
        return { kind, pose: 'throw', startup: 0.16, active: 0.05, recover: 0.2, dmg: 0, x: 0, y: 0, w: 0, h: 0, knock: 0, heavy: false };
      case 'slash':
        return { kind, pose: 'slash', startup: 0.06, active: 0.1, recover: 0.13, dmg: 22 * this.hero.dmgMul, x: 85, y: -70, w: 130, h: 90, knock: 240, heavy: false };
      case 'pounce':
        return { kind, pose: 'pounce', startup: 0.1, active: 0.7, recover: 0.1, dmg: 34 * this.hero.dmgMul, x: 60, y: -60, w: 130, h: 90, knock: 380, heavy: true };
      case 'claw':
        return { kind, pose: 'claw', startup: 0.05, active: 0.1, recover: 0.14, dmg: 24 * this.hero.dmgMul, x: 85, y: -50, w: 140, h: 110, knock: 260, heavy: false };
      case 'breath':
        return { kind, pose: 'breath', startup: 0.12, active: 0.05, recover: 0.24, dmg: 0, x: 0, y: 0, w: 0, h: 0, knock: 0, heavy: false };
      case 'charge':
        if (this.isDragon) return { kind, pose: 'dash', startup: 0, active: 0.3, recover: 0, dmg: 24 * this.hero.dmgMul, x: 40, y: -50, w: 170, h: 110, knock: 400, heavy: true };
        if (this.isRaptor) return { kind, pose: 'dash', startup: 0, active: 0.26, recover: 0, dmg: 20 * this.hero.dmgMul, x: 50, y: -60, w: 120, h: 100, knock: 360, heavy: true };
        return { kind, pose: 'dash', startup: 0, active: 0.34, recover: 0, dmg: 26 * this.hero.dmgMul, x: 50, y: -105, w: 110, h: 170, knock: 480, heavy: true };
    }
  }

  /** Nearest living enemy (or boss) within reach, used to auto-face attacks. */
  private nearestTarget(range: number) {
    let best: { x: number; y: number; flying: boolean } | undefined, bd = range;
    const list = [...this.gs.enemies, ...(this.gs.boss ? [this.gs.boss] : [])];
    for (const e of list) {
      if (!e || e.dead || !e.active) continue;
      const dx = Math.abs(e.x - this.x), dy = Math.abs(e.y - this.y);
      if (dy > 320) continue;
      if (dx < bd) { bd = dx; best = { x: e.x, y: e.y, flying: e.flying }; }
    }
    return best;
  }

  private startAttack(kind: AttackKind) {
    const def = this.def(kind);
    // turn toward the closest enemy so you don't have to line up perfectly (most useful on touch)
    const t = this.nearestTarget(kind === 'log' || kind === 'breath' ? 600 : 300);
    if (t && Math.abs(t.x - this.x) > 12) this.facing = t.x > this.x ? 1 : -1;
    // standing punch under a bird becomes an upward strike
    if (kind === 'punch' && t?.flying && this.y - t.y > 120 && Math.abs(t.x - this.x) < 170) {
      const s = this.formDef.scale * HS;
      def.x = 28 * s; def.y = -175 * s; def.w = 96 * s; def.h = 130 * s;
    }
    this.atk = { def, t: 0, fired: false, hit: new Set() };
    this.bufT = 0;
    audio.sfx(kind === 'pounce' ? 'pounce' : kind === 'log' ? 'throw' : 'swing');
    if (kind === 'airkick') this.airKickUsed = true;
  }

  private onActive(d: AttackDef) {
    if (d.kind === 'pound') {
      this.gs.playerPound(this.x + this.facing * 60, this.y, this.isElder);
    } else if (d.kind === 'breath') {
      audio.sfx('zap');
      this.gs.spawnProjectile('bolt', this.x + this.facing * 110, this.y - 62, this.facing);
    } else if (d.kind === 'pounce') {
      this.body.setVelocity(this.facing * 660, -560);
      this.gs.fx.burst(this.x, this.y - 10, 0xc47a4c, 10);
    } else if (d.kind === 'log') {
      this.gs.spawnProjectile(this.isElder ? 'flog' : 'log', this.x + this.facing * 70, this.y - 150, this.facing);
    }
  }

  /** The hitbox that is currently live, if any. */
  activeHitbox(): Hitbox | null {
    const make = (a: ActiveAttack) => {
      const d = a.def;
      const cx = this.x + this.facing * d.x, cy = this.y + d.y;
      return { rect: new Phaser.Geom.Rectangle(cx - d.w / 2, cy - d.h / 2, d.w, d.h), def: d, hit: a.hit };
    };
    if (this.charge && this.dashT > 0) return make(this.charge);
    const a = this.atk;
    if (!a || a.def.w === 0) return null;
    if (a.t < a.def.startup || a.t > a.def.startup + a.def.active) return null;
    return make(a);
  }

  update(dt: number) {
    const c = this.gs.controls;
    const b = this.body;
    this.onGround = b.blocked.down || b.touching.down;
    if (this.onGround) this.airKickUsed = false;
    this.animT += dt;

    if (this.state === 'dead' || this.state === 'cinematic') { this.draw(); return; }

    if (this.state === 'hurt') {
      this.hurtT -= dt;
      if (this.onGround) b.setVelocityX(b.velocity.x * 0.85);
      if (this.hurtT <= 0) this.state = 'normal';
      this.draw();
      return;
    }

    this.dashCd -= dt;
    if (this.dashT > 0) {
      this.dashT -= dt;
      b.setVelocity(this.facing * (this.isDragon ? 900 : this.isRaptor ? 950 : this.isBeast ? 640 : 740), this.isDragon ? this.diveVy : 0);
      if (this.dashT <= 0) {
        b.setAllowGravity(!this.isDragon);
        b.setVelocityX(this.facing * 150);
        this.charge = undefined;
      }
      this.draw();
      return;
    }

    if (this.atk) {
      const a = this.atk, d = a.def;
      a.t += dt;
      if (!a.fired && a.t >= d.startup) { a.fired = true; this.onActive(d); }
      if (d.kind === 'airkick' && this.onGround) this.atk = undefined;
      else if (d.kind === 'pounce' && a.fired && this.onGround && a.t > d.startup + 0.15) { this.atk = undefined; this.gs.fx.shake(0.006, 100); }
      else if (a.t >= d.startup + d.active + d.recover) this.atk = undefined;
    }

    // remember a punch/kick pressed mid-attack, and let it cut the recovery short
    this.bufT = Math.max(0, this.bufT - dt);
    if (c.pressed('punch')) { this.bufT = 0.22; this.bufKey = 'punch'; }
    else if (c.pressed('kick')) { this.bufT = 0.22; this.bufKey = 'kick'; }
    if (this.atk && this.bufT > 0) {
      const d = this.atk.def;
      const chainable = d.kind !== 'pounce' && d.kind !== 'airkick' && d.kind !== 'charge';
      if (chainable && this.atk.t > d.startup + d.active * 0.6) this.atk = undefined;
    }

    if (this.isDragon) { this.updateFlight(dt); this.draw(); return; }

    const left = c.isDown('left'), right = c.isDown('right');
    if (!this.atk) this.setCrouch(this.onGround && c.isDown('down') && !this.isBeast);

    const speed = this.hero.speed * this.formDef.speed * (this.isBeast ? BEASTS[this.beast].speed : 1);
    // heavy Bigfoot footfalls
    if (this.isBeast && this.beast === 'bigfoot' && this.onGround && Math.abs(b.velocity.x) > 20) {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.36; audio.sfx('step'); }
    }
    const groundAttack = !!this.atk && this.atk.def.kind !== 'airkick' && this.atk.def.kind !== 'pounce';
    if (this.atk?.def.kind === 'pounce' && this.atk.fired) {
      // momentum carries the leap
    } else if (groundAttack && this.onGround) {
      b.setVelocityX(b.velocity.x * 0.7);
    } else if (this.crouching) {
      b.setVelocityX(0);
    } else {
      let vx = 0;
      if (left) vx -= speed;
      if (right) vx += speed;
      b.setVelocityX(vx);
      if (vx !== 0 && !this.atk) this.facing = vx > 0 ? 1 : -1;
    }

    // jump (variable height: release early for a short hop)
    if (c.pressed('jump') && this.onGround && !groundAttack) {
      this.setCrouch(false);
      audio.sfx('jump');
      b.setVelocityY(-this.hero.jump * (this.isBeast ? BEASTS[this.beast].jump : 1));
    }
    if (!c.isDown('jump') && b.velocity.y < -260) b.setVelocityY(b.velocity.y * 0.55);

    if (!this.atk) {
      const P = this.bufT > 0 && this.bufKey === 'punch', K = this.bufT > 0 && this.bufKey === 'kick';
      if (this.isRaptor) {
        if (P) this.startAttack('slash');
        else if (K) this.startAttack(this.onGround ? 'pounce' : 'slash');
      } else if (this.isBeast) {
        if (P && this.onGround) this.startAttack('pound');
        else if (K) this.startAttack('log');
      } else if (this.onGround) {
        if (P) this.startAttack(this.crouching ? 'cpunch' : 'punch');
        else if (K) this.startAttack(this.crouching ? 'ckick' : 'kick');
      } else if ((P || K) && !this.airKickUsed) {
        this.startAttack('airkick');
      }
    }

    if (c.pressed('dash') && this.dashCd <= 0 && !this.atk) {
      if (left) this.facing = -1;
      if (right) this.facing = 1;
      this.setCrouch(false);
      this.dashT = this.isRaptor ? 0.26 : this.isBeast ? 0.34 : 0.18;
      this.dashCd = this.isBeast ? 0.75 : 0.45;
      b.setAllowGravity(false);
      if (this.isBeast) this.charge = { def: this.def('charge'), t: 0, fired: true, hit: new Set() };
      this.gs.fx.burst(this.x - this.facing * 20, this.y - 20, this.isBeast ? COLORS.beast : 0xffffff, 8);
    }

    this.draw();
  }

  /** Storm Dragon: free 8-way flight between the storm ceiling and the ground. */
  private updateFlight(dt: number) {
    const c = this.gs.controls, b = this.body;
    const left = c.isDown('left'), right = c.isDown('right');
    const up = c.isDown('up') || c.isDown('jump'), down = c.isDown('down');
    const sp = this.hero.speed * BEASTS.dragon.speed;
    const tx = (right ? sp : 0) - (left ? sp : 0);
    const ty = up ? -sp * 0.85 : down ? sp * 0.85 : Math.sin(this.animT * 3) * 22;
    const k = Math.min(1, dt * 9);
    const slow = this.atk ? 0.5 : 1;
    b.setVelocity(b.velocity.x + (tx * slow - b.velocity.x) * k, b.velocity.y + (ty * slow - b.velocity.y) * k);
    if (tx !== 0 && !this.atk) this.facing = tx > 0 ? 1 : -1;
    if (this.y < FLY_CEILING) { this.y = FLY_CEILING; if (b.velocity.y < 0) b.setVelocityY(0); }

    if (!this.atk) {
      if (this.bufT > 0 && this.bufKey === 'punch') this.startAttack('claw');
      else if (this.bufT > 0 && this.bufKey === 'kick') this.startAttack('breath');
    }
    if (c.pressed('dash') && this.dashCd <= 0 && !this.atk) {
      if (left) this.facing = -1;
      if (right) this.facing = 1;
      this.diveVy = down ? 420 : up ? -380 : 0;
      this.dashT = 0.3;
      this.dashCd = 0.6;
      this.charge = { def: this.def('charge'), t: 0, fired: true, hit: new Set() };
      this.gs.fx.burst(this.x - this.facing * 40, this.y - 50, COLORS.spirit, 10);
      audio.sfx('swing');
    }
  }

  /** Returns true if the hit landed. */
  hurt(dmg: number, fromX: number): boolean {
    const now = this.gs.time.now;
    if (this.state === 'dead' || this.state === 'cinematic' || now < this.invulnUntil || this.dashT > 0) return false;
    const dir = this.x < fromX ? -1 : 1;
    this.hp = Math.max(0, this.hp - Math.round(dmg));
    this.atk = undefined;
    this.setCrouch(false);
    this.body.setAllowGravity(!this.isDragon);
    audio.sfx('hurt');
    this.gs.fx.burst(this.x, this.centerY(), COLORS.hurt, 14);
    this.gs.fx.number(this.x, this.y - this.body.height - 10, Math.round(dmg), '#ff6b78', 26);
    this.gs.fx.shake(0.006, 140);
    this.gs.hitstop(70);
    this.gs.stats.damageTaken += Math.round(dmg);
    if (this.hp <= 0) { this.die(dir); return true; }
    if (this.isBeast) {
      // super armour: beasts flinch but don't get knocked around
      this.invulnUntil = now + 800;
      this.body.setVelocityX(dir * 120);
    } else {
      this.state = 'hurt';
      this.hurtT = 0.35;
      this.invulnUntil = now + 1100;
      this.body.setVelocity(dir * 260, -280);
    }
    return true;
  }

  private die(dir: number) {
    this.state = 'dead';
    this.body.setVelocity(dir * 200, -380);
    this.gs.tweens.add({ targets: this.g, rotation: -this.facing * 1.45, duration: 450, ease: 'Quad.easeOut' });
    this.gs.onPlayerDeath();
  }

  respawn() {
    this.hp = this.hero.maxHp;
    this.state = 'normal';
    this.g.rotation = 0;
    this.setForm(Math.max(0, this.form - 1));
    this.invulnUntil = this.gs.time.now + 2200;
    this.body.setVelocity(0, -500);
  }

  private pose(): Pose {
    const t = this.animT;
    if (this.cinematicPose) return { state: this.cinematicPose, t, p: 0 };
    if (this.state === 'dead' || this.state === 'hurt') return { state: 'hurt', t, p: 0 };
    if (this.dashT > 0) return { state: 'dash', t, p: 0 };
    if (this.atk) {
      const d = this.atk.def;
      return { state: d.pose, t, p: Math.min(1, this.atk.t / (d.startup + d.active + d.recover)), crouch: d.crouch };
    }
    if (this.isDragon) return { state: Math.abs(this.body.velocity.x) > 60 ? 'run' : 'idle', t, p: 0 };
    if (!this.onGround) return { state: this.body.velocity.y < 0 ? 'jump' : 'fall', t, p: 0 };
    if (this.crouching) return { state: 'crouch', t, p: 0 };
    if (Math.abs(this.body.velocity.x) > 10) return { state: 'run', t: t * (this.isBeast ? 0.7 : 1), p: 0 };
    return { state: 'idle', t, p: 0 };
  }

  /** Pick a painted pose + code-driven secondary motion (bob, lean, squash). */
  private raptorPose(pose: Pose) {
    const k = (p: string) => `raptor-${p}`;
    const t = pose.t, p = pose.p;
    let key = k('idle'), rot = 0, dx = 0, dy = 0, sx = 1, sy = 1;
    switch (pose.state) {
      case 'idle': sy = 1 + Math.sin(t * 4) * 0.015; break;
      case 'run': { const ph = t * 14; key = Math.floor(ph / Math.PI) % 2 === 0 ? k('run') : k('idle'); dy = -Math.abs(Math.sin(ph)) * 7; break; }
      case 'jump': case 'fall': key = k('pounce'); rot = pose.state === 'fall' ? 0.12 : -0.1; break;
      case 'crouch': sy = 0.88; break;
      case 'slash': key = p < 0.2 ? k('idle') : k('slash'); dx = p >= 0.2 && p < 0.6 ? 10 : -4; break;
      case 'pounce': key = p < 0.12 ? k('idle') : k('pounce'); if (p < 0.12) { sy = 0.86; sx = 1.08; } break;
      case 'dash': key = k('run'); sx = 1.1; break;
      case 'hurt': rot = -0.15; dx = -6; break;
      case 'flex': key = k('roar'); sx = 1.03 + Math.sin(t * 40) * 0.02; break;
      default: break;
    }
    return { key, rot, dx, dy, sx, sy };
  }

  private dragonPose(pose: Pose) {
    const k = (p: string) => `dragon-${p}`;
    const t = pose.t, p = pose.p, vy = this.body.velocity.y;
    let key = k('hover'), rot = 0, dx = 0, dy = Math.sin(t * 3) * 4, sx = 1, sy = 1;
    switch (pose.state) {
      case 'idle': sy = 1 + Math.sin(t * 6) * 0.04; break; // wingbeat
      case 'run': key = k('glide'); rot = Phaser.Math.Clamp(vy / 1400, -0.25, 0.25); dy = 0; break;
      case 'claw': key = p < 0.2 ? k('hover') : k('claw'); dx = p >= 0.2 && p < 0.6 ? 12 : -4; break;
      case 'breath': key = k('breath'); dx = p < 0.3 ? -6 : 4; break;
      case 'dash': key = k('glide'); sx = 1.12; rot = Phaser.Math.Clamp(this.diveVy / 1600, -0.3, 0.3); dy = 0; break;
      case 'hurt': rot = -0.18; dx = -8; break;
      case 'flex': key = k('breath'); sx = 1.03 + Math.sin(t * 40) * 0.02; break;
      default: break;
    }
    return { key, rot, dx, dy, sx, sy };
  }

  private drawSprite(pose: Pose) {
    if (this.isDragon) {
      const r = this.dragonPose(pose);
      return this.finishSprite(pose, r.key, r.rot, r.dx, r.dy, r.sx, r.sy);
    }
    if (this.isRaptor) {
      const r = this.raptorPose(pose);
      return this.finishSprite(pose, r.key, r.rot, r.dx, r.dy, r.sx, r.sy);
    }
    const id = this.isBeast ? this.beastArt : this.hero.id;
    const k = (p: string) => `${id}-${p}`;
    const t = pose.t, p = pose.p;
    let key = k('idle'), rot = 0, dx = 0, dy = 0, sx = 1, sy = 1;
    switch (pose.state) {
      case 'idle':
        sy = 1 + Math.sin(t * 3) * 0.012; sx = 1 - Math.sin(t * 3) * 0.006;
        break;
      case 'run': {
        const ph = t * (this.isBeast ? 8 : 11);
        key = Math.floor(ph / Math.PI) % 2 === 0 ? k('walk') : k('idle');
        dy = -Math.abs(Math.sin(ph)) * (this.isBeast ? 6 : 4);
        rot = 0.04;
        break;
      }
      case 'jump':
        key = this.isBeast ? k('walk') : k('jump'); rot = this.isBeast ? -0.12 : -0.05;
        break;
      case 'fall':
        key = this.isBeast ? k('walk') : k('jump'); rot = 0.08;
        break;
      case 'crouch':
        if (this.isBeast) { sy = 0.9; } else key = k('crouch');
        break;
      case 'punch':
        if (pose.crouch) { key = k('crouch'); dx = p > 0.25 && p < 0.65 ? 12 : 0; rot = dx ? 0.08 : 0; }
        else { key = p < 0.22 ? k('idle') : k('punch'); dx = p >= 0.22 && p < 0.6 ? 8 : p < 0.22 ? -4 : 0; }
        break;
      case 'kick':
        if (pose.crouch) { key = k('crouch'); dx = p > 0.3 && p < 0.7 ? 14 : 0; sy = 0.92; }
        else { key = p < 0.25 ? k('idle') : k('kick'); rot = p < 0.25 ? -0.05 : 0; }
        break;
      case 'airkick':
        key = this.isBeast ? k('charge') : k('kick'); rot = -0.28;
        break;
      case 'dash':
        key = this.isBeast ? k('charge') : k('walk'); rot = this.isBeast ? 0 : 0.22; sx = 1.06;
        break;
      case 'hurt':
        key = this.isBeast ? k('idle') : k('hurt'); rot = this.isBeast ? -0.12 : 0; dx = -4;
        break;
      case 'flex': {
        const shake = Math.sin(t * 40) * 0.02;
        key = this.isBeast ? k('raise') : k('idle'); sx = 1.03 + shake; sy = 1.03 - shake;
        break;
      }
      case 'pound':
        key = p < 0.45 ? k('raise') : k('slam');
        if (p >= 0.45 && p < 0.55) { sx = 1.08; sy = 0.92; }
        break;
      case 'throw':
        key = p < 0.35 ? k('idle') : k('throw'); dx = p < 0.35 ? -6 : 6;
        break;
    }
    this.finishSprite(pose, key, rot, dx, dy, sx, sy);
  }

  private finishSprite(pose: Pose, key: string, rot: number, dx: number, dy: number, sx: number, sy: number) {
    const s = this.formDef.scale;
    applySprite(this.spr, key, this.facing, s);
    this.spr.scaleX *= sx; this.spr.scaleY *= sy;
    this.spr.setPosition(dx * this.facing, dy);
    this.spr.setRotation(rot * this.facing);
    if (this.state === 'dead') this.spr.setRotation(-this.facing * 1.4).setY(-10);

    // glow per power level
    if (this.glow) {
      const pulse = 0.5 + 0.5 * Math.sin(this.animT * 6);
      this.glow.color = this.isBeast ? COLORS.beast : COLORS.spirit;
      this.glow.outerStrength = [0, 1.5, 3, 2.5][this.form] + (this.form ? pulse * 1.2 : 0);
    }
    if (this.halo) {
      const pulse = 0.5 + 0.5 * Math.sin(this.animT * 6);
      const str = this.form ? [0, 0.45, 0.75, 0.65][this.form] + pulse * 0.25 : 0;
      syncHalo(this.halo, this.spr, this.isBeast ? COLORS.beast : COLORS.spirit, str);
    }
    // red flash right after a hit
    const now = this.gs.time.now;
    if (this.state === 'hurt' || now < this.invulnUntil - 700) this.spr.setTint(0xff9a9a);
    else if (this.isBeast && this.ageTint) this.spr.setTint(this.ageTint);
    else this.spr.clearTint();

    // afterimages while dashing
    if (pose.state === 'dash') {
      this.trailT -= 1 / 60;
      if (this.trailT <= 0) {
        this.trailT = 0.035;
        const ghost = this.gs.add.image(this.x + this.spr.x, this.y + this.spr.y, this.spr.texture.key)
          .setOrigin(this.spr.originX, 1).setScale(this.spr.scaleX, this.spr.scaleY).setRotation(this.spr.rotation)
          .setTint(this.isBeast ? COLORS.beast : COLORS.spirit).setAlpha(0.45).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
        this.gs.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      }
    }
  }

  draw() {
    const pose = this.pose();
    const s = this.formDef.scale;
    const painted = this.useSprites && (!this.isBeast || this.beastSprites);
    this.spr.setVisible(painted);
    this.g.setVisible(!painted);
    if (painted) {
      this.g.clear();
      this.drawSprite(pose);
    } else {
      drawHumanoid(this.g, this.looks[this.form], pose);
      this.g.setScale(this.facing * s, s);
    }
    const now = this.gs.time.now;
    const blink = now < this.invulnUntil && this.state !== 'dead' ? (Math.floor(now / 70) % 2 ? 0.35 : 1) : 1;
    this.g.setAlpha(blink);
    this.spr.setAlpha(blink);

    this.aura.clear();
    if (this.form > 0 && this.state !== 'dead' && !this.useSprites) {
      const col = this.isBeast ? COLORS.beast : COLORS.spirit;
      const pulse = 0.5 + 0.5 * Math.sin(this.animT * 6);
      const h = this.formDef.bodyH * (this.isBeast ? 1 : s);
      const strength = this.form === 1 ? 0.6 : 1;
      this.aura.fillStyle(col, (0.08 + 0.05 * pulse) * strength);
      this.aura.fillEllipse(0, -h * 0.5, h * 0.75 + pulse * 10, h * 1.15);
      this.aura.fillStyle(col, 0.07 * strength);
      this.aura.fillEllipse(0, -h * 0.5, h * 0.5, h * 0.95);
    }

    this.shadow.clear();
    if (this.isDragon) {
      // flying: the shadow sits on the ground below and shrinks with altitude
      const alt = Math.max(0, GROUND_Y - this.y), k = Phaser.Math.Clamp(1 - alt / 600, 0.25, 1);
      this.shadow.fillStyle(0x000000, 0.3 * k);
      this.shadow.fillEllipse(0, alt + 2, this.formDef.bodyW * 1.4 * k, 12 * k);
      return;
    }
    this.shadow.fillStyle(0x000000, this.onGround ? 0.35 : 0.15);
    const w = this.formDef.bodyW * 1.5 * (this.onGround ? 1 : 0.6);
    this.shadow.fillEllipse(0, 2, w, 12);
  }
}

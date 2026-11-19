import Phaser from 'phaser';
import { COLORS, DIFFICULTY, Difficulty, GAME_H, GAME_W, GROUND_Y, HeroId, STAGES, StageDef } from '../config';
import { Controls } from '../systems/Controls';
import { Fx } from '../systems/Fx';
import { audio } from '../systems/Audio';
import { Parallax, THEMES } from '../gfx/Parallax';
import { Player } from '../entities/Player';
import { Crow, Enemy, EnemyKind, Husk, SpiritWolf } from '../entities/Enemies';
import { FossilGolem, MooseTitan, ThunderWyrm } from '../entities/Boss';
import { Orb, Projectile, ProjKind } from '../entities/Projectile';

export interface GameData { hero: HeroId; difficulty: Difficulty; stage?: number; lives?: number; score?: number }

const overlap = Phaser.Geom.Intersects.RectangleToRectangle;

export class GameScene extends Phaser.Scene {
  controls!: Controls;
  fx!: Fx;
  player!: Player;
  diff = DIFFICULTY.normal;
  heroId: HeroId = 'mara';
  difficulty: Difficulty = 'normal';
  stage = STAGES[0];

  enemies: Enemy[] = [];
  boss?: Enemy;
  lives = 3;
  score = 0;
  combo = 0;
  stats = { kills: 0, damageTaken: 0, maxCombo: 0, time: 0 };

  private projectiles: Projectile[] = [];
  private orbs: Orb[] = [];
  private enemyGroup!: Phaser.GameObjects.Group;
  private ground!: Phaser.GameObjects.Zone;
  private parallax!: Parallax;
  private ferns!: Phaser.GameObjects.TileSprite;
  private frozenUntil = 0;
  private cinematic = false;
  private arenaLocked = false;
  private ended = false;
  private spawnT = 2;
  private carrierT = 3;
  private comboT = 0;

  constructor() { super('Game'); }

  create(data: GameData) {
    this.heroId = data.hero ?? 'mara';
    this.difficulty = data.difficulty ?? 'normal';
    this.diff = DIFFICULTY[this.difficulty];
    this.stage = STAGES.find((st) => st.id === (data.stage ?? 1) && st.implemented) ?? STAGES[0];
    const S: StageDef = this.stage;
    const theme = THEMES[S.theme];
    // scene instances are reused on restart, so reset all state here
    this.enemies = []; this.projectiles = []; this.orbs = []; this.boss = undefined;
    this.lives = data.lives ?? this.diff.lives; this.score = data.score ?? 0; this.combo = 0; this.comboT = 0;
    this.stats = { kills: 0, damageTaken: 0, maxCombo: 0, time: 0 };
    this.frozenUntil = 0; this.cinematic = false; this.arenaLocked = false; this.ended = false;
    this.spawnT = 2.5; this.carrierT = 3.5;

    this.controls = new Controls(this);
    this.fx = new Fx(this);
    audio.play(S.theme === 'canyon' ? 'canyon' : S.theme === 'storm' ? 'storm' : 'forest');
    audio.ambience(S.theme);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.ambience(null));
    const L = S.length;
    this.physics.world.setBounds(0, 0, L, GAME_H);
    this.physics.world.resume();
    this.cameras.main.setBounds(0, 0, L, GAME_H).setZoom(1);

    this.parallax = new Parallax(this, S.theme);
    this.add.particles(0, 0, 'dot', {
      x: { min: 0, max: GAME_W }, y: { min: 260, max: 620 }, lifespan: 4500, frequency: 220,
      speedX: { min: -18, max: 18 }, speedY: { min: -22, max: 6 }, scale: { start: 0.45, end: 0.1 },
      alpha: { start: 0.9, end: 0 }, tint: theme.motes, blendMode: Phaser.BlendModes.ADD,
    }).setScrollFactor(0).setDepth(-60);

    this.add.tileSprite(0, GROUND_Y, L, 96, theme.ground).setOrigin(0).setDepth(-5);
    // extends past both ends so enemies entering from off-screen have floor under them
    this.ground = this.add.zone(L / 2, GROUND_Y + 40, L + 1600, 80);
    this.physics.add.existing(this.ground, true);

    const platforms = this.physics.add.staticGroup();
    for (const p of S.platforms) {
      if (S.theme === 'canyon' || S.theme === 'storm') this.makeRockPlatform(platforms, p.x, p.y, p.w);
      else this.makeLogPlatform(platforms, p.x, p.y, p.w);
    }
    if (S.theme === 'canyon') this.makeFossilDecor();
    if (S.theme === 'storm') this.makeStorm();
    this.makeArenaDecor();

    this.player = new Player(this, 220, GROUND_Y - 1, this.heroId, S.beast);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, platforms);
    this.enemyGroup = this.add.group();
    this.physics.add.collider(this.enemyGroup, this.ground);

    this.ferns = this.add.tileSprite(0, GAME_H - 175, GAME_W, 220, theme.fg).setOrigin(0).setScrollFactor(0).setDepth(40).setAlpha(0.9);

    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.1, 0.1, -120, 0);
    cam.fadeIn(500, 0, 0, 0);

    this.scene.launch('Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop('Hud'));

    this.time.delayedCall(400, () => {
      this.events.emit('banner', `STAGE ${S.id} · ${S.name.toUpperCase()}`, '#ffe6a8', 54);
    });
  }

  private makeLogPlatform(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number) {
    const g = this.add.graphics().setDepth(-4);
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, GROUND_Y + 4, w * 0.9, 14);
    // support posts
    g.fillStyle(0x2a1a10, 1);
    g.fillRect(x - w / 2 + 16, y + 8, 12, GROUND_Y - y - 8);
    g.fillRect(x + w / 2 - 28, y + 8, 12, GROUND_Y - y - 8);
    g.fillStyle(COLORS.outline, 1); g.fillRoundedRect(x - w / 2 - 3, y - 3, w + 6, 28, 12);
    g.fillStyle(0x6b4425, 1); g.fillRoundedRect(x - w / 2, y, w, 22, 10);
    g.fillStyle(0x4f311a, 1); g.fillRect(x - w / 2 + 14, y + 7, w * 0.4, 3); g.fillRect(x, y + 13, w * 0.35, 3);
    g.fillStyle(0x3f6b3a, 1); g.fillRoundedRect(x - w * 0.3, y - 4, w * 0.35, 7, 3);
    g.fillStyle(0xd9b07a, 1); g.fillEllipse(x + w / 2 - 2, y + 11, 10, 20);
    const z = this.add.zone(x, y + 6, w, 12);
    group.add(z);
    const body = z.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false;
  }

  /** Rain, wind-blown sleet and periodic lightning over Storm Peak. */
  private makeStorm() {
    this.add.particles(0, 0, 'raindrop', {
      x: { min: -200, max: GAME_W + 300 }, y: -40, lifespan: 900, frequency: 10, quantity: 2,
      speedY: { min: 950, max: 1150 }, speedX: { min: -260, max: -200 }, rotate: 12,
      alpha: { start: 0.55, end: 0.2 }, scaleY: { min: 0.8, max: 1.3 },
    }).setScrollFactor(0).setDepth(36);
    const flash = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xdfe8ff, 0).setOrigin(0).setScrollFactor(0).setDepth(-58);
    const bolt = this.add.graphics().setScrollFactor(0).setDepth(-59);
    const strike = () => {
      if (this.ended) return;
      // forked bolt in the far sky
      const x0 = Phaser.Math.Between(100, GAME_W - 100);
      bolt.clear().lineStyle(3, 0xeef3ff, 1);
      let x = x0, y = 0;
      bolt.beginPath(); bolt.moveTo(x, y);
      while (y < 380) { x += Phaser.Math.Between(-40, 40); y += Phaser.Math.Between(25, 55); bolt.lineTo(x, y); }
      bolt.strokePath(); bolt.setAlpha(1);
      this.tweens.add({ targets: bolt, alpha: 0, duration: 260 });
      flash.setAlpha(0.55);
      this.tweens.add({ targets: flash, alpha: 0, duration: 420, ease: 'Quad.easeOut' });
      this.time.delayedCall(Phaser.Math.Between(250, 900), () => audio.sfx('thunder'));
      this.time.delayedCall(Phaser.Math.Between(4500, 9000), strike);
    };
    this.time.delayedCall(2500, strike);
  }

  private makeRockPlatform(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number) {
    if (this.stage.theme === 'storm') return this.makeCragPlatform(group, x, y, w);
    const g = this.add.graphics().setDepth(-4);
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, GROUND_Y + 4, w * 0.9, 14);
    // sandstone pillar + slab
    g.fillStyle(0x4a2420, 1);
    g.fillRect(x - w * 0.18, y + 10, w * 0.36, GROUND_Y - y - 10);
    g.fillStyle(0x5e2e26, 1);
    for (let yy = y + 30; yy < GROUND_Y; yy += 26) g.fillRect(x - w * 0.18, yy, w * 0.36, 3);
    g.fillStyle(COLORS.outline, 1); g.fillRoundedRect(x - w / 2 - 3, y - 3, w + 6, 30, 6);
    g.fillStyle(0xa85d3c, 1); g.fillRoundedRect(x - w / 2, y, w, 24, 5);
    g.fillStyle(0xc9784c, 1); g.fillRect(x - w / 2 + 4, y + 2, w - 8, 5);
    g.fillStyle(0x7d3f2b, 1); g.fillRect(x - w / 2 + 10, y + 14, w * 0.5, 3);
    const z = this.add.zone(x, y + 6, w, 12);
    group.add(z);
    const body = z.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false;
  }

  /** Half-buried dinosaur bones and dig-site stakes along the canyon floor. */
  private makeFossilDecor() {
    const g = this.add.graphics().setDepth(-6);
    const bone = 0xd9cba8, shade = 0xa8977a;
    for (let x = 700; x < this.stage.arenaStart - 200; x += Phaser.Math.Between(700, 1100)) {
      // ribcage arcs
      for (let i = 0; i < 6; i++) {
        const rx = x + i * 26, h = 60 + Math.sin(i / 5 * Math.PI) * 50;
        g.lineStyle(9, COLORS.outline, 1); g.beginPath(); g.arc(rx, GROUND_Y + 4, h * 0.5, Math.PI, Math.PI * 1.55); g.strokePath();
        g.lineStyle(6, i % 2 ? shade : bone, 1); g.beginPath(); g.arc(rx, GROUND_Y + 4, h * 0.5, Math.PI, Math.PI * 1.55); g.strokePath();
      }
      // spine
      g.lineStyle(10, COLORS.outline, 1); g.lineBetween(x - 40, GROUND_Y - 4, x + 190, GROUND_Y - 10);
      g.lineStyle(6, bone, 1); g.lineBetween(x - 40, GROUND_Y - 4, x + 190, GROUND_Y - 10);
      // dig-site stakes with rope
      const sx = x + 260;
      g.fillStyle(0x6b4425, 1); g.fillRect(sx, GROUND_Y - 40, 5, 40); g.fillRect(sx + 120, GROUND_Y - 40, 5, 40);
      g.lineStyle(2, 0xe8c070, 1); g.lineBetween(sx + 2, GROUND_Y - 34, sx + 122, GROUND_Y - 30);
      g.fillStyle(0xff8a3d, 1); g.fillTriangle(sx + 60, GROUND_Y - 32, sx + 70, GROUND_Y - 32, sx + 65, GROUND_Y - 22);
    }
  }

  private makeArenaDecor() {
    // stone totems marking the boss clearing
    const g = this.add.graphics().setDepth(-6);
    const x0 = this.stage.arenaStart;
    for (const x of [x0 + 40, x0 + GAME_W - 40]) {
      g.fillStyle(COLORS.outline, 1); g.fillRoundedRect(x - 26, GROUND_Y - 230, 52, 232, 10);
      g.fillStyle(0x50606a, 1); g.fillRoundedRect(x - 22, GROUND_Y - 226, 44, 226, 8);
      g.fillStyle(0x3a464e, 1); g.fillRect(x - 22, GROUND_Y - 160, 44, 6); g.fillRect(x - 22, GROUND_Y - 90, 44, 6);
      g.fillStyle(COLORS.spirit, 0.85); g.fillTriangle(x - 10, GROUND_Y - 200, x + 10, GROUND_Y - 200, x, GROUND_Y - 180);
      g.fillCircle(x, GROUND_Y - 125, 7);
    }
  }

  /** Each boss has its own voice. */
  bossVoice() {
    return this.stage.id === 3 ? 'wyrm' : this.stage.id === 2 ? 'golem' : 'moose';
  }

  // ------------------------------------------------------------------ API used by entities

  hitstop(ms: number) {
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms);
    this.physics.world.pause();
  }

  /** Snow-capped granite ledge on a thin rock spire (Storm Peak). */
  private makeCragPlatform(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number) {
    const g = this.add.graphics().setDepth(-4);
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, GROUND_Y + 4, w * 0.9, 14);
    g.fillStyle(0x232a38, 1);
    g.fillTriangle(x - w * 0.22, GROUND_Y, x + w * 0.22, GROUND_Y, x, y + 10);
    g.fillStyle(COLORS.outline, 1); g.fillRoundedRect(x - w / 2 - 3, y - 3, w + 6, 30, 8);
    g.fillStyle(0x4a5468, 1); g.fillRoundedRect(x - w / 2, y, w, 24, 7);
    g.fillStyle(0x2f3747, 1); g.fillRect(x - w / 2 + 12, y + 14, w * 0.45, 3);
    g.fillStyle(0xdfe7f4, 1); g.fillRoundedRect(x - w / 2 + 2, y - 2, w - 4, 7, 3);
    const z = this.add.zone(x, y + 6, w, 12);
    group.add(z);
    const body = z.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false;
  }

  /** Enemy projectile with an explicit velocity (aimed shots). */
  spawnEnemyShot(kind: ProjKind, x: number, y: number, vx: number, vy: number) {
    this.projectiles.push(new Projectile(this, kind, x, y, Math.sign(vx) || 1, this.diff.enemyDmg).aim(vx, vy));
  }

  spawnProjectile(kind: ProjKind, x: number, y: number, dir: number) {
    const enemyKind = kind === 'ewave' || kind === 'spike' || kind === 'shard' || kind === 'strike' || kind === 'orb';
    const mul = enemyKind ? this.diff.enemyDmg : this.player.hero.dmgMul;
    if (kind === 'spike') this.time.delayedCall(750, () => audio.sfx('crack'));
    this.projectiles.push(new Projectile(this, kind, x, y, dir, mul));
  }

  playerPound(x: number, y: number) {
    audio.sfx('slam');
    this.fx.shake(0.014, 220);
    this.fx.ring(x, y - 10, COLORS.beast, 150, 320);
    this.fx.burst(x, y - 10, 0x9a6a3a, 22);
    this.spawnProjectile('pwave', x + 30, y - 24, 1);
    this.spawnProjectile('pwave', x - 30, y - 24, -1);
  }

  bossSlam(x: number, enraged: boolean) {
    audio.sfx('boom');
    this.fx.shake(0.02, 350);
    this.fx.ring(x, GROUND_Y - 10, COLORS.hollow, 200, 400);
    this.fx.burst(x, GROUND_Y - 10, 0x9a6a3a, 26);
    this.spawnProjectile('ewave', x + 40, GROUND_Y - 23, 1);
    this.spawnProjectile('ewave', x - 40, GROUND_Y - 23, -1);
    if (enraged) {
      this.time.delayedCall(450, () => {
        if (this.ended) return;
        this.spawnProjectile('ewave', x + 40, GROUND_Y - 23, 1);
        this.spawnProjectile('ewave', x - 40, GROUND_Y - 23, -1);
      });
    }
  }

  bossWallImpact(x: number) {
    audio.sfx('boom');
    // pine cones / debris rain down near the wall the titan hit
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(150 + i * 120, () => this.fx.burst(x + Phaser.Math.Between(-60, 60), 80, 0x6b4425, 6));
    }
  }

  enemyStrike(rect: Phaser.Geom.Rectangle, dmg: number, fromX: number) {
    if (overlap(rect, this.player.hurtRect())) this.player.hurt(dmg * this.diff.enemyDmg, fromX);
  }

  spawnEnemy(kind: EnemyKind, side: 1 | -1) {
    const cam = this.cameras.main;
    let x = side > 0 ? cam.scrollX + GAME_W + 70 : cam.scrollX - 70;
    if (x < 40) x = cam.scrollX + GAME_W + 70;
    x = Math.min(x, this.stage.length + 60);
    let e: Enemy;
    if (kind === 'crow') e = new Crow(this, x, Phaser.Math.Between(380, 430));
    else if (kind === 'wolf') e = new SpiritWolf(this, x, x > this.player.x ? -1 : 1);
    else e = new Husk(this, x);
    this.enemies.push(e);
    if (!e.flying) this.enemyGroup.add(e);
    return e;
  }

  onEnemyKilled(e: Enemy) {
    this.stats.kills++;
    audio.sfx(e instanceof Husk ? 'huskdie' : 'poof');
    this.score += Math.round(e.score * (1 + this.combo * 0.1));
    this.fx.wisps(e.x, e.y - 50, e.carrier ? COLORS.spirit : COLORS.hollow, e.isBoss ? 40 : 10);
    if (e.carrier) this.orbs.push(new Orb(this, e.x, e.y - 60));
    if (e.isBoss) this.stageClear(e);
  }

  onPlayerDeath() {
    this.lives--;
    this.combo = 0;
    this.time.delayedCall(1500, () => {
      if (this.ended) return;
      if (this.lives > 0) {
        this.player.respawn();
        this.events.emit('banner', `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, '#ffffff', 44);
      } else {
        this.finish(false);
      }
    });
  }

  // ------------------------------------------------------------------ power-ups

  private collectOrb() {
    const p = this.player;
    this.score += 250;
    audio.sfx('orb');
    this.fx.burst(p.x, p.centerY(), COLORS.spirit, 24);
    if (p.form >= 3) return;
    const next = p.form + 1;
    this.cinematic = true;
    this.physics.world.pause();
    p.state = 'cinematic';
    p.cinematicPose = 'flex';
    const cam = this.cameras.main;

    if (next < 3) {
      audio.sfx('powerup');
      cam.flash(140, 127, 246, 255);
      this.events.emit('banner', next === 1 ? 'AWAKENED!' : 'PRIMAL!', '#7ff6ff', 56);
      this.time.delayedCall(650, () => {
        p.setForm(next);
        this.fx.ring(p.x, p.centerY(), COLORS.spirit, 150);
        this.fx.wisps(p.x, p.centerY(), COLORS.spirit, 14);
        this.fx.shake(0.008, 160);
        this.endCinematic();
      });
      return;
    }

    // Full beast transformation
    audio.sfx('powerup');
    this.time.delayedCall(1150, () => { audio.sfx('transform'); audio.sfx(this.stage.beast); });
    cam.zoomTo(1.3, 450, 'Sine.easeInOut');
    let n = 0;
    this.time.addEvent({
      delay: 260, repeat: 3, callback: () => {
        this.fx.ring(p.x, p.centerY(), COLORS.beast, 110 + n * 35);
        this.fx.burst(p.x, p.centerY(), COLORS.beast, 18);
        this.fx.shake(0.004 + n * 0.003, 200);
        n++;
      },
    });
    this.time.delayedCall(1250, () => {
      cam.flash(280, 255, 214, 140);
      p.setForm(3);
      this.fx.burst(p.x, p.y - 80, COLORS.beast, 50);
      this.fx.wisps(p.x, p.y - 80, COLORS.beast, 24);
      this.fx.shake(0.022, 420);
      this.events.emit('banner', this.stage.beastName + '!', '#ffb43a', 96);
    });
    this.time.delayedCall(2100, () => {
      cam.zoomTo(1, 400, 'Sine.easeInOut');
      this.endCinematic();
    });
  }

  private endCinematic() {
    const p = this.player;
    this.cinematic = false;
    p.state = 'normal';
    p.cinematicPose = null;
    p.invulnUntil = this.time.now + 700;
    this.physics.world.resume();
  }

  // ------------------------------------------------------------------ flow

  private lockArena() {
    this.arenaLocked = true;
    const cam = this.cameras.main;
    const x0 = this.stage.arenaStart;
    cam.stopFollow();
    this.tweens.add({
      targets: cam, scrollX: x0, duration: 900, ease: 'Sine.easeInOut',
      onComplete: () => cam.setBounds(x0, 0, GAME_W, GAME_H),
    });
    this.physics.world.setBounds(x0, 0, GAME_W, GAME_H);
    // clear stragglers left behind
    for (const e of this.enemies) if (!e.dead && e.x < x0 - 100) { e.dead = true; e.destroy(); }
    this.events.emit('banner', 'WARNING', '#ff4d5e', 80);
    this.time.delayedCall(1800, () => {
      if (this.ended) return;
      this.boss = this.stage.id === 3
        ? new ThunderWyrm(this, x0 + GAME_W + 260, x0, x0 + GAME_W)
        : this.stage.id === 2
          ? new FossilGolem(this, x0 + GAME_W + 260, x0, x0 + GAME_W)
          : new MooseTitan(this, x0 + GAME_W + 220, x0, x0 + GAME_W);
      this.enemies.push(this.boss);
      this.enemyGroup.add(this.boss);
      this.fx.shake(0.01, 600);
      audio.play('boss');
      audio.sfx(this.bossVoice());
      this.events.emit('boss', this.stage.boss, this.stage.bossTitle);
    });
  }

  private stageClear(boss: Enemy) {
    this.ended = true;
    audio.stopMusic();
    audio.sfx(this.bossVoice());
    this.time.delayedCall(1000, () => audio.play('clear'));
    this.hitstop(450);
    const cam = this.cameras.main;
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 160, () => {
        this.fx.burst(boss.x + Phaser.Math.Between(-90, 90), boss.y - Phaser.Math.Between(60, 200), i % 2 ? COLORS.hollow : COLORS.spirit, 30);
        this.fx.shake(0.01, 150);
      });
    }
    this.time.delayedCall(1000, () => {
      cam.flash(400, 255, 255, 255);
      this.events.emit('banner', 'STAGE CLEAR!', '#ffe066', 100);
      for (const e of this.enemies) if (!e.dead) e.die(1);
    });
    this.time.delayedCall(4200, () => this.finish(true));
  }

  private finish(win: boolean) {
    if (!win) audio.play('gameover');
    this.ended = true;
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(650, () => {
      this.scene.start('Result', {
        win, hero: this.heroId, difficulty: this.difficulty, stage: this.stage.id, lives: this.lives,
        score: this.score + (win ? this.lives * 1000 : 0), ...this.stats,
      });
    });
  }

  // ------------------------------------------------------------------ main loop

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);
    this.controls.update();
    const cam = this.cameras.main;
    this.parallax.update(cam.scrollX);
    this.ferns.tilePositionX = cam.scrollX * 1.3;

    if (this.controls.pressed('pause') && !this.ended && !this.cinematic) {
      this.scene.launch('Pause');
      this.scene.pause();
      return;
    }

    if (this.time.now < this.frozenUntil) return;
    if (this.physics.world.isPaused && !this.cinematic) this.physics.world.resume();

    if (this.cinematic) { this.player.update(dt); return; }

    if (!this.ended) this.stats.time += dt;
    this.player.update(dt);
    for (const e of this.enemies) e.update(dt);
    const py = this.player.centerY();
    for (const o of this.orbs) {
      if (o.update(dt, this.player.x, py) && this.player.alive) { o.destroy(); this.collectOrb(); }
    }
    for (const pr of this.projectiles) pr.update(dt, this.fx);

    this.resolveCombat();

    if (!this.ended) {
      this.spawner(dt);
      if (!this.arenaLocked && this.player.x > this.stage.arenaStart + 220) this.lockArena();
    }

    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;

    // cleanup
    this.enemies = this.enemies.filter((e) => {
      if (e.dead) return false;
      if (!e.isBoss && Math.abs(e.x - this.player.x) > 1900) { e.destroy(); return false; }
      return true;
    });
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.orbs = this.orbs.filter((o) => !o.dead);
  }

  private hitEnemy(e: Enemy, dmg: number, dir: number, knock: number, heavy: boolean, rect: Phaser.Geom.Rectangle) {
    const d = Math.round(dmg);
    e.takeHit(d, dir, knock, heavy);
    audio.sfx(heavy ? 'heavy' : 'hit');
    const hr = e.hurtRect();
    const cx = Phaser.Math.Clamp(rect.centerX, hr.left, hr.right);
    const cy = Phaser.Math.Clamp(rect.centerY, hr.top, hr.bottom);
    this.fx.burst(cx, cy, heavy ? 0xffd34d : 0xffffff, heavy ? 16 : 10);
    this.fx.number(cx, cy - 24, d, heavy ? '#ffd34d' : '#ffffff', heavy ? 34 : 28);
    this.combo++;
    this.comboT = 1.3;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    if (heavy) this.fx.shake(this.player.isBeast ? 0.008 : 0.004, 110);
    this.hitstop(heavy ? (this.player.isBeast ? 110 : 80) : 50);
  }

  private resolveCombat() {
    const p = this.player;
    const hb = p.activeHitbox();
    if (hb) {
      for (const e of this.enemies) {
        if (e.dead || hb.hit.has(e)) continue;
        if (overlap(hb.rect, e.hurtRect())) {
          hb.hit.add(e);
          this.hitEnemy(e, hb.def.dmg, p.facing, hb.def.knock, hb.def.heavy, hb.rect);
        }
      }
    }

    if (p.alive) {
      const pr = p.hurtRect();
      for (const e of this.enemies) {
        if (!e.dead && e.contactDmg > 0 && overlap(e.hurtRect(), pr)) p.hurt(e.contactDmg * this.diff.enemyDmg, e.x);
      }
    }

    for (const proj of this.projectiles) {
      if (proj.dead) continue;
      const r = proj.rect();
      if (proj.owner === 'player') {
        for (const e of this.enemies) {
          if (e.dead || proj.hit.has(e)) continue;
          if (overlap(r, e.hurtRect())) {
            proj.hit.add(e);
            this.hitEnemy(e, proj.dmg, proj.dir, proj.knock, true, r);
            if (!proj.pierce) { this.fx.burst(proj.x, proj.y, 0x9a6a3a, 14); proj.kill(); break; }
          }
        }
      } else if (!proj.harmless && p.alive && overlap(r, p.hurtRect())) {
        if (p.hurt(proj.dmg, proj.x - proj.dir * 50)) { /* waves keep travelling */ }
      }
    }
  }

  private spawner(dt: number) {
    const p = this.player;
    if (!this.arenaLocked) {
      this.spawnT -= dt;
      const progress = Phaser.Math.Clamp(p.x / this.stage.arenaStart, 0, 1);
      const alive = this.enemies.filter((e) => !e.dead && !e.carrier).length;
      const cap = 2 + Math.floor(progress * 4);
      if (this.spawnT <= 0 && alive < cap) {
        this.spawnT = (2.7 - progress * 1.1) * this.diff.spawnMul;
        const side: 1 | -1 = Math.random() < 0.75 ? 1 : -1;
        const crowChance = this.stage.theme === 'storm' ? 0.55 : 0.35;
        const kind: EnemyKind = progress > 0.12 && Math.random() < crowChance ? 'crow' : 'husk';
        this.spawnEnemy(kind, side);
      }
    }
    if (p.form < 3 && !this.enemies.some((e) => e.carrier && !e.dead) && this.orbs.length === 0) {
      this.carrierT -= dt;
      if (this.carrierT <= 0) {
        this.spawnEnemy('wolf', Math.random() < 0.7 ? 1 : -1);
        this.carrierT = (this.arenaLocked ? 6 : 9) * this.diff.spawnMul;
      }
    }
  }
}

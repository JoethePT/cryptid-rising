import Phaser from 'phaser';
import { COLORS, STAGES, DIFFICULTY, Difficulty, FONT_TITLE, FONT_UI, GAME_W, HEROES, HeroId } from '../config';
import { Controls, isTouchDevice } from '../systems/Controls';
import { audio } from '../systems/Audio';
import { Parallax } from '../gfx/Parallax';
import { bigfootLook, drawHumanoid, heroLook } from '../gfx/Puppet';
import { applySprite, hasSprite, shaderFxOk } from '../gfx/Sprites';

const HERO_IDS: HeroId[] = ['mara', 'dez'];
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

export class MenuScene extends Phaser.Scene {
  private controls!: Controls;
  private parallax!: Parallax;
  private heroIdx = 0;
  private diffIdx = 1;
  private row: 0 | 1 | 2 = 0;
  private stageIdx = 0;
  private stageText!: Phaser.GameObjects.Text;
  private cards: { bg: Phaser.GameObjects.Graphics; puppet: Phaser.GameObjects.Graphics; art?: Phaser.GameObjects.Image; glow?: Phaser.FX.Glow; x: number }[] = [];
  private beastArt?: Phaser.GameObjects.Image;
  private diffText!: Phaser.GameObjects.Text;
  private padText!: Phaser.GameObjects.Text;
  private beast!: Phaser.GameObjects.Graphics;
  private scroll = 0;
  private t = 0;
  private starting = false;

  private playable = STAGES.filter((s) => s.implemented);

  constructor() { super('Menu'); }

  create() {
    this.starting = false;
    audio.play('title');
    this.cards = [];
    this.controls = new Controls(this);
    this.parallax = new Parallax(this);
    this.add.rectangle(0, 0, GAME_W, 720, 0x05080c, 0.45).setOrigin(0);

    // Stage-1 beast lurking at the edge of the clearing
    this.beast = this.add.graphics().setPosition(GAME_W - 70, 720).setScale(-1.5, 1.5);
    if (hasSprite(this, 'bigfoot-idle')) {
      this.beast.setVisible(false);
      this.beastArt = this.add.image(GAME_W - 40, 760, 'bigfoot-idle').setAlpha(0.55).setTint(0x8aa0a8);
      applySprite(this.beastArt, 'bigfoot-idle', -1, 2.1);
    }

    const title = this.add.text(GAME_W / 2, 92, 'CRYPTID RISING', {
      fontFamily: FONT_TITLE, fontSize: '112px', color: '#ffcf5a', stroke: '#1a1420', strokeThickness: 14,
    }).setOrigin(0.5);
    title.setShadow(0, 8, '#000000', 0, true, true);
    this.add.text(GAME_W / 2, 168, 'The Hollow has awakened. So have you.', {
      fontFamily: FONT_UI, fontSize: '22px', color: '#bfe9ef', fontStyle: '800',
    }).setOrigin(0.5);

    HERO_IDS.forEach((id, i) => {
      const x = GAME_W / 2 + (i === 0 ? -250 : 250);
      const bg = this.add.graphics();
      const puppet = this.add.graphics().setPosition(x - 110, 520).setScale(1.7);
      let art: Phaser.GameObjects.Image | undefined, glow: Phaser.FX.Glow | undefined;
      if (hasSprite(this, `${id}-idle`)) {
        puppet.setVisible(false);
        art = this.add.image(x - 110, 520, `${id}-idle`);
        applySprite(art, `${id}-idle`, 1, 1.75);
        if (art.preFX && shaderFxOk()) { art.preFX.setPadding(16); glow = art.preFX.addGlow(COLORS.spirit, 0, 0, false, 0.1, 12); }
      }
      const h = HEROES[id];
      this.add.text(x - 20, 250, h.name.toUpperCase(), { fontFamily: FONT_TITLE, fontSize: '40px', color: '#ffe6a8', stroke: '#1a1420', strokeThickness: 6 });
      this.add.text(x - 20, 296, h.title, { fontFamily: FONT_UI, fontSize: '18px', color: '#7ff6ff', fontStyle: '800' });
      this.add.text(x - 20, 326, h.blurb, { fontFamily: FONT_UI, fontSize: '15px', color: '#d8e6e8', wordWrap: { width: 190 } });
      const stat = (label: string, v: number, y: number) => {
        this.add.text(x - 20, y, label, { fontFamily: FONT_UI, fontSize: '13px', color: '#9fc6c9', fontStyle: '800' });
        const g = this.add.graphics();
        for (let k = 0; k < 5; k++) {
          g.fillStyle(k < v ? 0xffb43a : 0x2a3a42, 1);
          g.fillRoundedRect(x + 72 + k * 22, y + 2, 18, 12, 3);
        }
      };
      stat('POWER', h.stats.power, 400);
      stat('SPEED', h.stats.speed, 422);
      stat('TOUGH', h.stats.toughness, 444);
      const zone = this.add.zone(x, 380, 420, 290).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.heroIdx === i) this.start(); else { this.heroIdx = i; this.row = 0; }
      });
      this.cards.push({ bg, puppet, art, glow, x });
    });

    this.diffText = this.add.text(GAME_W / 2, 562, '', {
      fontFamily: FONT_TITLE, fontSize: '34px', color: '#ffffff', stroke: '#1a1420', strokeThickness: 6,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.diffText.on('pointerdown', () => { this.diffIdx = (this.diffIdx + 1) % 3; this.row = 1; });
    this.stageText = this.add.text(GAME_W / 2, 602, '', {
      fontFamily: FONT_TITLE, fontSize: '30px', color: '#ffffff', stroke: '#1a1420', strokeThickness: 6,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.stageText.on('pointerdown', () => { this.stageIdx = (this.stageIdx + 1) % this.playable.length; this.row = 2; });

    const startBtn = this.add.text(GAME_W / 2, 648, 'PRESS ENTER / Ⓐ TO START', {
      fontFamily: FONT_TITLE, fontSize: '26px', color: '#ffcf5a', stroke: '#1a1420', strokeThickness: 6,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    startBtn.on('pointerdown', () => this.start());
    this.tweens.add({ targets: startBtn, alpha: 0.45, yoyo: true, repeat: -1, duration: 700 });

    this.add.text(GAME_W / 2, 690, isTouchDevice() ? 'Tap a hero to pick, tap again to start   ·   tap difficulty / stage to change them' : '←/→ choose   ↑/↓ select row   Enter start   ·   M mute   ·   Gamepad supported', {
      fontFamily: FONT_UI, fontSize: '15px', color: '#8fb0b5', fontStyle: '800',
    }).setOrigin(0.5);
    this.padText = this.add.text(GAME_W - 16, 16, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#7ff6ff', fontStyle: '800' }).setOrigin(1, 0);

    this.cameras.main.fadeIn(400);
  }

  private start() {
    if (this.starting) return;
    this.starting = true;
    audio.sfx('select');
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => this.scene.start('Game', { hero: HERO_IDS[this.heroIdx], difficulty: DIFFS[this.diffIdx], stage: this.playable[this.stageIdx].id }));
  }

  update(_t: number, delta: number) {
    const dt = delta / 1000;
    this.t += dt;
    this.scroll += dt * 30;
    this.parallax.update(this.scroll);
    const c = this.controls;
    c.update();

    if (c.pressed('down') || c.pressed('up') || c.pressed('left') || c.pressed('right')) audio.sfx('move');
    if (c.pressed('down')) this.row = ((this.row + 1) % 3) as 0 | 1 | 2;
    if (c.pressed('up')) this.row = ((this.row + 2) % 3) as 0 | 1 | 2;
    if (c.pressed('left') || c.pressed('right')) {
      const d = c.pressed('left') ? -1 : 1;
      if (this.row === 0) this.heroIdx = (this.heroIdx + d + 2) % 2;
      else if (this.row === 1) this.diffIdx = Phaser.Math.Clamp(this.diffIdx + d, 0, 2);
      else this.stageIdx = (this.stageIdx + d + this.playable.length) % this.playable.length;
    }
    if (c.pressed('confirm')) this.start();

    drawHumanoid(this.beast, bigfootLook(), { state: 'idle', t: this.t, p: 0 });

    // cycle the selected hero through their power forms as a preview
    const previewForm = Math.floor(this.t / 1.4) % 3;
    this.cards.forEach((card, i) => {
      const sel = i === this.heroIdx;
      const g = card.bg;
      g.clear();
      g.fillStyle(0x0b141b, sel ? 0.9 : 0.7);
      g.fillRoundedRect(card.x - 210, 236, 420, 290, 18);
      g.lineStyle(sel ? 5 : 2, sel ? (this.row === 0 ? COLORS.beast : 0xffe6a8) : 0x2f4650, 1);
      g.strokeRoundedRect(card.x - 210, 236, 420, 290, 18);
      if (sel) {
        g.fillStyle(previewForm > 0 ? COLORS.spirit : 0xffe6a8, 0.08 + 0.04 * Math.sin(this.t * 4));
        g.fillEllipse(card.x - 110, 440, 170, 230);
      }
      const form = sel ? previewForm : 0;
      if (card.art) {
        const flex = sel && form > 0 && this.t % 1.4 < 0.5;
        applySprite(card.art, `${HERO_IDS[i]}-${flex ? 'punch' : 'idle'}`, 1, 1.75 * [1, 1.06, 1.12][form]);
        card.art.scaleY *= 1 + Math.sin(this.t * 3) * 0.01;
        card.art.setAlpha(sel ? 1 : 0.5);
        if (card.glow) card.glow.outerStrength = form * 1.8;
        return;
      }
      drawHumanoid(card.puppet, heroLook(HERO_IDS[i], form), { state: sel && form > 0 && this.t % 1.4 < 0.5 ? 'flex' : 'idle', t: this.t, p: 0 });
      card.puppet.setAlpha(sel ? 1 : 0.55);
    });

    const d = DIFFICULTY[DIFFS[this.diffIdx]];
    this.diffText.setText(`◀  DIFFICULTY: ${d.label.toUpperCase()}  ▶`);
    this.diffText.setColor(this.row === 1 ? '#ffb43a' : '#ffffff');
    const st = this.playable[this.stageIdx];
    this.stageText.setText(`◀  STAGE ${st.id}: ${st.name.toUpperCase()}  ▶`);
    this.stageText.setColor(this.row === 2 ? '#ffb43a' : '#c8d6d8');
    this.padText.setText(c.usingPad ? '🎮 Gamepad connected' : '');
  }
}

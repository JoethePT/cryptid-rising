import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI, GAME_W } from '../config';
import type { GameScene } from './GameScene';
import { drawHumanoid, heroLook } from '../gfx/Puppet';
import { hasSprite } from '../gfx/Sprites';

/** Screen-space UI, kept in its own scene so camera shake/zoom never touch it. */
export class HudScene extends Phaser.Scene {
  private gs!: GameScene;
  private g!: Phaser.GameObjects.Graphics;
  private portrait!: Phaser.GameObjects.Graphics;
  private formText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private shownHp = 1;
  private bossHp = 1;
  private bossActive = false;
  private t = 0;

  constructor() { super('Hud'); }

  create() {
    this.gs = this.scene.get('Game') as GameScene;
    this.bossActive = false;
    this.shownHp = 1;
    this.g = this.add.graphics();
    this.portrait = this.add.graphics();
    const p = this.gs.player;
    drawHumanoid(this.portrait, heroLook(p.hero.id, 0), { state: 'idle', t: 0, p: 0 });
    this.portrait.setPosition(50, 182).setScale(1.25);
    // mask the portrait to a circle
    const maskG = this.make.graphics({}).fillCircle(58, 58, 36);
    this.portrait.setMask(maskG.createGeometryMask());
    if (hasSprite(this, `${p.hero.id}-idle`)) {
      // painted portrait: the idle sprite, zoomed on the head
      this.portrait.setVisible(false);
      const img = this.add.image(58, 22, `${p.hero.id}-idle`).setOrigin(0.5, 0);
      img.setScale(260 / img.height);
      img.setMask(maskG.createGeometryMask());
    }

    const txt = (x: number, y: number, s: string, size: number, color = '#ffffff', font = FONT_UI) =>
      this.add.text(x, y, s, { fontFamily: font, fontSize: `${size}px`, color, stroke: '#0b0f14', strokeThickness: 5, fontStyle: '800' });

    txt(108, 16, p.hero.name.toUpperCase(), 22, '#ffe6a8', FONT_TITLE);
    this.formText = txt(108, 74, '', 16, '#7ff6ff');
    this.scoreText = txt(GAME_W - 24, 16, '', 30, '#ffffff', FONT_TITLE).setOrigin(1, 0);
    txt(GAME_W - 24, 52, `STAGE ${this.gs.stage.id} · ${this.gs.stage.name.toUpperCase()}`, 14, '#9fc6c9').setOrigin(1, 0);
    this.comboText = txt(GAME_W - 30, 120, '', 44, '#ffd34d', FONT_TITLE).setOrigin(1, 0.5).setAlpha(0);
    this.bossName = txt(GAME_W / 2, 632, '', 26, '#e8b8ff', FONT_TITLE).setOrigin(0.5, 1).setAlpha(0);

    const pad = this.gs.controls.usingPad;
    this.hint = txt(GAME_W / 2, 690, pad
      ? 'Stick/D-pad move · A jump · X punch · Y kick · B dash · Start pause'
      : 'A/D move · W/Space jump · S crouch · J punch · K kick · L/Shift dash · Esc pause', 16, '#d8e6e8').setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 9000, duration: 1200 });

    const onBanner = (text: string, color: string, size: number) => this.banner(text, color, size);
    const onBoss = (name: string, title: string) => {
      this.bossActive = true;
      this.bossName.setText(`${name}  —  ${title}`);
      this.tweens.add({ targets: this.bossName, alpha: 1, duration: 600 });
      this.banner(name, '#e8b8ff', 84);
    };
    this.gs.events.on('banner', onBanner);
    this.gs.events.on('boss', onBoss);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gs.events.off('banner', onBanner);
      this.gs.events.off('boss', onBoss);
    });
  }

  banner(text: string, color: string, size: number) {
    const t = this.add.text(GAME_W / 2, 270, text, {
      fontFamily: FONT_TITLE, fontSize: `${size}px`, color, stroke: '#0b0f14', strokeThickness: 10,
    }).setOrigin(0.5).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: 240, delay: 1400, duration: 450, onComplete: () => t.destroy() });
  }

  update(_t: number, delta: number) {
    const gs = this.gs;
    if (!gs.player) return;
    this.t += delta / 1000;
    const p = gs.player;
    const g = this.g;
    g.clear();

    // portrait ring
    const ringCol = p.isBeast ? COLORS.beast : p.form > 0 ? COLORS.spirit : 0xffe6a8;
    g.fillStyle(0x0b0f14, 0.8); g.fillCircle(58, 58, 40);
    g.lineStyle(5, ringCol, 1); g.strokeCircle(58, 58, 40);

    // health bar (with trailing damage)
    const hpFrac = Phaser.Math.Clamp(p.hp / p.hero.maxHp, 0, 1);
    this.shownHp += (hpFrac - this.shownHp) * Math.min(1, (delta / 1000) * 4);
    const bx = 108, by = 44, bw = 300, bh = 22;
    g.fillStyle(0x0b0f14, 0.85); g.fillRoundedRect(bx - 4, by - 4, bw + 8, bh + 8, 8);
    g.fillStyle(0x5a1a22, 1); g.fillRoundedRect(bx, by, bw, bh, 6);
    g.fillStyle(0xffffff, 0.6); g.fillRoundedRect(bx, by, Math.max(0, bw * this.shownHp), bh, 6);
    const hpCol = hpFrac > 0.5 ? 0x5fe07a : hpFrac > 0.25 ? 0xffc23a : 0xff4d5e;
    if (hpFrac > 0) { g.fillStyle(hpCol, 1); g.fillRoundedRect(bx, by, Math.max(12, bw * hpFrac), bh, 6); }
    g.fillStyle(0xffffff, 0.25); g.fillRoundedRect(bx + 4, by + 3, Math.max(0, bw * hpFrac - 8), 6, 3);

    // lives
    for (let i = 0; i < gs.lives; i++) {
      const lx = bx + bw + 24 + i * 22, ly = by + 11;
      g.fillStyle(0xff4d5e, 1);
      g.fillCircle(lx - 4, ly - 3, 6); g.fillCircle(lx + 4, ly - 3, 6);
      g.fillTriangle(lx - 10, ly - 1, lx + 10, ly - 1, lx, ly + 10);
    }

    // power pips (3 orbs -> beast)
    const names = ['HUMAN', 'AWAKENED', 'PRIMAL', `${gs.stage.beastName} FORM`];
    this.formText.setText(names[p.form]).setColor(p.isBeast ? '#ffb43a' : p.form > 0 ? '#7ff6ff' : '#c8d6d8');
    const pipX = 108 + this.formText.width + 18;
    for (let i = 0; i < 3; i++) {
      const x = pipX + i * 26, y = 84;
      const filled = i < p.form;
      const col = p.isBeast ? COLORS.beast : COLORS.spirit;
      g.fillStyle(0x0b0f14, 0.9); g.fillCircle(x, y, 10);
      if (filled) {
        const pulse = p.isBeast ? 0.5 + 0.5 * Math.sin(this.t * 6 + i) : 1;
        g.fillStyle(col, 0.35 * pulse); g.fillCircle(x, y, 14);
        g.fillStyle(col, 1); g.fillCircle(x, y, 7);
      } else {
        g.lineStyle(2, 0x4a6670, 1); g.strokeCircle(x, y, 7);
      }
    }

    this.scoreText.setText(String(gs.score).padStart(7, '0'));

    if (gs.combo >= 2) {
      this.comboText.setText(`${gs.combo} HITS`).setAlpha(1).setScale(1 + Math.min(0.4, gs.combo * 0.02));
    } else {
      this.comboText.setAlpha(Math.max(0, this.comboText.alpha - delta / 300));
    }

    // boss bar
    const boss = gs.boss;
    if (this.bossActive && boss) {
      const frac = Math.max(0, boss.hp / boss.maxHp);
      this.bossHp += (frac - this.bossHp) * Math.min(1, (delta / 1000) * 3);
      const w = 640, x = GAME_W / 2 - w / 2, y = 642;
      g.fillStyle(0x0b0f14, 0.85); g.fillRoundedRect(x - 5, y - 5, w + 10, 28, 8);
      g.fillStyle(0x2a1830, 1); g.fillRoundedRect(x, y, w, 18, 5);
      g.fillStyle(0xffffff, 0.5); g.fillRoundedRect(x, y, w * this.bossHp, 18, 5);
      if (frac > 0) { g.fillStyle(boss.hp < boss.maxHp * 0.5 ? 0xff5ad0 : COLORS.hollow, 1); g.fillRoundedRect(x, y, Math.max(10, w * frac), 18, 5); }
      if (frac <= 0) this.bossName.setAlpha(Math.max(0, this.bossName.alpha - delta / 600));
    }
  }
}

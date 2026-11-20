import Phaser from 'phaser';
import { DIFFICULTY, Difficulty, FONT_TITLE, FONT_UI, GAME_H, GAME_W, HEROES, HeroId, STAGES } from '../config';
import { Controls } from '../systems/Controls';
import { audio } from '../systems/Audio';
import { makeBayouTextures, makeCanyonTextures, makeForestTextures, makeMillTextures, makeRiftTextures, makeStormTextures } from '../gfx/Textures';
import { preloadSprites } from '../gfx/Sprites';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const w = 420, x = (GAME_W - w) / 2, y = GAME_H / 2;
    this.add.text(GAME_W / 2, y - 40, 'Summoning the forest spirits…', {
      fontFamily: FONT_UI, fontSize: '18px', color: '#9fc6c9', fontStyle: '800',
    }).setOrigin(0.5);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x16303a, 1).fillRoundedRect(x, y, w, 12, 6);
      bar.fillStyle(0x7ff6ff, 1).fillRoundedRect(x, y, Math.max(12, w * v), 12, 6);
    });
    preloadSprites(this);
  }
  create() {
    makeForestTextures(this);
    makeCanyonTextures(this);
    makeStormTextures(this);
    makeMillTextures(this);
    makeBayouTextures(this);
    makeRiftTextures(this);
    this.scene.start('Menu');
  }
}

function menuList(scene: Phaser.Scene, items: string[], y0: number, onPick: (i: number) => void) {
  const texts = items.map((s, i) =>
    scene.add.text(GAME_W / 2, y0 + i * 56, s, {
      fontFamily: FONT_TITLE, fontSize: '40px', color: '#ffffff', stroke: '#1a1420', strokeThickness: 6,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }),
  );
  let idx = 0;
  texts.forEach((t, i) => {
    t.on('pointerover', () => { idx = i; });
    t.on('pointerdown', () => { audio.sfx('select'); onPick(i); });
  });
  return {
    update(c: Controls) {
      if (c.pressed('up')) { idx = (idx + items.length - 1) % items.length; audio.sfx('move'); }
      if (c.pressed('down')) { idx = (idx + 1) % items.length; audio.sfx('move'); }
      if (c.pressed('confirm')) { audio.sfx('select'); onPick(idx); }
      texts.forEach((t, i) => t.setColor(i === idx ? '#ffb43a' : '#ffffff').setScale(i === idx ? 1.1 : 1));
    },
  };
}

export class PauseScene extends Phaser.Scene {
  private controls!: Controls;
  private list!: ReturnType<typeof menuList>;
  constructor() { super('Pause'); }

  create() {
    this.controls = new Controls(this);
    audio.duck(true);
    audio.sfx('pause');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.duck(false));
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0);
    this.add.text(GAME_W / 2, 200, 'PAUSED', { fontFamily: FONT_TITLE, fontSize: '96px', color: '#ffcf5a', stroke: '#1a1420', strokeThickness: 10 }).setOrigin(0.5);
    const game = this.scene.get('Game');
    this.list = menuList(this, ['RESUME', 'RESTART STAGE', 'QUIT TO TITLE'], 340, (i) => {
      if (i === 0) this.resume();
      else if (i === 1) { this.scene.stop(); game.scene.restart(); }
      else { this.scene.stop(); this.scene.stop('Hud'); this.scene.stop('Touch'); this.scene.stop('Game'); this.scene.start('Menu'); }
    });
    this.add.text(GAME_W / 2, 600, 'Esc / Start to resume   ·   M to mute sound', { fontFamily: FONT_UI, fontSize: '16px', color: '#9fc6c9', fontStyle: '800' }).setOrigin(0.5);
  }

  private resume() {
    this.scene.stop();
    this.scene.resume('Game');
  }

  update() {
    this.controls.update();
    if (this.controls.pressed('pause') || this.controls.pressed('back')) { this.resume(); return; }
    this.list.update(this.controls);
  }
}

export interface ResultData {
  win: boolean; hero: HeroId; difficulty: Difficulty; score: number; stage: number; lives: number;
  kills: number; damageTaken: number; maxCombo: number; time: number;
}

export class ResultScene extends Phaser.Scene {
  private controls!: Controls;
  private list!: ReturnType<typeof menuList>;
  constructor() { super('Result'); }

  create(d: ResultData) {
    this.controls = new Controls(this);
    this.add.image(0, 0, 'bg-sky').setOrigin(0);
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'bg-pines-far').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05080c, 0.55).setOrigin(0);

    const finale = d.win && d.stage === STAGES[STAGES.length - 1].id;
    this.add.text(GAME_W / 2, 110, finale ? 'THE HOLLOW IS CLEANSED!' : d.win ? `STAGE ${d.stage} CLEAR!` : 'GAME OVER', {
      fontFamily: FONT_TITLE, fontSize: '110px', color: d.win ? '#ffcf5a' : '#ff4d5e', stroke: '#1a1420', strokeThickness: 12,
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 182, `${HEROES[d.hero].name} · ${DIFFICULTY[d.difficulty].label}`, {
      fontFamily: FONT_UI, fontSize: '20px', color: '#bfe9ef', fontStyle: '800',
    }).setOrigin(0.5);

    const mins = Math.floor(d.time / 60), secs = Math.floor(d.time % 60);
    const rows: [string, string][] = [
      ['SCORE', String(d.score)],
      ['HOLLOW CLEANSED', String(d.kills)],
      ['BEST COMBO', `${d.maxCombo} hits`],
      ['DAMAGE TAKEN', String(d.damageTaken)],
      ['TIME', `${mins}:${String(secs).padStart(2, '0')}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 240 + i * 40;
      this.add.text(GAME_W / 2 - 20, y, k, { fontFamily: FONT_UI, fontSize: '22px', color: '#9fc6c9', fontStyle: '800' }).setOrigin(1, 0);
      const t = this.add.text(GAME_W / 2 + 20, y, v, { fontFamily: FONT_TITLE, fontSize: '28px', color: '#ffffff' }).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, delay: 200 + i * 150, duration: 300 });
    });

    const next = STAGES.find((s) => s.id === d.stage + 1);
    const canContinue = d.win && !!next?.implemented;
    if (d.win && next) {
      const msg = next.implemented
        ? `NEXT: STAGE ${next.id} · ${next.name.toUpperCase()} — become the ${next.beastName}`
        : `NEXT: STAGE ${next.id} · ${next.name.toUpperCase()} — the ${next.beastName} awaits (coming soon)`;
      this.add.text(GAME_W / 2, 455, msg, { fontFamily: FONT_UI, fontSize: '17px', color: '#ffb43a', fontStyle: '800' }).setOrigin(0.5);
    }

    const items = finale ? ['EPILOGUE', 'REPLAY STAGE', 'TITLE SCREEN']
      : canContinue ? ['NEXT STAGE', 'REPLAY STAGE', 'TITLE SCREEN'] : [d.win ? 'REPLAY STAGE' : 'TRY AGAIN', 'TITLE SCREEN'];
    this.list = menuList(this, items, canContinue ? 510 : 530, (i) => {
      const pick = items[i];
      if (pick === 'EPILOGUE') this.scene.start('Ending', { hero: d.hero, score: d.score });
      else if (pick === 'NEXT STAGE') {
        // score and remaining lives carry over; your form resets for the new beast
        this.scene.start('Game', { hero: d.hero, difficulty: d.difficulty, stage: next!.id, lives: d.lives, score: d.score });
      } else if (pick === 'TITLE SCREEN') this.scene.start('Menu');
      else this.scene.start('Game', { hero: d.hero, difficulty: d.difficulty, stage: d.stage });
    });
    this.cameras.main.fadeIn(500);
  }

  update() {
    this.controls.update();
    this.list.update(this.controls);
  }
}

/** The ending: a short epilogue over a dawn sky, then scrolling credits, then back to the title. */
export class EndingScene extends Phaser.Scene {
  private controls!: Controls;
  private canLeave = false;
  constructor() { super('Ending'); }

  create(d: { hero: HeroId; score: number }) {
    this.controls = new Controls(this);
    this.canLeave = false;
    audio.play('ending');
    audio.ambience('forest');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.ambience(null));
    // dawn breaking over the forest: the forest textures, warmed
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x1a2a4a, 0x1a2a4a, 0xffb07a, 0xffb07a, 1);
    sky.fillRect(0, 0, GAME_W, GAME_H);
    const glow = this.add.circle(GAME_W / 2, GAME_H + 60, 260, 0xffb07a, 0.25);
    const sun = this.add.circle(GAME_W / 2, GAME_H + 60, 110, 0xffd27a, 1);
    this.tweens.add({ targets: [sun, glow], y: 250, duration: 12000, ease: 'Sine.easeOut' });
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'bg-mountains').setOrigin(0).setTint(0x9a7a9a);
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'bg-pines-far').setOrigin(0).setTint(0x5a4050);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.25).setOrigin(0);
    const hero = HEROES[d.hero];
    const story = [
      'The Hollow Heart shattered, and the rift in the sky sealed with a sound like a held breath let go.',
      'One by one the husks fell still, and the forest took them back.',
      `As the sun rose over the pines, ${hero.name} felt the spirits' power settle into quiet.`,
      'The beasts sleep again, deep in the old places.',
      'But the totem remembers. And if the Hollow ever wakes…',
      'so will its champion.',
    ];
    const lines: Phaser.GameObjects.Text[] = [];
    story.forEach((txt, i) => {
      const t = this.add.text(GAME_W / 2, 150 + i * 62, txt, {
        fontFamily: FONT_UI, fontSize: '24px', color: '#fff4e0', fontStyle: '800', stroke: '#1a1420', strokeThickness: 5,
        align: 'center', wordWrap: { width: 1000 },
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, delay: 600 + i * 2200, duration: 900 });
      lines.push(t);
    });
    const after = 600 + story.length * 2200 + 2000;
    this.time.delayedCall(after, () => {
      this.tweens.add({ targets: lines, alpha: 0, duration: 800 });
      this.rollCredits(d.score);
    });
    this.cameras.main.fadeIn(1200);
  }

  private rollCredits(score: number) {
    const credits = [
      ['CRYPTID RISING', 64, '#ffcf5a', FONT_TITLE],
      ['', 20, '#fff', FONT_UI],
      [`FINAL SCORE  ${String(score).padStart(7, '0')}`, 34, '#ffffff', FONT_TITLE],
      ['', 30, '#fff', FONT_UI],
      ['THE CHAMPIONS', 30, '#7ff6ff', FONT_TITLE],
      ['Mara Holt, park ranger  ·  Dez Okafor, cryptid streamer', 20, '#fff4e0', FONT_UI],
      ['', 20, '#fff', FONT_UI],
      ['THE BEASTS', 30, '#ffb43a', FONT_TITLE],
      ['Bigfoot  ·  Velociraptor  ·  Storm Dragon', 20, '#fff4e0', FONT_UI],
      ['Elder Bigfoot  ·  Alpha Raptor  ·  Elder Dragon', 20, '#fff4e0', FONT_UI],
      ['', 20, '#fff', FONT_UI],
      ['THE HOLLOW', 30, '#c46bff', FONT_TITLE],
      ['Moose Titan  ·  Fossil Golem  ·  Thunder Wyrm', 20, '#fff4e0', FONT_UI],
      ['Sawmill Behemoth  ·  Tar Leviathan  ·  The Hollow Heart', 20, '#fff4e0', FONT_UI],
      ['', 30, '#fff', FONT_UI],
      ['Made with Phaser 3, TypeScript and Vite', 20, '#c8d6d8', FONT_UI],
      ['Painted character art generated in Canva', 20, '#c8d6d8', FONT_UI],
      ['Music and sound synthesized live in your browser', 20, '#c8d6d8', FONT_UI],
      ['', 40, '#fff', FONT_UI],
      ['THANK YOU FOR PLAYING', 44, '#ffcf5a', FONT_TITLE],
    ] as const;
    const c = this.add.container(GAME_W / 2, GAME_H + 40);
    let y = 0;
    for (const [txt, size, color, font] of credits) {
      if (txt) c.add(this.add.text(0, y, txt, { fontFamily: font, fontSize: `${size}px`, color, stroke: '#1a1420', strokeThickness: 5, fontStyle: font === FONT_UI ? '800' : undefined }).setOrigin(0.5, 0));
      y += size + 18;
    }
    const end = -(y - GAME_H / 2 + 40);
    this.tweens.add({
      targets: c, y: end, duration: 26000, ease: 'Linear',
      onComplete: () => {
        this.canLeave = true;
        const hint = this.add.text(GAME_W / 2, GAME_H - 40, 'Press ENTER / tap to return to the title', { fontFamily: FONT_UI, fontSize: '18px', color: '#fff4e0', fontStyle: '800' }).setOrigin(0.5);
        this.tweens.add({ targets: hint, alpha: 0.4, yoyo: true, repeat: -1, duration: 700 });
      },
    });
    this.time.delayedCall(4000, () => { this.canLeave = true; });
    this.input.on('pointerdown', () => this.leave());
  }

  private leave() {
    if (!this.canLeave) return;
    this.canLeave = false;
    this.cameras.main.fadeOut(600);
    this.time.delayedCall(650, () => this.scene.start('Menu'));
  }

  update() {
    this.controls.update();
    if (this.controls.pressed('confirm') || this.controls.pressed('pause')) this.leave();
  }
}

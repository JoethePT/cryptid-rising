import Phaser from 'phaser';
import { GAME_H, GAME_W, Theme } from '../config';

interface Layer { ts: Phaser.GameObjects.TileSprite; f: number }

export const THEMES: Record<Theme, { sky: string; layers: [string, number, number?][]; ground: string; fg: string; motes: number }> = {
  forest: {
    sky: 'bg-sky',
    layers: [['bg-mountains', 0.1], ['bg-pines-far', 0.25], ['bg-fog', 0.4, 0.9], ['bg-pines-near', 0.55]],
    ground: 'ground', fg: 'fg-ferns', motes: 0xd8ff7a,
  },
  canyon: {
    sky: 'cy-sky',
    layers: [['cy-mesas', 0.1], ['cy-spires', 0.25], ['cy-dust', 0.4, 0.9], ['cy-near', 0.55]],
    ground: 'cy-ground', fg: 'cy-fg', motes: 0xffc58a,
  },
  storm: {
    sky: 'st-sky',
    layers: [['st-peaks', 0.08], ['st-clouds', 0.2], ['st-mist', 0.4, 0.9], ['st-near', 0.55]],
    ground: 'st-ground', fg: 'st-fg', motes: 0xbfd4ff,
  },
};

/** Screen-fixed tile-sprite layers that scroll at a fraction of the camera. */
export class Parallax {
  private layers: Layer[] = [];

  constructor(scene: Phaser.Scene, theme: Theme = 'forest') {
    const t = THEMES[theme];
    scene.add.image(0, 0, t.sky).setOrigin(0).setScrollFactor(0).setDepth(-100);
    t.layers.forEach(([key, f, alpha], i) => {
      const ts = scene.add.tileSprite(0, 0, GAME_W, GAME_H, key).setOrigin(0).setScrollFactor(0).setDepth(-90 + i * 5).setAlpha(alpha ?? 1);
      this.layers.push({ ts, f });
    });
  }

  update(scrollX: number) {
    for (const l of this.layers) l.ts.tilePositionX = scrollX * l.f;
  }
}

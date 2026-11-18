import Phaser from 'phaser';
import { FONT_TITLE } from '../config';

/** Particles, floating numbers, camera shake. Hitstop lives on GameScene because it pauses physics. */
export class Fx {
  private emitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private scene: Phaser.Scene) {}

  private emitter(color: number) {
    let e = this.emitters.get(color);
    if (!e) {
      e = this.scene.add.particles(0, 0, 'dot', {
        speed: { min: 120, max: 420 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 250, max: 600 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 600,
        tint: color,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      e.setDepth(50);
      this.emitters.set(color, e);
    }
    return e;
  }

  burst(x: number, y: number, color: number, count = 12) {
    this.emitter(color).explode(count, x, y);
  }

  /** Spirit wisps drifting upward (enemy cleansed / power-up). */
  wisps(x: number, y: number, color: number, count = 10) {
    for (let i = 0; i < count; i++) {
      const img = this.scene.add.image(x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-30, 30), 'dot')
        .setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(49).setScale(Phaser.Math.FloatBetween(0.6, 1.4));
      this.scene.tweens.add({
        targets: img, y: img.y - Phaser.Math.Between(60, 160), x: img.x + Phaser.Math.Between(-30, 30),
        alpha: 0, duration: Phaser.Math.Between(600, 1100), ease: 'Sine.easeOut', onComplete: () => img.destroy(),
      });
    }
  }

  ring(x: number, y: number, color: number, radius = 80, ms = 300) {
    const c = this.scene.add.circle(x, y, 10).setStrokeStyle(6, color, 1).setDepth(48).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: c, radius, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
  }

  number(x: number, y: number, value: number | string, color = '#ffffff', size = 28) {
    const t = this.scene.add.text(x, y, String(value), {
      fontFamily: FONT_TITLE, fontSize: `${size}px`, color, stroke: '#1a1420', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(60);
    this.scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  shake(intensity = 0.006, ms = 120) {
    this.scene.cameras.main.shake(ms, intensity, true);
  }
}

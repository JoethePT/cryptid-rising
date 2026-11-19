import Phaser from 'phaser';
import { COLORS, FONT_TITLE, GAME_H, GAME_W } from '../config';
import { Action, touchInput } from '../systems/Controls';

interface Btn { a: Action; x: number; y: number; r: number; label: string; color: number }

/**
 * On-screen controls for phones and tablets: a joystick on the left, action buttons on the right
 * and a pause button at the top. State is recomputed from every active touch each frame
 * (multi-touch: move and attack at the same time) and written into `touchInput`.
 */
export class TouchScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private stick = { x: 165, y: 560, r: 92 };
  private knob = { x: 0, y: 0 };
  private buttons: Btn[] = [];
  private down = new Set<Action>();
  /** Buttons tapped since the last frame, so even an instant tap counts as one press. */
  private latched = new Set<Action>();

  constructor() { super('Touch'); }

  create() {
    this.input.addPointer(3); // up to 4 simultaneous touches
    this.g = this.add.graphics();
    this.buttons = [
      { a: 'jump', x: 1190, y: 630, r: 58, label: 'JUMP', color: COLORS.spirit },
      { a: 'punch', x: 1060, y: 645, r: 52, label: 'PUNCH', color: 0xffb43a },
      { a: 'kick', x: 1180, y: 500, r: 52, label: 'KICK', color: 0xff6b78 },
      { a: 'dash', x: 1050, y: 520, r: 44, label: 'DASH', color: 0xc8d6d8 },
      { a: 'pause', x: GAME_W / 2, y: 40, r: 26, label: 'II', color: 0xffffff },
    ];
    for (const b of this.buttons) {
      this.add.text(b.x, b.y, b.label, {
        fontFamily: FONT_TITLE, fontSize: b.a === 'pause' ? '24px' : '22px', color: '#ffffff', stroke: '#0b0f14', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0.85);
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      for (const b of this.buttons) if (Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) < b.r * 1.3) this.latched.add(b.a);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  private clear() {
    for (const k of Object.keys(touchInput) as Action[]) delete touchInput[k];
  }

  update() {
    const st = new Set<Action>();
    this.knob.x = this.stick.x; this.knob.y = this.stick.y;
    for (const p of this.input.manager.pointers) {
      if (!p || !p.isDown) continue;
      const { x, y } = p;
      // left lower part of the screen = joystick zone
      if (x < GAME_W * 0.42 && y > GAME_H * 0.3) {
        let dx = x - this.stick.x, dy = y - this.stick.y;
        const d = Math.hypot(dx, dy), max = this.stick.r;
        if (d > max) { dx *= max / d; dy *= max / d; }
        this.knob.x = this.stick.x + dx; this.knob.y = this.stick.y + dy;
        if (dx < -26) st.add('left');
        if (dx > 26) st.add('right');
        if (dy < -40) st.add('up');
        if (dy > 40) st.add('down');
        continue;
      }
      for (const b of this.buttons) {
        if (Phaser.Math.Distance.Between(x, y, b.x, b.y) < b.r * 1.3) st.add(b.a);
      }
    }
    for (const a of this.latched) st.add(a);
    this.latched.clear();
    // the pause button also confirms in menus
    if (st.has('pause')) st.add('confirm');
    this.clear();
    for (const a of st) touchInput[a] = true;
    this.down = st;
    this.draw();
  }

  private draw() {
    const g = this.g;
    g.clear();
    // joystick
    g.fillStyle(0x0b0f14, 0.35); g.fillCircle(this.stick.x, this.stick.y, this.stick.r + 10);
    g.lineStyle(3, 0xffffff, 0.35); g.strokeCircle(this.stick.x, this.stick.y, this.stick.r + 10);
    g.fillStyle(0xffffff, this.down.size ? 0.55 : 0.35); g.fillCircle(this.knob.x, this.knob.y, 38);
    // buttons
    for (const b of this.buttons) {
      const on = this.down.has(b.a);
      g.fillStyle(b.color, on ? 0.55 : 0.22); g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(3, b.color, on ? 1 : 0.6); g.strokeCircle(b.x, b.y, b.r);
    }
  }
}

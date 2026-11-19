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
  private stickId = -1;
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
      { a: 'jump', x: 1192, y: 622, r: 70, label: 'JUMP', color: COLORS.spirit },
      { a: 'punch', x: 1035, y: 640, r: 68, label: 'PUNCH', color: 0xffb43a },
      { a: 'kick', x: 1170, y: 465, r: 62, label: 'KICK', color: 0xff6b78 },
      { a: 'dash', x: 1015, y: 490, r: 54, label: 'DASH', color: 0xc8d6d8 },
      { a: 'pause', x: GAME_W / 2, y: 40, r: 26, label: 'II', color: 0xffffff },
    ];
    for (const b of this.buttons) {
      this.add.text(b.x, b.y, b.label, {
        fontFamily: FONT_TITLE, fontSize: b.a === 'pause' ? '24px' : '22px', color: '#ffffff', stroke: '#0b0f14', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0.85);
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < GAME_W * 0.42 && p.y > GAME_H * 0.3 && this.stickId < 0) {
        this.stickId = p.id;
        this.stick.x = Phaser.Math.Clamp(p.x, 110, GAME_W * 0.42 - 60);
        this.stick.y = Phaser.Math.Clamp(p.y, GAME_H * 0.42, GAME_H - 110);
      }
      const hit = this.buttonAt(p.x, p.y); if (hit) this.latched.add(hit);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  /** The button under a finger: the closest one whose (generous) touch area contains it. */
  private buttonAt(x: number, y: number): Action | undefined {
    let best: Action | undefined, bd = Infinity;
    for (const b of this.buttons) {
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y) / b.r;
      if (d < 1.35 && d < bd) { bd = d; best = b.a; }
    }
    return best;
  }

  private clear() {
    for (const k of Object.keys(touchInput) as Action[]) delete touchInput[k];
  }

  update() {
    const st = new Set<Action>();
    this.knob.x = this.stick.x; this.knob.y = this.stick.y;
    let stickHeld = false;
    for (const p of this.input.manager.pointers) {
      if (!p || !p.isDown) continue;
      if (p.id === this.stickId) stickHeld = true;
      const { x, y } = p;
      // left lower part of the screen = joystick zone
      if (p.id === this.stickId || (x < GAME_W * 0.42 && y > GAME_H * 0.3)) {
        let dx = x - this.stick.x, dy = y - this.stick.y;
        const d = Math.hypot(dx, dy), max = this.stick.r;
        if (d > max) { dx *= max / d; dy *= max / d; }
        this.knob.x = this.stick.x + dx; this.knob.y = this.stick.y + dy;
        if (dx < -22) st.add('left');
        if (dx > 22) st.add('right');
        if (dy < -40) st.add('up');
        if (dy > 40) st.add('down');
        continue;
      }
      const hit = this.buttonAt(x, y);
      if (hit) st.add(hit);
    }
    if (!stickHeld && this.stickId >= 0) { this.stickId = -1; this.stick.x = 165; this.stick.y = 560; this.knob.x = 165; this.knob.y = 560; }
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

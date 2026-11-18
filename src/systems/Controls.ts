import Phaser from 'phaser';

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'punch' | 'kick' | 'dash' | 'pause' | 'confirm' | 'back';

const K = Phaser.Input.Keyboard.KeyCodes;

const KEYMAP: Record<Action, number[]> = {
  left: [K.A, K.LEFT],
  right: [K.D, K.RIGHT],
  up: [K.W, K.UP],
  down: [K.S, K.DOWN],
  jump: [K.SPACE, K.W, K.UP],
  punch: [K.J, K.Z],
  kick: [K.K, K.X],
  dash: [K.L, K.SHIFT, K.C],
  pause: [K.ESC, K.P],
  confirm: [K.ENTER, K.SPACE, K.J],
  back: [K.ESC, K.BACKSPACE],
};

// Standard (XInput-style) gamepad mapping: 0=A 1=B 2=X 3=Y 5=RB 8=Back 9=Start
const PADMAP: Partial<Record<Action, number[]>> = {
  jump: [0],
  punch: [2],
  kick: [3],
  dash: [1, 5],
  pause: [9],
  confirm: [0, 9],
  back: [1, 8],
};

const ACTIONS = Object.keys(KEYMAP) as Action[];

/** Unified keyboard + gamepad input with per-frame "pressed" edges. Call update() once per frame. */
export class Controls {
  private keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  private now = new Map<Action, boolean>();
  private prev = new Map<Action, boolean>();

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    for (const a of ACTIONS) this.keys.set(a, KEYMAP[a].map((code) => kb.addKey(code, true)));
    // Prime twice so keys already held when the scene starts don't count as fresh presses.
    this.update();
    this.update();
  }

  get pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) return undefined;
    return gp.getPad(0) ?? gp.gamepads.find((p) => !!p);
  }

  private padDown(a: Action): boolean {
    const pad = this.pad;
    if (!pad) return false;
    const sx = pad.leftStick?.x ?? 0;
    const sy = pad.leftStick?.y ?? 0;
    switch (a) {
      case 'left':
        if (pad.left || sx < -0.4) return true;
        break;
      case 'right':
        if (pad.right || sx > 0.4) return true;
        break;
      case 'up':
        if (pad.up || sy < -0.5) return true;
        break;
      case 'down':
        if (pad.down || sy > 0.5) return true;
        break;
    }
    const btns = PADMAP[a];
    return !!btns && btns.some((i) => pad.buttons[i]?.pressed);
  }

  update() {
    for (const a of ACTIONS) {
      this.prev.set(a, this.now.get(a) ?? false);
      const kb = this.keys.get(a)!.some((k) => k.isDown);
      this.now.set(a, kb || this.padDown(a));
    }
  }

  isDown(a: Action) {
    return this.now.get(a) ?? false;
  }

  pressed(a: Action) {
    return (this.now.get(a) ?? false) && !(this.prev.get(a) ?? false);
  }

  get usingPad() {
    return !!this.pad;
  }
}

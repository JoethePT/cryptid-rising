import Phaser from 'phaser';
import manifest from '../../public/sprites/manifest.json';

// Painted character sprites (generated in Canva, cut out by art-src/process.py).
// Each sprite is drawn with its feet on the entity's origin. `h` is the on-screen height in px
// for that pose (poses were generated at different framings, so each gets its own height).

export interface SpriteDef { h: number; ax?: number; fallback?: string }

export const SPRITES: Record<string, SpriteDef> = {
  // Mara (standing height ~150)
  'mara-idle': { h: 150 }, 'mara-walk': { h: 152, ax: 0.47 }, 'mara-punch': { h: 138 }, 'mara-kick': { h: 150 },
  'mara-crouch': { h: 118 }, 'mara-jump': { h: 112 }, 'mara-hurt': { h: 144 },
  // Dez (a little bigger)
  'dez-idle': { h: 156 }, 'dez-walk': { h: 160, ax: 0.47 }, 'dez-punch': { h: 144 }, 'dez-kick': { h: 150 },
  'dez-crouch': { h: 124 }, 'dez-jump': { h: 118 }, 'dez-hurt': { h: 154 },
  // Bigfoot
  'bigfoot-idle': { h: 232 }, 'bigfoot-walk': { h: 236, ax: 0.5 }, 'bigfoot-raise': { h: 262 }, 'bigfoot-slam': { h: 170 },
  'bigfoot-throw': { h: 222 }, 'bigfoot-charge': { h: 196 },
  // Stage 4 beast: the Elder Bigfoot (a little bigger than the young one)
  'elder-idle': { h: 250 }, 'elder-walk': { h: 254, ax: 0.5, fallback: 'elder-idle' }, 'elder-raise': { h: 270, fallback: 'elder-idle' },
  'elder-slam': { h: 200, ax: 0.42, fallback: 'elder-idle' }, 'elder-throw': { h: 275, fallback: 'elder-idle' }, 'elder-charge': { h: 214, fallback: 'elder-walk' },
  // Velociraptor (stage 2 beast)
  'raptor-idle': { h: 150, ax: 0.55 }, 'raptor-run': { h: 118, ax: 0.5 }, 'raptor-slash': { h: 150, ax: 0.5 },
  'raptor-pounce': { h: 132, ax: 0.5, fallback: 'raptor-run' }, 'raptor-roar': { h: 210, ax: 0.5, fallback: 'raptor-slash' },
  // Stage 5 beast: the Alpha Raptor (bigger). Until alpha-run exists the game keeps the red-tinted raptor art.
  'alpha-idle': { h: 168, ax: 0.62 }, 'alpha-run': { h: 132, ax: 0.5 }, 'alpha-slash': { h: 168, ax: 0.5, fallback: 'alpha-idle' },
  'alpha-pounce': { h: 148, ax: 0.5, fallback: 'alpha-run' }, 'alpha-roar': { h: 200, ax: 0.5, fallback: 'alpha-idle' },
  // Storm Dragon (stage 3 beast, flies)
  'dragon-hover': { h: 150, ax: 0.58 }, 'dragon-glide': { h: 125, ax: 0.55, fallback: 'dragon-hover' },
  'dragon-claw': { h: 150, ax: 0.5, fallback: 'dragon-hover' }, 'dragon-breath': { h: 150, ax: 0.4, fallback: 'dragon-hover' },
  // Enemies
  'husk-walk': { h: 150, ax: 0.5 }, 'husk-windup': { h: 162, ax: 0.5 }, 'husk-swipe': { h: 146, ax: 0.45 },
  'crow-fly': { h: 92, ax: 0.5 }, 'crow-swoop': { h: 84, ax: 0.5 },
  'wolf-run': { h: 104, ax: 0.5 }, 'wolf-lunge': { h: 110, ax: 0.5 },
  'moose-walk': { h: 330, ax: 0.5 }, 'moose-charge': { h: 290, ax: 0.5 },
  'wyrm-fly': { h: 230, ax: 0.5 }, 'wyrm-strike': { h: 250, ax: 0.5, fallback: 'wyrm-fly' },
  'leviathan-rise': { h: 400, ax: 0.42 }, 'leviathan-lunge': { h: 400, ax: 0.42, fallback: 'leviathan-rise' },
  'heart-idle': { h: 360, ax: 0.5 }, 'heart-open': { h: 370, ax: 0.5, fallback: 'heart-idle' },
  'behemoth-walk': { h: 330, ax: 0.5 }, 'behemoth-swing': { h: 410, ax: 0.5, fallback: 'behemoth-walk' },
  'golem-walk': { h: 320, ax: 0.5 }, 'golem-roar': { h: 360, ax: 0.5, fallback: 'golem-walk' }, 'golem-lunge': { h: 270, ax: 0.5, fallback: 'golem-walk' },
};

/** Bump the folder name (and art-src/process.py OUT_DIR) whenever sprites change, so browsers never reuse stale images. */
export const SPRITE_DIR = 'sprites/a3';

type Manifest = Record<string, { w: number; h: number; ax: number }>;
const MAN = manifest as Manifest;

export function hasSprite(scene: Phaser.Scene, key: string) {
  return key in MAN && scene.textures.exists(key) && scene.textures.get(key).key !== '__MISSING';
}

export function preloadSprites(scene: Phaser.Scene) {
  for (const key of Object.keys(SPRITES)) {
    if (key in MAN) scene.load.image(key, `${SPRITE_DIR}/${key}.png`);
  }
  // a failed image is simply left out; entities then fall back to a related pose or the drawn puppet
  scene.load.on('loaderror', (file: Phaser.Loader.File) => {
    console.warn('[sprites] failed to load', file.key, file.url);
    if (scene.textures.exists(file.key)) scene.textures.remove(file.key);
  });
}

/**
 * Point an Image at a sprite and size/anchor it. `scale` multiplies the pose height (forms, bosses),
 * `facing` flips it around the feet anchor.
 */
export function applySprite(img: Phaser.GameObjects.Image, key: string, facing: number, scale = 1) {
  let def = SPRITES[key];
  // optional poses fall back to a related one (keeping the requested on-screen height)
  // follow the fallback chain (e.g. charge -> walk -> idle) to the first loaded pose
  for (let i = 0; i < 3 && !hasSprite(img.scene, key) && def?.fallback; i++) { key = def.fallback; def = SPRITES[key]; }
  // never switch to a texture that isn't loaded (that would draw Phaser's 'missing' square)
  if (!hasSprite(img.scene, key)) return;
  if (img.texture.key !== key) img.setTexture(key);
  const m = MAN[key];
  const s = (def.h * scale) / m.h;
  img.setOrigin(def.ax ?? m.ax, 1);
  img.setScale(s * facing, s);
}

/** True if every listed sprite is available (lets entities fall back to the puppet renderer). */
export function spritesReady(scene: Phaser.Scene, keys: string[]) {
  return keys.every((k) => {
    for (let i = 0; i < 4 && k; i++) { if (hasSprite(scene, k)) return true; k = SPRITES[k]?.fallback ?? ''; }
    return false;
  });
}

/**
 * Phaser's shader glow (preFX) draws as a solid coloured box on many phone GPUs, so phones and
 * tablets use a cheap additive "halo" copy of the sprite instead. `?fx` / `?nofx` override.
 */
export function shaderFxOk() {
  const q = new URLSearchParams(location.search);
  if (q.has('nofx')) return false;
  if (q.has('fx')) return true;
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  return !touch;
}

/** Make a halo image (added behind `spr` by the caller) that fakes a glow without shaders. */
export function makeHalo(scene: Phaser.Scene, spr: Phaser.GameObjects.Image, color: number) {
  return scene.add.image(0, 0, spr.texture.key).setBlendMode(Phaser.BlendModes.ADD).setTintFill(color).setAlpha(0);
}

/** Copy the sprite's current pose onto its halo, slightly enlarged. `strength` 0..1. */
export function syncHalo(halo: Phaser.GameObjects.Image, spr: Phaser.GameObjects.Image, color: number, strength: number) {
  if (halo.texture.key !== spr.texture.key) halo.setTexture(spr.texture.key);
  halo.setOrigin(spr.originX, spr.originY);
  halo.setScale(spr.scaleX * 1.07, spr.scaleY * 1.04);
  halo.setPosition(spr.x, spr.y).setRotation(spr.rotation);
  halo.setVisible(spr.visible && strength > 0).setTintFill(color).setAlpha(Phaser.Math.Clamp(strength, 0, 1) * 0.55 * spr.alpha);
}

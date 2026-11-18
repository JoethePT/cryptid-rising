import Phaser from 'phaser';
import { GAME_H, GAME_W, GRAVITY } from './config';
import { BootScene, PauseScene, ResultScene } from './scenes/MiscScenes';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { audio } from './systems/Audio';

const debug = new URLSearchParams(location.search).has('debug');

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#070b10',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAVITY }, debug } },
  input: { gamepad: true },
  scene: [BootScene, MenuScene, GameScene, HudScene, PauseScene, ResultScene],
};

async function boot() {
  // Wait (briefly) for the web fonts so Phaser text renders with them.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px Bangers'), document.fonts.load('800 20px Nunito')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to system fonts */ }
  const game = new Phaser.Game(config);
  (window as unknown as { game: Phaser.Game; audio: typeof audio }).game = game;
  (window as unknown as { audio: typeof audio }).audio = audio;
}

// Browsers only allow audio after a user gesture: unlock on the first key/click/touch.
const unlock = () => audio.unlock();
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);
window.addEventListener('touchstart', unlock);
// M toggles all sound
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) audio.toggleMute(); });

boot();

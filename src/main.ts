import Phaser from 'phaser';
import { GAME_H, GAME_W, GRAVITY } from './config';
import { BootScene, PauseScene, ResultScene } from './scenes/MiscScenes';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { TouchScene } from './scenes/TouchScene';
import { isTouchDevice } from './systems/Controls';
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
  scene: [BootScene, MenuScene, GameScene, HudScene, PauseScene, ResultScene, TouchScene],
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

// Phones: block browser gestures over the game, and ask for landscape when held upright.
if (isTouchDevice()) {
  const style = document.createElement('style');
  style.textContent = `
    html, body, #game { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; overscroll-behavior: none; }
    #rotate { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; text-align: center;
      background: #070b10; color: #d8e6e8; font: 800 20px Nunito, Arial, sans-serif; z-index: 10; padding: 24px; }
    @media (orientation: portrait) { #rotate { display: flex; } }`;
  document.head.appendChild(style);
  const rotate = document.createElement('div');
  rotate.id = 'rotate';
  rotate.innerHTML = '<div><div style="font-size:56px">⟳</div>Turn your phone sideways to play</div>';
  document.body.appendChild(rotate);

  // On the first tap, go fullscreen (hides the address bar on Android; iPhones ignore this),
  // and refit the game whenever the visible area changes.
  const goFull = () => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      else el.webkitRequestFullscreen?.();
    } catch { /* not allowed here */ }
  };
  window.addEventListener('touchend', goFull, { once: true });
  const refit = () => (window as unknown as { game?: Phaser.Game }).game?.scale.refresh();
  window.addEventListener('orientationchange', () => setTimeout(refit, 300));
  window.visualViewport?.addEventListener('resize', refit);
}

boot();

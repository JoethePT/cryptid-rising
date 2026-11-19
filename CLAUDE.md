# Cryptid Rising — project guide

An original 2D side-scrolling beat-'em-up. Collect spirit orbs to power up twice, then transform into a beast.
Built with **Phaser 3 + TypeScript + Vite**, running in any desktop browser and on phones/tablets (landscape). The game is solo, controlled by keyboard, gamepad or on-screen touch controls.

> Original IP: inspired by the *genre* (orb-powered transformation brawlers). Don't copy names, art, music,
> levels or characters from any existing game.

## Commands
- `npm install` installs the dependencies.
- `npm run dev` starts the dev server at http://localhost:5173. Add `?debug` to the URL to show physics bodies.
- `npm run build` runs the type-check and makes a production build in `dist/`.
- `npm run typecheck` runs only the type-check.

## Creative direction (approved)
- **Theme:** Pacific Northwest folk horror meets an 80s Saturday-morning cartoon. Moonlit pine forests, fog, fireflies.
- **Story:** a meteor wakes an ancient totem. The *Hollow* corruption twists wildlife into husks, and the forest spirits choose a champion.
- **Palette:** deep teal and moss greens, campfire orange. Spirit power = cyan `#7ff6ff`. Beast power = amber `#ffb43a`. Hollow = purple `#c46bff`.
- **Art style:** painted semi-realistic (approved). Character art is AI-generated in Canva, one image per key pose, then cut out into `public/sprites/`. Code adds the in-between motion (bob, lean, squash, glow, hit flash). `src/gfx/Puppet.ts` is the procedural fallback used if a sprite is missing.

## Art pipeline
1. Generate the pose in Canva using the character's concept image as a reference. Keep the side view facing right on a plain white background (green `#00FF00` for pale or glowing characters such as the Spirit Wolf).
2. Put it in a Canva design, export it as PNG, and download it to `art-src/<name>.png`. Downloads come from `export-download.canva.com`, which must be allowed in the environment's network settings.
3. Run `python3 art-src/process.py <name> [<name>:holes ...]`. This removes the background, crops, writes `public/sprites/<name>.png` and updates `manifest.json`. Add `:holes` when white is trapped between limbs.
4. Add the sprite to `SPRITES` in `src/gfx/Sprites.ts` with its on-screen height `h`, and an `ax` foot-anchor override if needed.
5. Check sizes and anchors with `python3 art-src/preview.py out.png <names...>`.
- **Fonts:** Bangers (titles), Nunito (UI).

## Heroes (pick one)
| Hero | Role | Speed | Jump | HP | Damage |
|---|---|---|---|---|---|
| Mara Holt | Park ranger: fast and nimble | 290 | 780 | 100 | ×1.0 |
| Dez Okafor | Cryptid streamer: heavy hitter | 240 | 720 | 125 | ×1.3 |

## Power system
Spirit Wolves (glowing, cyan) carry orbs. Kill one and it drops an orb.
`Human → Awakened (1 orb) → Primal (2) → BEAST (3)`. Each step makes the hero bigger, stronger and faster (see `FORMS` in `config.ts`).
Dying drops you one form level. Beasts have super armour (they flinch but don't get knocked back).

## Stage plan (6 stages, one beast per stage, two acts)
| # | Stage | Beast | Boss | Status |
|---|---|---|---|---|
| 1 | Old-Growth Forest | Bigfoot | Moose Titan | **playable** |
| 2 | Fossil Canyon | Velociraptor | Fossil Golem | **playable** |
| 3 | Storm Peak | Storm Dragon (flight stage) | Thunder Wyrm | **playable** |
| 4 | Ember Mill | Elder Bigfoot | Sawmill Behemoth | planned |
| 5 | Tar Pit Bayou | Alpha Raptor | Tar Leviathan | planned |
| 6 | The Hollow Rift | Elder Dragon | The Hollow Heart | planned |

## Controls
| Action | Keyboard | Gamepad |
|---|---|---|
| Move | A/D or ←/→ | Left stick / D-pad |
| Jump | W, ↑ or Space | A |
| Crouch | S / ↓ | Down |
| Punch | J / Z | X |
| Kick | K / X | Y |
| Dash | L / Shift / C | B / RB |
| Pause | Esc / P | Start |

**Touch (phones/tablets):** `scenes/TouchScene.ts` draws a joystick (left) and JUMP / PUNCH / KICK / DASH buttons (right) plus a pause button (top). It shows only on touch devices, or with `?touch` in the URL. It writes into `touchInput` in `systems/Controls.ts`, so every Controls instance sees it like a key press. Portrait shows a "turn your phone sideways" prompt.

Human moves: punch, kick, crouch punch, sweep kick (crouch + kick), one air kick per jump, and dash (with i-frames).
Crouching ducks under Husk swipes.
Velociraptor moves: **Claw Slash** (J), fast and chainable. **Pounce** (K), a leaping strike that also hits in the air. **Sprint** (dash), very fast and damaging. Fossil Golem: lunge bite, bone spikes from the ground (glow first), shard rain (watch the shadows), summons at 55% and 25% HP.
Storm Dragon moves: **free flight** (W/Space up, S down). **Claw** (J). **Lightning Breath** (K), a piercing bolt. **Dive** (dash), which goes up or down if you hold those directions. Thunder Wyrm: lightning columns (they flicker first), aimed storm orbs, side sweeps at your height, and swoops that end resting low, which is the window for fighters on foot. It summons crows at 55% and 25% HP.
Bigfoot moves: **Ground Pound** (J), which hits up close and sends shockwaves both ways. **Log Throw** (K), an arcing projectile. **Shoulder Charge** (dash), which damages enemies.

## Audio
`src/systems/Audio.ts` synthesizes everything, so the game has no audio files:
- **Music:** original 16-bit console-style songs with 2-operator FM bass and lead, square arpeggios and synth drums. Each song is a chord chart plus a hand-written lead line (16th-note tokens). Tracks: `title`, `forest`, `canyon`, `boss`, `clear`, `gameover`.
- **SFX:** `audio.sfx(name)` covers swing, hit, heavy, hurt, jump, orb, powerup, transform, slam, throw, poof, caw, roar, boom, crack, pounce, zap, thunder, and the menu move/select/pause sounds.
- **Creature voices** (formant-filtered growl synth): `bigfoot`, `raptor`, `dragon` (transformations), `moose`, `golem`, `wyrm` (bosses), `growl`/`huskdie` (Husk), `howl`/`snarl` (Spirit Wolf), `step` (Bigfoot footfalls).
- **Ambience:** `audio.ambience('forest' | 'canyon' | 'storm' | null)` loops crickets/breeze, desert wind or rain/wind under the music.
- Audio unlocks on the first key, click or touch (a browser rule). **M** toggles mute, and the setting is remembered in localStorage.

## Code map
```
src/
  config.ts            all tuning numbers + content data (heroes, forms, difficulty, stages)
  main.ts              Phaser game config, waits for fonts
  systems/Controls.ts  unified keyboard+gamepad, per-frame pressed() edges
  systems/Fx.ts        particles, damage numbers, rings, screen shake
  systems/Audio.ts     procedural FM music + synthesized sound effects
  gfx/Sprites.ts       painted sprite registry (pose heights, anchors), preload + applySprite()
  gfx/Puppet.ts        procedural fallback renderer (used only when a sprite is missing)
  gfx/Textures.ts      procedural canvas textures (sky, parallax layers, ground, orb)
  gfx/Parallax.ts      screen-fixed tile-sprite parallax
  entities/Player.ts   player state machine, attacks/hitboxes, forms
  entities/Enemies.ts  Enemy base + Husk, Crow, SpiritWolf (orb carrier)
  entities/Boss.ts     MooseTitan (charge / rear-slam / summon, enrages below 50%)
  entities/Projectile.ts  logs, shockwaves; Orb pickup
  scenes/GameScene.ts  stage flow, spawner, combat resolution, hitstop, transformation cinematic
  scenes/HudScene.ts   HUD (separate scene so it ignores camera shake/zoom)
  scenes/MenuScene.ts  title + hero select + difficulty
  scenes/MiscScenes.ts Boot, Pause, Result
  scenes/TouchScene.ts on-screen joystick + buttons for phones/tablets
```

## Conventions
- Everything is drawn facing right with the feet at (0,0). Entities flip/scale their Graphics child, never the physics container.
- Hit detection is manual rect overlap (`activeHitbox()` / `hurtRect()`). Arcade physics is used only for movement and the ground.
- Hitstop = `GameScene.hitstop(ms)`, which pauses physics and skips entity updates.
- UI messages go through `gameScene.events.emit('banner', text, color, size)`.
- Keep gameplay logic separate from visuals so `Puppet.ts` can later be replaced by sprite sheets.

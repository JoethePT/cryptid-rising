# Cryptid Rising

An original 2D side-scrolling beat-'em-up. Fight as park ranger **Mara Holt** or cryptid streamer **Dez Okafor**. Collect spirit orbs to power up twice, then transform into the stage's beast:

| Stage | Beast | Boss |
|---|---|---|
| 1 · Old-Growth Forest | Bigfoot | Moose Titan |
| 2 · Fossil Canyon | Velociraptor | Fossil Golem |
| 3–6 | Storm Dragon, Elder forms… | coming soon |

Built with **Phaser 3 + TypeScript + Vite**. It runs in any desktop browser.

## Run it
```bash
npm install
npm run dev      # http://localhost:5173  (add ?debug to see hitboxes)
npm run build    # production build in dist/
```

## Controls
| | Keyboard | Gamepad |
|---|---|---|
| Move / crouch | A D / S (or arrows) | Stick / D-pad |
| Jump | W / Space | A |
| Punch | J | X |
| Kick | K | Y |
| Dash | L / Shift | B / RB |
| Pause | Esc | Start |
| Mute sound | M | |

## Art and audio
- Characters are painted semi-realistic sprites generated in Canva and cut out with `art-src/process.py`. See `CLAUDE.md` for the pipeline.
- All music and sound effects are synthesized at runtime with the Web Audio API (`src/systems/Audio.ts`), using 16-bit-style FM bass and lead voices. The songs are original compositions, and the game ships no audio files.

See `CLAUDE.md` for the design doc, code map and conventions.

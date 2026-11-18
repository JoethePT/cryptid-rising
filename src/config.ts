// Central tuning + content data. Gameplay numbers live here so they can be tweaked in one place.

export const GAME_W = 1280;
export const GAME_H = 720;
export const GROUND_Y = 640;
export const GRAVITY = 1800;

export const FONT_TITLE = 'Bangers, Impact, sans-serif';
export const FONT_UI = 'Nunito, Arial, sans-serif';

export const COLORS = {
  spirit: 0x7ff6ff, // power-orb / awakened glow
  beast: 0xffb43a, // full beast glow
  hollow: 0xc46bff, // corruption glow on enemies
  hurt: 0xff4d5e,
  outline: 0x1a1420,
};

export type HeroId = 'mara' | 'dez';

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  blurb: string;
  speed: number;
  jump: number;
  maxHp: number;
  dmgMul: number;
  stats: { power: number; speed: number; toughness: number }; // 1..5 for the select screen
}

export const HEROES: Record<HeroId, HeroDef> = {
  mara: {
    id: 'mara',
    name: 'Mara Holt',
    title: 'Park Ranger',
    blurb: 'Fast and nimble. Quick strikes, long jumps.',
    speed: 290,
    jump: 780,
    maxHp: 100,
    dmgMul: 1.0,
    stats: { power: 3, speed: 5, toughness: 3 },
  },
  dez: {
    id: 'dez',
    name: 'Dez Okafor',
    title: 'Cryptid Streamer',
    blurb: 'Heavy hitter. Slower, but hits hard and takes a beating.',
    speed: 240,
    jump: 720,
    maxHp: 125,
    dmgMul: 1.3,
    stats: { power: 5, speed: 3, toughness: 4 },
  },
};

/** Power levels: 0 Human -> 1 Awakened -> 2 Primal -> 3 Beast. */
export const FORMS = [
  { name: 'Human', scale: 1.0, dmg: 1.0, speed: 1.0, bodyW: 46, bodyH: 140 },
  { name: 'Awakened', scale: 1.08, dmg: 1.4, speed: 1.05, bodyW: 50, bodyH: 151 },
  { name: 'Primal', scale: 1.18, dmg: 1.8, speed: 1.1, bodyW: 54, bodyH: 165 },
  { name: 'Beast', scale: 1.0, dmg: 1.0, speed: 1.0, bodyW: 92, bodyH: 215 },
];

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY: Record<Difficulty, { label: string; enemyDmg: number; enemyHp: number; lives: number; spawnMul: number }> = {
  easy: { label: 'Easy', enemyDmg: 0.6, enemyHp: 0.8, lives: 5, spawnMul: 1.3 },
  normal: { label: 'Normal', enemyDmg: 1.0, enemyHp: 1.0, lives: 3, spawnMul: 1.0 },
  hard: { label: 'Hard', enemyDmg: 1.4, enemyHp: 1.3, lives: 2, spawnMul: 0.8 },
};

export type BeastId = 'bigfoot' | 'raptor' | 'dragon';

/** Beast-form tuning. Speed/jump multiply the hero's base values. */
export const BEASTS: Record<BeastId, { bodyW: number; bodyH: number; speed: number; jump: number }> = {
  bigfoot: { bodyW: 92, bodyH: 215, speed: 0.88, jump: 0.92 },
  raptor: { bodyW: 116, bodyH: 120, speed: 1.4, jump: 1.15 },
  dragon: { bodyW: 140, bodyH: 140, speed: 1.2, jump: 1.2 },
};

export type Theme = 'forest' | 'canyon';

export interface StageDef {
  id: number;
  name: string;
  beast: BeastId;
  beastName: string;
  boss: string;
  bossTitle: string;
  implemented: boolean;
  theme: Theme;
  length: number;
  arenaStart: number;
  platforms: { x: number; y: number; w: number }[];
}

const NONE = { theme: 'forest' as Theme, length: 6400, arenaStart: 5120, platforms: [] };

// Six-stage plan (two acts).
export const STAGES: StageDef[] = [
  {
    id: 1, name: 'Old-Growth Forest', beast: 'bigfoot', beastName: 'BIGFOOT', boss: 'MOOSE TITAN', bossTitle: 'Hollow Lord of the Pines', implemented: true,
    theme: 'forest', length: 6400, arenaStart: 5120,
    platforms: [
      { x: 1350, y: 520, w: 220 }, { x: 2350, y: 500, w: 180 }, { x: 2620, y: 400, w: 160 },
      { x: 3700, y: 510, w: 240 }, { x: 4500, y: 470, w: 200 },
    ],
  },
  {
    id: 2, name: 'Fossil Canyon', beast: 'raptor', beastName: 'VELOCIRAPTOR', boss: 'FOSSIL GOLEM', bossTitle: 'Bones of the Badlands', implemented: true,
    theme: 'canyon', length: 7200, arenaStart: 5920,
    platforms: [
      { x: 1100, y: 510, w: 200 }, { x: 1900, y: 470, w: 160 }, { x: 2150, y: 380, w: 160 },
      { x: 3100, y: 500, w: 260 }, { x: 4050, y: 450, w: 180 }, { x: 4350, y: 360, w: 150 }, { x: 5100, y: 500, w: 220 },
    ],
  },
  { id: 3, name: 'Storm Peak', beast: 'dragon', beastName: 'STORM DRAGON', boss: 'THUNDER WYRM', bossTitle: 'Serpent of the Squall', implemented: false, ...NONE },
  { id: 4, name: 'Ember Mill', beast: 'bigfoot', beastName: 'ELDER BIGFOOT', boss: 'SAWMILL BEHEMOTH', bossTitle: 'Iron and Rot', implemented: false, ...NONE },
  { id: 5, name: 'Tar Pit Bayou', beast: 'raptor', beastName: 'ALPHA RAPTOR', boss: 'TAR LEVIATHAN', bossTitle: 'The Sunken Maw', implemented: false, ...NONE },
  { id: 6, name: 'The Hollow Rift', beast: 'dragon', beastName: 'ELDER DRAGON', boss: 'THE HOLLOW HEART', bossTitle: 'Star-Fallen Corruption', implemented: false, ...NONE },
];

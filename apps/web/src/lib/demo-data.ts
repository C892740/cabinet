/**
 * Demo dataset.
 *
 * Shown when no DATABASE_URL is configured so the whole product is explorable
 * out of the box. Covers are generated artwork (see CoverArt) — Cabinet ships
 * no copyrighted cover art and no ROMs.
 */

import type { Collection, Platform, Rom } from "./types";

export const platforms: Platform[] = [
  { id: "p_nes", slug: "nes", name: "Nintendo Entertainment System", shortName: "NES", manufacturer: "Nintendo", releaseYear: 1985, colorA: "#e74c3c", colorB: "#8e2f26" },
  { id: "p_snes", slug: "snes", name: "Super Nintendo", shortName: "SNES", manufacturer: "Nintendo", releaseYear: 1990, colorA: "#7c5cff", colorB: "#3b2c8a" },
  { id: "p_gb", slug: "gb", name: "Game Boy", shortName: "GB", manufacturer: "Nintendo", releaseYear: 1989, colorA: "#2ecc71", colorB: "#145f40" },
  { id: "p_gba", slug: "gba", name: "Game Boy Advance", shortName: "GBA", manufacturer: "Nintendo", releaseYear: 2001, colorA: "#9b59ff", colorB: "#4b2c9e" },
  { id: "p_genesis", slug: "genesis", name: "Mega Drive / Genesis", shortName: "GEN", manufacturer: "Sega", releaseYear: 1988, colorA: "#2e86de", colorB: "#17406e" },
  { id: "p_n64", slug: "n64", name: "Nintendo 64", shortName: "N64", manufacturer: "Nintendo", releaseYear: 1996, colorA: "#f39c12", colorB: "#8a5a10" },
  { id: "p_psx", slug: "psx", name: "PlayStation", shortName: "PS1", manufacturer: "Sony", releaseYear: 1994, colorA: "#636e94", colorB: "#2b3247" },
  { id: "p_dreamcast", slug: "dreamcast", name: "Dreamcast", shortName: "DC", manufacturer: "Sega", releaseYear: 1998, colorA: "#ff6b9d", colorB: "#8e3159" },
  { id: "p_gamegear", slug: "gamegear", name: "Game Gear", shortName: "GG", manufacturer: "Sega", releaseYear: 1990, colorA: "#1abc9c", colorB: "#0d5f52" },
  { id: "p_arcade", slug: "arcade", name: "Arcade", shortName: "ARC", manufacturer: "Various", releaseYear: 1980, colorA: "#ff9f43", colorB: "#8f4c14" },
];

type RomInput = Partial<Rom> & {
  title: string;
  platformSlug: string;
  year: number;
  genre: string;
};

function makeRom(input: RomInput, index: number): Rom {
  const sortTitle = input.title
    .replace(/^(the|a|an) /i, "")
    .toLowerCase();
  return {
    id: `rom_${String(index + 1).padStart(3, "0")}`,
    sortTitle,
    players: 1,
    rating: 8,
    region: "USA",
    sizeMb: 1,
    description: "",
    favorite: false,
    playtimeHours: 0,
    lastPlayedAt: null,
    coverSeed: 1000 + index * 7,
    filePath: `/${input.platformSlug}/${input.title}.zip`,
    addedAt: new Date(2026, 0, 5 + index).toISOString(),
    coverUrl: null,
    coverProvider: "generated",
    raGameId: null,
    ...input,
  };
}

const rawRoms: RomInput[] = [
  // ── NES ────────────────────────────────────────────────────────────────
  { title: "Super Mario Bros. 3", platformSlug: "nes", year: 1988, genre: "Platformer", players: 2, rating: 9.6, sizeMb: 0.4, favorite: true, playtimeHours: 24, lastPlayedAt: "2026-10-12T18:20:00.000Z", description: "The tail-feathered high point of 8-bit platforming — a world map, secret warps and the iconic raccoon suit." },
  { title: "The Legend of Zelda", platformSlug: "nes", year: 1986, genre: "Adventure", rating: 9.3, sizeMb: 0.3, favorite: true, playtimeHours: 18, lastPlayedAt: "2026-09-28T20:05:00.000Z", description: "The golden cartridge that invented the open-air adventure: eight dungeons, one sword, endless secrets." },
  { title: "Mega Man 2", platformSlug: "nes", year: 1989, genre: "Action", rating: 9.1, sizeMb: 0.4, playtimeHours: 9, description: "Eight robot masters, one arm cannon and a soundtrack that still lives rent-free in everyone's head." },
  { title: "Contra", platformSlug: "nes", year: 1987, genre: "Run & Gun", players: 2, rating: 8.8, sizeMb: 0.4, playtimeHours: 6, description: "Two commandos, alien invasions and the most famous cheat code in gaming history." },
  { title: "Castlevania III: Dracula's Curse", platformSlug: "nes", year: 1990, genre: "Action", rating: 8.7, sizeMb: 0.5, playtimeHours: 4, description: "A branching quest through Transylvania with three selectable allies and a merciless final stretch." },

  // ── SNES ───────────────────────────────────────────────────────────────
  { title: "Super Metroid", platformSlug: "snes", year: 1994, genre: "Action-Adventure", rating: 9.7, sizeMb: 2.6, favorite: true, playtimeHours: 31, lastPlayedAt: "2026-10-18T21:40:00.000Z", description: "Atmosphere as level design — Zebes is one giant, moody puzzle box that teaches you its language as you explore." },
  { title: "The Legend of Zelda: A Link to the Past", platformSlug: "snes", year: 1991, genre: "Adventure", rating: 9.6, sizeMb: 2.1, favorite: true, playtimeHours: 27, lastPlayedAt: "2026-10-02T19:15:00.000Z", description: "Two worlds, one hero and the template every top-down Zelda has followed since." },
  { title: "Chrono Trigger", platformSlug: "snes", year: 1995, genre: "JRPG", rating: 9.8, sizeMb: 4.0, favorite: true, playtimeHours: 42, lastPlayedAt: "2026-10-15T22:30:00.000Z", description: "Time travel, combo techs and a cast so charming that even the side quests feel essential." },
  { title: "Super Mario World", platformSlug: "snes", year: 1990, genre: "Platformer", players: 2, rating: 9.5, sizeMb: 0.6, playtimeHours: 19, description: "Yoshi's debut and the smoothest cape physics ever programmed, wrapped around a secret-stuffed map." },
  { title: "Final Fantasy VI", platformSlug: "snes", year: 1994, genre: "JRPG", rating: 9.6, sizeMb: 3.2, playtimeHours: 55, description: "An opera, a world of ruin and an ensemble cast that still anchors every 'greatest RPG' list." },
  { title: "Street Fighter II Turbo", platformSlug: "snes", year: 1993, genre: "Fighting", players: 2, rating: 9.0, sizeMb: 2.8, playtimeHours: 22, description: "The living-room tournament standard: faster rounds, new speed tiers and endless rivalries." },
  { title: "Donkey Kong Country", platformSlug: "snes", year: 1994, genre: "Platformer", players: 2, rating: 9.1, sizeMb: 2.4, playtimeHours: 11, description: "Pre-rendered barrels, mine-cart chaos and a soundtrack that made the SNES feel like an arcade." },
  { title: "Super Castlevania IV", platformSlug: "snes", year: 1991, genre: "Action", rating: 8.9, sizeMb: 1.4, playtimeHours: 7, description: "Simon Belmont's whip gets eight directions, and Dracula's castle has never looked this good." },

  // ── Game Boy ───────────────────────────────────────────────────────────
  { title: "Tetris", platformSlug: "gb", year: 1989, genre: "Puzzle", players: 2, rating: 9.2, sizeMb: 0.1, favorite: true, playtimeHours: 38, lastPlayedAt: "2026-10-17T08:10:00.000Z", description: "The reason the Game Boy sold millions — perfect on a train, dangerous on a deadline." },
  { title: "Pokémon Red Version", platformSlug: "gb", year: 1996, genre: "RPG", rating: 9.3, sizeMb: 1.0, favorite: true, playtimeHours: 63, lastPlayedAt: "2026-10-11T17:45:00.000Z", description: "Gotta catch 'em all, one link cable trade at a time. Kanto has never felt smaller or bigger." },
  { title: "The Legend of Zelda: Link's Awakening", platformSlug: "gb", year: 1993, genre: "Adventure", rating: 9.0, sizeMb: 0.7, playtimeHours: 14, description: "A dreamlike island adventure with a twist that lands harder than most console epics." },
  { title: "Metroid II: Return of Samus", platformSlug: "gb", year: 1991, genre: "Action-Adventure", rating: 8.4, sizeMb: 0.5, playtimeHours: 8, description: "A lonely hunt across SR388 that ends with one of the series' most tender moments." },

  // ── GBA ────────────────────────────────────────────────────────────────
  { title: "Metroid Fusion", platformSlug: "gba", year: 2002, genre: "Action-Adventure", rating: 9.1, sizeMb: 8.1, favorite: true, playtimeHours: 16, lastPlayedAt: "2026-10-14T20:00:00.000Z", description: "Samus versus her own reflection — tight, tense and packed with series lore." },
  { title: "Advance Wars", platformSlug: "gba", year: 2001, genre: "Strategy", players: 2, rating: 9.2, sizeMb: 4.3, playtimeHours: 29, description: "Turn-based tank chess with a cheerful coat of paint and a devious difficulty curve." },
  { title: "Castlevania: Aria of Sorrow", platformSlug: "gba", year: 2003, genre: "Action-RPG", rating: 9.0, sizeMb: 7.8, playtimeHours: 12, description: "The soul-collecting twist on the Metroidvania formula, set inside a very modern Dracula's castle." },
  { title: "Mario Kart: Super Circuit", platformSlug: "gba", year: 2001, genre: "Racing", players: 4, rating: 8.6, sizeMb: 5.2, playtimeHours: 13, description: "SNES tracks reborn, link-cable chaos included — the blue shell knows no mercy." },

  // ── Genesis ────────────────────────────────────────────────────────────
  { title: "Sonic the Hedgehog 2", platformSlug: "genesis", year: 1992, genre: "Platformer", players: 2, rating: 9.2, sizeMb: 1.2, favorite: true, playtimeHours: 15, lastPlayedAt: "2026-10-09T16:25:00.000Z", description: "Spin dashes, chemical plant zones and Miles 'Tails' Prower stealing the show in two-player mode." },
  { title: "Streets of Rage 2", platformSlug: "genesis", year: 1992, genre: "Beat 'em up", players: 2, rating: 9.1, sizeMb: 2.1, playtimeHours: 10, description: "The gold standard of couch co-op brawlers, with a Yuzo Koshiro soundtrack that still slaps." },
  { title: "Gunstar Heroes", platformSlug: "genesis", year: 1993, genre: "Run & Gun", players: 2, rating: 9.0, sizeMb: 2.0, playtimeHours: 6, description: "Treasure at maximum volume — screen-filling bosses and weapon combos that break the sound test." },
  { title: "Phantasy Star IV", platformSlug: "genesis", year: 1995, genre: "JRPG", rating: 9.2, sizeMb: 3.2, playtimeHours: 41, description: "Comic-panel storytelling, macro attacks and the best finale on the Mega Drive." },
  { title: "Earthworm Jim", platformSlug: "genesis", year: 1994, genre: "Platformer", rating: 8.3, sizeMb: 2.4, playtimeHours: 5, description: "A super-suited worm, a pocket rocket and the most gloriously weird animation of the 16-bit era." },

  // ── N64 ────────────────────────────────────────────────────────────────
  { title: "Super Mario 64", platformSlug: "n64", year: 1996, genre: "Platformer", rating: 9.5, sizeMb: 8.0, favorite: true, playtimeHours: 21, lastPlayedAt: "2026-10-16T15:30:00.000Z", description: "The game that taught a generation how 3D movement should feel — one castle, 120 stars." },
  { title: "The Legend of Zelda: Ocarina of Time", platformSlug: "n64", year: 1998, genre: "Adventure", rating: 9.7, sizeMb: 25.6, favorite: true, playtimeHours: 36, lastPlayedAt: "2026-10-06T20:50:00.000Z", description: "Hyrule in three dimensions, Z-targeting and an ocarina that still gives people chills." },
  { title: "GoldenEye 007", platformSlug: "n64", year: 1997, genre: "Shooter", players: 4, rating: 9.0, sizeMb: 12.0, playtimeHours: 17, description: "The four-player split-screen FPS that turned every living room into a very polite battleground." },
  { title: "Mario Kart 64", platformSlug: "n64", year: 1996, genre: "Racing", players: 4, rating: 8.9, sizeMb: 9.6, playtimeHours: 23, description: "Four controllers, one sofa, infinite friendships ended by a perfectly timed red shell." },
  { title: "Star Fox 64", platformSlug: "n64", year: 1997, genre: "Rail Shooter", players: 4, rating: 8.9, sizeMb: 10.2, playtimeHours: 9, description: "Do a barrel roll — branching paths, rumble packs and the birth of 'mission complete' swagger." },

  // ── PlayStation ────────────────────────────────────────────────────────
  { title: "Castlevania: Symphony of the Night", platformSlug: "psx", year: 1997, genre: "Action-RPG", rating: 9.5, sizeMb: 340, favorite: true, playtimeHours: 28, lastPlayedAt: "2026-10-13T21:10:00.000Z", description: "An inverted castle, a thousand items and the game that gave the genre its name." },
  { title: "Final Fantasy VII", platformSlug: "psx", year: 1997, genre: "JRPG", rating: 9.6, sizeMb: 680, playtimeHours: 58, description: "Midgar, materia and a moment in a flower market that changed RPGs forever." },
  { title: "Metal Gear Solid", platformSlug: "psx", year: 1998, genre: "Stealth", rating: 9.5, sizeMb: 720, playtimeHours: 19, description: "Codec calls, cardboard boxes and the birth of cinematic stealth." },
  { title: "Ridge Racer Type 4", platformSlug: "psx", year: 1998, genre: "Racing", players: 2, rating: 8.9, sizeMb: 512, playtimeHours: 8, description: "Drift-heavy racing dressed in the slickest menu design of the late '90s." },
  { title: "Silent Hill", platformSlug: "psx", year: 1999, genre: "Horror", rating: 9.0, sizeMb: 610, playtimeHours: 11, description: "Fog, static and psychological dread — the town knows exactly what you're afraid of." },

  // ── Dreamcast ──────────────────────────────────────────────────────────
  { title: "Sonic Adventure", platformSlug: "dreamcast", year: 1998, genre: "Platformer", rating: 8.5, sizeMb: 1024, playtimeHours: 12, description: "Six stories, one very fast hedgehog and the moment 3D Sonic found its feet." },
  { title: "Jet Set Radio", platformSlug: "dreamcast", year: 2000, genre: "Action", rating: 9.1, sizeMb: 890, favorite: true, playtimeHours: 14, lastPlayedAt: "2026-10-08T18:35:00.000Z", description: "Cel-shaded graffiti, inline skates and a soundtrack that basically invented 'vibes'." },
  { title: "SoulCalibur", platformSlug: "dreamcast", year: 1999, genre: "Fighting", players: 2, rating: 9.3, sizeMb: 960, playtimeHours: 16, description: "The arcade port that made the Dreamcast look like a console from the future." },
  { title: "Crazy Taxi", platformSlug: "dreamcast", year: 1999, genre: "Racing", players: 2, rating: 8.7, sizeMb: 640, playtimeHours: 7, description: "Pick up customers, ignore the laws of physics, and never stop the punk rock." },

  // ── Game Gear ──────────────────────────────────────────────────────────
  { title: "Sonic Chaos", platformSlug: "gamegear", year: 1993, genre: "Platformer", rating: 8.1, sizeMb: 0.5, playtimeHours: 4, description: "Pocket-sized speedrunning with jet shoes and a surprising amount of attitude." },
  { title: "Columns", platformSlug: "gamegear", year: 1990, genre: "Puzzle", players: 2, rating: 8.0, sizeMb: 0.2, playtimeHours: 6, description: "Sega's answer to falling blocks — jewel-toned, hypnotic and perfect for one more round." },
  { title: "Shining Force: The Sword of Hajya", platformSlug: "gamegear", year: 1992, genre: "Strategy", rating: 8.2, sizeMb: 0.8, playtimeHours: 12, description: "A full tactics RPG in the palm of your hand — with batteries you'll need to keep buying." },

  // ── Arcade ─────────────────────────────────────────────────────────────
  { title: "Street Fighter II: Champion Edition", platformSlug: "arcade", year: 1991, genre: "Fighting", players: 2, rating: 9.2, sizeMb: 22, favorite: true, playtimeHours: 33, lastPlayedAt: "2026-10-19T14:05:00.000Z", description: "The quarter-magnet that created competitive fighting games — and endless 'rematch?' standoffs." },
  { title: "Metal Slug", platformSlug: "arcade", year: 1996, genre: "Run & Gun", players: 2, rating: 9.3, sizeMb: 34, playtimeHours: 9, description: "Hand-drawn pixel chaos, absurd weaponry and the best 'MISSION 1 START' screen ever made." },
  { title: "Pac-Man", platformSlug: "arcade", year: 1980, genre: "Maze", players: 2, rating: 8.8, sizeMb: 0.1, playtimeHours: 15, description: "Four ghosts, one maze and the game that made arcades a mainstream pastime." },
  { title: "Galaga", platformSlug: "arcade", year: 1981, genre: "Shooter", players: 2, rating: 8.7, sizeMb: 0.1, playtimeHours: 8, description: "Dual-fighter captures, dive-bombing aliens and the most satisfying 'perfect' screen in the arcade." },
];

export const roms: Rom[] = rawRoms.map(makeRom);

export const collections: Collection[] = [
  {
    id: "col_coop",
    name: "Couch Co-op Night",
    description: "Everything worth two controllers and a Saturday evening.",
    isPublic: true,
    ownerId: "u_admin",
    romIds: roms.filter((r) => r.players > 1).map((r) => r.id),
  },
  {
    id: "col_backlog",
    name: "The Shameful Backlog",
    description: "Games everyone says are perfect and you swear you'll finish this time.",
    isPublic: true,
    ownerId: "u_admin",
    romIds: ["rom_006", "rom_008", "rom_019", "rom_036", "rom_031"],
  },
  {
    id: "col_16bit",
    name: "16-bit Golden Hour",
    description: "Peak cartridge-era design: SNES and Genesis at their finest.",
    isPublic: true,
    ownerId: "u_admin",
    romIds: roms.filter((r) => r.platformSlug === "snes" || r.platformSlug === "genesis").map((r) => r.id),
  },
];

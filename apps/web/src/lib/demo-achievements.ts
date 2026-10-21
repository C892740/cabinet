/**
 * Demo achievement fixtures.
 *
 * Cabinet's achievement screens are fully explorable with zero configuration:
 * these hand-written sets stand in for RetroAchievements data until a Web API
 * key is configured (RETROACHIEVEMENTS_API_KEY + RETROACHIEVEMENTS_USERNAME),
 * at which point real data replaces them. They are clearly marked
 * `source: "demo"` and are original writing, not scraped content.
 */

import type { Achievement, AchievementSet, Rom } from "./types";
import { tierForPoints } from "./ra";

type AchievementInput = {
  title: string;
  description: string;
  points: number;
  unlocked?: boolean;
  unlockedAt?: string;
  hardcore?: boolean;
};

function makeAchievement(input: AchievementInput, index: number): Achievement {
  const unlockedAt = input.unlocked ? (input.unlockedAt ?? "2026-09-14T18:30:00.000Z") : null;
  return {
    id: `demo_${index}`,
    title: input.title,
    description: input.description,
    points: input.points,
    tier: tierForPoints(input.points),
    badgeUrl: "",
    unlocked: Boolean(input.unlocked),
    unlockedAt,
    hardcore: Boolean(input.hardcore),
    rarityPct: null,
    secret: false,
  };
}

const DEMO_SETS: Record<string, { gameTitle: string; consoleName: string; items: AchievementInput[] }> = {
  "Super Metroid": {
    gameTitle: "Super Metroid",
    consoleName: "SNES",
    items: [
      { title: "The Last Metroid", description: "Escape Zebes before the self-destruct reaches zero.", points: 25, unlocked: true, hardcore: true, unlockedAt: "2026-08-02T20:14:00.000Z" },
      { title: "Varia Hunter", description: "Collect the Varia Suit without taking damage in Brinstar.", points: 10, unlocked: true, unlockedAt: "2026-08-05T19:02:00.000Z" },
      { title: "Shinespark Scholar", description: "Store a charge and launch a shinespark across three rooms.", points: 10, unlocked: true },
      { title: "Crystal Flash", description: "Survive a near-death moment using a Crystal Flash.", points: 5 },
      { title: "Speed Booster", description: "Clear Wrecked Ship's waterway at full speed.", points: 5 },
      { title: "Torizo's End", description: "Defeat a Torizo statue before it finishes standing up.", points: 10 },
      { title: "100% Completion", description: "Collect every item on Zebes.", points: 25 },
      { title: "Mother Brain", description: "Finish the game on Hard difficulty.", points: 50 },
    ],
  },
  "Chrono Trigger": {
    gameTitle: "Chrono Trigger",
    consoleName: "SNES",
    items: [
      { title: "A Matter of Time", description: "Defeat Lavos at the Ocean Palace.", points: 50, unlocked: true, hardcore: true, unlockedAt: "2026-07-21T22:41:00.000Z" },
      { title: "Frog's Song", description: "Complete the Masamune side quest.", points: 25, unlocked: true, unlockedAt: "2026-07-19T21:10:00.000Z" },
      { title: "Double Trouble", description: "Perform a dual tech for the first time.", points: 5, unlocked: true },
      { title: "Rainbow Shell", description: "Forge the Rainbow Sword.", points: 10, unlocked: true },
      { title: "The Guru of Zeal", description: "Save Melchior from the Ocean Palace.", points: 10 },
      { title: "Queen Zeal", description: "Defeat Queen Zeal without using Elixirs.", points: 25 },
      { title: "Dream Team", description: "Unlock every triple tech.", points: 25 },
      { title: "Beyond Time", description: "Witness every ending.", points: 50 },
    ],
  },
  "Castlevania: Symphony of the Night": {
    gameTitle: "Castlevania: Symphony of the Night",
    consoleName: "PlayStation",
    items: [
      { title: "What is a Man?", description: "Defeat Dracula's final form in the Inverted Castle.", points: 25, unlocked: true, unlockedAt: "2026-09-10T23:05:00.000Z" },
      { title: "Richter's Whipping Boy", description: "Clear the prologue without taking damage.", points: 10, unlocked: true },
      { title: "Library Card", description: "Buy every item from the Librarian.", points: 10, unlocked: true },
      { title: "Shield Rod Symphony", description: "Discover a Shield Rod spell on your own.", points: 5, unlocked: true, hardcore: true },
      { title: "200.6% Map", description: "Complete the castle map beyond perfection.", points: 50 },
      { title: "Familiar Faces", description: "Max out every familiar.", points: 25 },
      { title: "Mist Opportunity", description: "Reach the Forbidden Library using only Mist form.", points: 10 },
    ],
  },
  "Sonic the Hedgehog 2": {
    gameTitle: "Sonic the Hedgehog 2",
    consoleName: "Mega Drive",
    items: [
      { title: "Emerald Hunter", description: "Collect all seven Chaos Emeralds.", points: 25, unlocked: true, hardcore: true, unlockedAt: "2026-06-14T16:20:00.000Z" },
      { title: "Chemical Plant", description: "Clear Chemical Plant Zone Act 2 without drowning.", points: 5, unlocked: true },
      { title: "Spin Dash Mastery", description: "Defeat a boss using only a fully charged spin dash.", points: 10, unlocked: true },
      { title: "Tails' Triumph", description: "Finish a level as Tails alone.", points: 5 },
      { title: "Casino Night", description: "Hit the jackpot in Casino Night Zone.", points: 5 },
      { title: "Death Egg Run", description: "Clear Death Egg Zone without losing a life.", points: 25 },
      { title: "Super Sonic", description: "Transform into Super Sonic in every zone.", points: 10 },
    ],
  },
  "Super Mario Bros. 3": {
    gameTitle: "Super Mario Bros. 3",
    consoleName: "NES",
    items: [
      { title: "Leaf on the Wind", description: "Fly over an entire level with the Raccoon Suit.", points: 10, unlocked: true, unlockedAt: "2026-05-30T17:45:00.000Z" },
      { title: "King of the Koopas", description: "Defeat Bowser without using a Warp Whistle.", points: 25, unlocked: true },
      { title: "Kuribo's Shoe", description: "Stomp a Goomba's Boot all the way to the goal.", points: 5, unlocked: true },
      { title: "Card Shark", description: "Collect three matching cards at the end of a world.", points: 5, unlocked: true },
      { title: "Sky Pirate", description: "Clear the entire Sky world on the map without a flute.", points: 10 },
      { title: "Tanooki Statue", description: "Stomp an enemy while in statue form.", points: 5 },
      { title: "White Tanooki", description: "Finish the game without taking damage.", points: 50 },
    ],
  },
};

/** Build the demo achievement set for a rom, or null if no fixture exists. */
export function demoAchievementSet(rom: Rom): AchievementSet | null {
  const fixture = DEMO_SETS[rom.title];
  if (!fixture) return null;
  const achievements = fixture.items.map(makeAchievement);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  return {
    source: "demo",
    raGameId: null,
    gameTitle: fixture.gameTitle,
    consoleName: fixture.consoleName,
    boxArtUrl: null,
    total: achievements.length,
    unlocked,
    hardcoreUnlocked: achievements.filter((a) => a.hardcore).length,
    pointsEarned: achievements.filter((a) => a.unlocked).reduce((sum, a) => sum + a.points, 0),
    pointsTotal: achievements.reduce((sum, a) => sum + a.points, 0),
    completionPct: Math.round((unlocked / achievements.length) * 100),
    achievements,
    fetchedAt: new Date().toISOString(),
  };
}

/** Quick lookup used to embed summaries in library listings. */
export function hasDemoAchievements(title: string): boolean {
  return Boolean(DEMO_SETS[title]);
}

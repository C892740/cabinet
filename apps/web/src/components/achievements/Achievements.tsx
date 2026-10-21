"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Achievement, AchievementSet, AchievementSummary, AchievementTier, Rom } from "@/lib/types";

/**
 * Trophy-screen UI in the language of the PS5 achievement screens:
 * a progress ring and tier totals on top, then rows per achievement —
 * earned (full colour, date), locked (dimmed) and secret ("Hidden
 * achievement", reveal to see — since RetroAchievements has no native
 * secret flag, Cabinet derives secret from this anti-spoiler treatment).
 */

const TIER_STYLE: Record<AchievementTier, { label: string; color: string; glow: string }> = {
  platinum: { label: "Platinum", color: "#8fd3e8", glow: "rgba(143,211,232,0.35)" },
  gold: { label: "Gold", color: "#e8c14b", glow: "rgba(232,193,75,0.3)" },
  silver: { label: "Silver", color: "#c3cbd8", glow: "rgba(195,203,216,0.25)" },
  bronze: { label: "Bronze", color: "#d2885c", glow: "rgba(210,136,92,0.25)" },
};

export function TierIcon({ tier, size = 18 }: { tier: AchievementTier; size?: number }) {
  const style = TIER_STYLE[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={style.label} role="img">
      <path
        d="M12 2.6 14.4 8l5.9.6-4.4 4 1.2 5.8L12 15.5l-5.1 2.9L8.1 12.6 3.7 8.6 9.6 8z"
        fill={style.color}
        opacity={0.95}
      />
    </svg>
  );
}

function ProgressRing({ pct, size = 84 }: { pct: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#ring-gradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <defs>
        <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const style = TIER_STYLE[achievement.tier];
  if (achievement.badgeUrl) {
    return (
      <img
        src={achievement.badgeUrl}
        alt=""
        className="h-12 w-12 rounded-lg border border-white/15 bg-black/40 object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/15"
      style={{ backgroundImage: `linear-gradient(135deg, ${style.color}44, ${style.color}11)` }}
    >
      <TierIcon tier={achievement.tier} size={22} />
    </span>
  );
}

function rarityLabel(pct: number | null): string | null {
  if (pct == null) return null;
  if (pct < 1) return "Ultra rare";
  if (pct < 5) return "Very rare";
  if (pct < 20) return "Rare";
  if (pct < 50) return "Common";
  return "Very common";
}

function AchievementRow({ achievement, index }: { achievement: Achievement; index: number }) {
  const [revealed, setRevealed] = useState(!achievement.secret);
  const style = TIER_STYLE[achievement.tier];
  const rarity = rarityLabel(achievement.rarityPct);

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border px-4 py-3.5 sm:grid-cols-[auto_1fr_auto] ${
        achievement.unlocked
          ? "border-white/12 bg-white/[0.055]"
          : "border-white/[0.06] bg-white/[0.02] opacity-80"
      }`}
    >
      <div className="row-span-2 flex items-start sm:row-span-3">
        <AchievementBadge achievement={achievement} />
      </div>

      <div className="min-w-0">
        <h4 className="truncate text-sm font-semibold text-white">
          {achievement.secret && !revealed ? (
            <span className="inline-flex items-center gap-2 text-white/70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Hidden achievement
            </span>
          ) : (
            achievement.title
          )}
        </h4>
        <p className="mt-0.5 text-xs text-white/50">
          {achievement.secret && !revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="text-violet-300 underline decoration-violet-300/40 underline-offset-2 transition-colors hover:text-violet-200"
            >
              Reveal
            </button>
          ) : (
            achievement.description
          )}
        </p>
      </div>

      <div className="col-start-2 flex items-center gap-3 text-[11px] text-white/45 sm:col-start-3 sm:row-span-2 sm:flex-col sm:items-end sm:gap-1">
        <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: style.color }}>
          <TierIcon tier={achievement.tier} size={13} />
          {achievement.points} pts
        </span>
        {rarity && achievement.rarityPct != null && (
          <span>
            {rarity} · {achievement.rarityPct.toFixed(1)}%
          </span>
        )}
        {achievement.unlocked ? (
          <span className="text-emerald-300/80">
            Earned{achievement.unlockedAt ? ` ${new Date(achievement.unlockedAt).toLocaleDateString()}` : ""}
            {achievement.hardcore ? " · hardcore" : ""}
          </span>
        ) : (
          <span>Locked</span>
        )}
      </div>
    </motion.li>
  );
}

export function AchievementsPanel({ rom }: { rom: Rom }) {
  const [set, setSet] = useState<AchievementSet | null>(rom.achievements ? null : null);
  const [loading, setLoading] = useState(true);
  const [spoilers, setSpoilers] = useState(false); // false = PS5-style hidden secrets

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/roms/${rom.id}/achievements`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) {
          setSet(json?.achievements ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rom.id]);

  if (loading) {
    return (
      <div className="mt-8">
        <div className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
        <div className="mt-3 h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="mt-2 h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  if (!set || set.total === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-6 text-sm text-white/50">
        No achievements found for this game yet.
      </div>
    );
  }

  const tierCounts: Record<AchievementTier, number> = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const a of set.achievements) if (a.unlocked) tierCounts[a.tier] += 1;

  const withSecrets = set.achievements.map((a) => ({ ...a, secret: !a.unlocked && !spoilers }));

  return (
    <section className="mt-8" aria-label="Achievements">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative grid place-items-center">
            <ProgressRing pct={set.completionPct} />
            <span className="absolute text-sm font-semibold text-white">{set.completionPct}%</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Achievements</h3>
            <p className="mt-0.5 text-xs text-white/50">
              {set.unlocked} of {set.total} earned · {set.pointsEarned}/{set.pointsTotal} pts
              {set.source === "demo" && (
                <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/45">
                  demo data
                </span>
              )}
            </p>
            <div className="mt-2 flex items-center gap-3">
              {(["platinum", "gold", "silver", "bronze"] as AchievementTier[]).map((tier) => (
                <span key={tier} className="inline-flex items-center gap-1 text-xs text-white/60">
                  <TierIcon tier={tier} size={14} />
                  {tierCounts[tier]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSpoilers((v) => !v)}
          className="chip"
          aria-pressed={spoilers}
          title="Locked achievements show as hidden until revealed — like PS5 secret trophies"
        >
          {spoilers ? "Secrets revealed" : "Secrets hidden"}
        </button>
      </div>

      <ul className="mt-5 space-y-2">
        {withSecrets.map((achievement, index) => (
          <AchievementRow key={achievement.id} achievement={achievement} index={index} />
        ))}
      </ul>
    </section>
  );
}

/** Compact badge for rom cards and shells — the achievements pop-up trigger. */
export function AchievementChip({ summary, className = "" }: { summary: AchievementSummary; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white/90 backdrop-blur-md ${className}`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7 3h10v2h3v3a4 4 0 0 1-3.4 3.95A6 6 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1a6 6 0 0 1-3.6-3.95A4 4 0 0 1 4 8V5h3zM6 7v1a2 2 0 0 0 1 1.73V7zm12 2.73A2 2 0 0 0 18 8V7h-1v2.73z" />
      </svg>
      {summary.unlocked}/{summary.total}
    </span>
  );
}

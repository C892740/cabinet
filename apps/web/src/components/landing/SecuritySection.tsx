"use client";

import { motion } from "framer-motion";
import { ArrowRightIcon, KeyIcon, LockIcon, UnlockIcon } from "./KeyIcon";
import { Reveal } from "../ui/Reveal";

const steps = [
  {
    icon: LockIcon,
    title: "admin.cabinet",
    caption: "AES-256-GCM encrypted at rest",
    accent: "from-rose-500 to-orange-500",
  },
  {
    icon: KeyIcon,
    title: "Master passphrase",
    caption: "scrypt-hardened, never stored",
    accent: "from-violet-500 to-indigo-500",
  },
  {
    icon: UnlockIcon,
    title: "Readable admin key",
    caption: "Unlocked in memory, on demand",
    accent: "from-emerald-400 to-teal-500",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-28 px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="glass overflow-hidden rounded-5xl">
          <div className="grid gap-14 p-10 sm:p-14 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white/75">
                <LockIcon size={14} className="text-rose-300" />
                Admin security
              </div>
              <h2 className="text-gradient text-4xl font-semibold tracking-[-0.03em] sm:text-[42px] sm:leading-[1.08]">
                A dashboard that stays locked until you say so.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-white/60">
                Both the web app and the Windows app gate the admin dashboard behind a
                key-password. The desktop app goes further: the key is stored in an
                encrypted vault that only opens with your master passphrase — and can be
                converted back to readable form exactly when you need it.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {["AES-256-GCM", "scrypt (N=2¹⁵)", "8-hour admin sessions", "No plaintext keys on disk"].map(
                  (badge) => (
                    <span key={badge} className="chip">
                      {badge}
                    </span>
                  ),
                )}
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, x: 24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                    className="glass glass-hover flex items-center gap-4 rounded-3xl p-5"
                  >
                    <span
                      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${step.accent} text-white shadow-glow`}
                    >
                      <step.icon size={22} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-tight text-white">
                        {step.title}
                      </p>
                      <p className="truncate text-sm text-white/55">{step.caption}</p>
                    </div>
                    {index < steps.length - 1 && (
                      <ArrowRightIcon size={18} className="ml-auto text-white/25" />
                    )}
                  </motion.div>
                ))}
                <p className="px-2 text-xs leading-relaxed text-white/40">
                  The vault uses authenticated encryption: a wrong passphrase or a tampered
                  file fails to open instead of producing a wrong key.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

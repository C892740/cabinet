"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Scroll-reveal wrapper with a soft, Apple-ish ease. Honours the user's
 * reduced-motion preference by rendering content statically.
 */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? undefined : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Springy hover lift used by cards and buttons. */
export const lift = {
  whileHover: { y: -6, scale: 1.015 },
  whileTap: { scale: 0.985 },
  transition: { type: "spring" as const, stiffness: 260, damping: 22 },
};

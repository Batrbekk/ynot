"use client";

import * as React from "react";
import { motion } from "motion/react";
import { fadeUp, viewportOnce } from "@/lib/motion";

/**
 * Wraps a homepage block with a scroll-triggered fade-up entrance.
 * Renders a `motion.div` that wraps children — semantically transparent.
 */
export function FadeUpOnScroll({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={fadeUp}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  );
}

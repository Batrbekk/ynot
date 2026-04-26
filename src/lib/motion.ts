/**
 * Shared motion tokens for the YNOT storefront.
 *
 * The premium feel calls for restrained, slightly slow easings — short enough
 * not to delay interaction, long enough to feel intentional. We standardise
 * on 3 durations and 1 default easing so every animated surface feels related.
 */

export const ease = {
  /** Default easing — out cubic; comfortable for both entrance and exit. */
  out: [0.22, 1, 0.36, 1] as const,
  /** Entrance easing for drawers — slightly more pronounced settle. */
  drawer: [0.32, 0.72, 0, 1] as const,
} as const;

export const duration = {
  /** Hover, micro, accordion. */
  fast: 0.2,
  /** Most overlays / fades. */
  base: 0.32,
  /** Drawer slide / page-level fades. */
  slow: 0.45,
} as const;

/** Default `viewport` config for scroll-triggered fade-ins. */
export const viewportOnce = { once: true, margin: "0px 0px -10% 0px" } as const;

/**
 * Reusable variants. Use as `initial="hidden"` `animate="visible"` or
 * `whileInView="visible"`.
 */
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: ease.out },
  },
} as const;

export const fade = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.base, ease: ease.out },
  },
} as const;

export const overlayBackdrop = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.base, ease: ease.out },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast, ease: ease.out },
  },
} as const;

export const drawerPanelLeft = {
  hidden: { x: "-100%" },
  visible: {
    x: 0,
    transition: { duration: duration.slow, ease: ease.drawer },
  },
  exit: {
    x: "-100%",
    transition: { duration: duration.base, ease: ease.out },
  },
} as const;

export const drawerPanelRight = {
  hidden: { x: "100%" },
  visible: {
    x: 0,
    transition: { duration: duration.slow, ease: ease.drawer },
  },
  exit: {
    x: "100%",
    transition: { duration: duration.base, ease: ease.out },
  },
} as const;

export const modalPanel = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.base, ease: ease.out },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: duration.fast, ease: ease.out },
  },
} as const;

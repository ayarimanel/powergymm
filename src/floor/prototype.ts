/**
 * Prototype switch: while presenting the app, the Floor never shows "Fermé".
 * Outside opening hours it plays a typical evening (18:30) so the crowd card and its chart stay visible.
 * Set to false to show the real "Fermé · ouvre à 6h" card again.
 */
export const PROTOTYPE_ALWAYS_OPEN = true;

/**
 * Prototype switch: the live crowd is visible without a first scan at the entrance.
 * Lets the Floor be shown away from the club, before the entrance QR exists.
 * Set to false to require the first check-in again (the "Affluence réservée aux membres" card).
 */
export const PROTOTYPE_SKIP_SCAN_GATE = true;

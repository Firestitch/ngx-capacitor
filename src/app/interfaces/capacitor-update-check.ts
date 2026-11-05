/** When the manifest is read: the launch, a return after the away swap or more, a quick return, or the timer while in front */
export type CapacitorUpdateMoment = 'launch' | 'away' | 'back' | 'timer';

/** The last time the app read its manifest, and what it found */
export interface CapacitorUpdateCheck {
  /** ISO 8601 */
  date: string;
  moment: CapacitorUpdateMoment;
  /** What the check found or did, in a line: "Up to date: running 4.0.2 (checksum 3fa9c1e0b2d4)" */
  result: string;
}

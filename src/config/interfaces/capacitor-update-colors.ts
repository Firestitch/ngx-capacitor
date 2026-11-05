/** The update screen's colors, as CSS colors. A blank one keeps its default. */
export interface CapacitorUpdateColors {
  /** The large glow behind the content, and the start of the progress bar */
  primary?: string;
  /** The smaller glows, and the end of the progress bar */
  accent?: string;
  /** The screen itself, and the Android status bar while it shows */
  background?: string;
}

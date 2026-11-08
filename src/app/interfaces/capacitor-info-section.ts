import { CapacitorInfoRow } from './capacitor-info-row';


/** One part of the App info dialog: its name, a line on how to read it, and its facts, in order */
export interface CapacitorInfoSection {
  name: string;
  /** The part's answer in a few words, shown large above its facts ("Store build", "Update 4.0.3"); only the part that leads has one */
  title?: string;
  note?: string;
  rows: CapacitorInfoRow[];
}

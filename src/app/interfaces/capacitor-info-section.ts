import { CapacitorInfoRow } from './capacitor-info-row';


/** One part of the App info dialog: its heading, a line on how to read it, and its facts, in order */
export interface CapacitorInfoSection {
  name: string;
  note?: string;
  rows: CapacitorInfoRow[];
}

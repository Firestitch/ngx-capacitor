/** One labelled fact in the App info dialog */
export interface CapacitorInfoRow {
  label: string;
  /** The fact as text; left out when the row is a checksum alone */
  value?: string;
  /**
   * A bundle's whole checksum, the SHA-256 of its zip. The dialog shows its first 12
   * characters, as Environment Manager and Deployment Manager list them, and all of it on a tap
   */
  checksum?: string;
}

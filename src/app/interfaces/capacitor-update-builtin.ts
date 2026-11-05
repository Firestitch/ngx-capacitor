/** The store build's own bundle, recorded while it runs: the floor every manifest is measured against */
export interface CapacitorUpdateBuiltin {
  /** Its assets/build.json date */
  build: string | null;
  /** Its assets/native.json level */
  nativeLevel: number;
}

/**
 * Something the updater did that changed the phone: a version downloaded, waiting,
 * put in, a return to the store build, a store update required, or a failure
 */
export type CapacitorUpdateEventKind = 'download' | 'ready' | 'apply' | 'store' | 'required' | 'fail' | 'error';

/** One entry of the updater's history on this phone, newest first */
export interface CapacitorUpdateEvent {
  /** ISO 8601 */
  date: string;
  kind: CapacitorUpdateEventKind;
  /** What happened, in a line: "Put in 4.2.1" */
  message: string;
}

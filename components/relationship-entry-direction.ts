export type EntryMode = 'parent-of' | 'child-of' | 'spouse-of';

/** The role of the other person, relative to the subject being edited. */
export function oppositeEntryMode(mode: EntryMode): EntryMode {
  return mode === 'parent-of' ? 'child-of' : mode === 'child-of' ? 'parent-of' : mode;
}

export function entrySubmissionMode(mode: EntryMode, perspective: 'new-person' | 'anchor-person'): EntryMode {
  return perspective === 'new-person' ? mode : oppositeEntryMode(mode);
}

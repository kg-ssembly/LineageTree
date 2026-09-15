/** Combine loaded relationships with server metadata without counting visible relatives twice. */
export function remainingRelativeIds(loadedHiddenIds: string[], recordedIds: string[] | undefined, visibleIds: Set<string>) {
  return [...new Set([...loadedHiddenIds, ...(recordedIds ?? [])])].filter(id => !visibleIds.has(id));
}

export function personRecordBelongsToTree(data: { treeMembershipIds?: unknown; treeId?: unknown }, treeId: string) {
  const membershipIds = Array.isArray(data.treeMembershipIds)
    ? data.treeMembershipIds.filter((value): value is string => typeof value === 'string')
    : [data.treeId].filter((value): value is string => typeof value === 'string');
  return membershipIds.includes(treeId);
}

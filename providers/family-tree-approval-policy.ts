export function shouldApplyApprovalImmediately(options: {
  eligibleApproverIds: string[];
  approvalsDisabled: boolean;
  forceImmediateApproval?: boolean;
}) {
  return Boolean(options.forceImmediateApproval) || options.approvalsDisabled || options.eligibleApproverIds.length === 0;
}

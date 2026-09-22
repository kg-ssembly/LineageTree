# Account retention and deletion

LineageTree records authenticated app activity at most once per day. Accounts are considered for automatic cleanup only when they:

- are older than the configured unused period (90 days by default);
- have no activity after the initial 24-hour registration session;
- have no tree membership, submitted family change, access request, or notification activity; and
- have an email address that can receive the deletion warning.

The scheduled `processUnusedAccounts` function runs daily at 03:00 UTC. Its parameters are Firebase Functions string parameters:

- `ACCOUNT_CLEANUP_MODE`: `report` (default), `warn`, or `delete`;
- `ACCOUNT_UNUSED_DAYS`: minimum 30, default 90; and
- `ACCOUNT_GRACE_DAYS`: minimum 14, default 30.

Keep production in `report` mode for at least two reviewed runs. `warn` sends the email and creates the grace-period record but never deletes an account. `delete` retains the same warning workflow and deletes only candidates whose grace period has elapsed and who still pass a fresh eligibility check.

Any authenticated app activity or newly detected product footprint cancels a pending deletion. Phone-only accounts are excluded until a dependable warning channel is implemented.

User-requested deletion is available under My Profile → App settings. Recent authentication is required. Self-service deletion is limited to unused accounts. Accounts with shared family activity must use the support route in the privacy policy so retained family history can be reviewed and anonymised safely.

import type { Auth, UserRecord } from 'firebase-admin/auth';
import { FieldValue, Timestamp, type Firestore, type Query } from 'firebase-admin/firestore';

export type AccountCleanupMode = 'report' | 'warn' | 'delete';

export interface UnusedAccountEvidence {
  createdAtMs: number;
  lastSignInAtMs?: number;
  lastActiveAtMs?: number;
  nowMs: number;
  unusedDays: number;
  hasProductFootprint: boolean;
  hasWarningChannel: boolean;
}

export interface UnusedAccountEvaluation {
  eligible: boolean;
  reason: 'eligible' | 'invalid-metadata' | 'too-new' | 'returned-after-registration' | 'product-footprint' | 'warning-channel-unavailable';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REGISTRATION_SESSION_MS = DAY_MS;

export function evaluateUnusedAccount(evidence: UnusedAccountEvidence): UnusedAccountEvaluation {
  if (!Number.isFinite(evidence.createdAtMs)
    || !Number.isFinite(evidence.nowMs)
    || !Number.isFinite(evidence.unusedDays)
    || (evidence.lastSignInAtMs != null && !Number.isFinite(evidence.lastSignInAtMs))
    || (evidence.lastActiveAtMs != null && !Number.isFinite(evidence.lastActiveAtMs))) {
    return { eligible: false, reason: 'invalid-metadata' };
  }
  if (!evidence.hasWarningChannel) return { eligible: false, reason: 'warning-channel-unavailable' };
  if (evidence.hasProductFootprint) return { eligible: false, reason: 'product-footprint' };
  if (evidence.createdAtMs > evidence.nowMs - evidence.unusedDays * DAY_MS) return { eligible: false, reason: 'too-new' };

  const latestActivity = Math.max(
    evidence.createdAtMs,
    evidence.lastSignInAtMs ?? evidence.createdAtMs,
    evidence.lastActiveAtMs ?? evidence.createdAtMs,
  );
  if (latestActivity > evidence.createdAtMs + REGISTRATION_SESSION_MS) {
    return { eligible: false, reason: 'returned-after-registration' };
  }

  return { eligible: true, reason: 'eligible' };
}

function millis(value: unknown): number | undefined {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return undefined;
}

async function queryHasDocument(query: Query) {
  return !(await query.limit(1).get()).empty;
}

async function deleteQuery(db: Firestore, query: Query) {
  let deleted = 0;
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return deleted;
    const batch = db.batch();
    snapshot.docs.forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
}

type WarningSender = (user: UserRecord, deletionDate: Date) => Promise<void>;

export class AccountLifecycleFunction {
  constructor(
    private readonly db: Firestore,
    private readonly auth: Auth,
    private readonly sendWarning: WarningSender,
  ) {}

  async markActive(userId: string) {
    await Promise.all([
      this.db.collection('users').doc(userId).set({
        lastActiveAt: FieldValue.serverTimestamp(),
        accountLifecycleStatus: 'active',
        deletionWarningSentAt: FieldValue.delete(),
        scheduledDeletionAt: FieldValue.delete(),
      }, { merge: true }),
      this.db.collection('accountLifecycle').doc(userId).delete(),
    ]);
  }

  async markMeaningfulUse(userId: string) {
    const userRef = this.db.collection('users').doc(userId);
    await this.db.runTransaction(async transaction => {
      const user = await transaction.get(userRef);
      transaction.set(userRef, {
        lastActiveAt: FieldValue.serverTimestamp(),
        accountLifecycleStatus: 'active',
        deletionWarningSentAt: FieldValue.delete(),
        scheduledDeletionAt: FieldValue.delete(),
        ...(user.data()?.firstMeaningfulUseAt ? {} : { firstMeaningfulUseAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
    });
    await this.db.collection('accountLifecycle').doc(userId).delete();
  }

  async hasProductFootprint(userId: string) {
    const checks = await Promise.all([
      queryHasDocument(this.db.collection('trees').where('memberIds', 'array-contains', userId)),
      queryHasDocument(this.db.collection('approvalRequests').where('requestedByUserId', '==', userId)),
      queryHasDocument(this.db.collection('notifications').where('requestedByUserId', '==', userId)),
      queryHasDocument(this.db.collection('notificationActivity').where('userId', '==', userId)),
    ]);
    return checks.some(Boolean);
  }

  async evaluate(user: UserRecord, nowMs: number, unusedDays: number) {
    const profile = await this.db.collection('users').doc(user.uid).get();
    const profileData = profile.data() ?? {};
    const hasProductFootprint = Boolean(profileData.firstMeaningfulUseAt || profileData.defaultTreeId)
      || await this.hasProductFootprint(user.uid);
    return evaluateUnusedAccount({
      createdAtMs: Date.parse(user.metadata.creationTime),
      lastSignInAtMs: user.metadata.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : undefined,
      lastActiveAtMs: millis(profileData.lastActiveAt),
      nowMs,
      unusedDays,
      hasProductFootprint,
      hasWarningChannel: Boolean(user.email?.trim()),
    });
  }

  async deleteAccount(userId: string, _email?: string) {
    const profile = await this.db.collection('users').doc(userId).get();
    const profileData = profile.data() ?? {};
    if (await this.hasProductFootprint(userId) || profileData.firstMeaningfulUseAt || profileData.defaultTreeId) {
      throw new Error('This account has shared family activity. Resolve current tree memberships, then contact support so shared history can be handled safely.');
    }

    await deleteQuery(this.db, this.db.collection('notifications').where('userId', '==', userId));
    await deleteQuery(this.db, this.db.collection('notifications').where('requestedByUserId', '==', userId));
    await deleteQuery(this.db, this.db.collection('notificationActivity').where('userId', '==', userId));
    await deleteQuery(this.db, this.db.collection('emailDeliveries').where('accountUserId', '==', userId));
    await this.db.collection('emailDeliveries').doc(`welcome-${userId}`).delete();
    await this.db.collection('users').doc(userId).delete();
    await this.auth.deleteUser(userId);
    await this.db.collection('accountLifecycle').doc(userId).delete();
  }

  async run(options: { mode: AccountCleanupMode; unusedDays: number; graceDays: number; now?: Date }) {
    const now = options.now ?? new Date();
    const summary = { scanned: 0, eligible: 0, warned: 0, deleted: 0, blocked: {} as Record<string, number> };
    let pageToken: string | undefined;

    do {
      const page = await this.auth.listUsers(500, pageToken);
      for (const user of page.users) {
        summary.scanned += 1;
        const evaluation = await this.evaluate(user, now.getTime(), options.unusedDays);
        if (!evaluation.eligible) {
          summary.blocked[evaluation.reason] = (summary.blocked[evaluation.reason] ?? 0) + 1;
          if (options.mode !== 'report' && (evaluation.reason === 'returned-after-registration' || evaluation.reason === 'product-footprint')) {
            const lifecycleRef = this.db.collection('accountLifecycle').doc(user.uid);
            if ((await lifecycleRef.get()).exists) {
              await Promise.all([
                lifecycleRef.delete(),
                this.db.collection('users').doc(user.uid).set({
                  accountLifecycleStatus: 'active',
                  deletionWarningSentAt: FieldValue.delete(),
                  scheduledDeletionAt: FieldValue.delete(),
                }, { merge: true }),
              ]);
            }
          }
          continue;
        }

        summary.eligible += 1;
        if (options.mode === 'report') continue;
        const lifecycleRef = this.db.collection('accountLifecycle').doc(user.uid);
        const lifecycle = await lifecycleRef.get();
        const scheduledDeletionAt = millis(lifecycle.data()?.scheduledDeletionAt);

        if (!scheduledDeletionAt) {
          const deletionDate = new Date(now.getTime() + options.graceDays * DAY_MS);
          await lifecycleRef.set({
            status: 'warning-pending',
            warnedAt: Timestamp.fromDate(now),
            scheduledDeletionAt: Timestamp.fromDate(deletionDate),
            policyVersion: 1,
          }, { merge: true });
          await this.sendWarning(user, deletionDate);
          await Promise.all([
            lifecycleRef.set({
              status: 'warned',
            }, { merge: true }),
            this.db.collection('users').doc(user.uid).set({
              accountLifecycleStatus: 'warned',
              deletionWarningSentAt: Timestamp.fromDate(now),
              scheduledDeletionAt: Timestamp.fromDate(deletionDate),
            }, { merge: true }),
          ]);
          summary.warned += 1;
          continue;
        }

        if (lifecycle.data()?.status === 'warning-pending') {
          const deletionDate = new Date(scheduledDeletionAt);
          await this.sendWarning(user, deletionDate);
          await Promise.all([
            lifecycleRef.set({ status: 'warned' }, { merge: true }),
            this.db.collection('users').doc(user.uid).set({
              accountLifecycleStatus: 'warned',
              deletionWarningSentAt: lifecycle.data()?.warnedAt ?? Timestamp.fromDate(now),
              scheduledDeletionAt: Timestamp.fromDate(deletionDate),
            }, { merge: true }),
          ]);
          summary.warned += 1;
          continue;
        }

        if (options.mode === 'delete' && scheduledDeletionAt <= now.getTime()) {
          const finalEvaluation = await this.evaluate(user, now.getTime(), options.unusedDays);
          if (finalEvaluation.eligible) {
            await this.deleteAccount(user.uid, user.email);
            summary.deleted += 1;
          }
        }
      }
      pageToken = page.pageToken;
    } while (pageToken);

    return summary;
  }
}

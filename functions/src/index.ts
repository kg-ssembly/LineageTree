import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import sgMail from '@sendgrid/mail';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import {
  buildInviteEmailTemplate,
  buildNotificationEmailTemplate,
  buildPasswordResetEmailTemplate,
  buildAccountCreatedEmailTemplate,
} from '../../constants/email-templates';
import { ApprovalDecisionFunction } from './services/approval-decision-function';
import { MergeReviewFunction } from './services/merge-review-function';
import { TreeDeletionFunction } from './services/tree-deletion-function';

initializeApp();

const db = getFirestore();
const adminAuth = getAuth();
const approvalDecisionFunction = new ApprovalDecisionFunction(db);
const mergeReviewFunction = new MergeReviewFunction(db);
const treeDeletionFunction = new TreeDeletionFunction(db);

const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');
const SENDGRID_FROM_EMAIL = defineString('SENDGRID_FROM_EMAIL');
const SENDGRID_FROM_NAME = defineString('SENDGRID_FROM_NAME');
const APP_BASE_URL = defineString('APP_BASE_URL');
const SUPPORT_EMAIL = defineString('SUPPORT_EMAIL');
const EMAIL_LOGO_URL = defineString('EMAIL_LOGO_URL');

type UserRecordShape = {
  email?: string;
  displayName?: string;
};

type TreeCollaboratorShape = {
  userId?: string;
  role?: string;
};

type TreeRecordShape = {
  name?: string;
  ownerId?: string;
  ownerDisplayName?: string;
  editorIds?: string[];
  collaborators?: TreeCollaboratorShape[];
};

type AppNotificationShape = {
  userId?: string;
  type?: string;
  requestedByLabel?: string;
  sourceTreeName?: string;
  message?: string;
  status?: string;
};

function now() {
  return Timestamp.now();
}

function getStringParam(param: ReturnType<typeof defineString>, fallback = '') {
  const value = param.value();
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeBaseUrl() {
  return getStringParam(APP_BASE_URL, 'https://lineagetree.web.app').replace(/\/+$/, '');
}

function buildBranding() {
  return {
    appName: 'Lineage Tree',
    supportEmail: getStringParam(SUPPORT_EMAIL, 'support@lineagetree.app'),
    logoUrl: getStringParam(EMAIL_LOGO_URL),
  };
}

function buildLoginUrl() {
  return `${normalizeBaseUrl()}/login`;
}

function buildAppHomeUrl() {
  return `${normalizeBaseUrl()}/`;
}

function setSendGridKey() {
  sgMail.setApiKey(SENDGRID_API_KEY.value());
}

async function recordDelivery(id: string, payload: Record<string, unknown>) {
  await db.collection('emailDeliveries').doc(id).set({
    ...payload,
    updatedAt: now(),
  }, { merge: true });
}

async function sendTransactionalEmail(options: {
  deliveryId?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  category: string;
}) {
  const fromEmail = getStringParam(SENDGRID_FROM_EMAIL);
  if (!fromEmail) {
    throw new HttpsError('failed-precondition', 'SENDGRID_FROM_EMAIL is not configured.');
  }

  const fromName = getStringParam(SENDGRID_FROM_NAME, 'Lineage Tree');
  const deliveryRef = options.deliveryId ? db.collection('emailDeliveries').doc(options.deliveryId) : null;
  if (deliveryRef) {
    const existing = await deliveryRef.get();
    if (existing.exists && existing.data()?.status === 'sent') {
      return { deduplicated: true };
    }
  }

  setSendGridKey();
  await sgMail.send({
    to: options.to,
    from: {
      email: fromEmail,
      name: fromName,
    },
    replyTo: {
      email: getStringParam(SUPPORT_EMAIL, fromEmail),
      name: getStringParam(SENDGRID_FROM_NAME, 'Lineage Tree'),
    },
    subject: options.subject,
    html: options.html,
    text: options.text,
    categories: [options.category],
  });

  if (options.deliveryId) {
    await recordDelivery(options.deliveryId, {
      category: options.category,
      status: 'sent',
      to: options.to,
      subject: options.subject,
      sentAt: now(),
    });
  }

  return { deduplicated: false };
}

async function getUserById(userId: string) {
  const snapshot = await db.collection('users').doc(userId).get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'The user record could not be found.');
  }

  return snapshot.data() as UserRecordShape;
}

async function getTreeById(treeId: string) {
  const snapshot = await db.collection('trees').doc(treeId).get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'The family tree could not be found.');
  }

  return snapshot.data() as TreeRecordShape;
}

function assertAuthenticated(uid?: string) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  }
}

function isTreeEditor(tree: TreeRecordShape, userId: string) {
  return Array.isArray(tree.editorIds) && tree.editorIds.includes(userId);
}

function roleLabel(role?: string) {
  if (!role) {
    return 'Viewer';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export const sendWelcomeEmail = onCall(
  {
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);

    const user = await getUserById(request.auth!.uid);
    if (!user.email) {
      throw new HttpsError('failed-precondition', 'The signed-in account does not have an email address.');
    }

    const template = buildAccountCreatedEmailTemplate({
      ...buildBranding(),
      recipientName: user.displayName,
      loginUrl: buildAppHomeUrl(),
    });

    await sendTransactionalEmail({
      deliveryId: `welcome-${request.auth!.uid}`,
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      category: 'welcome',
    });

    return { ok: true };
  },
);

export const sendTreeInviteEmail = onCall(
  {
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const treeId = typeof request.data?.treeId === 'string' ? request.data.treeId.trim() : '';
    const collaboratorUserId = typeof request.data?.collaboratorUserId === 'string' ? request.data.collaboratorUserId.trim() : '';

    if (!treeId || !collaboratorUserId) {
      throw new HttpsError('invalid-argument', 'treeId and collaboratorUserId are required.');
    }

    const [tree, recipient, actor] = await Promise.all([
      getTreeById(treeId),
      getUserById(collaboratorUserId),
      getUserById(request.auth!.uid),
    ]);

    if (!isTreeEditor(tree, request.auth!.uid)) {
      throw new HttpsError('permission-denied', 'Only a tree editor can send invite emails.');
    }

    const collaborator = Array.isArray(tree.collaborators)
      ? tree.collaborators.find((entry) => entry?.userId === collaboratorUserId)
      : null;
    if (!collaborator || !recipient.email) {
      throw new HttpsError('failed-precondition', 'The collaborator could not be resolved for email delivery.');
    }

    const template = buildInviteEmailTemplate({
      ...buildBranding(),
      inviterName: actor.displayName || tree.ownerDisplayName || 'A Lineage Tree collaborator',
      recipientName: recipient.displayName,
      treeName: tree.name || 'your family tree',
      inviteUrl: buildLoginUrl(),
      roleLabel: roleLabel(collaborator.role),
    });

    await sendTransactionalEmail({
      to: recipient.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      category: 'tree-invite',
    });

    return { ok: true };
  },
);

export const sendPasswordResetEmail = onCall(
  {
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
  },
  async (request) => {
    const email = typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : '';
    if (!email) {
      throw new HttpsError('invalid-argument', 'An email address is required.');
    }

    try {
      const resetUrl = await adminAuth.generatePasswordResetLink(email);
      const template = buildPasswordResetEmailTemplate({
        ...buildBranding(),
        resetUrl,
        expiresIn: '1 hour',
      });

      await sendTransactionalEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        category: 'password-reset',
      });

      return { ok: true, emailRegistered: true };
    } catch (error: any) {
      const authCode = typeof error?.code === 'string' ? error.code : '';
      if (authCode === 'auth/user-not-found') {
        return { ok: true, emailRegistered: false };
      }

      throw error;
    }
  },
);

export const sendNotificationEmailOnCreate = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const notification = snapshot.data() as AppNotificationShape;
    if (notification.type !== 'merge-invite' || notification.status !== 'pending' || !notification.userId) {
      return;
    }

    const recipient = await getUserById(notification.userId);
    if (!recipient.email) {
      return;
    }

    const template = buildNotificationEmailTemplate({
      ...buildBranding(),
      recipientName: recipient.displayName,
      title: 'You have a merge invitation',
      summary: notification.message || 'A Lineage Tree collaborator invited you to review a merge.',
      actionLabel: 'Review Invitation',
      actionUrl: buildAppHomeUrl(),
      metadata: [
        { label: 'Invited by', value: notification.requestedByLabel || 'A collaborator' },
        { label: 'Source tree', value: notification.sourceTreeName || 'Family tree' },
      ],
    });

    await sendTransactionalEmail({
      deliveryId: `notification-${event.params.notificationId}`,
      to: recipient.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      category: 'notification',
    });
  },
);

export const reviewMergeRequestServer = onCall(
  {
    region: 'us-central1',
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);

    const requestId = typeof request.data?.requestId === 'string' ? request.data.requestId.trim() : '';
    const decision = request.data?.decision;
    const comment = typeof request.data?.comment === 'string' ? request.data.comment : '';
    const conflictChoices = Array.isArray(request.data?.conflictChoices) ? request.data.conflictChoices : [];
    const selectedMatchIds = Array.isArray(request.data?.selectedMatchIds)
      ? request.data.selectedMatchIds.filter((value: unknown): value is string => typeof value === 'string')
      : undefined;

    if (!requestId || (decision !== 'approve' && decision !== 'reject' && decision !== 'request-changes')) {
      throw new HttpsError('invalid-argument', 'A valid merge review payload is required.');
    }

    return mergeReviewFunction.review(request.auth!.uid, {
      requestId,
      decision,
      comment,
      conflictChoices,
      selectedMatchIds,
    });
  },
);

export const decideApprovalRequestServer = onCall(
  {
    region: 'us-central1',
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);

    const requestId = typeof request.data?.requestId === 'string' ? request.data.requestId.trim() : '';
    const decision = request.data?.decision;
    const auto = request.data?.auto === true;

    if (!requestId || (decision !== 'approve' && decision !== 'reject')) {
      throw new HttpsError('invalid-argument', 'A valid approval decision payload is required.');
    }

    return approvalDecisionFunction.decide(request.auth!.uid, requestId, decision, auto);
  },
);

export const processExpiredApprovalRequestsServer = onCall(
  {
    region: 'us-central1',
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);

    const treeId = typeof request.data?.treeId === 'string' ? request.data.treeId.trim() : '';
    if (!treeId) {
      throw new HttpsError('invalid-argument', 'treeId is required.');
    }

    return approvalDecisionFunction.processExpired(request.auth!.uid, treeId);
  },
);

export const deleteTreeServer = onCall(
  {
    region: 'us-central1',
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);

    const treeId = typeof request.data?.treeId === 'string' ? request.data.treeId.trim() : '';
    if (!treeId) {
      throw new HttpsError('invalid-argument', 'treeId is required.');
    }

    return treeDeletionFunction.deleteTree(request.auth!.uid, treeId);
  },
);

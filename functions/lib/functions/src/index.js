"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireApprovalRequests = exports.respondToTreeAccessServer = exports.requestTreeAccessServer = exports.archivePersonServer = exports.restorePersonServer = exports.deleteTreeServer = exports.processExpiredApprovalRequestsServer = exports.decideApprovalRequestServer = exports.reviewMergeRequestServer = exports.createMergeRequestServer = exports.sendNotificationEmailOnCreate = exports.sendMagicLinkEmail = exports.sendPasswordResetEmail = exports.sendTreeInviteEmail = exports.sendWelcomeEmail = exports.lookupAccountServer = exports.searchTreeDirectoryServer = exports.submitFamilyChangeServer = exports.unlinkProfilesServer = exports.proposeLinkedProfileUpdates = exports.manageCollaboratorServer = exports.readTreeGraphServer = exports.createSurnameTreeServer = exports.createTreeServer = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const tree_directory_function_1 = require("./services/tree-directory-function");
const request_limits_1 = require("./services/request-limits");
const approval_submission_function_1 = require("./services/approval-submission-function");
const tree_graph_function_1 = require("./services/tree-graph-function");
const tree_creation_function_1 = require("./services/tree-creation-function");
const collaborator_function_1 = require("./services/collaborator-function");
const tree_access_function_1 = require("./services/tree-access-function");
const person_recovery_function_1 = require("./services/person-recovery-function");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const mail_1 = __importDefault(require("@sendgrid/mail"));
const firestore_2 = require("firebase-functions/v2/firestore");
const linked_profile_function_1 = require("./services/linked-profile-function");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const email_templates_1 = require("../../constants/email-templates");
const approval_decision_function_1 = require("./services/approval-decision-function");
const merge_review_function_1 = require("./services/merge-review-function");
const tree_deletion_function_1 = require("./services/tree-deletion-function");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const adminAuth = (0, auth_1.getAuth)();
const approvalDecisionFunction = new approval_decision_function_1.ApprovalDecisionFunction(db);
const mergeReviewFunction = new merge_review_function_1.MergeReviewFunction(db);
const treeDeletionFunction = new tree_deletion_function_1.TreeDeletionFunction(db);
exports.createTreeServer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to create a tree.');
    return (0, tree_creation_function_1.createTreeRecord)(db, request.auth.uid, request.data ?? {});
});
exports.createSurnameTreeServer = (0, https_1.onCall)({ region: 'us-central1', timeoutSeconds: 540 }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to create a tree.');
    return (0, tree_creation_function_1.createSurnameTree)(db, request.auth.uid, String(request.data?.sourceTreeId ?? ''), String(request.data?.surname ?? ''));
});
exports.readTreeGraphServer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to view a family tree.');
    return (0, tree_graph_function_1.readTreeGraph)(db, request.auth.uid, request.data ?? {});
});
exports.manageCollaboratorServer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to manage collaborators.');
    return (0, collaborator_function_1.manageCollaborator)(db, request.auth.uid, request.data ?? {});
});
exports.proposeLinkedProfileUpdates = (0, firestore_2.onDocumentUpdated)({ document: 'persons/{personId}', region: 'us-central1', retry: true }, async (event) => {
    if (event.data)
        await (0, linked_profile_function_1.proposeLinkedUpdates)(db, event.params.personId, event.data.before.data(), event.data.after.data(), event.id);
});
exports.unlinkProfilesServer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to unlink profiles.');
    await (0, linked_profile_function_1.unlinkProfiles)(db, request.auth.uid, String(request.data?.requestId ?? ''));
    return { ok: true };
});
exports.submitFamilyChangeServer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to submit a change.');
    return new approval_submission_function_1.ApprovalSubmissionFunction(db).submit(request.auth.uid, request.data);
});
exports.searchTreeDirectoryServer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to find a tree.');
    return (0, tree_directory_function_1.searchTreeDirectory)(db, request.auth.uid, request.data ?? {});
});
exports.lookupAccountServer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to find an account.');
    return (0, tree_directory_function_1.lookupAccount)(db, request.auth.uid, request.data ?? {});
});
const SENDGRID_API_KEY = (0, params_1.defineSecret)('SENDGRID_API_KEY');
const SENDGRID_FROM_EMAIL = (0, params_1.defineString)('SENDGRID_FROM_EMAIL');
const SENDGRID_FROM_NAME = (0, params_1.defineString)('SENDGRID_FROM_NAME');
const APP_BASE_URL = (0, params_1.defineString)('APP_BASE_URL');
const SUPPORT_EMAIL = (0, params_1.defineString)('SUPPORT_EMAIL');
const EMAIL_LOGO_URL = (0, params_1.defineString)('EMAIL_LOGO_URL');
function now() {
    return firestore_1.Timestamp.now();
}
function getStringParam(param, fallback = '') {
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
    mail_1.default.setApiKey(SENDGRID_API_KEY.value());
}
async function recordDelivery(id, payload) {
    await db.collection('emailDeliveries').doc(id).set({
        ...payload,
        updatedAt: now(),
    }, { merge: true });
}
async function sendTransactionalEmail(options) {
    const fromEmail = getStringParam(SENDGRID_FROM_EMAIL);
    if (!fromEmail) {
        throw new https_1.HttpsError('failed-precondition', 'SENDGRID_FROM_EMAIL is not configured.');
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
    await mail_1.default.send({
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
async function getUserById(userId) {
    const snapshot = await db.collection('users').doc(userId).get();
    if (!snapshot.exists) {
        throw new https_1.HttpsError('not-found', 'The user record could not be found.');
    }
    return snapshot.data();
}
async function getTreeById(treeId) {
    const snapshot = await db.collection('trees').doc(treeId).get();
    if (!snapshot.exists) {
        throw new https_1.HttpsError('not-found', 'The family tree could not be found.');
    }
    return snapshot.data();
}
function assertAuthenticated(uid) {
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in to perform this action.');
    }
}
function isTreeEditor(tree, userId) {
    return Array.isArray(tree.editorIds) && tree.editorIds.includes(userId);
}
function roleLabel(role) {
    if (!role) {
        return 'Viewer';
    }
    return role.charAt(0).toUpperCase() + role.slice(1);
}
exports.sendWelcomeEmail = (0, https_1.onCall)({
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
}, async (request) => {
    assertAuthenticated(request.auth?.uid);
    const user = await getUserById(request.auth.uid);
    if (!user.email) {
        throw new https_1.HttpsError('failed-precondition', 'The signed-in account does not have an email address.');
    }
    const template = (0, email_templates_1.buildAccountCreatedEmailTemplate)({
        ...buildBranding(),
        recipientName: user.displayName,
        loginUrl: buildAppHomeUrl(),
    });
    await sendTransactionalEmail({
        deliveryId: `welcome-${request.auth.uid}`,
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        category: 'welcome',
    });
    return { ok: true };
});
exports.sendTreeInviteEmail = (0, https_1.onCall)({
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
}, async (request) => {
    assertAuthenticated(request.auth?.uid);
    const treeId = typeof request.data?.treeId === 'string' ? request.data.treeId.trim() : '';
    const collaboratorUserId = typeof request.data?.collaboratorUserId === 'string' ? request.data.collaboratorUserId.trim() : '';
    if (!treeId || !collaboratorUserId) {
        throw new https_1.HttpsError('invalid-argument', 'treeId and collaboratorUserId are required.');
    }
    const [tree, recipient, actor] = await Promise.all([
        getTreeById(treeId),
        getUserById(collaboratorUserId),
        getUserById(request.auth.uid),
    ]);
    if (!isTreeEditor(tree, request.auth.uid)) {
        throw new https_1.HttpsError('permission-denied', 'Only a tree editor can send invite emails.');
    }
    const collaborator = Array.isArray(tree.collaborators)
        ? tree.collaborators.find((entry) => entry?.userId === collaboratorUserId)
        : null;
    if (!collaborator || !recipient.email) {
        throw new https_1.HttpsError('failed-precondition', 'The collaborator could not be resolved for email delivery.');
    }
    const template = (0, email_templates_1.buildInviteEmailTemplate)({
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
});
exports.sendPasswordResetEmail = (0, https_1.onCall)({
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
}, async (request) => {
    const email = typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : '';
    if (!email) {
        throw new https_1.HttpsError('invalid-argument', 'An email address is required.');
    }
    await (0, request_limits_1.consumeLimit)(db, 'password-reset-address', email, 3, 3_600_000);
    await (0, request_limits_1.consumeLimit)(db, 'password-reset-origin', request.rawRequest.ip ?? 'unknown', 10, 3_600_000);
    try {
        const resetUrl = await adminAuth.generatePasswordResetLink(email);
        const template = (0, email_templates_1.buildPasswordResetEmailTemplate)({
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
        return { ok: true };
    }
    catch (error) {
        const authCode = typeof error?.code === 'string' ? error.code : '';
        if (authCode === 'auth/user-not-found') {
            return { ok: true };
        }
        throw error;
    }
});
exports.sendMagicLinkEmail = (0, https_1.onCall)({
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
}, async (request) => {
    const email = typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
        throw new https_1.HttpsError('invalid-argument', 'A valid email address is required.');
    }
    await (0, request_limits_1.consumeLimit)(db, 'magic-link-address', email, 3, 3_600_000);
    await (0, request_limits_1.consumeLimit)(db, 'magic-link-origin', request.rawRequest.ip ?? 'unknown', 10, 3_600_000);
    const signInUrl = await adminAuth.generateSignInWithEmailLink(email, {
        url: `${normalizeBaseUrl()}/login`,
        handleCodeInApp: true,
    });
    const template = (0, email_templates_1.buildMagicLinkEmailTemplate)({
        ...buildBranding(),
        signInUrl,
        expiresIn: '1 hour',
    });
    await sendTransactionalEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        category: 'magic-link',
    });
    return { ok: true };
});
exports.sendNotificationEmailOnCreate = (0, firestore_2.onDocumentCreated)({
    document: 'notifications/{notificationId}',
    region: 'us-central1',
    secrets: [SENDGRID_API_KEY],
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const notification = snapshot.data();
    if (notification.type !== 'merge-invite' || notification.status !== 'pending' || !notification.userId) {
        return;
    }
    const recipient = await getUserById(notification.userId);
    if (!recipient.email) {
        return;
    }
    const template = (0, email_templates_1.buildNotificationEmailTemplate)({
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
});
exports.createMergeRequestServer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    assertAuthenticated(request.auth?.uid);
    const sourceTreeId = typeof request.data?.sourceTreeId === 'string' ? request.data.sourceTreeId.trim() : '';
    const targetTreeId = typeof request.data?.targetTreeId === 'string' ? request.data.targetTreeId.trim() : '';
    if (!sourceTreeId || !targetTreeId || sourceTreeId.includes('/') || targetTreeId.includes('/') || sourceTreeId === targetTreeId) {
        throw new https_1.HttpsError('invalid-argument', 'Choose two different trees before starting a merge.');
    }
    return mergeReviewFunction.create(request.auth.uid, sourceTreeId, targetTreeId);
});
exports.reviewMergeRequestServer = (0, https_1.onCall)({
    region: 'us-central1',
}, async (request) => {
    assertAuthenticated(request.auth?.uid);
    const requestId = typeof request.data?.requestId === 'string' ? request.data.requestId.trim() : '';
    const decision = request.data?.decision;
    const comment = typeof request.data?.comment === 'string' ? request.data.comment : '';
    const conflictChoices = Array.isArray(request.data?.conflictChoices) ? request.data.conflictChoices : [];
    const selectedMatchIds = Array.isArray(request.data?.selectedMatchIds)
        ? request.data.selectedMatchIds.filter((value) => typeof value === 'string')
        : undefined;
    if (!requestId || (decision !== 'approve' && decision !== 'reject' && decision !== 'request-changes')) {
        throw new https_1.HttpsError('invalid-argument', 'A valid merge review payload is required.');
    }
    return mergeReviewFunction.review(request.auth.uid, {
        requestId,
        decision,
        comment,
        conflictChoices,
        selectedMatchIds,
    });
});
exports.decideApprovalRequestServer = (0, https_1.onCall)({
    region: 'us-central1',
}, async (request) => {
    assertAuthenticated(request.auth?.uid);
    const requestId = typeof request.data?.requestId === 'string' ? request.data.requestId.trim() : '';
    const decision = request.data?.decision;
    if (request.data?.auto === true) {
        throw new https_1.HttpsError('permission-denied', 'Automatic decisions are performed by the scheduler.');
    }
    if (!requestId || (decision !== 'approve' && decision !== 'reject')) {
        throw new https_1.HttpsError('invalid-argument', 'A valid approval decision payload is required.');
    }
    return approvalDecisionFunction.decide(request.auth.uid, requestId, decision);
});
exports.processExpiredApprovalRequestsServer = (0, https_1.onCall)({
    region: 'us-central1',
}, async (request) => {
    assertAuthenticated(request.auth?.uid);
    const treeId = typeof request.data?.treeId === 'string' ? request.data.treeId.trim() : '';
    if (!treeId) {
        throw new https_1.HttpsError('invalid-argument', 'treeId is required.');
    }
    return approvalDecisionFunction.processExpired(request.auth.uid, treeId);
});
exports.deleteTreeServer = (0, https_1.onCall)({
    region: 'us-central1',
}, async (request) => {
    assertAuthenticated(request.auth?.uid);
    const treeId = typeof request.data?.treeId === 'string' ? request.data.treeId.trim() : '';
    if (!treeId) {
        throw new https_1.HttpsError('invalid-argument', 'treeId is required.');
    }
    return treeDeletionFunction.deleteTree(request.auth.uid, treeId);
});
exports.restorePersonServer = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to restore a person.');
    return (0, person_recovery_function_1.restoreDeletedPerson)(db, request.auth.uid, String(request.data?.treeId ?? ''), String(request.data?.personId ?? ''), request.data?.restoreLinks !== false);
});
exports.archivePersonServer = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to remove a person.');
    const treeId = String(request.data?.treeId ?? '');
    const personId = String(request.data?.personId ?? '');
    if (!treeId || !personId || treeId.includes('/') || personId.includes('/'))
        throw new https_1.HttpsError('invalid-argument', 'Choose a person.');
    return (0, person_recovery_function_1.archivePerson)(db, treeId, personId, request.auth.uid);
});
exports.requestTreeAccessServer = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to request access.');
    return (0, tree_access_function_1.requestTreeAccess)(db, request.auth.uid, String(request.data?.treeId ?? ''));
});
exports.respondToTreeAccessServer = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to respond.');
    return (0, tree_access_function_1.respondToAccess)(db, request.auth.uid, String(request.data?.notificationId ?? ''), String(request.data?.status ?? ''));
});
exports.expireApprovalRequests = (0, scheduler_1.onSchedule)({ schedule: "every 5 minutes", timeZone: "UTC", timeoutSeconds: 540, maxInstances: 1, retryCount: 3 }, async () => {
    await approvalDecisionFunction.processScheduledExpirations();
});

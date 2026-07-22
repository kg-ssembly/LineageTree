"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTreeServer = exports.processExpiredApprovalRequestsServer = exports.decideApprovalRequestServer = exports.reviewMergeRequestServer = exports.sendNotificationEmailOnCreate = exports.sendPasswordResetEmail = exports.sendTreeInviteEmail = exports.sendWelcomeEmail = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const mail_1 = __importDefault(require("@sendgrid/mail"));
const firestore_2 = require("firebase-functions/v2/firestore");
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
        return { ok: true, emailRegistered: true };
    }
    catch (error) {
        const authCode = typeof error?.code === 'string' ? error.code : '';
        if (authCode === 'auth/user-not-found') {
            return { ok: true, emailRegistered: false };
        }
        throw error;
    }
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
    const auto = request.data?.auto === true;
    if (!requestId || (decision !== 'approve' && decision !== 'reject')) {
        throw new https_1.HttpsError('invalid-argument', 'A valid approval decision payload is required.');
    }
    return approvalDecisionFunction.decide(request.auth.uid, requestId, decision, auto);
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

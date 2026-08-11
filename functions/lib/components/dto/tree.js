"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTreeKinshipSystem = getTreeKinshipSystem;
exports.getTreeRole = getTreeRole;
exports.canManageTree = canManageTree;
exports.canEditTreeContent = canEditTreeContent;
exports.canSetDefaultTree = canSetDefaultTree;
exports.isTreeDiscoverable = isTreeDiscoverable;
exports.treeNeedsDiscoverabilityChoice = treeNeedsDiscoverabilityChoice;
exports.getAssignedPersonId = getAssignedPersonId;
exports.getAssignedUserIdForPerson = getAssignedUserIdForPerson;
exports.isAssignedPersonForUser = isAssignedPersonForUser;
exports.getUnlinkedCollaborators = getUnlinkedCollaborators;
exports.getTreeApprovalWindowHours = getTreeApprovalWindowHours;
function getTreeKinshipSystem(tree) {
    const system = tree?.kinshipSystem ?? 'auto';
    return system === 'northern-sotho' ? 'nso' : system;
}
function getTreeRole(tree, userId) {
    if (!userId) {
        return null;
    }
    if (tree.ownerId === userId) {
        return 'owner';
    }
    return tree.collaborators.find((collaborator) => collaborator.userId === userId)?.role ?? null;
}
function canManageTree(tree, userId) {
    return !!userId && tree.ownerId === userId;
}
function canEditTreeContent(tree, userId) {
    return !!userId && tree.editorIds.includes(userId);
}
function canSetDefaultTree(tree, userId) {
    const role = getTreeRole(tree, userId);
    return role !== null && role !== 'viewer';
}
function isTreeDiscoverable(tree) {
    return tree?.discoverable === true;
}
function treeNeedsDiscoverabilityChoice(tree) {
    return tree?.discoverable == null;
}
function getAssignedPersonId(tree, userId) {
    if (!userId) {
        return null;
    }
    return tree.personAssignments[userId] ?? null;
}
function getAssignedUserIdForPerson(tree, personId) {
    if (!personId) {
        return null;
    }
    return Object.entries(tree.personAssignments).find(([, assignedPersonId]) => assignedPersonId === personId)?.[0] ?? null;
}
function isAssignedPersonForUser(tree, personId, userId) {
    return !!personId && getAssignedPersonId(tree, userId) === personId;
}
function getUnlinkedCollaborators(tree) {
    const linkedUserIds = new Set(Object.keys(tree.personAssignments));
    return tree.collaborators.filter((collaborator) => !linkedUserIds.has(collaborator.userId));
}
function getTreeApprovalWindowHours(tree) {
    const nextValue = Number(tree?.approvalWindowHours ?? 24);
    if (!Number.isFinite(nextValue)) {
        return 24;
    }
    return Math.max(0, Math.min(168, Math.round(nextValue)));
}

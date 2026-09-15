import { httpsCallable } from 'firebase/functions';
import type { CollaboratorRole } from '../components/dto/tree';
import { functionsApi } from './firebase-provider';

export async function addCollaboratorToTree(actorUserId: string, treeId: string, email: string, role: CollaboratorRole) {
  await httpsCallable(functionsApi, 'manageCollaboratorServer')({ treeId, action: 'add', email, role });
}

export async function removeCollaboratorFromTree(actorUserId: string, treeId: string, collaboratorUserId: string) {
  await httpsCallable(functionsApi, 'manageCollaboratorServer')({ treeId, action: 'remove', userId: collaboratorUserId });
}

export async function assignTreePersonToUser(actorUserId: string, treeId: string, userId: string, personId: string) {
  await httpsCallable(functionsApi, 'manageCollaboratorServer')({ treeId, action: 'assign', userId, personId });
}

export async function clearTreePersonAssignment(treeId: string, userId: string) {
  await httpsCallable(functionsApi, 'manageCollaboratorServer')({ treeId, action: 'clear-assignment', userId });
}

export type AppNotificationType = 'merge-invite';
export type AppNotificationStatus = 'pending' | 'accepted' | 'dismissed';

export interface AppNotification {
  id: string;
  userId: string;
  type: AppNotificationType;
  status: AppNotificationStatus;
  requestedByUserId: string;
  requestedByLabel: string;
  sourceTreeId: string;
  sourceTreeName: string;
  targetIdentifier: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
  seenAt?: string;
  openedAt?: string;
}

export interface NotificationActivityState {
  id: string;
  userId: string;
  sourceKind: 'approval' | 'merge-request' | 'merge-history' | 'membership';
  sourceId: string;
  actionedAt?: string;
  createdAt: string;
  updatedAt: string;
}

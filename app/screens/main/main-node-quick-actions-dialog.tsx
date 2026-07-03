import React from 'react';
import type { useMainScreenController } from './main-controller';
import { TreeDetailNodeQuickActionsDialog } from '../profile-shared';

export function MainNodeQuickActionsDialog({
  controller,
}: {
  controller: ReturnType<typeof useMainScreenController>;
}) {
  return (
    <TreeDetailNodeQuickActionsDialog
      visible={controller.nodeQuickActionState.visible}
      person={controller.nodeQuickActionState.person}
      theme={controller.theme}
      t={controller.t}
      canEdit={controller.canEdit}
      mutating={controller.mutating}
      closeNodeQuickActions={controller.closeNodeQuickActions}
      openPersonProfile={controller.openPersonProfile}
      openCreateRelativeDialog={controller.openCreateRelativeDialog}
      crossSurnameChildIds={controller.crossSurnameChildIds}
      canvasActiveFamilyRef={controller.sharedTabProps?.activeFamilyRef ?? { current: null }}
      canvasFamilySwitchRef={controller.sharedTabProps?.familySwitchRef ?? { current: null }}
      onOpenMaidenFamilyTree={controller.handleOpenMaidenFamilyTree}
    />
  );
}

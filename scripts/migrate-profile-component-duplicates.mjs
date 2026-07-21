import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const replacements = [
  [
    'app/screens/person-profile/person-profile-view.tsx',
    [
      [
        "import { PersonNotesDialog } from './dialogs/notes-dialog';\nimport { PersonPhotoViewerModal } from './dialogs/photo-viewer-modal';\nimport { PersonLineageSection } from './sections/lineage-section';\nimport { MemberProfileSection } from './sections/member-profile-section';\nimport { PersonMemoriesSection, type PersonMemorySectionTabKey } from './sections/memories-section';\nimport { PersonRelationshipsSection, type PersonRelationshipSectionTabKey } from './sections/relationships-section';",
        "import {\n  PersonLineageSection,\n  PersonMemoriesSection,\n  PersonNotesDialog,\n  PersonPhotoViewerModal,\n  PersonRelationshipsSection,\n  type PersonMemorySectionTabKey,\n  type PersonRelationshipSectionTabKey,\n} from '../profile-shared';\nimport { MemberProfileSection } from './sections/member-profile-section';",
      ],
    ],
  ],
  [
    'app/screens/tree-detail/tree-detail-view.tsx',
    [
      [
        "import { TreeDetailNodeQuickActionsDialog } from './tree-detail-node-quick-actions-dialog';",
        "import { TreeDetailNodeQuickActionsDialog } from '../profile-shared';",
      ],
    ],
  ],
  [
    'app/screens/my-profile/my-profile-view.tsx',
    [
      [
        "import { NotesDialog } from './dialogs/notes-dialog';\nimport { PhotoViewerModal } from './dialogs/photo-viewer-modal';\nimport { AppSettingsSection, type UserProfileTabProps } from './sections/app-settings-section';\nimport { LineageSection } from './sections/lineage-section';\nimport { MemoriesSection, type MemorySectionTabKey } from './sections/memories-section';\nimport { ProfileOverviewSection } from './sections/profile-overview-section';\nimport { ProfileHeroSection } from './sections/profile-hero-section';\nimport { RelationshipsSection, type RelationshipSectionTabKey } from './sections/relationships-section';",
        "import { AppSettingsSection, type UserProfileTabProps } from './sections/app-settings-section';\nimport {\n  PersonLineageSection as LineageSection,\n  PersonMemoriesSection as MemoriesSection,\n  PersonNotesDialog as NotesDialog,\n  PersonPhotoViewerModal as PhotoViewerModal,\n  PersonRelationshipsSection as RelationshipsSection,\n  type PersonMemorySectionTabKey as MemorySectionTabKey,\n  type PersonRelationshipSectionTabKey as RelationshipSectionTabKey,\n} from '../profile-shared';\nimport { ProfileOverviewSection } from './sections/profile-overview-section';\nimport { ProfileHeroSection } from './sections/profile-hero-section';",
      ],
    ],
  ],
  [
    'app/screens/main/main-view.tsx',
    [
      [
        "import { MainNoTreeGate } from './main-no-tree-gate';\nimport { MainNodeQuickActionsDialog } from './main-node-quick-actions-dialog';\nimport { MainTabNavigator } from './main-tab-navigator';",
        "import { MainNoTreeGate } from './main-no-tree-gate';\nimport { TreeDetailNodeQuickActionsDialog } from '../profile-shared';\nimport { MainTabNavigator } from './main-tab-navigator';",
      ],
      [
        "{!isSharedLoaderVisible ? <MainNodeQuickActionsDialog controller={controller} /> : null}",
        "{!isSharedLoaderVisible ? (\n        <TreeDetailNodeQuickActionsDialog\n          visible={controller.nodeQuickActionState.visible}\n          person={controller.nodeQuickActionState.person}\n          theme={controller.theme}\n          t={controller.t}\n          canEdit={controller.canEdit}\n          mutating={controller.mutating}\n          closeNodeQuickActions={controller.closeNodeQuickActions}\n          openPersonProfile={controller.openPersonProfile}\n          openCreateRelativeDialog={controller.openCreateRelativeDialog}\n          crossSurnameChildIds={controller.crossSurnameChildIds}\n          canvasActiveFamilyRef={controller.sharedTabProps?.activeFamilyRef ?? { current: null }}\n          canvasFamilySwitchRef={controller.sharedTabProps?.familySwitchRef ?? { current: null }}\n          onOpenMaidenFamilyTree={controller.handleOpenMaidenFamilyTree}\n        />\n      ) : null}",
      ],
    ],
  ],
];

const deletions = [
  'app/screens/my-profile/dialogs/notes-dialog.tsx',
  'app/screens/my-profile/dialogs/photo-viewer-modal.tsx',
  'app/screens/my-profile/sections/lineage-section.tsx',
  'app/screens/my-profile/sections/memories-section.tsx',
  'app/screens/my-profile/sections/relationships-section.tsx',
  'app/screens/main/main-node-quick-actions-dialog.tsx',
];

for (const [relativePath, edits] of replacements) {
  const absolutePath = path.join(root, relativePath);
  let current;
  try {
    current = await readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      continue;
    }
    throw error;
  }
  const updated = edits.reduce((text, [from, to]) => text.replace(from, to), current);
  if (updated !== current) {
    await writeFile(absolutePath, updated);
  }
}

for (const relativePath of deletions) {
  await rm(path.join(root, relativePath), { force: true });
}

process.stdout.write('Profile component duplicates migrated.\n');

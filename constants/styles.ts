import {StyleSheet} from 'react-native';

// ── Soft neutral palette constants (mirrors theme.ts softPalettes) ───────────
const F = {
  background:       '#FAFBFD',
  surface:          '#FFFFFF',
  surfaceVariant:   '#EEF2F7',
  outlineVariant:   '#D5DEE8',
  onSurface:        '#10151D',
  onSurfaceVariant: '#4E5A6A',
  onSurfaceDeep:    '#313743',
  primaryGreen:     '#2FA36B',
  canvasBg:         '#F8FBFE',
  canvasBorder:     '#D7E1EB',
  nodeBg:           '#FFFFFF',
  nodeBorder:       '#D5DEE8',
  avatarBg:         '#EAF1F8',
  avatarBorder:     '#D6E0EA',
  hintBg:           '#F1F6FB',
  pendingBg:        '#F7FAFD',
  pendingBorder:    '#D7E1EB',
  photoPreferred:   '#2FA36B',
  photoBg:          '#EAF1F8',
};

const CARD_CHROME = {
    shadowColor: '#161A22',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 8},
    elevation: 3,
} as const;

export class GlobalStyles {
    static readonly dialogChrome = StyleSheet.create({
        dialog: {
            marginHorizontal: 12,
            borderRadius: 20,
        },
        dialogTitle: {
            paddingBottom: 4,
        },
        content: {
            paddingBottom: 12,
        },
        scrollArea: {
            borderBottomWidth: 0,
            borderTopWidth: 0,
            paddingHorizontal: 16,
        },
        dialogActions: {
            paddingHorizontal: 8,
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
        },
    });

    static readonly home = StyleSheet.create({
        container: {
            flex: 1,
        },
        content: {
            padding: 20,
            paddingBottom: 48,
        },
        profileCard: {
            ...CARD_CHROME,
            borderRadius: 20,
            padding: 24,
            marginBottom: 18,
        },
        heroTopRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
        },
        avatar: {
            marginBottom: 4,
        },
        profileTextWrap: {
            marginTop: 16,
        },
        titleWithHelperRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
        },
        name: {
            fontWeight: '800',
            marginBottom: 4,
        },
        email: {
            marginTop: 2,
        },
        heroDescription: {
            marginTop: 10,
            lineHeight: 22,
        },
        helperIconButton: {
            margin: 0,
            marginLeft: -4,
        },
        heroStatsRow: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 20,
            flexWrap: 'wrap',
        },
        statCard: {
            ...CARD_CHROME,
            flex: 1,
            minWidth: 92,
            borderRadius: 20,
            paddingVertical: 18,
            paddingHorizontal: 16,
        },
        heroActionsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 20,
        },
        heroActionButton: {
            flexGrow: 1,
        },
        headerButtonContent: {
            height: 52,
        },
        sectionCard: {
            ...CARD_CHROME,
            borderRadius: 20,
            padding: 20,
            marginBottom: 18,
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
        },
        sectionTextWrap: {
            flex: 1,
            minWidth: 220,
        },
        sectionSubtitle: {
            marginTop: 4,
        },
        themeSwitch: {
            marginTop: 16,
        },
        appearanceHint: {
            marginTop: 16,
            borderRadius: 20,
            padding: 16,
        },
        centeredState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 32,
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 28,
        },
        stateText: {
            marginTop: 8,
            textAlign: 'center',
        },
        treeCard: {
            ...CARD_CHROME,
            marginTop: 12,
            borderRadius: 20,
        },
        treeHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
        },
        treeTextWrap: {
            flex: 1,
        },
        treeMetaText: {
            marginTop: 4,
        },
        treeChipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        cardActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
        },
        tabBar: {
            height: 78,
            paddingTop: 10,
            paddingBottom: 12,
            borderTopWidth: 1,
            elevation: 0,
            shadowOpacity: 0,
        },
        tabLabel: {
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'none',
        },
        tabItem: {
            minHeight: 56,
        },
        // Profile tab
        profileHeroCard: {
            ...CARD_CHROME,
            borderRadius: 20,
            padding: 24,
            marginBottom: 18,
        },
        profileAvatarRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 18,
        },
        profileNameWrap: {
            flex: 1,
        },
        editNameRow: {
            gap: 12,
            marginTop: 16,
        },
        editNameInput: {
            width: '100%',
        },
        saveNameButton: {
            alignSelf: 'flex-start',
            borderRadius: 999,
        },
        signOutButton: {
            marginTop: 16,
        },
        signOutButtonContent: {
            height: 48,
        },
    });

    static readonly treeDetail = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: F.background,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: F.background,
        },
        tabScene: {
            backgroundColor: F.background,
        },
        tabBar: {
            height: 78,
            paddingTop: 10,
            paddingBottom: 12,
            borderTopWidth: 1,
            elevation: 0,
            shadowOpacity: 0,
        },
        tabLabel: {
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'none',
        },
        tabItem: {
            minHeight: 56,
        },
        content: {
            padding: 20,
            paddingBottom: 48,
        },
        sectionCard: {
            ...CARD_CHROME,
            borderRadius: 20,
            padding: 20,
            marginBottom: 18,
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
        },
        titleWrap: {
            flex: 1,
            minWidth: 220,
        },
        titleWithHelperRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
        },
        helperIconButton: {
            margin: 0,
            marginLeft: -4,
        },
        sectionSubtitle: {
            marginTop: 4,
            color: F.onSurfaceVariant,
        },
        managementSegmentedButtons: {
            marginTop: 16,
        },
        treeSettingsWrap: {
            marginTop: 16,
        },
        approvalWindowRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            marginTop: 12,
        },
        approvalWindowInput: {
            minWidth: 120,
            flexBasis: 120,
        },
        approvalPreviewCard: {
            marginTop: 12,
            borderRadius: 20,
            padding: 16,
        },
        summaryChipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 16,
        },
        collaboratorList: {
            marginTop: 16,
        },
        collaboratorCard: {
            ...CARD_CHROME,
            marginBottom: 12,
            borderRadius: 20,
        },
        collaboratorRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
        },
        approvalRequestHeader: {
            gap: 12,
        },
        approvalRequestActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 4,
        },
        collaboratorTextWrap: {
            flex: 1,
        },
        collaboratorMeta: {
            color: F.onSurfaceVariant,
            marginTop: 4,
        },
        collaboratorChipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        actionButtonsWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        visualisationTabContainer: {
            flex: 1,
            padding: 12,
            paddingTop: 8,
            paddingBottom: 12,
        },
        visualisationEmptyState: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 20,
            paddingHorizontal: 24,
        },
        filterInput: {
            marginTop: 16,
        },
        searchRow: {
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            marginTop: 16,
            marginBottom: 6,
        },
        searchBar: {
            flex: 1,
            borderRadius: 20,
        },
        filterButton: {
            borderRadius: 20,
        },
        resultsPill: {
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            marginBottom: 10,
        },
        filterRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        profileMetricsWrap: {
            marginTop: 16,
            gap: 12,
        },
        flatPanel: {
            borderRadius: 18,
            padding: 16,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: F.outlineVariant,
        },
        selfAssignmentSectionWrap: {
            marginTop: 20,
        },
        selfAssignmentCard: {
            ...CARD_CHROME,
            marginTop: 16,
            borderRadius: 20,
        },
        selfAssignmentHeader: {
            gap: 12,
        },
        selfAssignmentTextWrap: {
            flex: 1,
        },
        selfAssignmentTitle: {
            marginTop: 10,
        },
        selfAssignmentActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 4,
        },
        assignmentHelperText: {
            marginTop: 12,
        },
        assignmentSuggestionList: {
            marginTop: 16,
            gap: 12,
        },
        surnameVariantDraftsRow: {
            marginTop: 12,
        },
        surnameGroupButton: {
            marginTop: 12,
        },
        assignmentSuggestionCard: {
            ...CARD_CHROME,
            borderRadius: 20,
        },
        assignmentSuggestionRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
        },
        assignmentSuggestionTextWrap: {
            flex: 1,
        },
        assignmentChooserWrap: {
            marginTop: 20,
        },
        assignmentSearchInput: {
            marginTop: 12,
        },
        collaboratorSectionWrap: {
            marginTop: 20,
        },
        metricCard: {
            ...CARD_CHROME,
            marginBottom: 0,
            borderRadius: 20,
        },
        centeredState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 32,
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 28,
        },
        stateText: {
            marginTop: 8,
            color: F.onSurfaceVariant,
            textAlign: 'center',
        },
        emptyStateButton: {
            marginTop: 16,
        },
        emptyStateActionRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 12,
            marginTop: 4,
        },
        personCard: {
            ...CARD_CHROME,
            marginTop: 16,
            borderRadius: 20,
        },
        memberList: {
            marginTop: 8,
            gap: 10,
        },
        memberListRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: 18,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: F.outlineVariant,
        },
        memberListInfo: {
            flex: 1,
            minWidth: 0,
            marginLeft: 12,
        },
        memberListMeta: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
        },
        memberListTrailing: {
            marginLeft: 8,
        },
        personHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
        },
        personPhotoWrap: {
            marginRight: 4,
        },
        personPhoto: {
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 2,
            borderColor: F.avatarBorder,
            backgroundColor: F.avatarBg,
        },
        personPhotoFallback: {
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 2,
            borderColor: F.avatarBorder,
            backgroundColor: F.avatarBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        personHeaderText: {
            flex: 1,
        },
        personNameRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
        },
        metadataRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 8,
        },
        personNotes: {
            marginTop: 12,
            color: F.onSurfaceDeep,
        },
        cardActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        ownerSuggestionWrap: {
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: F.outlineVariant,
        },
        ownerSuggestionButton: {
            marginTop: 12,
            alignSelf: 'flex-start',
        },
        quickActionDialog: {
            marginHorizontal: 16,
            borderRadius: 20,
        },
        quickActionSubtitle: {
            marginBottom: 8,
        },
    });

    static readonly personProfile = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: F.background,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: F.background,
        },
        content: {
            padding: 16,
            paddingBottom: 40,
            paddingTop: 84,
        },
        stickyActionBar: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 3,
            elevation: 6,
            height: 72,
        },
        heroCard: {
            ...CARD_CHROME,
            borderRadius: 20,
            padding: 22,
            marginBottom: 16,
            position: 'relative',
        },
        heroFloatingButton: {
            position: 'absolute',
            top: 14,
            zIndex: 1,
            elevation: 7,
            margin: 0,
        },
        heroFloatingButtonLeft: {
            left: 14,
        },
        heroFloatingButtonRight: {
            right: 14,
        },
        heroHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
        },
        heroAvatarRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            flex: 1,
        },
        heroAvatar: {
            width: 92,
            height: 92,
            borderRadius: 46,
            backgroundColor: F.avatarBg,
            borderWidth: 2,
            borderColor: F.avatarBorder,
        },
        heroAvatarFallback: {
            width: 92,
            height: 92,
            borderRadius: 46,
            backgroundColor: F.avatarBg,
            borderWidth: 2,
            borderColor: F.avatarBorder,
            alignItems: 'center',
            justifyContent: 'center',
        },
        heroIdentityWrap: {
            flex: 1,
            minWidth: 220,
        },
        heroNameRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
        },
        heroSubtext: {
            marginTop: 6,
            color: F.onSurfaceVariant,
        },
        metadataRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        claimBox: {
            marginTop: 16,
            padding: 18,
            borderRadius: 20,
        },
        claimRow: {
            gap: 12,
        },
        claimTextWrap: {
            flex: 1,
        },
        claimText: {
            marginTop: 6,
            color: F.onSurfaceVariant,
        },
        sectionCard: {
            ...CARD_CHROME,
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
        },
        managementSegmentedButtons: {
            marginTop: 12,
        },
        managementSegmentedButtonsSecondary: {
            marginTop: 10,
        },
        tabStripCard: {
            borderRadius: 20,
            marginBottom: 16,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: F.outlineVariant,
        },
        relationshipTabStripCard: {
            marginTop: 8,
        },
        tabStripContent: {
            paddingHorizontal: 8,
            paddingVertical: 4,
        },
        tabStripItem: {
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginHorizontal: 2,
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
        },
        sectionHeaderText: {
            flex: 1,
            minWidth: 220,
        },
        titleWithHelperRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
        },
        helperIconButton: {
            margin: 0,
            marginLeft: -4,
        },
        sectionSubtitle: {
            marginTop: 6,
            color: F.onSurfaceVariant,
        },
        detailGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 16,
        },
        detailCard: {
            minWidth: 160,
            flexGrow: 1,
            flexBasis: 160,
            borderRadius: 18,
            padding: 16,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: F.outlineVariant,
        },
        detailLabel: {
            marginBottom: 8,
            color: F.onSurfaceVariant,
        },
        relationshipList: {
            marginTop: 16,
        },
        relationshipCard: {
            marginBottom: 12,
            borderRadius: 18,
            padding: 16,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: F.outlineVariant,
        },
        relationshipRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
        },
        relationshipTextWrap: {
            flex: 1,
        },
        relationshipChip: {
            alignSelf: 'flex-start',
        },
        relationshipTitle: {
            marginTop: 10,
        },
        relationshipSubtitle: {
            marginTop: 6,
            color: F.onSurfaceVariant,
        },
        rowActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 28,
        },
        stateText: {
            marginTop: 8,
            color: F.onSurfaceVariant,
            textAlign: 'center',
        },
        notesBox: {
            marginTop: 16,
            padding: 18,
            borderRadius: 20,
            backgroundColor: F.hintBg,
        },
        notesText: {
            marginTop: 8,
            color: F.onSurfaceDeep,
        },
        memoryDialog: {
            maxHeight: '88%',
        },
        memoryDialogScrollArea: {
            borderBottomWidth: 0,
            borderTopWidth: 0,
            paddingHorizontal: 16,
        },
        memoryDialogContent: {
            paddingBottom: 12,
        },
        memoryDialogInput: {
            minHeight: 140,
        },
        memoryDialogPhotoActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
        },
        memoryDialogPhotoList: {
            paddingTop: 4,
            paddingBottom: 4,
        },
        memoryDialogPhotoCard: {
            marginRight: 12,
            position: 'relative',
        },
        memoryDialogPhoto: {
            width: 120,
            height: 120,
            borderRadius: 20,
            backgroundColor: F.photoBg,
        },
        memoryDialogPhotoButton: {
            position: 'absolute',
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
        },
        memoryDialogPhotoPrimaryButton: {
            top: 6,
            left: 6,
        },
        memoryDialogPhotoRemoveButton: {
            top: 6,
            right: 6,
        },
        memoryDialogHint: {
            color: F.onSurfaceVariant,
            marginBottom: 12,
        },
        sectionDivider: {
            marginTop: 20,
            marginBottom: 8,
        },
        gallerySection: {
            marginTop: 12,
        },
        galleryRow: {
            paddingTop: 12,
            paddingRight: 12,
        },
        photoCard: {
            ...CARD_CHROME,
            marginRight: 12,
            overflow: 'hidden',
            borderRadius: 20,
        },
        photoCardPreferred: {
            shadowColor: F.photoPreferred,
            shadowOpacity: 0.18,
            shadowRadius: 14,
            shadowOffset: {width: 0, height: 6},
            elevation: 4,
        },
        photo: {
            width: 220,
            height: 180,
            backgroundColor: F.avatarBg,
        },
        lifeEventsSection: {
            marginTop: 12,
        },
        timelineChipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        viewerBackdrop: {
            flex: 1,
            backgroundColor: 'rgba(12, 10, 14, 0.94)',
            justifyContent: 'center',
            paddingHorizontal: 12,
            paddingVertical: 16,
        },
        viewerCloseButton: {
            position: 'absolute',
            top: 44,
            right: 16,
            zIndex: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
        },
        viewerNavButton: {
            position: 'absolute',
            top: '50%',
            marginTop: -24,
            zIndex: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
        },
        viewerNavButtonLeft: {
            left: 12,
        },
        viewerNavButtonRight: {
            right: 12,
        },
        viewerCounter: {
            position: 'absolute',
            bottom: 28,
            alignSelf: 'center',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
        },
        viewerSlide: {
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 16,
        },
        viewerImage: {
            width: '100%',
            height: '100%',
        },
    });

    static readonly treeFormDialog = StyleSheet.create({
        dialog: {
            maxHeight: '82%',
        },
    });

    static readonly confirmDialog = StyleSheet.create({
        dialog: {
            maxHeight: '72%',
        },
    });

    static readonly collaboratorDialog = StyleSheet.create({
        dialog: {
            maxHeight: '82%',
        },
        roleButtons: {
            marginTop: 12,
        },
    });

    static readonly lifeEventDialog = StyleSheet.create({
        dialog: {
            maxHeight: '82%',
        },
        scrollArea: {
            borderBottomWidth: 0,
            borderTopWidth: 0,
            paddingHorizontal: 16,
        },
        content: {
            paddingBottom: 12,
        },
        helperText: {
            color: F.onSurfaceVariant,
        },
        typeWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 16,
        },
        typeChip: {
            marginRight: 8,
            marginBottom: 8,
        },
        fieldSpacing: {
            marginTop: 16,
        },
        dateActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
        },
    });

    static readonly relationshipDialog = StyleSheet.create({
        dialog: {
            maxHeight: '90%',
            marginHorizontal: 12,
            borderRadius: 24,
        },
        dialogTitle: {
            paddingBottom: 4,
        },
        scrollArea: {
            borderBottomWidth: 0,
            borderTopWidth: 0,
            paddingHorizontal: 16,
        },
        content: {
            paddingBottom: 16,
        },
        dialogActions: {
            paddingHorizontal: 8,
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
        },
        relationshipTypeCard: {
            ...CARD_CHROME,
            borderRadius: 18,
            padding: 8,
        },
        section: {
            marginTop: 16,
        },
        sectionCard: {
            ...CARD_CHROME,
            borderRadius: 18,
            padding: 12,
        },
        sectionHeaderRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
        },
        searchInput: {
            marginTop: 8,
        },
        helperCopy: {
            marginTop: 8,
            color: F.onSurfaceVariant,
        },
        choiceWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 10,
        },
        choiceChip: {
            marginRight: 8,
            marginBottom: 8,
        },
        selectedChipRow: {
            marginTop: 12,
        },
        resultsList: {
            marginTop: 12,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: F.outlineVariant,
        },
        resultRow: {
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: F.surface,
        },
        resultRowSelected: {
            backgroundColor: '#EAF5EF',
        },
        resultRowDivider: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: F.outlineVariant,
        },
        resultRowTitle: {
            fontWeight: '700',
        },
        resultRowMeta: {
            marginTop: 4,
            color: F.onSurfaceVariant,
        },
        emptyState: {
            marginTop: 12,
            padding: 14,
            borderRadius: 16,
            backgroundColor: F.hintBg,
        },
        resultsFooterText: {
            marginTop: 8,
            color: F.onSurfaceVariant,
        },
    });

    static readonly personRelationshipDialog = StyleSheet.create({
        dialog: {
            maxHeight: '82%',
        },
        scrollArea: {
            borderBottomWidth: 0,
            borderTopWidth: 0,
            paddingHorizontal: 16,
        },
        content: {
            paddingBottom: 16,
        },
        helperText: {
            color: F.onSurfaceVariant,
        },
        segmentedButtons: {
            marginTop: 16,
        },
        section: {
            marginTop: 16,
        },
        searchInput: {
            marginTop: 8,
        },
        choiceWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        choiceChip: {
            marginRight: 8,
            marginBottom: 8,
        },
        selectedChipRow: {
            marginTop: 12,
        },
        resultsList: {
            marginTop: 12,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: F.outlineVariant,
        },
        resultRow: {
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: F.surface,
        },
        resultRowSelected: {
            backgroundColor: '#EAF5EF',
        },
        resultRowDivider: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: F.outlineVariant,
        },
        resultRowTitle: {
            fontWeight: '700',
        },
        resultRowMeta: {
            marginTop: 4,
            color: F.onSurfaceVariant,
        },
        emptyState: {
            marginTop: 12,
            padding: 14,
            borderRadius: 16,
            backgroundColor: F.hintBg,
        },
        resultsFooterText: {
            marginTop: 8,
            color: F.onSurfaceVariant,
        },
    });

    static readonly relationshipInsightCard = StyleSheet.create({
        card: {
            marginTop: 16,
            paddingTop: 4,
        },
        subtitle: {
            marginTop: 6,
            color: F.onSurfaceVariant,
        },
        section: {
            marginTop: 16,
        },
        chipRow: {
            paddingTop: 8,
            paddingRight: 8,
        },
        chip: {
            marginRight: 8,
        },
        selectedPairRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        searchInput: {
            marginTop: 12,
        },
        resultsList: {
            marginTop: 12,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: F.outlineVariant,
        },
        resultRow: {
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: F.surface,
        },
        resultRowSelected: {
            backgroundColor: '#EAF5EF',
        },
        resultRowDivider: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: F.outlineVariant,
        },
        resultRowTitle: {
            fontWeight: '700',
        },
        resultRowMeta: {
            marginTop: 4,
            color: F.onSurfaceVariant,
        },
        emptyState: {
            marginTop: 12,
            padding: 14,
            borderRadius: 16,
            backgroundColor: F.hintBg,
        },
        actionsRow: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 8,
        },
        pickerDialog: {
            borderRadius: 20,
            marginHorizontal: 16,
        },
        paginationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
        },
        paginationLabel: {
            color: F.onSurfaceVariant,
        },
        resultBox: {
            marginTop: 12,
            padding: 18,
            borderRadius: 20,
            backgroundColor: F.hintBg,
        },
        pathText: {
            marginTop: 8,
            color: F.onSurfaceDeep,
        },
        summaryRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        pathStepCard: {
            padding: 12,
            borderRadius: 14,
            backgroundColor: F.surface,
            marginBottom: 10,
        },
        stepMeta: {
            marginTop: 4,
            color: F.onSurfaceVariant,
        },
    });

    static readonly personFormDialog = StyleSheet.create({
        dialog: {
            maxHeight: '92%',
            marginHorizontal: 12,
            borderRadius: 20,
        },
        dialogTitle: {
            paddingBottom: 4,
        },
        scrollArea: {
            borderBottomWidth: 0,
            borderTopWidth: 0,
            paddingHorizontal: 16,
        },
        content: {
            paddingBottom: 12,
        },
        dialogActions: {
            paddingHorizontal: 8,
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
        },
        fieldSpacing: {
            marginTop: 8,
        },
        sectionSpacing: {
            marginTop: 16,
        },
        birthDateActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
        },
        chipGroup: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 8,
        },
        chip: {
            marginRight: 8,
            marginBottom: 8,
        },
        relationshipHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        helperText: {
            marginTop: 8,
            color: F.onSurfaceVariant,
        },
        pendingRelationshipCard: {
            marginTop: 12,
            padding: 12,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: F.pendingBorder,
            backgroundColor: F.pendingBg,
        },
        relationshipChipRow: {
            paddingTop: 12,
            paddingRight: 8,
        },
        relationshipChip: {
            marginRight: 8,
        },
        coParentBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            marginTop: 12,
            borderRadius: 20,
        },
        presentRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        stepProgressRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingBottom: 12,
            gap: 6,
            borderBottomWidth: StyleSheet.hairlineWidth,
        },
        stepDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#ccc',
        },
        stepLine: {
            flex: 1,
            height: 2,
            borderRadius: 1,
        },
        stepLabel: {
            marginLeft: 4,
        },
        selectedPersonRow: {
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
        },
        selectedPersonChip: {
            alignSelf: 'flex-start',
        },
        photoHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
        },
        photoActionRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        photoHint: {
            marginTop: 8,
            opacity: 0.7,
        },
        photoList: {
            paddingTop: 12,
            paddingBottom: 4,
        },
        photoCard: {
            marginRight: 12,
            position: 'relative',
        },
        photo: {
            width: 96,
            height: 96,
            borderRadius: 20,
            backgroundColor: F.photoBg,
        },
        photoRemoveButton: {
            position: 'absolute',
            top: -6,
            right: -6,
            backgroundColor: F.surface,
            margin: 0,
        },
        photoPrimaryButton: {
            position: 'absolute',
            top: -6,
            left: -6,
            backgroundColor: F.surface,
            margin: 0,
        },
    });

    static readonly familyTreeCanvas = StyleSheet.create({
        container: {
            marginTop: 16,
        },
        containerFill: {
            flex: 1,
            marginTop: 0,
        },
        controlsRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
        },
        zoomButtonsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
        },
        viewport: {
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: F.canvasBorder,
            backgroundColor: F.canvasBg,
        },
        fullscreenContainer: {
            flex: 1,
            padding: 12,
        },
        fullscreenViewport: {
            flex: 1,
            minHeight: 320,
        },
        fullscreenHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        fullscreenSubtitle: {
            marginTop: 4,
            marginBottom: 12,
        },
        canvas: {
            backgroundColor: F.canvasBg,
        },
        inlineViewportFill: {
            flex: 1,
            minHeight: 320,
        },
        viewportOverlay: {
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'space-between',
            padding: 12,
            zIndex: 4,
            elevation: 4,
        },
        gestureLayer: {
            ...StyleSheet.absoluteFillObject,
            zIndex: 2,
        },
        floatingHintCard: {
            alignSelf: 'flex-start',
            maxWidth: 300,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 10,
        },
        floatingHintText: {
            lineHeight: 18,
        },
        floatingControlsCard: {
            alignSelf: 'flex-end',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: 4,
            borderWidth: 1,
            borderRadius: 20,
            padding: 4,
        },
        node: {
            position: 'absolute',
            backgroundColor: F.nodeBg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: F.nodeBorder,
            padding: 14,
            justifyContent: 'center',
            shadowColor: '#1F2C1B',
            shadowOpacity: 0.10,
            shadowRadius: 8,
            shadowOffset: {width: 0, height: 4},
            elevation: 2,
        },
        nodeInnerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        nodeAvatarWrap: {
            flexShrink: 0,
        },
        nodeAvatar: {
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 2,
            borderColor: F.avatarBorder,
            backgroundColor: F.avatarBg,
        },
        nodeAvatarFallback: {
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 2,
            borderColor: F.nodeBorder,
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
        },
        nodeTextWrap: {
            flex: 1,
            minWidth: 0,
        },
        nodeBadge: {
            position: 'absolute',
            top: 8,
            right: 8,
            borderRadius: 20,
            paddingHorizontal: 8,
            paddingVertical: 2,
            zIndex: 1,
        },
        nodeBadgeText: {
            fontWeight: '700',
        },
        nodeTitle: {
            fontWeight: '700',
            paddingRight: 12,
        },
        nodeMeta: {
            color: F.onSurfaceVariant,
            marginTop: 4,
        },
    });

    static readonly login = StyleSheet.create({
        flex: {flex: 1},
        scroll: {flexGrow: 1, justifyContent: 'center', padding: 24},
        heroWrap: {
            marginBottom: 28,
        },
        heroTitle: {
            marginTop: 14,
            fontWeight: '800',
        },
        heroSubtitle: {
            marginTop: 8,
            lineHeight: 24,
        },
        card: {
            ...CARD_CHROME,
            borderRadius: 20,
            padding: 24,
        },
        title: {marginBottom: 4, fontWeight: '700'},
        subtitle: {marginBottom: 20},
        input: {marginTop: 6},
        button: {marginTop: 24, borderRadius: 999},
        buttonContent: {height: 52},
        linkButton: {marginTop: 12, alignSelf: 'center'},
    });

    static readonly signUp = StyleSheet.create({
        flex: {flex: 1},
        scroll: {flexGrow: 1, justifyContent: 'center', padding: 24},
        heroWrap: {
            marginBottom: 28,
        },
        heroTitle: {
            marginTop: 14,
            fontWeight: '800',
        },
        heroSubtitle: {
            marginTop: 8,
            lineHeight: 24,
        },
        card: {
            ...CARD_CHROME,
            borderRadius: 20,
            padding: 24,
        },
        title: {marginBottom: 4, fontWeight: '700'},
        subtitle: {marginBottom: 20},
        input: {marginTop: 6},
        button: {marginTop: 24, borderRadius: 999},
        buttonContent: {height: 52},
        linkButton: {marginTop: 12, alignSelf: 'center'},
    });
}

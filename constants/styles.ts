import {StyleSheet} from 'react-native';

// ── Forest palette constants (mirrors theme.ts forestPalettes) ────────────────
const F = {
  background:       '#FFFFFF',
  surface:          '#FFFFFF',
  surfaceVariant:   '#EBE5D9',
  outlineVariant:   '#CFCAB8',
  onSurface:        '#1A1C18',
  onSurfaceVariant: '#605C4A',
  onSurfaceDeep:    '#3E3A2C',
  primaryGreen:     '#2D6A4F',
  canvasBg:         '#F0EBE0',
  canvasBorder:     '#C8D4C0',
  nodeBg:           '#FFFFFF',
  nodeBorder:       '#CFCAB8',
  avatarBg:         '#EBE5D9',
  avatarBorder:     '#C8D4C0',
  hintBg:           '#EEE8D8',
  pendingBg:        '#F5F2EA',
  pendingBorder:    '#CFCAB8',
  photoPreferred:   '#2D6A4F',
  photoBg:          '#EBE5D9',
};

const CARD_CHROME = {
    shadowColor: '#1F2C1B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 2,
} as const;

export class GlobalStyles {
    static readonly home = StyleSheet.create({
        container: {
            flex: 1,
        },
        content: {
            padding: 20,
            paddingBottom: 56,
        },
        profileCard: {
            ...CARD_CHROME,
            borderRadius: 28,
            padding: 22,
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
            paddingVertical: 16,
            paddingHorizontal: 14,
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
            borderRadius: 28,
            padding: 18,
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
            borderRadius: 18,
            padding: 14,
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
            borderRadius: 22,
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
            height: 68,
            paddingTop: 8,
            paddingBottom: 10,
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
            minHeight: 52,
        },
        // Profile tab
        profileHeroCard: {
            ...CARD_CHROME,
            borderRadius: 28,
            padding: 22,
            marginBottom: 18,
        },
        profileAvatarRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
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
            height: 68,
            paddingTop: 8,
            paddingBottom: 10,
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
            minHeight: 52,
        },
        content: {
            padding: 20,
            paddingBottom: 56,
        },
        sectionCard: {
            ...CARD_CHROME,
            borderRadius: 28,
            padding: 18,
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
            borderRadius: 24,
            paddingHorizontal: 24,
        },
        filterInput: {
            marginTop: 16,
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
        selfAssignmentSectionWrap: {
            marginTop: 20,
        },
        selfAssignmentCard: {
            ...CARD_CHROME,
            marginTop: 16,
            borderRadius: 28,
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
        assignmentSuggestionCard: {
            ...CARD_CHROME,
            borderRadius: 28,
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
            borderRadius: 28,
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
            borderRadius: 28,
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
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 2,
            borderColor: F.avatarBorder,
            backgroundColor: F.avatarBg,
        },
        personPhotoFallback: {
            width: 64,
            height: 64,
            borderRadius: 32,
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
            borderRadius: 28,
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
        },
        heroCard: {
            ...CARD_CHROME,
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
        },
        heroToolbar: {
            marginBottom: 12,
            alignItems: 'flex-start',
        },
        heroToolbarButtonContent: {
            paddingHorizontal: 0,
        },
        heroHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
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
            padding: 16,
            borderRadius: 18,
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
            borderRadius: 24,
            padding: 16,
            marginBottom: 16,
        },
        managementSegmentedButtons: {
            marginTop: 12,
        },
        managementSegmentedButtonsSecondary: {
            marginTop: 10,
        },
        tabStripCard: {
            borderRadius: 16,
            marginBottom: 16,
            overflow: 'hidden',
            borderBottomWidth: StyleSheet.hairlineWidth,
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
            ...CARD_CHROME,
            minWidth: 160,
            flexGrow: 1,
            flexBasis: 160,
            borderRadius: 18,
        },
        detailLabel: {
            marginBottom: 8,
            color: F.onSurfaceVariant,
        },
        relationshipList: {
            marginTop: 16,
        },
        relationshipCard: {
            ...CARD_CHROME,
            marginBottom: 12,
            borderRadius: 18,
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
            padding: 16,
            borderRadius: 18,
            backgroundColor: F.hintBg,
        },
        notesText: {
            marginTop: 8,
            color: F.onSurfaceDeep,
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
            borderRadius: 18,
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
        timelineWrap: {
            marginTop: 16,
        },
        timelineCard: {
            ...CARD_CHROME,
            marginBottom: 12,
            borderRadius: 18,
        },
        timelineRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
        },
        timelineTextWrap: {
            flex: 1,
        },
        timelineChipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        timelineTitle: {
            marginTop: 10,
        },
        timelineDescription: {
            marginTop: 8,
            color: F.onSurfaceDeep,
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
        viewerSlide: {
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 16,
        },
        viewerImage: {
            width: '100%',
            height: '78%',
        },
    });

    static readonly treeFormDialog = StyleSheet.create({
        dialog: {
            marginHorizontal: 16,
        },
    });

    static readonly confirmDialog = StyleSheet.create({
        dialog: {
            marginHorizontal: 16,
        },
    });

    static readonly collaboratorDialog = StyleSheet.create({
        dialog: {
            marginHorizontal: 16,
        },
        roleButtons: {
            marginTop: 12,
        },
    });

    static readonly lifeEventDialog = StyleSheet.create({
        dialog: {
            maxHeight: '82%',
            marginHorizontal: 16,
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
        searchInput: {
            marginTop: 8,
        },
        peopleWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 8,
        },
        personChip: {
            marginRight: 8,
            marginBottom: 8,
        },
    });

    static readonly personRelationshipDialog = StyleSheet.create({
        dialog: {
            maxHeight: '82%',
            marginHorizontal: 16,
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
        peopleWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 12,
        },
        personChip: {
            marginRight: 8,
            marginBottom: 8,
        },
    });

    static readonly relationshipInsightCard = StyleSheet.create({
        card: {
            ...CARD_CHROME,
            borderRadius: 24,
            marginTop: 16,
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
        actionsRow: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 8,
        },
        lockedPersonRow: {
            marginTop: 8,
        },
        resultBox: {
            marginTop: 12,
            padding: 16,
            borderRadius: 18,
            backgroundColor: F.hintBg,
        },
        pathText: {
            marginTop: 8,
            color: F.onSurfaceDeep,
        },
    });

    static readonly personFormDialog = StyleSheet.create({
        dialog: {
            maxHeight: '92%',
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
            borderRadius: 18,
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
            borderRadius: 8,
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
            borderRadius: 12,
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
            borderRadius: 24,
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
            borderRadius: 18,
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
            borderRadius: 18,
            padding: 4,
        },
        node: {
            position: 'absolute',
            backgroundColor: F.nodeBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: F.nodeBorder,
            padding: 12,
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
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 2,
            borderColor: F.avatarBorder,
            backgroundColor: F.avatarBg,
        },
        nodeAvatarFallback: {
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 2,
            borderColor: F.nodeBorder,
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
        },
        nodeTextWrap: {
            flex: 1,
        },
        nodeBadge: {
            position: 'absolute',
            top: 8,
            right: 8,
            borderRadius: 18,
            paddingHorizontal: 8,
            paddingVertical: 2,
            zIndex: 1,
        },
        nodeBadgeText: {
            fontWeight: '700',
        },
        nodeTitle: {
            fontWeight: '700',
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
            marginBottom: 24,
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
            borderRadius: 28,
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
            marginBottom: 24,
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
            borderRadius: 28,
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


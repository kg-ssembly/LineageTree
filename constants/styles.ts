import {StyleSheet} from 'react-native';

// ── Forest palette constants (mirrors theme.ts forestPalettes) ────────────────
const F = {
  background:       '#F6F3ED',
  surface:          '#FDFAF5',
  surfaceVariant:   '#EBE5D9',
  outlineVariant:   '#CFCAB8',
  onSurface:        '#1A1C18',
  onSurfaceVariant: '#605C4A',
  onSurfaceDeep:    '#3E3A2C',
  primaryGreen:     '#2D6A4F',
  canvasBg:         '#F0EBE0',
  canvasBorder:     '#C8D4C0',
  nodeBg:           '#FFFEFB',
  nodeBorder:       '#CFCAB8',
  avatarBg:         '#EBE5D9',
  avatarBorder:     '#C8D4C0',
  hintBg:           '#EEE8D8',
  pendingBg:        '#F5F2EA',
  pendingBorder:    '#CFCAB8',
  photoPreferred:   '#2D6A4F',
  photoBg:          '#EBE5D9',
};

export class GlobalStyles {
    static readonly home = StyleSheet.create({
        container: {
            flex: 1,
        },
        content: {
            padding: 16,
            paddingBottom: 40,
        },
        profileCard: {
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
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
        },
        statCard: {
            flex: 1,
            borderRadius: 18,
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
            height: 48,
        },
        sectionCard: {
            borderRadius: 24,
            padding: 16,
            marginBottom: 16,
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
            marginTop: 12,
            borderRadius: 18,
            borderWidth: 1,
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
            height: 64,
            paddingTop: 6,
            paddingBottom: 8,
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
            padding: 16,
            paddingBottom: 40,
        },
        sectionCard: {
            borderRadius: 24,
            padding: 16,
            marginBottom: 16,
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
            marginTop: 16,
            borderRadius: 18,
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
            borderRadius: 18,
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
            marginBottom: 0,
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
            marginTop: 16,
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
            marginRight: 12,
            overflow: 'hidden',
            borderRadius: 18,
        },
        photoCardPreferred: {
            borderColor: F.photoPreferred,
            borderWidth: 2,
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
            paddingHorizontal: 0,
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
            paddingHorizontal: 4,
        },
        content: {
            paddingHorizontal: 4,
            paddingBottom: 8,
        },
        dialogActions: {
            paddingHorizontal: 8,
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
        },
        relationshipTypeCard: {
            borderRadius: 18,
            borderWidth: 1,
            padding: 8,
        },
        section: {
            marginTop: 16,
        },
        sectionCard: {
            borderRadius: 18,
            borderWidth: 1,
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
            paddingHorizontal: 0,
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
            paddingHorizontal: 4,
        },
        content: {
            paddingHorizontal: 4,
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
        scroll: {flexGrow: 1, justifyContent: 'center', padding: 20},
        heroWrap: {
            marginBottom: 20,
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
            borderRadius: 24,
            padding: 24,
        },
        title: {marginBottom: 4, fontWeight: '700'},
        subtitle: {marginBottom: 20},
        input: {marginTop: 4},
        button: {marginTop: 24, borderRadius: 999},
        buttonContent: {height: 52},
        linkButton: {marginTop: 10},
    });

    static readonly signUp = StyleSheet.create({
        flex: {flex: 1},
        scroll: {flexGrow: 1, justifyContent: 'center', padding: 20},
        heroWrap: {
            marginBottom: 20,
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
            borderRadius: 24,
            padding: 24,
        },
        title: {marginBottom: 4, fontWeight: '700'},
        subtitle: {marginBottom: 20},
        input: {marginTop: 4},
        button: {marginTop: 24, borderRadius: 999},
        buttonContent: {height: 52},
        linkButton: {marginTop: 10},
    });
}


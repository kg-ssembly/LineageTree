import { StyleSheet } from 'react-native';

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
      borderRadius: 5,
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
      justifyContent: 'space-between',
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
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    statCard: {
      flex: 1,
      borderRadius: 5,
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
      borderRadius: 5,
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
      borderRadius: 5,
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
      borderRadius: 5,
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
      backgroundColor: '#F8F7FF',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F8F7FF',
    },
    tabScene: {
      backgroundColor: '#F8F7FF',
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
      borderRadius: 5,
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
      justifyContent: 'space-between',
      gap: 8,
    },
    helperIconButton: {
      margin: 0,
    },
    sectionSubtitle: {
      marginTop: 4,
      color: '#6B6B74',
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
      color: '#6B6B74',
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
      borderRadius: 5,
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
      borderRadius: 5,
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
      borderRadius: 5,
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
      color: '#6B6B74',
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
      borderColor: '#CFC5FF',
      backgroundColor: '#ECE8FF',
    },
    personPhotoFallback: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      borderColor: '#CFC5FF',
      backgroundColor: '#ECE8FF',
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
      color: '#3E3E45',
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
      borderTopColor: '#D7D1F9',
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
      backgroundColor: '#F8F7FF',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F8F7FF',
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    heroCard: {
      borderRadius: 5,
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
      color: '#6B6B74',
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
      borderRadius: 5,
    },
    claimRow: {
      gap: 12,
    },
    claimTextWrap: {
      flex: 1,
    },
    claimText: {
      marginTop: 6,
      color: '#6B6B74',
    },
    sectionCard: {
      borderRadius: 5,
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
      justifyContent: 'space-between',
      gap: 8,
    },
    helperIconButton: {
      margin: 0,
    },
    sectionSubtitle: {
      marginTop: 6,
      color: '#6B6B74',
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
      borderRadius: 5,
    },
    detailLabel: {
      marginBottom: 8,
      color: '#6B6B74',
    },
    relationshipList: {
      marginTop: 16,
    },
    relationshipCard: {
      marginBottom: 12,
      borderRadius: 5,
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
      color: '#6B6B74',
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
      color: '#6B6B74',
      textAlign: 'center',
    },
    notesBox: {
      marginTop: 16,
      padding: 16,
      borderRadius: 5,
      backgroundColor: '#F3F0FF',
    },
    notesText: {
      marginTop: 8,
      color: '#4E4E58',
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
      borderRadius: 5,
    },
    photoCardPreferred: {
      borderColor: '#7C4DFF',
      borderWidth: 2,
    },
    photo: {
      width: 220,
      height: 180,
      backgroundColor: '#ECE8FF',
    },
    lifeEventsSection: {
      marginTop: 12,
    },
    timelineWrap: {
      marginTop: 16,
    },
    timelineCard: {
      marginBottom: 12,
      borderRadius: 5,
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
      color: '#4E4E58',
    },
    viewerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(12, 10, 24, 0.94)',
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

  static readonly login = StyleSheet.create({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
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
      borderRadius: 5,
      padding: 24,
    },
    title: { marginBottom: 4, fontWeight: '700' },
    subtitle: { marginBottom: 20 },
    input: { marginTop: 4 },
    button: { marginTop: 24, borderRadius: 5 },
    buttonContent: { height: 52 },
    linkButton: { marginTop: 10 },
  });

  static readonly signUp = StyleSheet.create({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
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
      borderRadius: 5,
      padding: 24,
    },
    title: { marginBottom: 4, fontWeight: '700' },
    subtitle: { marginBottom: 20 },
    input: { marginTop: 4 },
    button: { marginTop: 24, borderRadius: 5 },
    buttonContent: { height: 52 },
    linkButton: { marginTop: 10 },
  });
}


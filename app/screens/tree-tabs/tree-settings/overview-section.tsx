import React from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { Reveal } from '../../../../components';
import { isPersonDeceased } from '../../../../components/dto/person';
import { isTreeDiscoverable, treeNeedsDiscoverabilityChoice } from '../../../../components/dto/tree';
import { formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { OverviewSectionProps } from './tree-settings-shared';
import { formatRole } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;

export function OverviewSection({
  selectedTree,
  people,
  role,
  isOwner,
  currentUserLabel,
  currentAssignedPerson,
  currentSelfAssignmentSuggestions,
  canCreateSelfProfile,
  mutating,
  userId,
  treeSurnameVariants,
  unlinkedCollaboratorCount,
  linkSearchQuery,
  filteredLinkPeople,
  onOpenHelperDialog,
  onOpenSurnameVariantDialog,
  onSetTreeDiscoverability,
  onOpenAddSelf,
  openPersonProfile,
  onAssignPersonToUser,
  openConfirm,
  onClearSelfAssignment,
  setLinkSearchQuery,
}: OverviewSectionProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const handleSelfLink = async (personId: string) => {
    if (!userId || currentAssignedPerson) {
      return;
    }

    await onAssignPersonToUser(userId, personId);
  };

  return (
    <>
      <View style={styles.summaryChipRow}>
        <Chip icon="account-key">{formatRole(role)}</Chip>
        <Chip icon="account-group">{t(K.treeSettings.familyMembersCount, { count: people.length })}</Chip>
        <Chip icon="account-multiple">{t(K.treeSettings.collaboratorsCount, { count: selectedTree.collaborators.length })}</Chip>
        {unlinkedCollaboratorCount > 0 ? <Chip icon="account-clock">{t(K.treeSettings.awaitingLinkCount, { count: unlinkedCollaboratorCount })}</Chip> : null}
      </View>

      <Reveal delay={80}>
        <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginBottom: 12 }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleLarge">{t(K.treeSettings.treeDiscoverability)}</Text>
              </View>
            </View>
            <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
              {treeNeedsDiscoverabilityChoice(selectedTree)
                ? t(K.treeSettings.treeDiscoverabilityPrompt)
                : isTreeDiscoverable(selectedTree)
                  ? t(K.treeSettings.treeDiscoverabilityOn)
                  : t(K.treeSettings.treeDiscoverabilityOff)}
            </Text>
            {isOwner ? (
              <View style={[styles.collaboratorChipRow, { marginTop: 12 }]}>
                <Button mode={isTreeDiscoverable(selectedTree) ? 'contained' : 'outlined'} onPress={() => { void onSetTreeDiscoverability(true); }} disabled={mutating}>
                  {t(K.treeSettings.makeTreeDiscoverable)}
                </Button>
                <Button mode={!isTreeDiscoverable(selectedTree) && !treeNeedsDiscoverabilityChoice(selectedTree) ? 'contained' : 'outlined'} onPress={() => { void onSetTreeDiscoverability(false); }} disabled={mutating}>
                  {t(K.treeSettings.keepTreePrivate)}
                </Button>
              </View>
            ) : null}
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal delay={90}>
        <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginBottom: 12 }]}>
          <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <View style={styles.titleWithHelperRow}>
                <Text variant="titleLarge">{t(K.treeSettings.surnameVariants)}</Text>
                <IconButton
                  icon="information-outline"
                  size={18}
                  style={styles.helperIconButton}
                  onPress={() => onOpenHelperDialog('surname-variants')}
                  accessibilityLabel={t(K.treeSettings.aboutSurnameVariants)}
                />
              </View>
            </View>
          </View>

          {treeSurnameVariants.length > 0 ? (
            <View style={[styles.collaboratorChipRow, { marginTop: 16 }]}>
              {treeSurnameVariants.map((variant) => <Chip key={`tree-variant-${variant}`} compact>{variant}</Chip>)}
            </View>
          ) : null}

          {isOwner || role === 'editor' ? (
            <View style={{ marginTop: 8 }}>
              <Button mode="outlined" icon="shape-plus-outline" onPress={onOpenSurnameVariantDialog} style={{ marginBottom: 8 }}>
                {treeSurnameVariants.length > 0 ? t(K.treeSettings.manageVariantsCount, { count: treeSurnameVariants.length }) : t(K.treeSettings.manageVariants)}
              </Button>
            </View>
          ) : null}
          </Card.Content>
        </Card>
      </Reveal>

      <View style={styles.selfAssignmentSectionWrap}>
        <Reveal delay={110}>
          <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWrap}>
                  <View style={styles.titleWithHelperRow}>
                    <Text variant="titleLarge">{t(K.treeSettings.myPlaceInThisTree)}</Text>
                    <IconButton
                      icon="information-outline"
                      size={18}
                      style={styles.helperIconButton}
                      onPress={() => onOpenHelperDialog('my-place')}
                      accessibilityLabel={t(K.treeSettings.aboutMyPlaceInTree)}
                    />
                  </View>
                </View>
                {!currentAssignedPerson ? (
                  <Button mode="contained-tonal" icon="account-plus" onPress={onOpenAddSelf} disabled={mutating || !canCreateSelfProfile}>
                    {t(K.treeSettings.addMyself)}
                  </Button>
                ) : null}
              </View>
              <View style={styles.selfAssignmentHeader}>
                <View style={styles.selfAssignmentTextWrap}>
                  <View style={styles.collaboratorChipRow}>
                    <Chip compact icon={currentAssignedPerson ? 'check-decagram' : 'link-variant-off'}>
                      {currentAssignedPerson ? t(K.treeSettings.linkedProfile) : t(K.treeSettings.notLinkedYet)}
                    </Chip>
                    <Chip compact icon="account">{currentUserLabel}</Chip>
                  </View>
                  <Text variant="titleMedium" style={styles.selfAssignmentTitle}>
                    {currentAssignedPerson ? formatPersonName(currentAssignedPerson) : t(K.treeSettings.chooseExistingOrCreateOwn)}
                  </Text>
                  <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {currentAssignedPerson
                      ? t(K.treeSettings.openOrUnlinkProfile)
                      : t(K.treeSettings.manualLinkIfNeeded)}
                  </Text>
                </View>
                {currentAssignedPerson ? (
                  <View style={styles.selfAssignmentActions}>
                    <Button mode="contained" icon="open-in-new" onPress={() => openPersonProfile(currentAssignedPerson)} disabled={mutating}>
                      {t(K.common.open)}
                    </Button>
                    <Button
                      mode="text"
                      icon="link-off"
                      textColor={theme.colors.error}
                      onPress={() => openConfirm(
                        t(K.treeSettings.unlinkYourProfile),
                        t(K.treeSettings.unlinkYourProfileConfirm),
                        t(K.common.unlink),
                        onClearSelfAssignment,
                      )}
                      disabled={mutating}
                    >
                      {t(K.common.unlink)}
                    </Button>
                  </View>
                ) : null}
              </View>

              {!canCreateSelfProfile ? (
                <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                  {t(K.treeSettings.linkYourselfEditorAccess)}
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        </Reveal>

        {!currentAssignedPerson ? (
          currentSelfAssignmentSuggestions.length > 0 ? (
            <View style={styles.assignmentSuggestionList}>
              {currentSelfAssignmentSuggestions.slice(0, 3).map((suggestion, index) => (
                <Reveal key={`suggestion-${suggestion.person.id}`} delay={120 + index * 20}>
                  <Card mode="elevated" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface }]}>
                    <Card.Content>
                    <View style={styles.assignmentSuggestionRow}>
                      <View style={styles.assignmentSuggestionTextWrap}>
                        <View style={styles.collaboratorChipRow}>
                          <Chip compact icon={suggestion.tone === 'exact' ? 'star-four-points' : 'lightbulb-on-outline'}>
                            {suggestion.tone === 'exact' ? t(K.treeSettings.suggestedMatch) : t(K.treeSettings.likelyMatch)}
                          </Chip>
                          {suggestion.person.birthDate ? <Chip compact icon="calendar">{suggestion.person.birthDate}</Chip> : null}
                        </View>
                        <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{formatPersonName(suggestion.person)}</Text>
                        <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{suggestion.reason}</Text>
                      </View>
                      <Button mode="contained" onPress={() => handleSelfLink(suggestion.person.id)} disabled={mutating || !userId}>
                        {t(K.treeSettings.linkMe)}
                      </Button>
                    </View>
                    </Card.Content>
                  </Card>
                </Reveal>
              ))}
            </View>
          ) : (
            <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
              {t(K.treeSettings.noProfileMatchYet)}
            </Text>
          )
        ) : null}

        {!currentAssignedPerson ? (
          <Reveal delay={120}>
            <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginTop: 12 }]}>
              <Card.Content>
                <View style={styles.assignmentChooserWrap}>
                  <Text variant="titleMedium">{t(K.treeSettings.linkExistingFamilyMember)}</Text>
                  <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {t(K.treeSettings.searchEveryonePickBest)}
                  </Text>

                  <TextInput
                    mode="outlined"
                    label={t(K.treeSettings.searchExistingFamilyMembers)}
                    value={linkSearchQuery}
                    onChangeText={setLinkSearchQuery}
                    style={styles.assignmentSearchInput}
                    left={<TextInput.Icon icon="magnify" />}
                  />

                  {filteredLinkPeople.length > 0 ? (
                    <View style={styles.assignmentSuggestionList}>
                      {filteredLinkPeople.map((person, index) => (
                        <Reveal key={`assignable-${person.id}`} delay={140 + index * 15}>
                          <Card mode="elevated" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface }]}>
                            <Card.Content>
                              <View style={styles.assignmentSuggestionRow}>
                                <View style={styles.assignmentSuggestionTextWrap}>
                                  <Text variant="titleMedium">{formatPersonName(person)}</Text>
                                  <View style={styles.collaboratorChipRow}>
                                    {person.birthDate ? <Chip compact icon="calendar">{person.birthDate}</Chip> : null}
                                    <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>
                                      {isPersonDeceased(person) ? t(K.common.deceased) : t(K.common.present)}
                                    </Chip>
                                  </View>
                                </View>
                                <Button mode="contained-tonal" onPress={() => handleSelfLink(person.id)} disabled={mutating || !userId}>
                                  {t(K.treeSettings.linkMe)}
                                </Button>
                              </View>
                            </Card.Content>
                          </Card>
                        </Reveal>
                      ))}
                    </View>
                  ) : (
                    <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                      {t(K.treeSettings.noAvailableFamilyMembersMatchSearch)}
                    </Text>
                  )}
                </View>
              </Card.Content>
            </Card>
          </Reveal>
        ) : null}
      </View>
    </>
  );
}

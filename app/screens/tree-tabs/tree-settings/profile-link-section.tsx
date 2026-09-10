import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, GlobalStyles, Reveal, SectionCard } from '../../../../components';
import { isPersonDeceased } from '../../../../components/dto/person';
import { formatPersonName } from '../../../../components/person-formatting';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { OverviewSectionProps } from './tree-settings-shared';
import { getTreeSettingsFamilyMemberCardStyle } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;
const LINK_PAGE_SIZE = 5;


export function ProfileLinkSection({selectedTree, currentUserLabel, currentAssignedPerson, currentSelfAssignmentSuggestions, canCreateSelfProfile, mutating, userId, linkSearchQuery, filteredLinkPeople, onOpenHelperDialog, onOpenAddSelf, openPersonProfile, onAssignPersonToUser, openConfirm, onClearSelfAssignment, setLinkSearchQuery}: Pick<OverviewSectionProps, 'selectedTree' | 'currentUserLabel' | 'currentAssignedPerson' | 'currentSelfAssignmentSuggestions' | 'canCreateSelfProfile' | 'mutating' | 'userId' | 'linkSearchQuery' | 'filteredLinkPeople' | 'onOpenHelperDialog' | 'onOpenAddSelf' | 'openPersonProfile' | 'onAssignPersonToUser' | 'openConfirm' | 'onClearSelfAssignment' | 'setLinkSearchQuery'>) {
  const theme = useTheme();
  const { t } = useI18n();
  const [linkPeoplePage, setLinkPeoplePage] = useState(1);
  const handleSelfLink = async (personId: string) => {
    if (!userId || currentAssignedPerson) {
      return;
    }

    await onAssignPersonToUser(userId, personId);
  };

  const linkPeopleTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredLinkPeople.length / LINK_PAGE_SIZE)),
    [filteredLinkPeople.length],
  );

  const paginatedLinkPeople = useMemo(() => {
    const startIndex = (linkPeoplePage - 1) * LINK_PAGE_SIZE;
    return filteredLinkPeople.slice(startIndex, startIndex + LINK_PAGE_SIZE);
  }, [filteredLinkPeople, linkPeoplePage]);

  useEffect(() => {
    setLinkPeoplePage(1);
  }, [linkSearchQuery, currentAssignedPerson?.id, selectedTree.id]);

  useEffect(() => {
    setLinkPeoplePage((page) => Math.min(page, linkPeopleTotalPages));
  }, [linkPeopleTotalPages]);

  return (
      <View style={styles.selfAssignmentSectionWrap}>
        <Reveal delay={110}>
          <SectionCard style={[styles.selfAssignmentCard, getTreeSettingsFamilyMemberCardStyle(theme)]}>
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
                  <Button mode="contained" icon="account-plus" onPress={onOpenAddSelf} disabled={mutating || !canCreateSelfProfile} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
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
                  {currentAssignedPerson ? (
                    <Text variant="titleMedium" style={styles.selfAssignmentTitle}>
                      {formatPersonName(currentAssignedPerson)}
                    </Text>
                  ) : null}
                </View>
                {currentAssignedPerson ? (
                  <View style={styles.selfAssignmentActions}>
                    <Button mode="contained" icon="open-in-new" onPress={() => openPersonProfile(currentAssignedPerson)} disabled={mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
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
                      style={BUTTON_CHROME}
                      contentStyle={BUTTON_CONTENT_CHROME}
                    >
                      {t(K.common.unlink)}
                    </Button>
                  </View>
                ) : null}
              </View>

              {!currentAssignedPerson ? (
                <>
                  {currentSelfAssignmentSuggestions.length > 0 ? (
                    <View style={styles.assignmentSuggestionList}>
                      {currentSelfAssignmentSuggestions.slice(0, 3).map((suggestion, index) => (
                        <Reveal key={`suggestion-${suggestion.person.id}`} delay={120 + index * 20}>
                          <SectionCard nested style={[styles.assignmentSuggestionCard, getTreeSettingsFamilyMemberCardStyle(theme)]}>
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
                                <Button mode="contained" onPress={() => handleSelfLink(suggestion.person.id)} disabled={mutating || !userId} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                                  {t(K.treeSettings.linkMe)}
                                </Button>
                              </View>
                          </SectionCard>
                        </Reveal>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.assignmentChooserWrap}>
                    <Text variant="titleMedium">{t(K.treeSettings.linkExistingFamilyMember)}</Text>

                    <TextInput
                      mode="outlined"
                      label={t(K.treeSettings.searchExistingFamilyMembers)}
                      value={linkSearchQuery}
                      onChangeText={setLinkSearchQuery}
                      style={styles.assignmentSearchInput}
                      left={<TextInput.Icon icon="magnify" />}
                    />

                    {paginatedLinkPeople.length > 0 ? (
                      <View style={styles.assignmentSuggestionList}>
                        {paginatedLinkPeople.map((person, index) => (
                          <Reveal key={`assignable-${person.id}`} delay={140 + index * 15}>
                            <SectionCard nested style={[styles.assignmentSuggestionCard, getTreeSettingsFamilyMemberCardStyle(theme)]}>
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
                                  <Button mode="contained" onPress={() => handleSelfLink(person.id)} disabled={mutating || !userId} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                                    {t(K.treeSettings.linkMe)}
                                  </Button>
                                </View>
                            </SectionCard>
                          </Reveal>
                        ))}
                      </View>
                    ) : null}

                    {linkPeopleTotalPages > 1 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
                        <IconButton
                          icon="chevron-left"
                          onPress={() => setLinkPeoplePage((page) => Math.max(1, page - 1))}
                          disabled={linkPeoplePage === 1}
                          accessibilityLabel={t(K.tree.familyMembers.previousPage)}
                          mode="outlined"
                          style={BUTTON_CHROME}
                          containerColor={theme.colors.surface}
                          iconColor={theme.colors.primary}
                        />
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {t(K.tree.familyMembers.pageOf, { current: linkPeoplePage, total: linkPeopleTotalPages })}
                        </Text>
                        <IconButton
                          icon="chevron-right"
                          onPress={() => setLinkPeoplePage((page) => Math.min(linkPeopleTotalPages, page + 1))}
                          disabled={linkPeoplePage === linkPeopleTotalPages}
                          accessibilityLabel={t(K.tree.familyMembers.nextPage)}
                          mode="outlined"
                          style={BUTTON_CHROME}
                          containerColor={theme.colors.surface}
                          iconColor={theme.colors.primary}
                        />
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
          </SectionCard>
        </Reveal>
      </View>
  );
}

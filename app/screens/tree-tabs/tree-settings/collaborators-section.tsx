import React from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, GlobalStyles, Reveal, SectionCard } from '../../../../components';
import { formatPersonName } from '../../../../components/person-formatting';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { buildSelfAssignmentSuggestions } from '../shared';
import type { CollaboratorsSectionProps } from './tree-settings-shared';
import { formatRole, getTreeSettingsFamilyMemberCardStyle } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;

export function CollaboratorsSection({
  selectedTree,
  people,
  assignedPersonByUserId,
  assignedUserIdByPersonId,
  canManageCollaborators,
  isOwner,
  userId,
  mutating,
  ownerLinkTargetUserId,
  ownerLinkSearchQuery,
  filteredOwnerLinkPeople,
  ownerLinkPage,
  ownerLinkTotalPages,
  onOpenHelperDialog,
  onOpenCollaboratorDialog,
  openConfirm,
  onRemoveCollaborator,
  onAssignPersonToUser,
  setOwnerLinkSearchQuery,
  setOwnerLinkPage,
  toggleOwnerLinkChooser,
  clearOwnerLinkChooser,
}: CollaboratorsSectionProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const handleOwnerLinkSuggestion = async (targetUserId: string, personId: string) => {
    await onAssignPersonToUser(targetUserId, personId);
    if (ownerLinkTargetUserId === targetUserId) {
      clearOwnerLinkChooser();
    }
  };

  return (
    <View style={styles.collaboratorSectionWrap}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleLarge">{t(K.treeSettings.collaborators)}</Text>
            <IconButton
              icon="information-outline"
              size={18}
              style={styles.helperIconButton}
              onPress={() => onOpenHelperDialog('collaborators')}
              accessibilityLabel={t(K.treeSettings.aboutCollaborators)}
            />
          </View>
        </View>
        {canManageCollaborators ? (
          <Button mode="contained" icon="account-plus" onPress={onOpenCollaboratorDialog} disabled={mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
            {t(K.treeSettings.addCollaborator)}
          </Button>
        ) : null}
      </View>

      <View style={styles.collaboratorList}>
        {selectedTree.collaborators.map((collaborator, collaboratorIndex) => {
          const linkedPerson = assignedPersonByUserId.get(collaborator.userId) ?? null;
          const collaboratorSuggestions = !linkedPerson
            ? buildSelfAssignmentSuggestions(collaborator, people, assignedUserIdByPersonId, collaborator.userId).slice(0, 2)
            : [];
          const isOwnerSuggestionTarget = ownerLinkTargetUserId === collaborator.userId;

            return (
              <Reveal key={collaborator.userId} delay={90 + collaboratorIndex * 25}>
              <SectionCard nested style={[styles.collaboratorCard, getTreeSettingsFamilyMemberCardStyle(theme)]}>
                <View style={styles.collaboratorRow}>
                  <View style={styles.collaboratorTextWrap}>
                    <Text variant="titleMedium">{collaborator.displayName || collaborator.email}</Text>
                    <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{collaborator.email}</Text>
                    <View style={styles.collaboratorChipRow}>
                      <Chip compact>{formatRole(collaborator.role)}</Chip>
                      {collaborator.userId === userId ? <Chip compact icon="account">{t(K.common.you)}</Chip> : null}
                      {linkedPerson ? <Chip compact icon="link-variant">{formatPersonName(linkedPerson)}</Chip> : null}
                    </View>
                  </View>
                  {canManageCollaborators && collaborator.role !== 'owner' ? (
                    <IconButton
                      icon="account-remove"
                      iconColor="#C62828"
                      onPress={() => openConfirm(
                        t(K.treeSettings.removeCollaborator),
                        t(K.treeSettings.removeFromTree, { name: collaborator.displayName || collaborator.email }),
                        t(K.common.remove),
                        async () => onRemoveCollaborator(collaborator.userId),
                      )}
                      disabled={mutating}
                    />
                  ) : null}
                </View>

                {isOwner && collaborator.userId !== userId && !linkedPerson ? (
                  <View style={styles.ownerSuggestionWrap}>
                    <Text variant="titleSmall">{t(K.treeSettings.suggestMatchingFamilyMember)}</Text>
                    <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                      {t(K.treeSettings.helpNameGetStarted, { name: collaborator.displayName || collaborator.email })}
                    </Text>

                    {collaboratorSuggestions.length > 0 ? (
                      <View style={styles.assignmentSuggestionList}>
                        {collaboratorSuggestions.map((suggestion, suggestionIndex) => (
                          <Reveal key={`owner-suggestion-${collaborator.userId}-${suggestion.person.id}`} delay={120 + suggestionIndex * 20}>
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
                                <Button mode="contained" onPress={() => handleOwnerLinkSuggestion(collaborator.userId, suggestion.person.id)} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                                  {t(K.treeSettings.suggest)}
                                </Button>
                              </View>
                            </SectionCard>
                          </Reveal>
                        ))}
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <Button mode="outlined" icon={isOwnerSuggestionTarget ? 'chevron-up' : 'account-search'} onPress={() => toggleOwnerLinkChooser(collaborator.userId)} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                        {isOwnerSuggestionTarget ? t(K.treeSettings.hideChooser) : t(K.treeSettings.browseFamilyMembers)}
                      </Button>
                    </View>

                    {isOwnerSuggestionTarget ? (
                      <View style={styles.assignmentChooserWrap}>
                        <TextInput
                          mode="outlined"
                          label={t(K.common.searchFamilyMembers)}
                          value={ownerLinkSearchQuery}
                          onChangeText={setOwnerLinkSearchQuery}
                          style={styles.assignmentSearchInput}
                          left={<TextInput.Icon icon="magnify" />}
                        />

                        {filteredOwnerLinkPeople.length > 0 ? (
                          <View style={styles.assignmentSuggestionList}>
                            {filteredOwnerLinkPeople.map((person, personIndex) => (
                              <Reveal key={`owner-link-${collaborator.userId}-${person.id}`} delay={140 + personIndex * 15}>
                                <SectionCard nested style={[styles.assignmentSuggestionCard, getTreeSettingsFamilyMemberCardStyle(theme)]}>
                                  <View style={styles.assignmentSuggestionRow}>
                                    <View style={styles.assignmentSuggestionTextWrap}>
                                      <Text variant="titleMedium">{formatPersonName(person)}</Text>
                                      {person.birthDate ? (
                                        <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                                          {person.birthDate}
                                        </Text>
                                      ) : null}
                                    </View>
                                    <Button mode="contained" onPress={() => handleOwnerLinkSuggestion(collaborator.userId, person.id)} disabled={mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                                      {t(K.treeSettings.suggest)}
                                    </Button>
                                  </View>
                                </SectionCard>
                              </Reveal>
                            ))}
                            {ownerLinkTotalPages > 1 ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                <IconButton
                                  icon="chevron-left"
                                  onPress={() => setOwnerLinkPage((page) => Math.max(1, page - 1))}
                                  disabled={ownerLinkPage === 1}
                                  accessibilityLabel={t(K.tree.familyMembers.previousPage)}
                                  mode="outlined"
                                  style={BUTTON_CHROME}
                                  containerColor={theme.colors.surface}
                                  iconColor={theme.colors.primary}
                                />
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                  {t(K.tree.familyMembers.pageOf, { current: ownerLinkPage, total: ownerLinkTotalPages })}
                                </Text>
                                <IconButton
                                  icon="chevron-right"
                                  onPress={() => setOwnerLinkPage((page) => Math.min(ownerLinkTotalPages, page + 1))}
                                  disabled={ownerLinkPage === ownerLinkTotalPages}
                                  accessibilityLabel={t(K.tree.familyMembers.nextPage)}
                                  mode="outlined"
                                  style={BUTTON_CHROME}
                                  containerColor={theme.colors.surface}
                                  iconColor={theme.colors.primary}
                                />
                              </View>
                            ) : null}
                          </View>
                        ) : (
                          <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                            {t(K.treeSettings.noAvailableFamilyMembersMatchSearch)}
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </SectionCard>
            </Reveal>
          );
        })}
      </View>
    </View>
  );
}

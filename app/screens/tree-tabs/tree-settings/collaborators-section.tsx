import React from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { buildSelfAssignmentSuggestions } from '../shared';
import type { CollaboratorsSectionProps } from './tree-settings-shared';
import { formatRole } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;

export function CollaboratorsSection({
  selectedTree,
  people,
  assignedPersonByUserId,
  assignedUserIdByPersonId,
  role,
  isOwner,
  userId,
  mutating,
  ownerLinkTargetUserId,
  ownerLinkSearchQuery,
  filteredOwnerLinkPeople,
  onOpenHelperDialog,
  onOpenCollaboratorDialog,
  openConfirm,
  onRemoveCollaborator,
  onAssignPersonToUser,
  setOwnerLinkSearchQuery,
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
            <Text variant="titleLarge">{t('Collaborators')}</Text>
            <IconButton
              icon="information-outline"
              size={18}
              style={styles.helperIconButton}
              onPress={() => onOpenHelperDialog('collaborators')}
              accessibilityLabel={t('About collaborators')}
            />
          </View>
        </View>
        {isOwner ? (
          <Button mode="contained" icon="account-plus" onPress={onOpenCollaboratorDialog} disabled={mutating}>
            {t('Add collaborator')}
          </Button>
        ) : null}
      </View>

      <View style={styles.collaboratorList}>
        {selectedTree.collaborators.map((collaborator) => {
          const linkedPerson = assignedPersonByUserId.get(collaborator.userId) ?? null;
          const collaboratorSuggestions = !linkedPerson
            ? buildSelfAssignmentSuggestions(collaborator, people, assignedUserIdByPersonId, collaborator.userId).slice(0, 2)
            : [];
          const isOwnerSuggestionTarget = ownerLinkTargetUserId === collaborator.userId;

          return (
            <Card key={collaborator.userId} mode="elevated" style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <View style={styles.collaboratorRow}>
                  <View style={styles.collaboratorTextWrap}>
                    <Text variant="titleMedium">{collaborator.displayName || collaborator.email}</Text>
                    <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{collaborator.email}</Text>
                    <View style={styles.collaboratorChipRow}>
                      <Chip compact>{formatRole(collaborator.role)}</Chip>
                      {collaborator.userId === userId ? <Chip compact icon="account">{t('You')}</Chip> : null}
                      {linkedPerson ? <Chip compact icon="link-variant">{formatPersonName(linkedPerson)}</Chip> : null}
                    </View>
                  </View>
                  {isOwner && collaborator.role !== 'owner' ? (
                    <IconButton
                      icon="account-remove"
                      iconColor="#C62828"
                      onPress={() => openConfirm(
                        t('Remove collaborator'),
                        t('Remove {name} from this tree?', { name: collaborator.displayName || collaborator.email }),
                        t('Remove'),
                        async () => onRemoveCollaborator(collaborator.userId),
                      )}
                      disabled={mutating}
                    />
                  ) : null}
                </View>

                {isOwner && collaborator.userId !== userId && !linkedPerson ? (
                  <View style={styles.ownerSuggestionWrap}>
                    <Text variant="titleSmall">{t('Suggest a matching family member')}</Text>
                    <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                      {t('Help {name} get started by linking the family member that looks like them best.', { name: collaborator.displayName || collaborator.email })}
                    </Text>

                    {collaboratorSuggestions.length > 0 ? (
                      <View style={styles.assignmentSuggestionList}>
                        {collaboratorSuggestions.map((suggestion) => (
                          <Card key={`owner-suggestion-${collaborator.userId}-${suggestion.person.id}`} mode="elevated" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface }]}>
                            <Card.Content>
                              <View style={styles.assignmentSuggestionRow}>
                                <View style={styles.assignmentSuggestionTextWrap}>
                                  <View style={styles.collaboratorChipRow}>
                                    <Chip compact icon={suggestion.tone === 'exact' ? 'star-four-points' : 'lightbulb-on-outline'}>
                                      {suggestion.tone === 'exact' ? t('Suggested match') : t('Likely match')}
                                    </Chip>
                                    {suggestion.person.birthDate ? <Chip compact icon="calendar">{suggestion.person.birthDate}</Chip> : null}
                                  </View>
                                  <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{formatPersonName(suggestion.person)}</Text>
                                  <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{suggestion.reason}</Text>
                                </View>
                                <Button mode="contained-tonal" onPress={() => handleOwnerLinkSuggestion(collaborator.userId, suggestion.person.id)} disabled={mutating}>
                                  {t('Link')}
                                </Button>
                              </View>
                            </Card.Content>
                          </Card>
                        ))}
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <Button mode="outlined" icon={isOwnerSuggestionTarget ? 'chevron-up' : 'account-search'} onPress={() => toggleOwnerLinkChooser(collaborator.userId)}>
                        {isOwnerSuggestionTarget ? t('Hide chooser') : t('Browse family members')}
                      </Button>
                    </View>

                    {isOwnerSuggestionTarget ? (
                      <View style={styles.assignmentChooserWrap}>
                        <TextInput
                          mode="outlined"
                          label={t('Search family members')}
                          value={ownerLinkSearchQuery}
                          onChangeText={setOwnerLinkSearchQuery}
                          style={styles.assignmentSearchInput}
                          left={<TextInput.Icon icon="magnify" />}
                        />

                        {filteredOwnerLinkPeople.length > 0 ? (
                          <View style={styles.assignmentSuggestionList}>
                            {filteredOwnerLinkPeople.map((person) => (
                              <Card key={`owner-link-${collaborator.userId}-${person.id}`} mode="elevated" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface }]}>
                                <Card.Content>
                                  <View style={styles.assignmentSuggestionRow}>
                                    <View style={styles.assignmentSuggestionTextWrap}>
                                      <Text variant="titleMedium">{formatPersonName(person)}</Text>
                                      {person.birthDate ? (
                                        <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                                          {person.birthDate}
                                        </Text>
                                      ) : null}
                                    </View>
                                    <Button mode="contained" onPress={() => handleOwnerLinkSuggestion(collaborator.userId, person.id)} disabled={mutating}>
                                      {t('Link')}
                                    </Button>
                                  </View>
                                </Card.Content>
                              </Card>
                            ))}
                          </View>
                        ) : (
                          <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                            {t('No available family members match that search yet.')}
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

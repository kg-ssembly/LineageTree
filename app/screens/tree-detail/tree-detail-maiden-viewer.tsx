import React from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Chip, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import type { PersonPhoto, PersonRecord } from '../../../components/dto/person';
import { formatPersonDate, getDisplayPersonPhoto, getPersonLifeSpanLabel, getPersonPresenceLabel } from '../../../components/dto/person';
import { formatPersonName } from '../../../components/person-formatting';
import { GlobalStyles } from '../../../constants/styles';
import { I18N_KEYS as K } from '../../../i18n/keys';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;

export function TreeDetailMaidenViewer({
  theme,
  t,
  returnTreeName,
  sharedTabContent,
  canvasActiveFamilyRef,
  canvasFamilySwitchRef,
  maidenMembersVisible,
  setMaidenMembersVisible,
  maidenMemberSearchQuery,
  setMaidenMemberSearchQuery,
  filteredMaidenViewerPeople,
  paginatedMaidenViewerPeople,
  maidenMembersPage,
  maidenMembersTotalPages,
  setMaidenMembersPage,
  viewerPerson,
  setViewerPerson,
  viewerPersonPreferredPhoto,
  viewerProfileTab,
  setViewerProfileTab,
  viewerRelationshipInsight,
  returnTreeAssignedPerson,
  viewerTimeline,
  viewerPhotoIndex,
  setViewerPhotoIndex,
  closeMaidenMembersModal,
  closeViewerPersonDialog,
  navigationGoBack,
}: {
  theme: any;
  t: (message: string, params?: Record<string, string | number | null | undefined>) => string;
  returnTreeName?: string | null;
  sharedTabContent: React.ReactNode;
  canvasActiveFamilyRef: React.MutableRefObject<string | null>;
  canvasFamilySwitchRef: React.MutableRefObject<((surname: string) => void) | null>;
  maidenMembersVisible: boolean;
  setMaidenMembersVisible: React.Dispatch<React.SetStateAction<boolean>>;
  maidenMemberSearchQuery: string;
  setMaidenMemberSearchQuery: (value: string) => void;
  filteredMaidenViewerPeople: PersonRecord[];
  paginatedMaidenViewerPeople: PersonRecord[];
  maidenMembersPage: number;
  maidenMembersTotalPages: number;
  setMaidenMembersPage: React.Dispatch<React.SetStateAction<number>>;
  viewerPerson: PersonRecord | null;
  setViewerPerson: React.Dispatch<React.SetStateAction<PersonRecord | null>>;
  viewerPersonPreferredPhoto: PersonPhoto | null | undefined;
  viewerProfileTab: 'summary' | 'life' | 'photos';
  setViewerProfileTab: React.Dispatch<React.SetStateAction<'summary' | 'life' | 'photos'>>;
  viewerRelationshipInsight: { relationship: string } | null;
  returnTreeAssignedPerson: PersonRecord | null;
  viewerTimeline: Array<{ id: string; date: string; title: string; description: string; badgeLabel: string }>;
  viewerPhotoIndex: number | null;
  setViewerPhotoIndex: React.Dispatch<React.SetStateAction<number | null>>;
  closeMaidenMembersModal: () => void;
  closeViewerPersonDialog: () => void;
  navigationGoBack: () => void;
}) {
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Button mode="contained-tonal" icon="arrow-left" onPress={navigationGoBack} style={{ borderRadius: 999 }} contentStyle={{ paddingHorizontal: 6 }}>
          {t('Back to {treeName}', { treeName: returnTreeName ?? t('original tree') })}
        </Button>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton
            mode="contained"
            icon="family-tree"
            onPress={() => {
              if (canvasActiveFamilyRef.current) {
                canvasFamilySwitchRef.current?.(canvasActiveFamilyRef.current);
              }
            }}
          />
          <IconButton
            mode={maidenMembersVisible ? 'contained' : 'contained-tonal'}
            icon="account-group-outline"
            onPress={() => setMaidenMembersVisible(true)}
            selected={maidenMembersVisible}
          />
        </View>
      </View>

      <View style={{ flex: 1, paddingTop: 84 }}>
        {sharedTabContent}
      </View>

      <Portal>
        <Dialog visible={maidenMembersVisible} onDismiss={closeMaidenMembersModal} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface, maxHeight: '88%' }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.tree.familyMembers.maidenTitle)}</Dialog.Title>
          <IconButton icon="close" size={20} onPress={closeMaidenMembersModal} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          <Dialog.ScrollArea style={dialogChrome.content}>
            <View style={{ gap: 12, paddingBottom: 8 }}>
              <View style={styles.searchRow}>
                <TextInput
                  mode="outlined"
                  label={t(K.tree.familyMembers.search)}
                  value={maidenMemberSearchQuery}
                  onChangeText={setMaidenMemberSearchQuery}
                  style={styles.searchBar}
                  left={<TextInput.Icon icon="magnify" />}
                  right={maidenMemberSearchQuery ? <TextInput.Icon icon="close" onPress={() => setMaidenMemberSearchQuery('')} /> : undefined}
                />
              </View>
              {filteredMaidenViewerPeople.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text variant="titleMedium">{t(K.tree.familyMembers.noMatches)}</Text>
                  <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                    {t('Try adjusting the search.')}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={[styles.resultsPill, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t(K.tree.familyMembers.count, { count: filteredMaidenViewerPeople.length })}
                    </Text>
                  </View>
                  <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
                    {paginatedMaidenViewerPeople.map((person) => (
                      <Pressable
                        key={person.id}
                        onPress={() => {
                          setMaidenMembersVisible(false);
                          setViewerPerson(person);
                          setViewerProfileTab('summary');
                          setViewerPhotoIndex(null);
                        }}
                      >
                        <Card mode="contained" style={{ borderRadius: 12 }}>
                          <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {getDisplayPersonPhoto(person) ? (
                              <Image source={{ uri: getDisplayPersonPhoto(person)!.url }} style={{ width: 52, height: 52, borderRadius: 10 }} />
                            ) : (
                              <View style={{ width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceVariant }}>
                                <MaterialCommunityIcons name="account" size={22} color={theme.colors.primary} />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text variant="titleMedium">{formatPersonName(person)}</Text>
                              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                {getPersonLifeSpanLabel(person)}
                              </Text>
                            </View>
                            <IconButton icon="chevron-right" size={18} />
                          </Card.Content>
                        </Card>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {maidenMembersTotalPages > 1 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <IconButton icon="chevron-left" onPress={() => setMaidenMembersPage((page) => Math.max(1, page - 1))} disabled={maidenMembersPage === 1} accessibilityLabel={t('Previous page')} />
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        {t('Page {current} of {total}', { current: maidenMembersPage, total: maidenMembersTotalPages })}
                      </Text>
                      <IconButton icon="chevron-right" onPress={() => setMaidenMembersPage((page) => Math.min(maidenMembersTotalPages, page + 1))} disabled={maidenMembersPage === maidenMembersTotalPages} accessibilityLabel={t('Next page')} />
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </Dialog.ScrollArea>
        </Dialog>

        <Dialog visible={Boolean(viewerPerson)} onDismiss={closeViewerPersonDialog} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface, maxHeight: '88%' }]}>
          <Button
            mode="text"
            icon="arrow-left"
            onPress={() => {
              setViewerPerson(null);
              setViewerProfileTab('summary');
              setViewerPhotoIndex(null);
              setMaidenMembersVisible(true);
            }}
            style={{ alignSelf: 'flex-start', marginTop: 8, marginLeft: 8 }}
            contentStyle={{ justifyContent: 'flex-start' }}
          >
            {t('Back to members')}
          </Button>
          <IconButton icon="close" size={20} onPress={closeViewerPersonDialog} style={dialogChrome.closeButton} accessibilityLabel={t('Close')} />
          {viewerPerson ? (
            <Dialog.Content style={dialogChrome.content}>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                {viewerPersonPreferredPhoto ? (
                  <Image source={{ uri: viewerPersonPreferredPhoto.url }} style={{ width: 72, height: 72, borderRadius: 12 }} />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceVariant }}>
                    <MaterialCommunityIcons name="account" size={30} color={theme.colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text variant="titleLarge">{formatPersonName(viewerPerson)}</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{getPersonLifeSpanLabel(viewerPerson)}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{getPersonPresenceLabel(viewerPerson)}</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                {[
                  { key: 'summary', label: t('Summary') },
                  { key: 'life', label: t('Life events') },
                  { key: 'photos', label: t('Photos') },
                ].map((item) => (
                  <Chip key={item.key} selected={viewerProfileTab === item.key} onPress={() => setViewerProfileTab(item.key as 'summary' | 'life' | 'photos')}>
                    {item.label}
                  </Chip>
                ))}
              </ScrollView>

              <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingBottom: 8 }}>
                {viewerProfileTab === 'summary' ? (
                  <View style={{ gap: 12 }}>
                    <Card mode="contained" style={{ borderRadius: 12 }}>
                      <Card.Content>
                        <Text variant="titleMedium">{t('How you relate')}</Text>
                        <Text variant="bodyMedium" style={{ marginTop: 8 }}>
                          {returnTreeAssignedPerson && viewerRelationshipInsight
                            ? t('{name} is your {relationship}', {
                              name: viewerPerson.firstName || formatPersonName(viewerPerson),
                              relationship: viewerRelationshipInsight.relationship.toLowerCase(),
                            })
                            : returnTreeAssignedPerson
                              ? t('No family connection found in this tree yet.')
                              : t('No linked profile found in the original tree.')}
                        </Text>
                      </Card.Content>
                    </Card>
                    <Card mode="contained" style={{ borderRadius: 12 }}>
                      <Card.Content>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {viewerPerson.maidenName?.trim() ? <Chip>{viewerPerson.maidenName.trim()}</Chip> : null}
                          {viewerPerson.birthDate ? <Chip icon="calendar">{formatPersonDate(viewerPerson.birthDate)}</Chip> : null}
                          {viewerPerson.deathDate ? <Chip icon="calendar-remove">{formatPersonDate(viewerPerson.deathDate)}</Chip> : null}
                        </View>
                        <Text variant="bodyMedium" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
                          {viewerPerson.notes?.trim() || t('No notes added yet.')}
                        </Text>
                      </Card.Content>
                    </Card>
                  </View>
                ) : null}

                {viewerProfileTab === 'life' ? (
                  viewerTimeline.length > 0 ? (
                    <View style={{ gap: 12 }}>
                      {viewerTimeline.map((item) => (
                        <Card key={item.id} mode="contained" style={{ borderRadius: 12 }}>
                          <Card.Content>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                              <Chip compact>{item.badgeLabel}</Chip>
                              <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                            </View>
                            <Text variant="titleMedium">{item.title}</Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                              {item.description}
                            </Text>
                          </Card.Content>
                        </Card>
                      ))}
                    </View>
                  ) : (
                    <View style={{ paddingVertical: 12 }}>
                      <Text variant="titleMedium">{t('No life events yet')}</Text>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        {t('Life milestones and memories will appear here.')}
                      </Text>
                    </View>
                  )
                ) : null}

                {viewerProfileTab === 'photos' ? (
                  viewerPerson.photos.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
                      {viewerPerson.photos.map((photo, index) => (
                        <Pressable key={photo.id} onPress={() => setViewerPhotoIndex(index)}>
                          <Card mode="elevated" style={{ borderRadius: 12, overflow: 'hidden' }}>
                            <Image source={{ uri: photo.url }} style={{ width: 180, height: 180 }} />
                          </Card>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={{ paddingVertical: 12 }}>
                      <Text variant="titleMedium">{t('No photos yet')}</Text>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        {t('Photos and scanned keepsakes will show up here.')}
                      </Text>
                    </View>
                  )
                ) : null}
              </ScrollView>
            </Dialog.Content>
          ) : null}
        </Dialog>
      </Portal>

      <Modal visible={viewerPhotoIndex !== null && Boolean(viewerPerson)} transparent animationType="fade" onRequestClose={() => setViewerPhotoIndex(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <IconButton icon="close" size={24} iconColor="#fff" style={{ position: 'absolute', top: 24, right: 24, zIndex: 2 }} onPress={() => setViewerPhotoIndex(null)} />
          {viewerPerson && viewerPhotoIndex !== null ? (
            <Image source={{ uri: (viewerPerson.photos[viewerPhotoIndex] as PersonPhoto | undefined)?.url }} style={{ width: '100%', height: '80%', resizeMode: 'contain' }} />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

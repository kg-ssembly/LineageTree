import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Button, Card, Chip, IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { HorizontalTabStrip } from '../../../../components';
import type { NewPersonPhotoInput, PersonLifeEvent, PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { formatPersonDate } from '../../../../components/dto/person';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const styles = GlobalStyles.personProfile;

export type PersonMemorySectionTabKey = 'notes' | 'photos' | 'events';

export function PersonMemoriesSection({
  person,
  preferredPhoto,
  canEdit,
  mutating,
  memorySectionTab,
  setMemorySectionTab,
  memoryTimeline,
  onOpenHelperDialog,
  onOpenNotesDialog,
  onAddPhotoFromLibrary,
  onAddPhotoFromCamera,
  onRemovePhoto,
  onSetPreferredPhoto,
  onUpdatePhotoDetails,
  photoProcessing,
  onOpenViewer,
  onAddLifeEvent,
  onEditLifeEvent,
}: {
  person: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
  canEdit: boolean;
  mutating: boolean;
  memorySectionTab: PersonMemorySectionTabKey;
  setMemorySectionTab: (tab: PersonMemorySectionTabKey) => void;
  memoryTimeline: Array<{ id: string; date: string; title: string; description: string; badgeLabel: string; system: boolean }>;
  onOpenHelperDialog: () => void;
  onOpenNotesDialog: () => void;
  onAddPhotoFromLibrary: () => void;
  onAddPhotoFromCamera: () => void;
  onRemovePhoto: (photo: PersonPhoto) => void;
  onSetPreferredPhoto: (photo: PersonPhoto, crop: boolean) => void;
  onUpdatePhotoDetails: (photo: PersonPhoto, values: Pick<NewPersonPhotoInput, 'title' | 'description'>) => void;
  photoProcessing: boolean;
  onOpenViewer: (index: number) => void;
  onAddLifeEvent: () => void;
  onEditLifeEvent: (event: PersonLifeEvent) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, { title: string; description: string }>>({});

  useEffect(() => {
    const nextDrafts = person.photos.reduce<Record<string, { title: string; description: string }>>((acc, photo) => {
      acc[photo.id] = {
        title: photo.title ?? '',
        description: photo.description ?? '',
      };
      return acc;
    }, {});
    setPhotoDrafts(nextDrafts);
  }, [person.photos]);

  const photoCards = useMemo(
    () => person.photos.map((photo, index) => ({ photo, index, draft: photoDrafts[photo.id] ?? { title: photo.title ?? '', description: photo.description ?? '' } })),
    [person.photos, photoDrafts],
  );

  return (
    <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={styles.titleWithHelperRow}>
        <Text variant="titleLarge">{t(K.memories.memoriesAndGallery)}</Text>
        <IconButton
          icon="information-outline"
          size={20}
          style={styles.helperIconButton}
          onPress={onOpenHelperDialog}
          accessibilityLabel={t(K.memories.aboutMemoriesAndGallery)}
        />
      </View>

      <HorizontalTabStrip
        items={[
          { key: 'events', label: t(K.memories.lifeEvents) },
          { key: 'photos', label: t(K.memories.photos) },
          { key: 'notes', label: t(K.memories.notes) },
        ]}
        activeKey={memorySectionTab}
        onChange={(value) => setMemorySectionTab(value as PersonMemorySectionTabKey)}
        containerStyle={[styles.tabStripCard, { backgroundColor: theme.colors.surface }]}
        contentContainerStyle={styles.tabStripContent}
        itemStyle={styles.tabStripItem}
      />

      {memorySectionTab === 'notes' ? (
        <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.notes)}</Text>
            </View>
            {canEdit ? (
              <Button mode="contained-tonal" icon="pencil" onPress={onOpenNotesDialog}>
                {person.notes ? t(K.memories.editNotes) : t(K.memories.addNotes)}
              </Button>
            ) : null}
          </View>
          <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
            {person.notes || t(K.memories.noNotesAddedYet)}
          </Text>
        </View>
      ) : null}

      {memorySectionTab === 'photos' ? (
        <View style={styles.gallerySection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.photoGalleryCount, { count: person.photos.length })}</Text>
            </View>
            {canEdit ? (
              <View style={styles.memoryDialogPhotoActions}>
                <Button mode="contained-tonal" icon="image" onPress={onAddPhotoFromLibrary} disabled={photoProcessing}>
                  {t(K.common.library)}
                </Button>
                <Button mode="contained-tonal" icon="camera" onPress={onAddPhotoFromCamera} disabled={photoProcessing}>
                  {t(K.common.camera)}
                </Button>
              </View>
            ) : null}
          </View>
          {person.photos.length > 0 ? (
            <View style={styles.galleryGrid}>
              {photoCards.map(({ photo, index, draft }) => (
                <Card key={photo.id} mode="elevated" style={[styles.photoCard, styles.photoGridCard, preferredPhoto?.id === photo.id && styles.photoCardPreferred]}>
                  <Pressable onPress={() => onOpenViewer(index)}>
                    <Image source={{ uri: photo.url }} style={styles.photo} />
                  </Pressable>
                  <View style={styles.photoMeta}>
                    <Text variant="titleSmall">{draft.title || t('Untitled photo')}</Text>
                    {draft.description ? (
                      <Text variant="bodySmall" style={[styles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>{draft.description}</Text>
                    ) : null}
                    {canEdit ? (
                      <>
                        <TextInput
                          mode="outlined"
                          dense
                          label={t('Photo title')}
                          value={draft.title}
                          onChangeText={(value) => setPhotoDrafts((current) => ({ ...current, [photo.id]: { ...current[photo.id], title: value, description: current[photo.id]?.description ?? draft.description } }))}
                        />
                        <TextInput
                          mode="outlined"
                          dense
                          multiline
                          label={t('Photo description')}
                          value={draft.description}
                          onChangeText={(value) => setPhotoDrafts((current) => ({ ...current, [photo.id]: { title: current[photo.id]?.title ?? draft.title, description: value } }))}
                          style={styles.photoMetaField}
                        />
                        <View style={styles.photoActionRow}>
                          <Button compact mode="text" onPress={() => onSetPreferredPhoto(photo, false)} disabled={photoProcessing}>
                            {preferredPhoto?.id === photo.id ? t('Profile photo') : t('Set profile')}
                          </Button>
                          <Button compact mode="text" onPress={() => onSetPreferredPhoto(photo, true)} disabled={photoProcessing}>
                            {t('Crop profile')}
                          </Button>
                          <IconButton icon="content-save-outline" size={18} onPress={() => onUpdatePhotoDetails(photo, draft)} disabled={photoProcessing} />
                          <IconButton icon="trash-can-outline" size={18} onPress={() => onRemovePhoto(photo)} disabled={photoProcessing} />
                        </View>
                      </>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noPhotosYet)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.memories.photosAndKeepsakes)}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {memorySectionTab === 'events' ? (
        <View style={styles.lifeEventsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.lifeEventsCount, { count: memoryTimeline.length })}</Text>
            </View>
            {canEdit ? (
              <Button mode="contained-tonal" icon="plus" onPress={onAddLifeEvent}>
                {t(K.memories.addEvent)}
              </Button>
            ) : null}
          </View>

          {memoryTimeline.length > 0 ? (
            <View style={styles.relationshipList}>
              {memoryTimeline.map((item) => {
                const editableEvent = !item.system ? person.lifeEvents.find((event) => event.id === item.id) ?? null : null;
                return (
                  <View key={item.id} style={[styles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.relationshipRow}>
                      <View style={styles.relationshipTextWrap}>
                        <View style={styles.timelineChipRow}>
                          <Chip compact>{item.badgeLabel}</Chip>
                          <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                        </View>
                        <Text variant="titleMedium" style={styles.relationshipTitle}>{item.title}</Text>
                        <Text variant="bodySmall" style={[styles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>{item.description}</Text>
                      </View>
                      {canEdit && editableEvent ? (
                        <View style={styles.rowActions}>
                          <IconButton icon="pencil" onPress={() => onEditLifeEvent(editableEvent)} disabled={mutating} />
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noMemoriesYet)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.memories.startWithMilestones)}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </Surface>
  );
}

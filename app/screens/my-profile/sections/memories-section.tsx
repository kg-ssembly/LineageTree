import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Button, Card, Chip, IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { HorizontalTabStrip } from '../../../../components';
import type { NewPersonPhotoInput, PersonLifeEvent, PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { formatPersonDate } from '../../../../components/dto/person';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const personProfileStyles = GlobalStyles.personProfile;

export type MemorySectionTabKey = 'events' | 'photos' | 'notes';

export function MemoriesSection({
  linkedPerson,
  preferredPhoto,
  memorySectionTab,
  setMemorySectionTab,
  memoryTimeline,
  canEditLinkedProfile,
  mutating,
  onOpenNotesDialog,
  onAddPhotoFromLibrary,
  onAddPhotoFromCamera,
  onRemovePhoto,
  onSetPreferredPhoto,
  onUpdatePhotoDetails,
  photoProcessing,
  onAddLifeEvent,
  onEditLifeEvent,
  onOpenViewer,
}: {
  linkedPerson: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
  memorySectionTab: MemorySectionTabKey;
  setMemorySectionTab: (tab: MemorySectionTabKey) => void;
  memoryTimeline: Array<{ id: string; date: string; title: string; description: string; badgeLabel: string; system: boolean }>;
  canEditLinkedProfile: boolean;
  mutating: boolean;
  onOpenNotesDialog: () => void;
  onAddPhotoFromLibrary: () => void;
  onAddPhotoFromCamera: () => void;
  onRemovePhoto: (photo: PersonPhoto) => void;
  onSetPreferredPhoto: (photo: PersonPhoto, crop: boolean) => void;
  onUpdatePhotoDetails: (photo: PersonPhoto, values: Pick<NewPersonPhotoInput, 'title' | 'description'>) => void;
  photoProcessing: boolean;
  onAddLifeEvent: () => void;
  onEditLifeEvent: (event: PersonLifeEvent) => void;
  onOpenViewer: (index: number) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, { title: string; description: string }>>({});

  useEffect(() => {
    const nextDrafts = linkedPerson.photos.reduce<Record<string, { title: string; description: string }>>((acc, photo) => {
      acc[photo.id] = {
        title: photo.title ?? '',
        description: photo.description ?? '',
      };
      return acc;
    }, {});
    setPhotoDrafts(nextDrafts);
  }, [linkedPerson.photos]);

  const photoCards = useMemo(
    () => linkedPerson.photos.map((photo, index) => ({ photo, index, draft: photoDrafts[photo.id] ?? { title: photo.title ?? '', description: photo.description ?? '' } })),
    [linkedPerson.photos, photoDrafts],
  );

  return (
    <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <Text variant="titleLarge">{t(K.memories.memories)}</Text>

      <HorizontalTabStrip
        items={[
          { key: 'events', label: t(K.memories.lifeEvents) },
          { key: 'photos', label: t(K.memories.photos) },
          { key: 'notes', label: t(K.memories.notes) },
        ]}
        activeKey={memorySectionTab}
        onChange={(value) => setMemorySectionTab(value as MemorySectionTabKey)}
        containerStyle={[personProfileStyles.tabStripCard, { backgroundColor: theme.colors.surface }]}
        contentContainerStyle={personProfileStyles.tabStripContent}
        itemStyle={personProfileStyles.tabStripItem}
      />

      {memorySectionTab === 'notes' ? (
        <View style={[personProfileStyles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View style={personProfileStyles.sectionHeader}>
            <View style={personProfileStyles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.notes)}</Text>
            </View>
            {canEditLinkedProfile ? (
              <Button mode="contained-tonal" icon="pencil" onPress={onOpenNotesDialog}>
                {linkedPerson.notes ? t(K.memories.editNotes) : t(K.memories.addNotes)}
              </Button>
            ) : null}
          </View>
          <Text variant="bodyMedium" style={[personProfileStyles.notesText, { color: theme.colors.onSurfaceVariant }]}>
            {linkedPerson.notes || t(K.memories.noNotesAddedYet)}
          </Text>
        </View>
      ) : null}

      {memorySectionTab === 'photos' ? (
        <View style={personProfileStyles.gallerySection}>
          <View style={personProfileStyles.sectionHeader}>
            <View style={personProfileStyles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.photoGalleryCount, { count: linkedPerson.photos.length })}</Text>
            </View>
            {canEditLinkedProfile ? (
              <View style={personProfileStyles.memoryDialogPhotoActions}>
                <Button mode="contained-tonal" icon="image" onPress={onAddPhotoFromLibrary} disabled={photoProcessing}>
                  {t(K.common.library)}
                </Button>
                <Button mode="contained-tonal" icon="camera" onPress={onAddPhotoFromCamera} disabled={photoProcessing}>
                  {t(K.common.camera)}
                </Button>
              </View>
            ) : null}
          </View>
          {linkedPerson.photos.length > 0 ? (
            <View style={personProfileStyles.galleryGrid}>
              {photoCards.map(({ photo, index, draft }) => (
                <Card key={photo.id} mode="elevated" style={[personProfileStyles.photoCard, personProfileStyles.photoGridCard, preferredPhoto?.id === photo.id && personProfileStyles.photoCardPreferred]}>
                  <Pressable onPress={() => onOpenViewer(index)}>
                    <Image source={{ uri: photo.url }} style={personProfileStyles.photo} />
                  </Pressable>
                  <View style={personProfileStyles.photoMeta}>
                    <Text variant="titleSmall">{draft.title || t('Untitled photo')}</Text>
                    {draft.description ? (
                      <Text variant="bodySmall" style={[personProfileStyles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        {draft.description}
                      </Text>
                    ) : null}
                    {canEditLinkedProfile ? (
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
                          style={personProfileStyles.photoMetaField}
                        />
                        <View style={personProfileStyles.photoActionRow}>
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
            <View style={personProfileStyles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noPhotosYet)}</Text>
              <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.memories.photosAndKeepsakes)}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {memorySectionTab === 'events' ? (
        <View style={personProfileStyles.lifeEventsSection}>
          <View style={personProfileStyles.sectionHeader}>
            <View style={personProfileStyles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.lifeEventsCount, { count: memoryTimeline.length })}</Text>
            </View>
            {canEditLinkedProfile ? (
              <Button mode="contained-tonal" icon="plus" onPress={onAddLifeEvent}>
                {t(K.memories.addEvent)}
              </Button>
            ) : null}
          </View>

          {memoryTimeline.length > 0 ? (
            <View style={personProfileStyles.relationshipList}>
              {memoryTimeline.map((item) => {
                const editableEvent = !item.system ? linkedPerson.lifeEvents.find((event) => event.id === item.id) ?? null : null;
                return (
                  <View key={item.id} style={[personProfileStyles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={personProfileStyles.relationshipRow}>
                      <View style={personProfileStyles.relationshipTextWrap}>
                        <View style={personProfileStyles.timelineChipRow}>
                          <Chip compact>{item.badgeLabel}</Chip>
                          <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                        </View>
                        <Text variant="titleMedium" style={personProfileStyles.relationshipTitle}>{item.title}</Text>
                        <Text variant="bodySmall" style={[personProfileStyles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                          {item.description}
                        </Text>
                      </View>
                      {canEditLinkedProfile && editableEvent ? (
                        <View style={personProfileStyles.rowActions}>
                          <Button mode="text" onPress={() => onEditLifeEvent(editableEvent)} disabled={mutating} compact>
                            {t('Edit')}
                          </Button>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={personProfileStyles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noMemoriesYet)}</Text>
              <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.memories.startWithMilestones)}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </Surface>
  );
}

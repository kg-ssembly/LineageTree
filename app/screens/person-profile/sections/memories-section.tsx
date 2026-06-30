import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Button, Card, Chip, IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { HorizontalTabStrip, Reveal } from '../../../../components';
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
      <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
        Moments, photographs, and story fragments that make this page feel human.
      </Text>

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
                {person.notes ? 'Shape the story' : 'Add the first story note'}
              </Button>
            ) : null}
          </View>
          <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
            {person.notes || t('No story note yet. A single detail, phrase, or memory can make this page feel instantly alive.')}
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
                  Bring in photos
                </Button>
                <Button mode="contained-tonal" icon="camera" onPress={onAddPhotoFromCamera} disabled={photoProcessing}>
                  Capture a moment
                </Button>
              </View>
            ) : null}
          </View>
          {person.photos.length > 0 ? (
            <View style={styles.galleryGrid}>
              {photoCards.map(({ photo, index, draft }) => (
                <Reveal key={photo.id} delay={80 + index * 50} style={styles.photoGridCard}>
                <Card mode="elevated" style={[styles.photoCard, preferredPhoto?.id === photo.id && styles.photoCardPreferred]}>
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
                            {preferredPhoto?.id === photo.id ? 'Featured portrait' : 'Feature this'}
                          </Button>
                          <Button compact mode="text" onPress={() => onSetPreferredPhoto(photo, true)} disabled={photoProcessing}>
                            Refine crop
                          </Button>
                          <IconButton icon="content-save-outline" size={18} onPress={() => onUpdatePhotoDetails(photo, draft)} disabled={photoProcessing} />
                          <IconButton icon="trash-can-outline" size={18} onPress={() => onRemovePhoto(photo)} disabled={photoProcessing} />
                        </View>
                      </>
                    ) : null}
                  </View>
                </Card>
                </Reveal>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noPhotosYet)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                Start with one portrait, keepsake, or candid memory and the gallery will begin to feel lived in.
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
                Add a memory
              </Button>
            ) : null}
          </View>

          {memoryTimeline.length > 0 ? (
            <View style={styles.timelineList}>
              {memoryTimeline.map((item, index) => {
                const editableEvent = !item.system ? person.lifeEvents.find((event) => event.id === item.id) ?? null : null;
                return (
                  <Reveal key={item.id} delay={90 + index * 55}>
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        <View style={[styles.timelineDot, { backgroundColor: item.system ? theme.colors.secondary : theme.colors.primary }]} />
                        {index < memoryTimeline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: theme.colors.outlineVariant }]} /> : null}
                      </View>
                      <View style={[styles.timelineStoryCard, { backgroundColor: theme.colors.surface }]}>
                        {preferredPhoto && index === 0 ? <Image source={{ uri: preferredPhoto.url }} style={styles.timelinePhoto} /> : null}
                        <View style={styles.timelineChipRow}>
                          <Chip compact>{item.badgeLabel}</Chip>
                          <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                        </View>
                        <Text variant="titleMedium" style={styles.relationshipTitle}>{item.title}</Text>
                        <Text variant="bodyMedium" style={[styles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>{item.description || 'A remembered family moment.'}</Text>
                        {canEdit && editableEvent ? (
                          <Button mode="text" onPress={() => onEditLifeEvent(editableEvent)} disabled={mutating} compact style={styles.timelineAction}>
                            Refine this memory
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  </Reveal>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noMemoriesYet)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                Begin with a birth, a move, a wedding, or a quiet memory only close family would know.
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </Surface>
  );
}

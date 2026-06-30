import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Button, Card, Chip, IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { HorizontalTabStrip, Reveal } from '../../../../components';
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
      <Text variant="bodyMedium" style={[personProfileStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
        A living scrapbook of milestones, photos, and the little details worth keeping.
      </Text>

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
                {linkedPerson.notes ? 'Shape the story' : 'Add the first story note'}
              </Button>
            ) : null}
          </View>
          <Text variant="bodyMedium" style={[personProfileStyles.notesText, { color: theme.colors.onSurfaceVariant }]}>
            {linkedPerson.notes || t('No story note yet. Add a voice, a memory, or a small detail that family will recognize instantly.')}
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
                  Bring in photos
                </Button>
                <Button mode="contained-tonal" icon="camera" onPress={onAddPhotoFromCamera} disabled={photoProcessing}>
                  Capture a moment
                </Button>
              </View>
            ) : null}
          </View>
          {linkedPerson.photos.length > 0 ? (
            <View style={personProfileStyles.galleryGrid}>
              {photoCards.map(({ photo, index, draft }) => (
                <Reveal key={photo.id} delay={80 + index * 50} style={personProfileStyles.photoGridCard}>
                <Card mode="elevated" style={[personProfileStyles.photoCard, preferredPhoto?.id === photo.id && personProfileStyles.photoCardPreferred]}>
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
            <View style={personProfileStyles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noPhotosYet)}</Text>
              <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                Start with one portrait, keepsake, or candid memory and this scrapbook will begin to take shape.
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
                Add a memory
              </Button>
            ) : null}
          </View>

          {memoryTimeline.length > 0 ? (
            <View style={personProfileStyles.timelineList}>
              {memoryTimeline.map((item, index) => {
                const editableEvent = !item.system ? linkedPerson.lifeEvents.find((event) => event.id === item.id) ?? null : null;
                return (
                  <Reveal key={item.id} delay={90 + index * 55}>
                    <View style={personProfileStyles.timelineRow}>
                      <View style={personProfileStyles.timelineRail}>
                        <View style={[personProfileStyles.timelineDot, { backgroundColor: item.system ? theme.colors.secondary : theme.colors.primary }]} />
                        {index < memoryTimeline.length - 1 ? <View style={[personProfileStyles.timelineLine, { backgroundColor: theme.colors.outlineVariant }]} /> : null}
                      </View>
                      <View style={[personProfileStyles.timelineStoryCard, { backgroundColor: theme.colors.surface }]}>
                        {preferredPhoto && index === 0 ? <Image source={{ uri: preferredPhoto.url }} style={personProfileStyles.timelinePhoto} /> : null}
                        <View style={personProfileStyles.timelineChipRow}>
                          <Chip compact>{item.badgeLabel}</Chip>
                          <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                        </View>
                        <Text variant="titleMedium" style={personProfileStyles.relationshipTitle}>{item.title}</Text>
                        <Text variant="bodyMedium" style={[personProfileStyles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                          {item.description || 'A remembered family moment.'}
                        </Text>
                        {canEditLinkedProfile && editableEvent ? (
                          <Button mode="text" onPress={() => onEditLifeEvent(editableEvent)} disabled={mutating} compact style={personProfileStyles.timelineAction}>
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
            <View style={personProfileStyles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noMemoriesYet)}</Text>
              <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                Begin with a birth, a move, a wedding, or a quiet memory only your family would know.
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </Surface>
  );
}

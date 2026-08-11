import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, Dialog, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, CachedImage, GlobalStyles, HorizontalTabStrip, Reveal, SectionCard, TabStripCard } from '../../../../components';
import type { NewPersonPhotoInput, PersonLifeEvent, PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { formatPersonDate } from '../../../../components/dto/person';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { getFamilyMemberCardStyle } from '../../profile-shared/profile-card-shared';

const styles = GlobalStyles.personProfile;
const dialogChrome = GlobalStyles.dialogChrome;
const MAX_ANIMATED_PHOTO_CARDS = 6;
const MAX_ANIMATED_TIMELINE_ROWS = 6;
const PHOTO_ANIMATION_THRESHOLD = 8;
const TIMELINE_ANIMATION_THRESHOLD = 10;

export type PersonMemorySectionTabKey = 'notes' | 'photos' | 'events';

function syncPhotoDrafts(
  currentDrafts: Record<string, { description: string; linkedLifeEventId: string }>,
  photos: PersonPhoto[],
) {
  let changed = false;
  const nextDrafts: Record<string, { description: string; linkedLifeEventId: string }> = {};

  for (const photo of photos) {
    const description = photo.description ?? '';
    const linkedLifeEventId = photo.linkedLifeEventId ?? '';
    const existingDraft = currentDrafts[photo.id];

    if (existingDraft && existingDraft.description === description && existingDraft.linkedLifeEventId === linkedLifeEventId) {
      nextDrafts[photo.id] = existingDraft;
      continue;
    }

    nextDrafts[photo.id] = { description, linkedLifeEventId };
    changed = true;
  }

  if (!changed && Object.keys(currentDrafts).length === photos.length) {
    return currentDrafts;
  }

  return nextDrafts;
}

function MaybeReveal({
  enabled,
  delay,
  style,
  children,
}: {
  enabled: boolean;
  delay?: number;
  style?: React.ComponentProps<typeof Reveal>['style'];
  children: React.ReactNode;
}) {
  if (!enabled) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Reveal delay={delay} style={style}>
      {children}
    </Reveal>
  );
}

export function PersonMemoriesSection({
  person,
  preferredPhoto,
  canEdit,
  mutating,
  selectedPhotoId,
  setSelectedPhotoId,
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
  onUpdatePhotoDetails: (photo: PersonPhoto, values: Pick<NewPersonPhotoInput, 'description' | 'linkedLifeEventId'>) => void;
  photoProcessing: boolean;
  onOpenViewer: (index: number) => void;
  onAddLifeEvent: () => void;
  onEditLifeEvent: (event: PersonLifeEvent) => void;
  selectedPhotoId: string | null;
  setSelectedPhotoId: (photoId: string | null) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, { description: string; linkedLifeEventId: string }>>({});
  const isPhotosTab = memorySectionTab === 'photos';
  const isEventsTab = memorySectionTab === 'events';

  useEffect(() => {
    setPhotoDrafts((currentDrafts) => syncPhotoDrafts(currentDrafts, person.photos));
  }, [person.photos]);

  const photoCards = useMemo(
    () => (isPhotosTab
      ? person.photos.map((photo, index) => ({
          photo,
          index,
          draft: photoDrafts[photo.id] ?? { description: photo.description ?? '', linkedLifeEventId: photo.linkedLifeEventId ?? '' },
        }))
      : []),
    [isPhotosTab, person.photos, photoDrafts],
  );
  const selectedPhoto = useMemo(
    () => (selectedPhotoId ? person.photos.find((photo) => photo.id === selectedPhotoId) ?? null : null),
    [person.photos, selectedPhotoId],
  );
  const lifeEventsById = useMemo(
    () => new Map(person.lifeEvents.map((event) => [event.id, event])),
    [person.lifeEvents],
  );
  const selectedDraft = selectedPhoto ? (photoDrafts[selectedPhoto.id] ?? {
    description: selectedPhoto.description ?? '',
    linkedLifeEventId: selectedPhoto.linkedLifeEventId ?? '',
  }) : null;
  const animatePhotoCards = isPhotosTab && person.photos.length <= PHOTO_ANIMATION_THRESHOLD;
  const animateTimelineRows = isEventsTab && memoryTimeline.length <= TIMELINE_ANIMATION_THRESHOLD;
  const linkedEventLabel = (linkedLifeEventId?: string) => lifeEventsById.get(linkedLifeEventId ?? '')?.title ?? '';

  return (
    <Reveal delay={130}>
      <SectionCard variant="person" style={getFamilyMemberCardStyle(theme)}>
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

      <TabStripCard nested>
        <HorizontalTabStrip
          items={[
            { key: 'events', label: t(K.memories.lifeEvents) },
            { key: 'photos', label: t(K.memories.photos) },
            { key: 'notes', label: t(K.memories.notes) },
          ]}
          activeKey={memorySectionTab}
          onChange={(value) => setMemorySectionTab(value as PersonMemorySectionTabKey)}
          contentContainerStyle={styles.tabStripContent}
          itemStyle={styles.tabStripItem}
        />
      </TabStripCard>

      {memorySectionTab === 'notes' ? (
        <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.notes)}</Text>
            </View>
            {canEdit ? (
              <Button mode="contained" icon="pencil" onPress={onOpenNotesDialog} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {person.notes ? t(K.personProfile.shapeThisStory) : t(K.memories.addFirstStoryNote)}
              </Button>
            ) : null}
          </View>
          <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
            {person.notes || t(K.memories.noStoryNoteYet)}
          </Text>
        </View>
      ) : null}

      {isPhotosTab ? (
        <View style={styles.gallerySection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.photoGalleryCount, { count: person.photos.length })}</Text>
            </View>
            {canEdit ? (
              <View style={styles.memoryDialogPhotoActions}>
                <Button mode="contained" icon="image" onPress={onAddPhotoFromLibrary} disabled={photoProcessing} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t(K.memories.bringInPhotos)}
                </Button>
                <Button mode="contained" icon="camera" onPress={onAddPhotoFromCamera} disabled={photoProcessing} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t(K.memories.captureMoment)}
                </Button>
              </View>
            ) : null}
          </View>
          {person.photos.length > 0 ? (
            <View style={styles.galleryGrid}>
              {photoCards.map(({ photo, index, draft }) => (
                <MaybeReveal
                  key={photo.id}
                  enabled={animatePhotoCards && index < MAX_ANIMATED_PHOTO_CARDS}
                  delay={Math.min(80 + index * 40, 240)}
                  style={styles.photoGridCard}
                >
                  <SectionCard
                    variant="person"
                    nested
                    style={[styles.photoCard, preferredPhoto?.id === photo.id && styles.photoCardPreferred]}
                  >
                    <Pressable onPress={() => onOpenViewer(index)}>
                      <CachedImage uri={photo.url} style={styles.photo} priority="low" recyclingKey={photo.id} />
                    </Pressable>
                    {draft.description || draft.linkedLifeEventId ? (
                      <View style={styles.photoMeta}>
                        {draft.description ? (
                          <Text variant="bodySmall" style={[styles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                            {draft.description}
                          </Text>
                        ) : null}
                        {draft.linkedLifeEventId ? (
                          <Chip compact icon="link-variant">
                            {linkedEventLabel(draft.linkedLifeEventId) || t(K.memories.linkedMemory)}
                          </Chip>
                        ) : null}
                      </View>
                    ) : null}
                  </SectionCard>
                </MaybeReveal>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noPhotosYet)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.memories.startGalleryStory)}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {isEventsTab ? (
        <View style={styles.lifeEventsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text variant="titleSmall">{t(K.memories.lifeEventsCount, { count: memoryTimeline.length })}</Text>
            </View>
            {canEdit ? (
              <Button mode="contained" icon="plus" onPress={onAddLifeEvent} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.memories.addLifeEvent)}
              </Button>
            ) : null}
          </View>

          {memoryTimeline.length > 0 ? (
            <View style={styles.timelineList}>
              {memoryTimeline.map((item, index) => {
                const editableEvent = !item.system ? lifeEventsById.get(item.id) ?? null : null;
                return (
                  <MaybeReveal
                    key={item.id}
                    enabled={animateTimelineRows && index < MAX_ANIMATED_TIMELINE_ROWS}
                    delay={Math.min(90 + index * 45, 270)}
                  >
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        <View style={[styles.timelineDot, { backgroundColor: item.system ? theme.colors.secondary : theme.colors.primary }]} />
                        {index < memoryTimeline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: theme.colors.outlineVariant }]} /> : null}
                      </View>
                      <View style={[styles.timelineStoryCard, { backgroundColor: theme.colors.surface }]}>
                        {preferredPhoto && index === 0 ? (
                          <CachedImage
                            uri={preferredPhoto.url}
                            style={styles.timelinePhoto}
                            priority="normal"
                            recyclingKey={preferredPhoto.id}
                          />
                        ) : null}
                        <View style={styles.timelineChipRow}>
                          <Chip compact>{item.badgeLabel}</Chip>
                          <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                        </View>
                        <Text variant="titleMedium" style={styles.relationshipTitle}>{item.title}</Text>
                        <Text variant="bodyMedium" style={[styles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>{item.description || t(K.memories.rememberedFamilyMoment)}</Text>
                        {canEdit && editableEvent ? (
                          <Button mode="text" onPress={() => onEditLifeEvent(editableEvent)} disabled={mutating} compact style={[styles.timelineAction, BUTTON_CHROME]} contentStyle={BUTTON_CONTENT_CHROME}>
                            {t(K.memories.refineThisMemory)}
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  </MaybeReveal>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noMemoriesYet)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.memories.timelineStartingPrompt)}
              </Text>
            </View>
          )}
        </View>
      ) : null}
      <Portal>
        <Dialog visible={Boolean(selectedPhoto)} onDismiss={() => setSelectedPhotoId(null)} style={[dialogChrome.dialog, styles.memoryDialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.memories.photoInfo)}</Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setSelectedPhotoId(null)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <View style={styles.memoryDialogContent}>
              <Text variant="bodySmall" style={styles.memoryDialogHint}>
                {t(K.memories.photoInfoSummary)}
              </Text>
              {selectedPhoto ? (
                <CachedImage
                  uri={selectedPhoto.url}
                  style={styles.timelinePhoto}
                  priority="high"
                  recyclingKey={selectedPhoto.id}
                />
              ) : null}
              {selectedDraft ? (
                <>
                  <TextInput
                    mode="outlined"
                    label={t(K.memories.tellUsMoreAboutThisPhoto)}
                    value={selectedDraft.description}
                    onChangeText={(value) => setPhotoDrafts((current) => ({
                      ...current,
                      [selectedPhoto!.id]: { ...selectedDraft, description: value },
                    }))}
                    multiline
                    disabled={!canEdit || photoProcessing}
                    style={styles.memoryDialogInput}
                  />
                  {canEdit ? (
                    <View style={styles.photoActionRow}>
                      <Button compact mode="text" onPress={() => onSetPreferredPhoto(selectedPhoto!, false)} disabled={photoProcessing}>
                        {preferredPhoto?.id === selectedPhoto?.id ? t(K.memories.featuredPortrait) : t(K.memories.featureThis)}
                      </Button>
                      <Button compact mode="text" onPress={() => onSetPreferredPhoto(selectedPhoto!, true)} disabled={photoProcessing}>
                        {t(K.memories.refineCrop)}
                      </Button>
                    </View>
                  ) : null}
                  <Text variant="titleSmall">{t(K.memories.linkToMemory)}</Text>
                  <View style={styles.timelineChipRow}>
                    <Chip
                      selected={!selectedDraft.linkedLifeEventId}
                      onPress={() => setPhotoDrafts((current) => ({
                        ...current,
                        [selectedPhoto!.id]: { ...selectedDraft, linkedLifeEventId: '' },
                      }))}
                      disabled={!canEdit || photoProcessing}
                    >
                      {t(K.common.none)}
                    </Chip>
                    {person.lifeEvents.map((event) => (
                      <Chip
                        key={event.id}
                        selected={selectedDraft.linkedLifeEventId === event.id}
                        onPress={() => setPhotoDrafts((current) => ({
                          ...current,
                          [selectedPhoto!.id]: { ...selectedDraft, linkedLifeEventId: event.id },
                        }))}
                        disabled={!canEdit || photoProcessing}
                      >
                        {event.title || formatPersonDate(event.date)}
                      </Chip>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            {canEdit && selectedPhoto ? (
              <IconButton
                icon="trash-can-outline"
                iconColor={theme.colors.error}
                onPress={() => {
                  setSelectedPhotoId(null);
                  void onRemovePhoto(selectedPhoto);
                }}
                disabled={photoProcessing}
                accessibilityLabel={t(K.common.delete)}
                style={styles.photoDeleteButton}
              />
            ) : <View />}
            {canEdit && selectedPhoto && selectedDraft ? (
              <Button mode="contained" onPress={() => {
                void onUpdatePhotoDetails(selectedPhoto, selectedDraft);
                setSelectedPhotoId(null);
              }} disabled={photoProcessing}>
                {t(K.common.save)}
              </Button>
            ) : null}
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </SectionCard>
    </Reveal>
  );
}

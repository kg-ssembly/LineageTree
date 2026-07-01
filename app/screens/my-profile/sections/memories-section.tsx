import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Button, Card, Chip, Dialog, IconButton, Portal, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { HorizontalTabStrip, InfoDialog, Reveal } from '../../../../components';
import type { NewPersonPhotoInput, PersonLifeEvent, PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { formatPersonDate } from '../../../../components/dto/person';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const personProfileStyles = GlobalStyles.personProfile;
const dialogChrome = GlobalStyles.dialogChrome;

export type MemorySectionTabKey = 'events' | 'photos' | 'notes';

export function MemoriesSection({
  linkedPerson,
  preferredPhoto,
  memorySectionTab,
  setMemorySectionTab,
  memoryTimeline,
  canEditLinkedProfile,
  mutating,
  selectedPhotoId,
  setSelectedPhotoId,
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
  onUpdatePhotoDetails: (photo: PersonPhoto, values: Pick<NewPersonPhotoInput, 'description' | 'linkedLifeEventId'>) => void;
  photoProcessing: boolean;
  onAddLifeEvent: () => void;
  onEditLifeEvent: (event: PersonLifeEvent) => void;
  onOpenViewer: (index: number) => void;
  selectedPhotoId: string | null;
  setSelectedPhotoId: (photoId: string | null) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [helperVisible, setHelperVisible] = useState(false);
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, { description: string; linkedLifeEventId: string }>>({});

  useEffect(() => {
    const nextDrafts = linkedPerson.photos.reduce<Record<string, { description: string; linkedLifeEventId: string }>>((acc, photo) => {
      acc[photo.id] = {
        description: photo.description ?? '',
        linkedLifeEventId: photo.linkedLifeEventId ?? '',
      };
      return acc;
    }, {});
    setPhotoDrafts(nextDrafts);
  }, [linkedPerson.photos]);

  const photoCards = useMemo(
    () => linkedPerson.photos.map((photo, index) => ({
      photo,
      index,
      draft: photoDrafts[photo.id] ?? { description: photo.description ?? '', linkedLifeEventId: photo.linkedLifeEventId ?? '' },
    })),
    [linkedPerson.photos, photoDrafts],
  );
  const selectedPhoto = useMemo(
    () => linkedPerson.photos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [linkedPerson.photos, selectedPhotoId],
  );
  const selectedDraft = selectedPhoto ? (photoDrafts[selectedPhoto.id] ?? {
    description: selectedPhoto.description ?? '',
    linkedLifeEventId: selectedPhoto.linkedLifeEventId ?? '',
  }) : null;
  const linkedEventLabel = (linkedLifeEventId?: string) => linkedPerson.lifeEvents.find((event) => event.id === linkedLifeEventId)?.title ?? '';

  return (
    <Reveal delay={130}>
      <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={personProfileStyles.titleWithHelperRow}>
        <Text variant="titleLarge">{t(K.memories.memories)}</Text>
        <IconButton
          icon="information-outline"
          size={20}
          style={personProfileStyles.helperIconButton}
          onPress={() => setHelperVisible(true)}
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
                {linkedPerson.notes ? t(K.personProfile.shapeThisStory) : t(K.memories.addFirstStoryNote)}
              </Button>
            ) : null}
          </View>
          <Text variant="bodyMedium" style={[personProfileStyles.notesText, { color: theme.colors.onSurfaceVariant }]}>
            {linkedPerson.notes || t(K.memories.noStoryNoteYet)}
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
                  {t(K.memories.bringInPhotos)}
                </Button>
                <Button mode="contained-tonal" icon="camera" onPress={onAddPhotoFromCamera} disabled={photoProcessing}>
                  {t(K.memories.captureMoment)}
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
                  {draft.description || draft.linkedLifeEventId ? (
                    <View style={personProfileStyles.photoMeta}>
                      {draft.description ? (
                        <Text variant="bodySmall" style={[personProfileStyles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                          {draft.description}
                        </Text>
                      ) : null}
                      {draft.linkedLifeEventId ? (
                        <Chip compact icon="link-variant">
                          {linkedEventLabel(draft.linkedLifeEventId) || 'Linked memory'}
                        </Chip>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
                </Reveal>
              ))}
            </View>
          ) : (
            <View style={personProfileStyles.emptyState}>
              <Text variant="titleMedium">{t(K.memories.noPhotosYet)}</Text>
              <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.memories.startGalleryStory)}
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
                {t(K.memories.addLifeEvent)}
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
                          {item.description || t(K.memories.rememberedFamilyMoment)}
                        </Text>
                        {canEditLinkedProfile && editableEvent ? (
                          <Button mode="text" onPress={() => onEditLifeEvent(editableEvent)} disabled={mutating} compact style={personProfileStyles.timelineAction}>
                            {t(K.memories.refineThisMemory)}
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
                {t(K.memories.timelineStartingPrompt)}
              </Text>
            </View>
          )}
        </View>
      ) : null}
      <Portal>
        <Dialog visible={Boolean(selectedPhoto)} onDismiss={() => setSelectedPhotoId(null)} style={[dialogChrome.dialog, personProfileStyles.memoryDialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.memories.photoInfo)}</Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setSelectedPhotoId(null)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <View style={personProfileStyles.memoryDialogContent}>
              <Text variant="bodySmall" style={personProfileStyles.memoryDialogHint}>
                {t(K.memories.photoInfoSummary)}
              </Text>
              {selectedPhoto ? <Image source={{ uri: selectedPhoto.url }} style={personProfileStyles.timelinePhoto} /> : null}
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
                    disabled={!canEditLinkedProfile || photoProcessing}
                    style={personProfileStyles.memoryDialogInput}
                  />
                  {canEditLinkedProfile ? (
                    <View style={personProfileStyles.photoActionRow}>
                      <Button compact mode="text" onPress={() => onSetPreferredPhoto(selectedPhoto!, false)} disabled={photoProcessing}>
                        {preferredPhoto?.id === selectedPhoto?.id ? t(K.memories.featuredPortrait) : t(K.memories.featureThis)}
                      </Button>
                      <Button compact mode="text" onPress={() => onSetPreferredPhoto(selectedPhoto!, true)} disabled={photoProcessing}>
                        {t(K.memories.refineCrop)}
                      </Button>
                    </View>
                  ) : null}
                  <Text variant="titleSmall">{t(K.memories.linkToMemory)}</Text>
                  <View style={personProfileStyles.timelineChipRow}>
                    <Chip
                      selected={!selectedDraft.linkedLifeEventId}
                      onPress={() => setPhotoDrafts((current) => ({
                        ...current,
                        [selectedPhoto!.id]: { ...selectedDraft, linkedLifeEventId: '' },
                      }))}
                      disabled={!canEditLinkedProfile || photoProcessing}
                    >
                      {t(K.common.none)}
                    </Chip>
                    {linkedPerson.lifeEvents.map((event) => (
                      <Chip
                        key={event.id}
                        selected={selectedDraft.linkedLifeEventId === event.id}
                        onPress={() => setPhotoDrafts((current) => ({
                          ...current,
                          [selectedPhoto!.id]: { ...selectedDraft, linkedLifeEventId: event.id },
                        }))}
                        disabled={!canEditLinkedProfile || photoProcessing}
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
            {canEditLinkedProfile && selectedPhoto ? (
              <IconButton
                icon="trash-can-outline"
                iconColor={theme.colors.error}
                onPress={() => {
                  setSelectedPhotoId(null);
                  void onRemovePhoto(selectedPhoto);
                }}
                disabled={photoProcessing}
                accessibilityLabel={t(K.common.delete)}
                style={personProfileStyles.photoDeleteButton}
              />
            ) : <View />}
            {canEditLinkedProfile && selectedPhoto && selectedDraft ? (
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
      <InfoDialog
        visible={helperVisible}
        title={t(K.memories.memories)}
        message={t(K.memories.momentsPhotosFragments)}
        onDismiss={() => setHelperVisible(false)}
      />
      </Surface>
    </Reveal>
  );
}

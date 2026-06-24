import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, Surface, Text, useTheme } from 'react-native-paper';
import { HorizontalTabStrip } from '../../../../components';
import type { PersonLifeEvent, PersonPhoto, PersonRecord } from '../../../../components/dto/person';
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
  onOpenPhotosDialog,
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
  onOpenPhotosDialog: () => void;
  onAddLifeEvent: () => void;
  onEditLifeEvent: (event: PersonLifeEvent) => void;
  onOpenViewer: (index: number) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

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
              <Button mode="contained-tonal" icon="image-plus" onPress={onOpenPhotosDialog}>
                {linkedPerson.photos.length > 0 ? t(K.memories.managePhotos) : t(K.memories.addPhotos)}
              </Button>
            ) : null}
          </View>
          {linkedPerson.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={personProfileStyles.galleryRow}>
              {linkedPerson.photos.map((photo, index) => (
                <Pressable key={photo.id} onPress={() => onOpenViewer(index)}>
                  <Card mode="elevated" style={[personProfileStyles.photoCard, preferredPhoto?.id === photo.id && personProfileStyles.photoCardPreferred]}>
                    <Image source={{ uri: photo.url }} style={personProfileStyles.photo} />
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
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
              <Text variant="titleSmall">{t('Life events ({count})', { count: memoryTimeline.length })}</Text>
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

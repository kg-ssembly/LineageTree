import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { HorizontalTabStrip } from '../../../../components';
import type { PersonLifeEvent, PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { formatPersonDate } from '../../../../components/dto/person';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';

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
  onOpenPhotosDialog,
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
  onOpenPhotosDialog: () => void;
  onOpenViewer: (index: number) => void;
  onAddLifeEvent: () => void;
  onEditLifeEvent: (event: PersonLifeEvent) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={styles.titleWithHelperRow}>
        <Text variant="titleLarge">{t('Memories & gallery')}</Text>
        <IconButton
          icon="information-outline"
          size={20}
          style={styles.helperIconButton}
          onPress={onOpenHelperDialog}
          accessibilityLabel={t('About memories and gallery')}
        />
      </View>

      <HorizontalTabStrip
        items={[
          { key: 'events', label: t('Life Events') },
          { key: 'photos', label: t('Photos') },
          { key: 'notes', label: t('Notes') },
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
              <Text variant="titleSmall">{t('Notes')}</Text>
            </View>
            {canEdit ? (
              <Button mode="contained-tonal" icon="pencil" onPress={onOpenNotesDialog}>
                {person.notes ? t('Edit notes') : t('Add notes')}
              </Button>
            ) : null}
          </View>
          <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
            {person.notes || t('No notes added yet.')}
          </Text>
        </View>
      ) : null}

      {memorySectionTab === 'photos' ? (
        <View style={styles.gallerySection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text variant="titleSmall">{t('Photo gallery ({count})', { count: person.photos.length })}</Text>
            </View>
            {canEdit ? (
              <Button mode="contained-tonal" icon="image-plus" onPress={onOpenPhotosDialog}>
                {person.photos.length > 0 ? t('Manage photos') : t('Add photos')}
              </Button>
            ) : null}
          </View>
          {person.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
              {person.photos.map((photo, index) => (
                <Pressable key={photo.id} onPress={() => onOpenViewer(index)}>
                  <Card mode="elevated" style={[styles.photoCard, preferredPhoto?.id === photo.id && styles.photoCardPreferred]}>
                    <Image source={{ uri: photo.url }} style={styles.photo} />
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t('No photos yet')}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t('Photos and scanned keepsakes will show up here.')}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {memorySectionTab === 'events' ? (
        <View style={styles.lifeEventsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text variant="titleSmall">{t('Life events ({count})', { count: memoryTimeline.length })}</Text>
            </View>
            {canEdit ? (
              <Button mode="contained-tonal" icon="plus" onPress={onAddLifeEvent}>
                {t('Add event')}
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
              <Text variant="titleMedium">{t('No memories yet')}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t('Start with major milestones like marriage, divorce, moving house, graduation, or a treasured family story.')}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </Surface>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import type { PersonLifeEvent, PersonLifeEventType } from './dto/person';
import { formatPersonDate, getLifeEventTypeLabel, parsePersonDate } from './dto/person';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.lifeEventDialog;
const dialogChrome = GlobalStyles.dialogChrome;

interface LifeEventDialogProps {
  visible: boolean;
  loading?: boolean;
  event?: PersonLifeEvent | null;
  onDismiss: () => void;
  onDelete?: (() => void | Promise<void>) | null;
  onSubmit: (payload: Omit<PersonLifeEvent, 'id'>) => void | Promise<void>;
}

const lifeEventTypes: PersonLifeEventType[] = ['married', 'divorced', 'moved', 'graduated', 'retired', 'milestone', 'death', 'child-born', 'custom'];

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultTitleKey(type: PersonLifeEventType) {
  switch (type) {
    case 'married':
      return K.memories.lifeEventMarriageTitle;
    case 'divorced':
      return K.memories.lifeEventDivorceTitle;
    case 'moved':
      return K.memories.lifeEventMovedHomeTitle;
    case 'graduated':
      return K.memories.lifeEventGraduationTitle;
    case 'retired':
      return K.memories.lifeEventRetirementTitle;
    case 'milestone':
      return K.memories.lifeEventFamilyMilestoneTitle;
    case 'death':
      return K.memories.lifeEventPassedAwayTitle;
    case 'child-born':
      return K.memories.lifeEventWelcomedChildTitle;
    default:
      return K.memories.lifeEventDefaultTitle;
  }
}

function formatDateButtonLabel(value: string) {
  return value ? formatPersonDate(value) : K.common.pickDate;
}

export default function LifeEventDialog({
  visible,
  loading = false,
  event,
  onDismiss,
  onDelete,
  onSubmit,
}: LifeEventDialogProps) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const [type, setType] = useState<PersonLifeEventType>('married');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextType = event?.type ?? 'married';
    setType(nextType);
    setTitle(event?.title ?? t(getDefaultTitleKey(nextType)));
    setDate(event?.date ?? '');
    setDescription(event?.description ?? '');
    setTitleError(null);
    setDateError(null);
    setDatePickerVisible(false);
  }, [event, t, visible]);

  const selectedDate = useMemo(() => parsePersonDate(date) ?? undefined, [date]);

  const handleTypeChange = (nextType: PersonLifeEventType) => {
    setType(nextType);
    setTitle((current) => (!current || current === t(getDefaultTitleKey(type)) ? t(getDefaultTitleKey(nextType)) : current));
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError(t(K.personForm.addTitleForLifeEvent));
      return;
    }

    if (!date.trim()) {
      setDateError(t(K.personForm.pickDateForLifeEvent));
      return;
    }

    await onSubmit({
      type,
      title: trimmedTitle,
      date: date.trim(),
      description: description.trim(),
    });
  };

  return (
    <>
      <Portal>
        <Dialog
          visible={visible}
          onDismiss={loading ? undefined : onDismiss}
          style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{event ? t(K.memories.editLifeEvent) : t(K.memories.addLifeEvent)}</Dialog.Title>
          <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
          <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text variant="bodyMedium" style={styles.helperText}>
                {t(K.memories.captureMilestones)}
              </Text>

              <View style={styles.typeWrap}>
                {lifeEventTypes.map((item) => (
                  <Chip
                    key={item}
                    selected={type === item}
                    onPress={() => handleTypeChange(item)}
                    style={styles.typeChip}
                    disabled={loading}
                  >
                    {getLifeEventTypeLabel(item)}
                  </Chip>
                ))}
              </View>

              <TextInput
                mode="outlined"
                label={t(K.memories.eventTitle)}
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  if (titleError) {
                    setTitleError(null);
                  }
                }}
                style={styles.fieldSpacing}
                disabled={loading}
                error={!!titleError}
              />
              <HelperText type="error" visible={!!titleError}>
                {titleError}
              </HelperText>

              <View style={styles.fieldSpacing}>
                <Text variant="titleSmall">{t(K.memories.eventDate)}</Text>
                <View style={styles.dateActions}>
                  <Button mode="outlined" icon="calendar" onPress={() => setDatePickerVisible(true)} disabled={loading}>
                  {t(formatDateButtonLabel(date))}
                  </Button>
                  {date ? (
                    <Button onPress={() => setDate('')} disabled={loading}>
                      {t(K.common.clear)}
                    </Button>
                  ) : null}
                </View>
                <HelperText type="error" visible={!!dateError}>
                  {dateError}
                </HelperText>
              </View>

              <TextInput
                mode="outlined"
                label={t(K.memories.eventDetails)}
                value={description}
                onChangeText={setDescription}
                style={styles.fieldSpacing}
                multiline
                numberOfLines={4}
                disabled={loading}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions
            style={[
              dialogChrome.dialogActions,
              { borderTopColor: theme.colors.outlineVariant, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
            ]}
          >
            {event && onDelete ? (
              <IconButton icon="trash-can-outline" iconColor={theme.colors.error} onPress={onDelete} disabled={loading} accessibilityLabel={t(K.common.delete)} />
            ) : (
              <View />
            )}
            <Button mode="contained" onPress={handleSubmit} disabled={loading}>{t(K.common.save)}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <DatePickerModal
        locale={language}
        mode="single"
        visible={datePickerVisible}
        date={selectedDate}
        onDismiss={() => setDatePickerVisible(false)}
        onConfirm={({ date: confirmedDate }) => {
          setDatePickerVisible(false);
          if (confirmedDate) {
            setDate(formatIsoDate(confirmedDate));
            if (dateError) {
              setDateError(null);
            }
          }
        }}
        saveLabel={t(K.common.save)}
        label={t(K.common.selectEventDate)}
      />
    </>
  );
}

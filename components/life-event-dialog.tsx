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

function getDefaultTitle(type: PersonLifeEventType) {
  switch (type) {
    case 'married':
      return 'Marriage';
    case 'divorced':
      return 'Divorce';
    case 'moved':
      return 'Moved home';
    case 'graduated':
      return 'Graduation';
    case 'retired':
      return 'Retirement';
    case 'milestone':
      return 'Family milestone';
    case 'death':
      return 'Passed away';
    case 'child-born':
      return 'Welcomed a child';
    default:
      return 'Life event';
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
  const { t } = useI18n();
  const [type, setType] = useState<PersonLifeEventType>('married');
  const [title, setTitle] = useState('Marriage');
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
    setTitle(event?.title ?? getDefaultTitle(nextType));
    setDate(event?.date ?? '');
    setDescription(event?.description ?? '');
    setTitleError(null);
    setDateError(null);
    setDatePickerVisible(false);
  }, [event, visible]);

  const selectedDate = useMemo(() => parsePersonDate(date) ?? undefined, [date]);

  const handleTypeChange = (nextType: PersonLifeEventType) => {
    setType(nextType);
    setTitle((current) => (!current || current === getDefaultTitle(type) ? getDefaultTitle(nextType) : current));
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError(t('Add a title for this life event.'));
      return;
    }

    if (!date.trim()) {
      setDateError(t('Pick a date for this life event.'));
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
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{event ? t('Edit life event') : t('Add life event')}</Dialog.Title>
          <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t('Cancel')} style={dialogChrome.closeButton} />
          <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text variant="bodyMedium" style={styles.helperText}>
                {t('Capture milestones like marriage, divorce, moves, or other memorable family moments.')}
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
                label={t('Event title')}
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
                <Text variant="titleSmall">{t('Event date')}</Text>
                <View style={styles.dateActions}>
                  <Button mode="outlined" icon="calendar" onPress={() => setDatePickerVisible(true)} disabled={loading}>
                  {t(formatDateButtonLabel(date))}
                  </Button>
                  {date ? (
                    <Button onPress={() => setDate('')} disabled={loading}>
                      {t('Clear')}
                    </Button>
                  ) : null}
                </View>
                <HelperText type="error" visible={!!dateError}>
                  {dateError}
                </HelperText>
              </View>

              <TextInput
                mode="outlined"
                label={t('Details')}
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
              <IconButton icon="trash-can-outline" iconColor={theme.colors.error} onPress={onDelete} disabled={loading} accessibilityLabel={t('Delete')} />
            ) : (
              <View />
            )}
            <Button mode="contained" onPress={handleSubmit} disabled={loading}>{t('Save')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <DatePickerModal
        locale="en"
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
        saveLabel={t('Save')}
        label={t('Select event date')}
      />
    </>
  );
}

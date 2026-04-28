import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import type { PersonLifeEvent, PersonLifeEventType } from './dto/person';
import { getLifeEventTypeLabel, parsePersonDate } from './dto/person';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.lifeEventDialog;

interface LifeEventDialogProps {
  visible: boolean;
  loading?: boolean;
  event?: PersonLifeEvent | null;
  onDismiss: () => void;
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
  const parsed = parsePersonDate(value);
  return parsed ? parsed.toLocaleDateString() : 'Pick a date';
}

export default function LifeEventDialog({
  visible,
  loading = false,
  event,
  onDismiss,
  onSubmit,
}: LifeEventDialogProps) {
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
      setTitleError('Add a title for this life event.');
      return;
    }

    if (!date.trim()) {
      setDateError('Pick a date for this life event.');
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
        <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} style={styles.dialog}>
          <Dialog.Title>{event ? 'Edit life event' : 'Add life event'}</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text variant="bodyMedium" style={styles.helperText}>
                Capture milestones like marriage, divorce, moves, or other memorable family moments.
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
                label="Event title"
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
                <Text variant="titleSmall">Event date</Text>
                <View style={styles.dateActions}>
                  <Button mode="outlined" icon="calendar" onPress={() => setDatePickerVisible(true)} disabled={loading}>
                    {formatDateButtonLabel(date)}
                  </Button>
                  {date ? (
                    <Button onPress={() => setDate('')} disabled={loading}>
                      Clear
                    </Button>
                  ) : null}
                </View>
                <HelperText type="error" visible={!!dateError}>
                  {dateError}
                </HelperText>
              </View>

              <TextInput
                mode="outlined"
                label="Details"
                value={description}
                onChangeText={setDescription}
                style={styles.fieldSpacing}
                multiline
                numberOfLines={4}
                disabled={loading}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={onDismiss} disabled={loading}>Cancel</Button>
            <Button onPress={handleSubmit} disabled={loading}>Save</Button>
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
        saveLabel="Save"
        label="Select event date"
      />
    </>
  );
}




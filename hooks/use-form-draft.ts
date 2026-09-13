import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

/** Account/record-scoped drafts. Existing drafts are offered, never silently applied. */
export function useFormDraft<T>(key: string, visible: boolean, value: T) {
  const [available, setAvailable] = useState<T | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const baseline = useRef('');
  const latest = useRef(value);
  const completed = useRef(false);
  const generation = useRef(0);
  const [, refresh] = useState(0);
  const queue = useRef(Promise.resolve());
  latest.current = value;
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!visible) { setReady(false); return; }
    let active = true;
    completed.current = false;
    generation.current += 1;
    setError('');
    setReady(false);
    setAvailable(null);
    // Let the form initialise its fields before recording its unchanged baseline.
    const timer = setTimeout(() => {
      baseline.current = JSON.stringify(latest.current);
      void AsyncStorage.getItem(key).then((raw) => {
        if (!active) return;
        if (raw) setAvailable(JSON.parse(raw) as T);
        setReady(true);
      }).catch(() => { if (active) { setError('Draft storage is unavailable. Keep this form open until saved.'); setReady(true); } });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [key, visible]);
  const save = useCallback(async () => {
    const raw = JSON.stringify(latest.current);
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(key, raw));
    await queue.current;
  }, [key]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && visible && ready && !available && !completed.current && JSON.stringify(latest.current) !== baseline.current) {
        void save().catch(() => setError('Draft could not be saved on this device.'));
      }
    });
    return () => subscription.remove();
  }, [visible, ready, available, save]);
  const clear = async (submitted = false) => {
    completed.current = submitted;
    generation.current += 1;
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.removeItem(key));
    await queue.current;
    baseline.current = JSON.stringify(latest.current);
    setAvailable(null);
    refresh((value) => value + 1);
  };
  useEffect(() => {
    if (!visible || !ready || available || completed.current || serialized === baseline.current) return;
    const version = generation.current;
    const timer = setTimeout(() => {
      if (version !== generation.current || completed.current) return;
      void save().catch(() => setError('Draft could not be saved on this device.'));
    }, 400);
    return () => clearTimeout(timer);
  }, [serialized, visible, ready, available, key, save]); // save reads latest through a ref
  return { available, consume: () => setAvailable(null), save, clear, error, dirty: ready && serialized !== baseline.current };
}

import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { measureWork } from '../components/performance-metrics';

/** Skip serialization and disk writes when only transient store fields changed. */
export function selectiveStorage<T extends object>(storage: PersistStorage<T>): PersistStorage<T> {
  let previous: T | undefined;
  return {
    getItem: (name) => storage.getItem(name),
    removeItem: (name) => { previous = undefined; return storage.removeItem(name); },
    setItem: (name: string, value: StorageValue<T>) => {
      if (previous && Object.keys(value.state).every((key) => value.state[key as keyof T] === previous![key as keyof T])) return;
      previous = value.state;
      try {
        const result = measureWork('cache.serialize.ms', () => storage.setItem(name, value));
        if (result instanceof Promise) return result.catch((error) => { previous = undefined; throw error; });
        return result;
      } catch (error) { previous = undefined; throw error; }
    },
  };
}

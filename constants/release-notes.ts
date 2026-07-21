import { CURRENT_APP_VERSION } from './app-metadata';

export type ReleaseNote = {
  version: string;
  highlights: string[];
};

const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.10',
    highlights: [
      'Choose your preferred language the first time you sign in.',
      'Lineage Tree now shows in-app update notices when a new version is available.',
    ],
  },
];

const FALLBACK_RELEASE_NOTE: ReleaseNote = {
  version: CURRENT_APP_VERSION,
  highlights: [
    'We made improvements across the app to keep the family tree experience smoother and more reliable.',
  ],
};

export function getReleaseNote(version: string): ReleaseNote {
  return RELEASE_NOTES.find((note) => note.version === version) ?? {
    ...FALLBACK_RELEASE_NOTE,
    version,
  };
}

export function getCurrentReleaseNote(): ReleaseNote {
  return getReleaseNote(CURRENT_APP_VERSION);
}

export { RELEASE_NOTES };

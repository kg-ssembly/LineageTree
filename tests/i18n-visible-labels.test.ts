import assert from 'node:assert/strict';
import test from 'node:test';
import { LANGUAGE_OPTIONS, setActiveLanguage, translate } from '../i18n';

const visibleLabels = [
  'Confirm',
  'Cancel',
  'Next',
  'Previous',
  'Overview',
  'Relationships',
  'Descendant tree',
  'Ascendant tree',
  'Next page',
  'Previous page',
  'Page {current} of {total}',
  'Confirm New Surname',
  'Please review before saving',
  'Review {count} relationship changes before saving.',
];

test('visible shared labels are translated for every supported non-English language', () => {
  for (const { code } of LANGUAGE_OPTIONS) {
    setActiveLanguage(code);
    for (const label of visibleLabels) {
      const translated = translate(label, { current: 1, total: 2, count: 3 });
      if (label === 'Page {current} of {total}' || label === 'Review {count} relationship changes before saving.') {
        if (code === 'en') {
          assert.equal(
            translated,
            label === 'Page {current} of {total}'
              ? 'Page 1 of 2'
              : 'Review 3 relationship changes before saving.',
          );
        } else {
          assert.notEqual(translated, label);
        }
        continue;
      }
      if (code === 'en') {
        assert.equal(translated, label);
        continue;
      }
      assert.notEqual(
        translated,
        label,
        `Expected ${code} to translate "${label}", but it still resolved to the English source text`,
      );
    }
  }
});

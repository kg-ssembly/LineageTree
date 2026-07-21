import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const screenFiles = ['app/screens/**/*.{ts,tsx}'];

export default [
  {
    ignores: [
      '.expo/**',
      '.test-dist/**',
      'dist/**',
      'node_modules/**',
      'web-build/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-undef': 'off',
      'no-useless-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: screenFiles,
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: 'react-native-paper',
              importNames: ['Surface'],
              message: 'Prefer shared shells like SectionCard or TabStripCard before adding a new screen-level Surface wrapper.',
            },
            {
              name: 'react-native-paper',
              importNames: ['Card'],
              message: 'Prefer shared shells or extracted feature cards before adding another screen-local Card.',
            },
            {
              name: 'react-native-svg',
              message: 'Prefer the shared ScreenBackground for decorative screen backdrops.',
            },
            {
              name: '../../../constants/styles',
              importNames: ['GlobalStyles'],
              message: 'Check shared UI wrappers first before adding another screen-local style shell.',
            },
            {
              name: '../../../../constants/styles',
              importNames: ['GlobalStyles'],
              message: 'Check shared UI wrappers first before adding another screen-local style shell.',
            },
          ],
        },
      ],
    },
  },
];

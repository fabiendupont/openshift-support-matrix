import recommended from 'eslint-plugin-github/lib/configs/flat/recommended.js'
import typescript from 'eslint-plugin-github/lib/configs/flat/typescript.js'
import jest from 'eslint-plugin-jest'

export default [
  recommended,
  ...typescript,
  {
    files: ['**/*.ts'],
    rules: {
      'i18n-text/no-en': 'off',
      'eslint-comments/no-use': 'off',
      'import/no-namespace': 'off',
      'import/no-unresolved': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', {accessibility: 'no-public'}],
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', {allowExpressions: true}],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-function-type': 'warn',
      'no-shadow': 'off',
      'func-style': 'off',
      'import/no-commonjs': 'off',
    }
  },
  {
    files: ['**/*.test.ts'],
    plugins: {jest},
    languageOptions: {
      globals: jest.environments.globals.globals
    },
    rules: {
      ...jest.configs.recommended.rules
    }
  },
  {
    ignores: ['dist/', 'lib/', 'node_modules/']
  }
]

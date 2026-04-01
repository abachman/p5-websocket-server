// @ts-check

import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default [
  eslintConfigPrettier,
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
]
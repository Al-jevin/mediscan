// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Expo/RN patterns (hydration, measure refs, store sync) trip the new
      // React Compiler lint rules without indicating real runtime bugs.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react/no-unescaped-entities': 'off',
      'unicode-bom': 'error',
    },
  },
]);

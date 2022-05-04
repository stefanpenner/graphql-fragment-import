module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['node', 'prettier', '@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:node/recommended', 'plugin:prettier/recommended'],
  env: {
    node: true,
  },
  ignorePatterns: ['lib/dist/**/*.js'],
  rules: {
    'node/shebang': 'off',
  },
  overrides: [
    {
      env: { mocha: true },
      files: '**/*-test.js',
      plugins: ['mocha'],
      extends: ['plugin:mocha/recommended'],
      rules: {
        'node/no-unpublished-require': 'off',
        'mocha/no-setup-in-describe': 'off',
        'mocha/no-hooks-for-single-case': 'off',
      },
    },
    {
      files: ['**/*.ts'],
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      rules: {
        'node/no-unsupported-features/es-syntax': 'off',
      },
    },
  ],
};

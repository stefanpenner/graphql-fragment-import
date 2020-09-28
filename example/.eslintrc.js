module.exports = {
  root: true,
  env: {
    browser: false,
    commonjs: true,
    es2020: true,
  },
  parserOptions: {
    ecmaVersion: 11,
  },
  rules: {},
  overrides: [
    {
      // TODO: export a config
      files: '**/*.graphql',
      parser: '@eslint-ast/eslint-plugin-graphql/parser',
      parserOptions: {
        schema: `${__dirname}/schema.graphql`,
      },
      plugins: ['@eslint-ast/graphql', '@graphql-fragment-import'],
      extends: ['plugin:@eslint-ast/graphql/recommended'],
      rules: {
        '@graphql-fragment-import/validate-imports': 'error',
        '@eslint-ast/graphql/KnownFragmentNamesRule': 'off',
        '@eslint-ast/graphql/NoUnusedFragmentsRule': 'off',
      },
    },
  ],
};

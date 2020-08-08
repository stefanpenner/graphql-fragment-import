module.exports = {
  root: true,
  env: {
    browser: false,
    commonjs: true,
    es2020: true
  },
  parserOptions: {
    ecmaVersion: 11
  },
  rules: { },
  overrides: [
    {
      files: '**/*.graphql',
      parser: '@eslint-ast/eslint-plugin-graphql/parser',
      plugins: [
        "@graphql-fragment-import/eslint-plugin",
        '@eslint-ast/eslint-plugin-graphql',
      ],

      rules: {
        '@graphql-fragment-import/validate-imports': 'error',
        '@eslint-ast/graphql/all': [
          'error',
          { schema: `${__dirname}/schema.graphql` }
        ],
        '@eslint-ast/graphql/single-top-level-query': 'error',
      }
    },
  ],
};

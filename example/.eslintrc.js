module.exports = {
  root: true,
  overrides: [
    {
      files: '**/*.graphql',
      parser: 'eslint-plugin-graphql/parser',
      plugins: [
        'eslint-plugin-graphql',
      ],

      rules: {
        'graphql/single-top-level-query': 'error',
        'graphql/validate-imports': 'error',
      },
    },
  ],
};

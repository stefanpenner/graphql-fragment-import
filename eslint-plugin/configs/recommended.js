module.exports = {
  rules: {
    // default NoUnUsedFragments is not fragment import aware
    '@eslint-ast/graphql/NoUnusedFragmentsRule': 'off',
    '@eslint-ast/graphql/KnownFragmentNamesRule': 'off',
    '@graphql-fragment-import/validate-imports': 'error',
  },
};

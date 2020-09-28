module.exports = {
  rules: {
    // default NoUnUsedFragments is not fragment import aware
    '@eslint-ast/graphql/NoUnusedFragmentsRule': 'off',
    '@graphql-fragment-import/validate-imports': 'error',
  },
};

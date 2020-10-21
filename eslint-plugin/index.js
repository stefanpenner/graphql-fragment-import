'use strict';

module.exports = {
  name: require('./package').name,
  configs: {
    get recommended() {
      return require('./configs/recommended');
    },
  },

  rules: {
    get 'validate-imports'() {
      return require('./rules/validate-imports');
    },
  },
};

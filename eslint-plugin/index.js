"use strict";

module.exports = {
  rules: {
    get "validate-imports"() {
      return require("./rules/validate-imports");
    },
  },

  // TODO:
  meta: {
    type: "",

    docs: {
      description: "linting for fragments and importable fragments",
      category: "",
      recommended: true,
      url: "",
    },

    fixable: "",
    schema: [], // no options
  },

  create: function (/*context*/) {
    return {
      // callback functions
    };
  },
};

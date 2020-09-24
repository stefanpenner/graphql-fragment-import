"use strict";

const fs = require("fs");
const path = require("path");
const inlineImports = require("../../lib/inline-imports");
const parseImports = require("../parse-imports");
const pathContainsDirectory = require("../path-contains-directory");

// this rule errors if we have more then one top level query
module.exports = {
  meta: {
    messages: {},
    docs: {
      description: "ensure imports are valid",
      category: "problem",
    },
  },
  create(context) {
    const VALID_IMPORTS = [];
    const SPREAD_FRAGMENTS = Object.create(null);
    const FRAGMENT_DEFINITIONS = Object.create(null);
    const FILE_NAME = context.getFilename();
    const basedir = path.dirname(FILE_NAME);
    if (
      typeof context.parserServices.getFragmentDefinitionsFromSource !==
      "function"
    ) {
      throw new Error(
        `[graphql-fragment-import/validate-imports] invalid parser detected, please ensure the relevant eslint parser is: '@eslint-ast/eslint-plugin-graphql/parser'`
      );
    }

    function Document() {
      // since graphql does drops comments, we must do our own parsing to
      // find `#import '_fragment.graphql'` and handle them "natively"
      for (const node of parseImports(context.getSourceCode().text)) {
        CommentImportStatement(node);
      }
    }

    function CommentImportStatement(node) {
      const importIdentifier = node.name.value;
      const importFileName = path.basename(importIdentifier);
      const extname = path.extname(importFileName);

      if (pathContainsDirectory(importIdentifier, "node_modules")) {
        context.report({
          message: `imports cannot contain 'node_modules'`,
          node,
        });
        return;
      }
      if (importFileName.charAt(0) !== "_") {
        context.report({
          message: `imported fragments must begin with an underscore [_]`,
          node,
        });
        return;
      }

      if (extname !== ".graphql") {
        context.report({
          message: `imported fragments must have the extension '.graphql' but got '${extname}'`,
          node,
        });
        return;
      }

      // TODO: use faster / memoized implementation
      // TODO: configurable resolution strategy
      try {
        require("resolve").sync(importIdentifier, { basedir });
      } catch (e) {
        if (
          typeof e === "object" &&
          e !== null &&
          e.code === "MODULE_NOT_FOUND"
        ) {
          context.report({
            message: `no such file: '${importIdentifier}' starting at: '${basedir}'`,
            node,
          });
        } else {
          throw e;
        }
      }

      VALID_IMPORTS.push(node);
    }

    function FragmentDefinition(node) {
      // we grab all in-file fragment definitions, grouped by name for later validation
      FRAGMENT_DEFINITIONS[node.name.value] =
        FRAGMENT_DEFINITIONS[node.name.value] || [];
      FRAGMENT_DEFINITIONS[node.name.value].push(node);
    }

    function FragmentSpread(node) {
      // we grab all in-file fragment spread definitions, grouped by name for later validation
      SPREAD_FRAGMENTS[node.name.value] =
        SPREAD_FRAGMENTS[node.name.value] || [];
      SPREAD_FRAGMENTS[node.name.value].push(node);
    }

    return {
      // Graphql does not yet parses these, so we simulate the existence of a
      // CommentImportStatement listener via the Document visitor
      Document,
      FragmentDefinition,
      FragmentSpread,

      "Document:exit"() {
        const filename = context.getFilename();
        let FRAGMENT_DEFINITIONS_WITH_INLINED_IMPORTS;

        if (VALID_IMPORTS.length > 0) {
          const source = inlineImports(context.getSourceCode().text, {
            basedir: path.dirname(filename),
            throwIfImportNotFound: false,
          });

          FRAGMENT_DEFINITIONS_WITH_INLINED_IMPORTS = Object.create(null);

          for (const fragment of context.parserServices.getFragmentDefinitionsFromSource(
            source
          )) {
            FRAGMENT_DEFINITIONS_WITH_INLINED_IMPORTS[
              fragment.name.value
            ] = fragment;
          }
        }

        const ALL_FRAGMENTS =
          FRAGMENT_DEFINITIONS_WITH_INLINED_IMPORTS || FRAGMENT_DEFINITIONS;
        // short-circuit no SPREAD_FRAGMENTS but we have imports, all imports
        // are then unused
        if (
          Object.keys(SPREAD_FRAGMENTS).length === 0 &&
          VALID_IMPORTS.length > 0
        ) {
          for (const node of VALID_IMPORTS) {
            context.report({
              message: `import unused`,
              node,
            });
          }
        }

        for (const spreads of Object.values(SPREAD_FRAGMENTS)) {
          for (const spread of spreads) {
            if (ALL_FRAGMENTS[spread.name.value]) {
              continue;
            }
            context.report({
              message: `Unknown fragment "${spread.name.value}".`,
              node: spread,
            });
          }
        }
      },
    };
  },
};

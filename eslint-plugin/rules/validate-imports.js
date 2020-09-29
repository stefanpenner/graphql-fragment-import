'use strict';

const path = require('path');
const inlineImports = require('@graphql-fragment-import/lib/inline-imports');
const parseImports = require('../parse-imports');
const pathContainsDirectory = require('../path-contains-directory');

// this rule errors if we have more then one top level query
module.exports = {
  meta: {
    messages: {
      badFragmentSpread:
        'Fragment "{{ fragment }}" cannot be spread here as objects of type "{{ objectType }}" can never be of type "{{ fragmentType }}"',
      unusedFragmentDefinition: 'Fragment "{{ fragmentName }}" is never used',
    },
    docs: {
      description: 'ensure imports are valid',
      category: 'problem',
    },
  },
  create(context) {
    const VALID_IMPORTS = new Map();
    const SPREAD_FRAGMENTS = Object.create(null);
    const FRAGMENT_DEFINITIONS = Object.create(null);
    const FILE_NAME = context.getFilename();
    const basedir = path.dirname(FILE_NAME);
    const typeInfo = context.parserServices.createTypeInfo();
    if (typeof context.parserServices.getFragmentDefinitionsFromSource !== 'function') {
      throw new Error(
        `[graphql-fragment-import/validate-imports] invalid parser detected, please ensure the relevant eslint parser is: '@eslint-ast/eslint-plugin-graphql/parser'`,
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

      if (pathContainsDirectory(importIdentifier, 'node_modules')) {
        context.report({
          message: `imports cannot contain 'node_modules'`,
          node,
        });
        return;
      }
      if (importFileName.charAt(0) !== '_') {
        context.report({
          message: `imported fragments must begin with an underscore [_]`,
          node,
        });
        return;
      }

      if (extname !== '.graphql') {
        context.report({
          message: `imported fragments must have the extension '.graphql' but got '${extname}'`,
          node,
        });
        return;
      }

      // TODO: use faster / memoized implementation
      // TODO: configurable resolution strategy
      try {
        require('resolve').sync(importIdentifier, { basedir });
      } catch (e) {
        if (typeof e === 'object' && e !== null && e.code === 'MODULE_NOT_FOUND') {
          context.report({
            message: `no such file: '${importIdentifier}' starting at: '${basedir}'`,
            node,
          });
        } else {
          throw e;
        }
      }

      VALID_IMPORTS.set(node.loc.start.line, node);
    }

    function FragmentDefinition(node) {
      // we grab all in-file fragment definitions, grouped by name for later validation
      FRAGMENT_DEFINITIONS[node.name.value] = FRAGMENT_DEFINITIONS[node.name.value] || [];
      FRAGMENT_DEFINITIONS[node.name.value].push(node);
    }

    function FragmentSpread(node) {
      let type = typeInfo.getType();
      // we grab all in-file fragment spread definitions, grouped by name for later validation
      SPREAD_FRAGMENTS[node.name.value] = SPREAD_FRAGMENTS[node.name.value] || [];
      SPREAD_FRAGMENTS[node.name.value].push({
        node,
        // type.ofType for fragment spreads in queries
        // type for fragment spreads in fragment definitions
        type: type.ofType || type,
      });
    }

    return {
      '*'(node) {
        typeInfo.enter(context.parserServices.correspondingNode(node));
      },
      '*:exit'(node) {
        typeInfo.leave(context.parserServices.correspondingNode(node));
      },

      // Graphql does not yet parses these, so we simulate the existence of a
      // CommentImportStatement listener via the Document visitor
      Document,
      FragmentDefinition,
      FragmentSpread,

      'Document:exit'() {
        const filename = context.getFilename();
        let FRAGMENT_TO_IMPORT_LINE;
        let IMPORTED_FRAGMENTS;
        let IMPORT_LINE_USED;

        if (VALID_IMPORTS.size > 0) {
          FRAGMENT_TO_IMPORT_LINE = Object.create(null);
          IMPORTED_FRAGMENTS = Object.create(null);
          IMPORT_LINE_USED = new Map();

          const importLinesToInlinedSource = inlineImports.lineToImports(
            context.getSourceCode().text,
            {
              basedir: path.dirname(filename),
              throwIfImportNotFound: false,
            },
          );

          for (const [lineNumber, source] of importLinesToInlinedSource) {
            // initially we don't know that it's used
            // we'll mark the used ones as true
            // whatever false remains are unused
            IMPORT_LINE_USED.set(lineNumber, false);

            for (const fragment of context.parserServices.getFragmentDefinitionsFromSource(
              source,
            )) {
              FRAGMENT_TO_IMPORT_LINE[fragment.name.value] = lineNumber;
              IMPORTED_FRAGMENTS[fragment.name.value] = fragment;
            }
          }

          // short-circuit no SPREAD_FRAGMENTS but we have imports, all imports
          // are then unused
          if (Object.keys(SPREAD_FRAGMENTS).length === 0) {
            for (const node of VALID_IMPORTS.values()) {
              context.report({
                message: `import unused`,
                node,
              });
            }
          }
        }

        const USED_FRAGMENT_DEFINITIONS = new Set();

        for (const spreads of Object.values(SPREAD_FRAGMENTS)) {
          for (const { node, type } of spreads) {
            const name = node.name.value;
            if (IMPORTED_FRAGMENTS[name] || FRAGMENT_DEFINITIONS[name]) {
              if (FRAGMENT_DEFINITIONS[node.name.value]) {
                USED_FRAGMENT_DEFINITIONS.add(FRAGMENT_DEFINITIONS[node.name.value]);
                continue;
              }
              let lineNumber = FRAGMENT_TO_IMPORT_LINE[name];
              IMPORT_LINE_USED.set(lineNumber, true);

              let fragmentDefinitionTypeCondition =
                IMPORTED_FRAGMENTS[name].typeCondition.name.value;
              let fragmentSpreadTypeName = type.name;

              if (fragmentSpreadTypeName !== fragmentDefinitionTypeCondition) {
                // imported fragment is spread on wrong type
                context.report({
                  node,
                  messageId: 'badFragmentSpread',
                  data: {
                    fragment: node.name.value,
                    objectType: fragmentSpreadTypeName,
                    fragmentType: fragmentDefinitionTypeCondition,
                  },
                });
              }
            } else {
              context.report({
                message: `Unknown fragment "${node.name.value}".`,
                node,
              });
            }
          }
        }

        for (const nodes of Object.values(FRAGMENT_DEFINITIONS)) {
          if (!USED_FRAGMENT_DEFINITIONS.has(nodes)) {
            nodes.forEach(node => {
              context.report({
                messageId: 'unusedFragmentDefinition',
                data: {
                  fragmentName: node.name.value,
                },
                node,
              });
            });
          }
        }

        // don't double count from the short-circuited version above
        if (Object.keys(SPREAD_FRAGMENTS).length > 0) {
          for (let [lineNumber, isUsed] of IMPORT_LINE_USED) {
            if (isUsed === false) {
              context.report({
                message: 'import unused',
                node: VALID_IMPORTS.get(lineNumber),
              });
            }
          }
        }
      },
    };
  },
};

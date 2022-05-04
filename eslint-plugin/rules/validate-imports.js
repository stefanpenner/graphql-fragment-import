'use strict';

const path = require('path');
const gatherFragmentImportsForContext = require('../gather-fragment-imports-for-context');
const parseImports = require('../parse-imports');
const pathContainsDirectory = require('../path-contains-directory');

const ERR_PREFIX = `[graphql-fragment-import/validate-imports]`;

// this rule errors if we have more then one top level query
module.exports = {
  meta: {
    messages: {
      badFragmentSpread:
        'Fragment "{{ fragment }}" cannot be spread here as objects of type "{{ objectType }}" can never be of type "{{ fragmentType }}"',
      unusedFragmentDefinition: 'Fragment "{{ fragmentName }}" is never used',
      fileNotFound: 'no such file: "{{ importIdentifier }}" starting at: "{{ basedir }}"',
    },
    docs: {
      description: 'ensure imports are valid',
      category: 'problem',
    },
    schema: [
      {
        type: 'object',
        properties: {
          importResolver: {
            type: 'string',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    let resolveImport;

    let importResolver =
      Array.isArray(context.options) &&
      context.options.length > 0 &&
      context.options[0].importResolver;
    if (typeof importResolver === 'string') {
      if (!path.isAbsolute(importResolver)) {
        throw new Error(
          `${ERR_PREFIX} option "importResolver" must be an absolute path, not "${importResolver}"`,
        );
      }

      resolveImport = require(importResolver);
    } else {
      resolveImport = require('resolve').sync;
    }

    const VALID_IMPORTS = new Map();
    const SPREAD_FRAGMENTS = Object.create(null);
    const FRAGMENT_DEFINITIONS = Object.create(null);
    const FILE_NAME = context.getFilename();
    const basedir = path.dirname(FILE_NAME);
    const typeInfo = context.parserServices.createTypeInfo();
    if (typeof context.parserServices.getFragmentDefinitionsFromSource !== 'function') {
      throw new Error(
        `${ERR_PREFIX} invalid parser detected, please ensure the relevant eslint parser is: '@eslint-ast/eslint-plugin-graphql/parser'`,
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

      try {
        resolveImport(importIdentifier, { basedir });
        VALID_IMPORTS.set(node.loc.start.line, node);
      } catch (e) {
        if (typeof e === 'object' && e !== null && e.code === 'MODULE_NOT_FOUND') {
          context.report({
            messageId: 'fileNotFound',
            data: {
              importIdentifier,
              basedir,
            },
            node,
          });
        } else {
          throw e;
        }
      }
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
      // resolve non-null and list types
      // e.g.
      // type Query {
      //  books: [Book!]!
      // }
      // gets a NonNull ofType List ofType NonNull ofType Book
      while (typeof type.ofType === 'object' && type.ofType !== null) {
        type = type.ofType;
      }
      SPREAD_FRAGMENTS[node.name.value].push({
        node,
        type,
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
        const basename = path.basename(filename);
        const isPartial = basename.length > 0 && basename.charAt(0) === '_';
        const USED_FRAGMENT_DEFINITIONS = new Map();

        const lineToFragmentNameToBucket = gatherFragmentImportsForContext(context, false);
        if (VALID_IMPORTS.size > 0) {
          let foundImports = new Set();
          // eslint-disable-next-line no-unused-vars
          lineToFragmentNameToBucket.forEach((value, _) => {
            value.forEach((augmentedFragment, fragmentName) => {
              USED_FRAGMENT_DEFINITIONS.set(fragmentName, augmentedFragment);
              foundImports.add(augmentedFragment.loc.filename);
            });
          });

          VALID_IMPORTS.forEach(node => {
            if (!foundImports.has(resolveImport(node.name.value, { basedir }))) {
              context.report({
                message: `import unused`,
                node,
              });
            }
          });
        }

        for (const spreads of Object.values(SPREAD_FRAGMENTS)) {
          for (const { node, type } of spreads) {
            const name = node.name.value;
            if (USED_FRAGMENT_DEFINITIONS.get(name) || FRAGMENT_DEFINITIONS[name] !== undefined) {
              let fragmentDefinitionTypeCondition = (
                USED_FRAGMENT_DEFINITIONS.get(name) || FRAGMENT_DEFINITIONS[name][0]
              ).typeCondition.name.value;
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

        if (isPartial === false) {
          for (const nodes of Object.values(FRAGMENT_DEFINITIONS)) {
            nodes.forEach(node => {
              if (
                node &&
                !USED_FRAGMENT_DEFINITIONS.has(node.name.value) &&
                SPREAD_FRAGMENTS[node.name.value] === undefined
              ) {
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
            });
          }
        }
      },
    };
  },
};

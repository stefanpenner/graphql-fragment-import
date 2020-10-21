'use strict';

const { RuleTester } = require('eslint');
const Project = require('fixturify-project');
const fs = require('fs');
const rule = require('../rules/validate-imports');
const { expect } = require('chai');

describe('eslint/validate-imports', function () {
  describe('default resolver', function () {
    let project, tester;
    project = new Project('my-fake-project', '0.0.0', project => {
      project.files['_my-person.graphql'] = `
fragment myPerson on People {
  id
  name
}`;
      project.files['_my-fruit.graphql'] = `
fragment myFruit on Fruit {
  id
  colour
}`;

      project.files['test-file.graphql'] = `
#import './_my-person.graphql'
query foo {
  bar {
    ...myPerson
  }
}`;

      project.files['test-file-fragment-with-import.graphql'] = `
#import './_my-person.graphql'
fragment foo on People {
  ...myPerson
  someOtherProperty
}

query {
  bar {
    ...foo
  }
}
`;

      project.files['no-such-import.graphql'] = `
#import './_no-such-file.graphql'
query foo {
  bar {
    ...myFragment
  }
}
`;

      project.files['unused-import.graphql'] = `
#import './_my-person.graphql'
query foo {
  bar {
    id
  }
}`;

      project.files['unused-some-import.graphql'] = `
#import './_my-person.graphql'
#import './_my-fruit.graphql'

query foo {
  bar {
    id
    ...myPerson
  }
}`;

      project.files['unused-fragment.graphql'] = `
fragment NotGonnaUseThis on People {
  id
}

query {
  bar {
    name
  }
}
    `;

      project.files['missing-fragments.graphql'] = `
#import './_my-person.graphql'
query foo {
  bar {
    ...noSuchFragment,
    ...myPerson,
    ...noSuchFragment,
  }
}`;

      project.addDependency('some-dependency', '1.0.0', addon => {
        addon.files['_fragment.graphql'] = `
fragment MyFragment on Fruit {
  id
} `;
      });

      project.files['with-node-modules-import.graphql'] = `
#import './node_modules/some-dependency/_fragment.graphql'
query foo {
  bar {
    ...Fragment
  }
}
      `;

      project.files['complex.graphql'] = `
#import './file-without-underscore.graphql'
#import './_fragment.apple'
#import './_fragment.graphgql'
#import './_fragment.grapqhl'
query foo {
  bar {
    ...MyFragment
    ...myPerson
  }
} `;

      // two errors for the bad spreads on imported fragments
      // the in-document fragment is left to the standard rule, wrapped by @eslint-ast/eslint-plugin-graphql
      project.files['invalid-spread-imported.graphql'] = `
#import './_my-person.graphql'
#import './_my-fruit.graphql'
fragment inDocumentFragment on People {
  name
}
query foo {
  bar {
    ...myFruit
    ...inDocumentFragment
  }
  baz {
    ...myPerson
    ...inDocumentFragment
  }
} `;
    });

    project.writeSync();

    beforeEach(function () {
      tester = new RuleTester({
        parser: require.resolve(`@eslint-ast/eslint-plugin-graphql/parser`),
        parserOptions: {
          schema: `${__dirname}/schema.graphql`,
        },
      });
    });

    it('fails if no parser is provided', function () {
      const rule = require('../rules/validate-imports');

      expect(() =>
        rule.create({
          getFilename() {
            return '';
          },
          parserServices: {
            createTypeInfo() {},
          },
        }),
      ).to.throw(/invalid parser detected/);

      expect(() =>
        rule.create({
          getFilename() {
            return '';
          },
          parserServices: {
            createTypeInfo() {},
            getFragmentDefinitionsFromSource() {},
          },
        }),
      ).to.not.throw();
    });

    function valid(_filename) {
      it(` lints ${_filename} as valid`, function () {
        const filename = `${project.baseDir}/${_filename}`;
        const code = fs.readFileSync(filename, 'utf8');
        tester.run(_filename, require('../rules/validate-imports'), {
          valid: [
            {
              code,
              filename,
            },
          ],
          invalid: [],
        });
      });
    }

    function invalid(_filename, errors) {
      it(`lints ${_filename} as invalid`, function () {
        const filename = `${project.baseDir}/${_filename}`;
        const code = fs.readFileSync(filename, 'utf8');

        tester.run(_filename, rule, {
          valid: [],
          invalid: [
            {
              code,
              filename,
              errors,
            },
          ],
        });
      });
    }

    valid.skip = function (rulePath) {
      // eslint-disable-next-line mocha/no-skipped-tests
      it.skip(rulePath);
    };
    invalid.skip = function (rulePath) {
      // eslint-disable-next-line mocha/no-skipped-tests
      it.skip(rulePath);
    };

    valid('test-file.graphql');
    valid('test-file-fragment-with-import.graphql');
    valid('_my-person.graphql');
    valid('_my-fruit.graphql');
    invalid('no-such-import.graphql', [
      {
        type: 'CommentImportStatement',
        messageId: 'fileNotFound',
        data: {
          importIdentifier: './_no-such-file.graphql',
          basedir: project.baseDir,
        },
        line: 2,
        column: 1,
        endLine: 2,
        endColumn: 34,
      },
      {
        type: 'FragmentSpread',
        message: 'Unknown fragment "myFragment".',
        line: 5,
        column: 6,
        endLine: 5,
        endColumn: 9,
      },
    ]);

    invalid('unused-import.graphql', [
      {
        type: 'CommentImportStatement',
        message: `import unused`,

        line: 2,
        column: 1,
        endLine: 2,
        endColumn: 31,
      },
    ]);

    invalid('unused-some-import.graphql', [
      {
        type: 'CommentImportStatement',
        message: `import unused`,

        line: 3,
        column: 1,
        endLine: 3,
        endColumn: 30,
      },
    ]);

    invalid('unused-fragment.graphql', [
      {
        type: 'FragmentDefinition',
        message: 'Fragment "NotGonnaUseThis" is never used',
        line: 2,
        column: 2,
        endLine: 4,
        endColumn: 2,
      },
    ]);

    invalid('missing-fragments.graphql', [
      {
        type: 'FragmentSpread',
        message: `Unknown fragment "noSuchFragment".`,

        line: 5,
        column: 6,
        endLine: 5,
        endColumn: 9,
      },
      {
        type: 'FragmentSpread',
        message: `Unknown fragment "noSuchFragment".`,

        line: 7,
        column: 6,
        endLine: 7,
        endColumn: 9,
      },
    ]);

    invalid('complex.graphql', [
      {
        type: 'CommentImportStatement',
        message: `imported fragments must begin with an underscore [_]`,
        line: 2,
        column: 1,
        endLine: 2,
        endColumn: 44,
      },
      {
        type: 'CommentImportStatement',
        message: `imported fragments must have the extension '.graphql' but got '.apple'`,
        line: 3,
        column: 1,
        endLine: 3,
        endColumn: 28,
      },
      {
        type: 'CommentImportStatement',
        message: `imported fragments must have the extension '.graphql' but got '.graphgql'`,
        line: 4,
        column: 1,
        endLine: 4,
        endColumn: 31,
      },
      {
        type: 'CommentImportStatement',
        message: `imported fragments must have the extension '.graphql' but got '.grapqhl'`,
        line: 5,
        column: 1,
        endLine: 5,
        endColumn: 30,
      },
      {
        type: 'FragmentSpread',
        message: `Unknown fragment "MyFragment".`,

        line: 8,
        column: 6,
        endLine: 8,
        endColumn: 9,
      },
      {
        type: 'FragmentSpread',
        message: `Unknown fragment "myPerson".`,

        line: 9,
        column: 6,
        endLine: 9,
        endColumn: 9,
      },
    ]);

    invalid('with-node-modules-import.graphql', [
      {
        type: 'CommentImportStatement',
        message: `imports cannot contain 'node_modules'`,
        line: 2,
        column: 1,
        endLine: 2,
        endColumn: 59,
      },

      {
        type: 'FragmentSpread',
        message: `Unknown fragment "Fragment".`,
        line: 5,
        column: 6,
        endLine: 5,
        endColumn: 9,
      },
    ]);

    invalid('invalid-spread-imported.graphql', [
      {
        type: 'FragmentSpread',
        message:
          'Fragment "myFruit" cannot be spread here as objects of type "People" can never be of type "Fruit"',
        line: 9,
        column: 6,
        endLine: 9,
        endColumn: 9,
      },
      {
        type: 'FragmentSpread',
        message:
          'Fragment "myPerson" cannot be spread here as objects of type "Fruit" can never be of type "People"',
        line: 13,
        column: 6,
        endLine: 13,
        endColumn: 9,
      },
    ]);
  });

  describe('custom resolver setup', function () {
    function mockContext(importResolver) {
      return {
        parserServices: {
          getFragmentDefinitionsFromSource() {},
          createTypeInfo() {},
        },
        getFilename() {
          return '';
        },
        options: [{ importResolver }],
      };
    }

    it('throws on relative importResolver configs', function () {
      expect(() => {
        rule.create(mockContext(`./custom-resolver`));
      }).to.throw(
        '[graphql-fragment-import/validate-imports] option "importResolver" must be an absolute path, not "./custom-resolver"',
      );
    });

    it('allows absolute importResolver configs', function () {
      expect(() => {
        rule.create(mockContext(`${__dirname}/custom-resolver`));
      }).to.not.throw();
    });
  });

  describe('custom resolver', function () {
    let project;

    project = new Project('my-project-custom-resolver', '0.0.0', project => {
      project.files['schema.graphql'] = `
type Book {
  title: String
  author: String
  sales: Int
}

type Query {
  books: [Book!]!
}
        `;
      project.files['FRAGMENTS'] = `
fragment BookAuthor on Book {
  author
}

fragment BookTitle on Book {
  title
}`;

      project.files['relative-import.graphql'] = `
#import "./_super-fragment.graphql"
query {
  books {
    ...BookAuthor
    ...BookTitle
  }
}`;

      project.files['named-import.graphql'] = `
#import "_SuperFragment.graphql"
query {
  books {
    ...BookTitle
    ...BookAuthor
  }
}`;

      project.files['mixed-imports.graphql'] = `
#import "_SuperFragment.graphql"
#import "./_fragment-times.graphql"
query {
  books {
    ...BookTitle
    ...BookAuthor
  }
}`;

      project.files['missing-relative-import.graphql'] = `
#import "./_miss-super-fragment.graphql"
query { books { title } }
`;

      project.files['missing-named-import.graphql'] = `
#import "_SuperMissFragment.graphql"
query { books { title } }
`;

      project.files['missing-mixed-imports.graphql'] = `
#import "_SuperFragmentMiss.graphql"
#import "_ThisOneHits.graphql"
#import "./_ah-ha.graphql"
#import "./_fragment-times-miss.graphql"
query {
  books {
    ...BookTitle
    ...BookAuthor
  }
}`;
    });

    project.writeSync();
    let tester = new RuleTester({
      parser: require.resolve(`@eslint-ast/eslint-plugin-graphql/parser`),
      parserOptions: {
        filename: 'test-file.graphql',
        schema: `${project.baseDir}/schema.graphql`,
      },
    });

    function code(filename) {
      return fs.readFileSync(`${project.baseDir}/${filename}`, 'utf8');
    }
    let basedir = project.baseDir;

    let options = [
      {
        importResolver: `${__dirname}/custom-resolver`,
      },
    ];

    tester.run('validate-imports', rule, {
      valid: [
        {
          code: code('relative-import.graphql'),
          filename: `${basedir}/relative-import.graphql`,
          options,
        },
        {
          code: code('named-import.graphql'),
          filename: `${basedir}/named-import.graphql`,
          options,
        },
        {
          code: code('mixed-imports.graphql'),
          filename: `${basedir}/mixed-imports.graphql`,
          options,
        },
      ],
      invalid: [
        {
          code: code('missing-relative-import.graphql'),
          filename: `${basedir}/missing-relative-import.graphql`,
          options,
          errors: [
            {
              messageId: 'fileNotFound',
              data: {
                importIdentifier: './_miss-super-fragment.graphql',
                basedir,
              },
            },
          ],
        },
        {
          code: code('missing-named-import.graphql'),
          filename: `${basedir}/missing-named-import.graphql`,
          options,
          errors: [
            {
              messageId: 'fileNotFound',
              data: {
                importIdentifier: '_SuperMissFragment.graphql',
                basedir,
              },
            },
          ],
        },
        {
          code: code('missing-mixed-imports.graphql'),
          filename: `${basedir}/missing-mixed-imports.graphql`,
          options,
          errors: [
            {
              messageId: 'fileNotFound',
              data: {
                importIdentifier: '_SuperFragmentMiss.graphql',
                basedir,
              },
            },
            {
              messageId: 'fileNotFound',
              data: {
                importIdentifier: './_fragment-times-miss.graphql',
                basedir,
              },
            },
          ],
        },
      ],
    });
  });
});

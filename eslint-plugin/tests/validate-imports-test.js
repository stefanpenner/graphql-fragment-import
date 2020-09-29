'use strict';

const { RuleTester } = require('eslint');
const Project = require('fixturify-project');
const fs = require('fs');
const { expect } = require('chai');

describe('eslint/validate-imports', function () {
  let project, tester;
  beforeEach(function () {
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
    });

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

    project.writeSync();

    tester = new RuleTester({
      parser: require.resolve(`@eslint-ast/eslint-plugin-graphql/parser`),
      parserOptions: {
        filename: 'test-file.graphql',
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

      tester.run(_filename, require('../rules/validate-imports'), {
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
  invalid('no-such-import.graphql', [
    {
      type: 'CommentImportStatement',
      message: /no such file: '.\/_no-such-file.graphql' starting at:/,
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

  // invalid('unused-some-import.graphql', [
  //   {
  //     type: 'CommentImportStatement',
  //     message: `import unused`,

  //     line: 2,
  //     column: 1,
  //     endLine: 2,
  //     endColumn: 31,
  //   },
  // ]);

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

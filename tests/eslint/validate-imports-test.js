'use strict';

const { RuleTester } = require('eslint');
const Project = require('fixturify-project');
const fs = require('fs');

describe('eslint/validate-imports', function() {

  let project, tester;
  beforeEach(function() {
    project = new Project('my-fake-project', '0.0.0', project => {
      project.files['_my-file.graphql'] = `
fragment myFile on People {
  id
}`;

      project.files['test-file.graphql'] = `
#import './_my-file.graphql'
query foo {
  bar {
    ...myFile
  }
}`;

      project.files['no-such-import.graphql'] = `
#import './_no-such-file.graphql'
query foo {
  bar {
    ...myFragment
  }
}
`;

      project.files['unused-import.graphql'] = `
#import './_my-file.graphql'
query foo {
  bar {
    id
  }
}`;
      project.files['missing-fragments.graphql'] = `
#import './_my-file.graphql'
query foo {
  bar {
    ...noSuchFragment,
    ...myFile,
    ...noSuchFragment,
  }
}`;

      project.addDependency('some-dependency', '1.0.0', addon => {
        addon.files['_fragment.graphql'] = `
fragment Fragment on Fruit {
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
    ...myFile
  }
} `
    });

    project.writeSync();

    tester = new RuleTester({
      parser: require.resolve(`@eslint-ast/eslint-plugin-graphql/parser`)
    });
  })

  function valid(_filename) {
    it(` lints ${_filename} as valid`, () => {
      const filename = `${project.baseDir}/${_filename}`;
      const code = fs.readFileSync(filename, 'utf8');
      tester.run(_filename, require('../../eslint-plugin/rules/validate-imports'), {
        valid: [
          {
            code ,
            filename
          }],
        invalid: [],
      });
    })
  }

  function invalid(_filename, errors) {
    it(`lints ${_filename} as invalid`, () => {
      const filename = `${project.baseDir}/${_filename}`;
      const code = fs.readFileSync(filename, 'utf8');

      tester.run(_filename, require('../../eslint-plugin/rules/validate-imports'), {
        valid: [],
        invalid: [
          {
            code,
            filename,
            errors
          }
        ],
      });
    })
  }

  valid.skip = function(rulePath) { it.skip(rulePath) };
  invalid.skip = function(rulePath) { it.skip(rulePath) };

  valid('test-file.graphql');
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
    }
  ]);

  invalid('unused-import.graphql', [
    {
      type: 'CommentImportStatement',
      message: `import unused`,

      line: 2,
      column: 1,
      endLine: 2,
      endColumn: 29,
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
      message: `Unknown fragment "myFile".`,

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
    }
  ]);
});

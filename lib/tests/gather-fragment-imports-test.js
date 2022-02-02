'use strict';
const { assert } = require('chai');
const path = require('path');
const fs = require('fs');
const gatherFragmentImports = require('../gather-fragment-imports');
const FixturifyProject = require('fixturify-project');

const fragmentCapture = /(fragment (\w*).*\{[\w\n\s]*)\}/gm;

function* fakeParser(src) {
  let fragmentSnippet;

  while ((fragmentSnippet = fragmentCapture.exec(src)) !== null) {
    yield {
      name: {
        value: fragmentSnippet[2],
      },
      loc: {},
    };
  }
}

describe('gather-fragment-imports', function () {
  let basedir;

  beforeEach(function () {
    const project = new FixturifyProject('my-example', '0.0.1', project => {
      project.files['apple.graphql'] = `
fragment apple on User {
  name
}`;
      project.files['orange.graphql'] = `
fragment orange on User {
  name
}`;
      project.files['parent.graphql'] = `
#import './apple.graphql'

fragment parent on User {
  name
}`;
      project.files['double-import.graphql'] = `
#import './apple.graphql'
#import './orange.graphql'

fragment parent on User {
  name
}`;
      project.files['nested-1.graphql'] = `
#import './nested-2.graphql'

fragment nested1 on User {
  name
}`;
      project.files['nested-2.graphql'] = `
#import './nested-3.graphql'

fragment nested2 on User {
  name
}`;
      project.files['nested-3.graphql'] = `
fragment nested3 on User {
  name
}`;
      project.files['nested.graphql'] = `
#import './nested-1.graphql'

fragment parent on User {
  name
}`;
      project.files['from-dependency.graphql'] = `
#import 'my-dependency/_dependency-fragment.graphql'
query {
  myQuery {
    ...FromDependency
  }
}`;
      project.files['missing-import.graphql'] = `
#import 'missing-import.graphql'
query {
  myQuery {
    ...MissingImport
  }
}`;

      project.addDependency('my-dependency', '0.0.1', dependency => {
        dependency.files['_dependency-fragment.graphql'] = `
fragment FromDependency on User {
  name
}`;
      });
    });
    project.writeSync();
    basedir = project.baseDir;
  });

  it('handles single import', function () {
    const result = gatherFragmentImports({
      source: fs.readFileSync(path.join(basedir, 'parent.graphql'), 'utf8'),
      sourceLocation: path.join(basedir, 'parent.graphql'),
      resolveImport: require('resolve').sync,
      fragmentParserGenerator: fakeParser,
      throwIfImportNotFound: false,
    });

    assert.deepEqual(
      result,
      new Map([
        [
          2,
          new Map([
            [
              'apple',
              { name: { value: 'apple' }, loc: { filename: path.join(basedir, 'apple.graphql') } },
            ],
          ]),
        ],
      ]),
    );
  });

  it('handles double import', function () {
    const result = gatherFragmentImports({
      source: fs.readFileSync(path.join(basedir, 'double-import.graphql'), 'utf8'),
      sourceLocation: path.join(basedir, 'double-import.graphql'),
      resolveImport: require('resolve').sync,
      fragmentParserGenerator: fakeParser,
      throwIfImportNotFound: false,
    });

    assert.deepEqual(
      result,
      new Map([
        [
          2,
          new Map([
            [
              'apple',
              { name: { value: 'apple' }, loc: { filename: path.join(basedir, 'apple.graphql') } },
            ],
          ]),
        ],
        [
          3,
          new Map([
            [
              'orange',
              {
                name: { value: 'orange' },
                loc: { filename: path.join(basedir, 'orange.graphql') },
              },
            ],
          ]),
        ],
      ]),
    );
  });

  it('handles nested imports, 3 fragments for import on line 2', function () {
    const result = gatherFragmentImports({
      source: fs.readFileSync(path.join(basedir, 'nested.graphql'), 'utf8'),
      sourceLocation: path.join(basedir, 'nested.graphql'),
      resolveImport: require('resolve').sync,
      fragmentParserGenerator: fakeParser,
      throwIfImportNotFound: false,
    });

    assert.deepEqual(
      result,
      new Map([
        [
          2,
          new Map([
            [
              'nested1',
              {
                name: { value: 'nested1' },
                loc: { filename: path.join(basedir, 'nested-1.graphql') },
              },
            ],
            [
              'nested2',
              {
                name: { value: 'nested2' },
                loc: { filename: path.join(basedir, 'nested-1.graphql') },
              },
            ],
            [
              'nested3',
              {
                name: { value: 'nested3' },
                loc: { filename: path.join(basedir, 'nested-1.graphql') },
              },
            ],
          ]),
        ],
      ]),
    );
  });

  it('handles imports from another package', function () {
    const result = gatherFragmentImports({
      source: fs.readFileSync(path.join(basedir, 'from-dependency.graphql'), 'utf8'),
      sourceLocation: path.join(basedir, 'from-dependency.graphql'),
      resolveImport: require('resolve').sync,
      fragmentParserGenerator: fakeParser,
      throwIfImportNotFound: false,
    });

    assert.deepEqual(
      result,
      new Map([
        [
          2,
          new Map([
            [
              'FromDependency',
              {
                name: { value: 'FromDependency' },
                loc: {
                  filename: path.join(
                    basedir,
                    'node_modules/my-dependency/_dependency-fragment.graphql',
                  ),
                },
              },
            ],
          ]),
        ],
      ]),
    );
  });

  it('throws when there is missing import', function () {
    const fn = function () {
      gatherFragmentImports({
        source: fs.readFileSync(path.join(basedir, 'missing-import.graphql'), 'utf8'),
        sourceLocation: path.join(basedir, 'missing-import.graphql'),
        resolveImport: require('resolve').sync,
        fragmentParserGenerator: fakeParser,
        throwIfImportNotFound: true,
      });
    };

    assert.throws(fn, "Cannot find module 'missing-import.graphql' from");
  });
});

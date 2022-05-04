import chai from 'chai';
import path from 'path';
import fs from 'fs';
import gatherFragmentImports, { AugmentedFragmentDefinitionWithFileNameInLocation } from '../gather-fragment-imports';
import FixturifyProject from 'fixturify-project';
import { FragmentDefinitionNode } from 'graphql';
import resolve from 'resolve';

const FRAGMENT_NAME_REGEX = /fragment (.*?) on/;
function fakeParser(src: string): FragmentDefinitionNode[] {
  const match = src.match(FRAGMENT_NAME_REGEX);
  if (match && match.length > 1) {
    return [{
      name: {
        value: match[1],
      },
      loc: {},
    } as FragmentDefinitionNode]; // intentionally mis-cast to avoid mocking
  } else {
    return [{
      name: {
        value: 'value'
      },
      loc: {},
    } as FragmentDefinitionNode];
  }
}

describe('gather-fragment-imports', () => {
  let basedir: string | undefined;

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
  ...apple
  name
}`;
      project.files['double-import.graphql'] = `
#import './apple.graphql'
#import './orange.graphql'

fragment parent on User {
  ...apple
  ...orange
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

  it('handles single import', () => {
    const result = gatherFragmentImports(
      fs.readFileSync(path.join(basedir!, 'parent.graphql'), 'utf8'),
      path.join(basedir!, 'parent.graphql'),
      resolve.sync,
      fakeParser,
      false,
    );

    chai.assert.deepEqual(
      result,
      new Map([
        [5, new Map([
          ['apple', { 
            name: { value: 'apple' },
            loc: { filename: path.join(basedir!, 'apple.graphql') },
          } as unknown as AugmentedFragmentDefinitionWithFileNameInLocation]
        ])]
      ]),
    );
  });

  it('handles double import', () => {
    const result = gatherFragmentImports(
      fs.readFileSync(path.join(basedir!, 'double-import.graphql'), 'utf8'),
      path.join(basedir!, 'double-import.graphql'),
      resolve.sync,
      fakeParser,
      false
    );

    chai.assert.deepEqual(
      result,
      new Map([
        [6, new Map([
          ['apple', { 
            name: { value: 'apple' },
            loc: { filename: path.join(basedir!, 'apple.graphql') },
          } as unknown as AugmentedFragmentDefinitionWithFileNameInLocation]
        ])],
        [10, new Map([
          ['orange', {
            name: { value: 'orange' },
            loc: { filename: path.join(basedir!, 'orange.graphql') },
          } as unknown as AugmentedFragmentDefinitionWithFileNameInLocation]
        ])]
      ]),
    );
  });

  it('handles imports from another package import', () => {
    const result = gatherFragmentImports(
      fs.readFileSync(path.join(basedir!, 'from-dependency.graphql'), 'utf8'),
      path.join(basedir!, 'from-dependency.graphql'),
      resolve.sync,
      fakeParser,
      false,
    );

    chai.assert.deepEqual(
      result,
      new Map([
        [6, new Map([
          ['FromDependency', { 
            name: { value: 'FromDependency' },
            loc: { filename: path.join(basedir!, 'node_modules/my-dependency/_dependency-fragment.graphql') },
          } as unknown as AugmentedFragmentDefinitionWithFileNameInLocation]
        ])]
      ]),
    );
  });

  it('throws when there is missing import', () => {
    const fn = () => {
      gatherFragmentImports(
        fs.readFileSync(path.join(basedir!, 'missing-import.graphql'), 'utf8'),
        path.join(basedir!, 'missing-import.graphql'),
        resolve.sync,
        fakeParser,
        true,
      );
    };

    chai.assert.throws(fn, "Cannot find module 'missing-import.graphql' from");
  });
});

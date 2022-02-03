'use strict';
const path = require('path');
const { expect } = require('chai');

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

function createFakeContext(source, sourceLocation) {
  return {
    getSourceCode: () => {
      return {
        text: source,
      };
    },
    getFilename: () => {
      return path.resolve(__dirname, sourceLocation);
    },
    parserServices: {
      getFragmentDefinitionsFromSource: fakeParser,
    },
  };
}

describe('gather-fragment-imports-for-context', function () {
  const gatherFragmentImportsForContext = require('../gather-fragment-imports-for-context');

  it('empty source should return empty map', function () {
    const context = createFakeContext('', '../../example/file.graphql');
    expect(gatherFragmentImportsForContext(context, false)).to.deep.equal(new Map());
  });

  it('single file import should contain fragment node from there', function () {
    const context = createFakeContext('#import "./_orange.graphql"', '../../example/file.graphql');

    const fragments = new Map([
      [
        'Orange',
        {
          name: { value: 'Orange' },
          loc: {
            filename: path.join(__dirname, '../../example/_orange.graphql'),
          },
        },
      ],
      [
        'Kiwi',
        {
          name: { value: 'Kiwi' },
          loc: {
            filename: path.join(__dirname, '../../example/_orange.graphql'),
          },
        },
      ],
    ]);
    expect(gatherFragmentImportsForContext(context, false)).to.deep.equal(
      new Map([[1, fragments]]),
    );
  });
});

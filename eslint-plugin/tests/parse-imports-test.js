'use strict';

const { expect } = require('chai');

describe('parse-imports', function () {
  const parseImports = require('../parse-imports');
  it('works', function () {
    expect(parseImports('')).to.eql([]);
    expect(parseImports('#import "_foo.graphql"')).to.deep.eql([
      {
        type: 'CommentImportStatement',
        name: {
          type: 'Name',
          value: '_foo.graphql',
          loc: {
            start: {
              line: 1,
              column: 9,
            },
            end: {
              line: 1,
              column: 21,
            },
          },
          comments: [],
          range: [9, 21],
          tokens: [],
        },
        comments: [],
        tokens: [],
        loc: {
          start: {
            line: 1,
            column: 0,
          },
          end: {
            line: 1,
            column: 22,
          },
        },
        range: [0, 22],
      },
    ]);

    expect(
      parseImports(`#import "_foo.graphql"
#import "_bar.graphql"`),
    ).to.eql([
      {
        type: 'CommentImportStatement',
        name: {
          type: 'Name',
          value: '_foo.graphql',
          loc: {
            start: {
              line: 1,
              column: 9,
            },
            end: {
              line: 1,
              column: 21,
            },
          },
          comments: [],
          range: [9, 21],
          tokens: [],
        },
        loc: {
          start: {
            line: 1,
            column: 0,
          },
          end: {
            line: 1,
            column: 22,
          },
        },
        comments: [],
        range: [0, 22],
        tokens: [],
      },
      {
        type: 'CommentImportStatement',
        name: {
          type: 'Name',
          value: '_bar.graphql',
          loc: {
            start: {
              line: 2,
              column: 9,
            },
            end: {
              line: 2,
              column: 21,
            },
          },
          comments: [],
          range: [32, 44],
          tokens: [],
        },
        loc: {
          start: {
            line: 2,
            column: 0,
          },
          end: {
            line: 2,
            column: 22,
          },
        },
        comments: [],
        range: [23, 45],
        tokens: [],
      },
    ]);
  });
});

'use strict';
const matchImport = require('@graphql-fragment-import/lib/dist/match-import').default;
const EOL_REGEXP = require('@graphql-fragment-import/lib/dist/eol-regexp').default;

module.exports = function parseImports(source) {
  const imports = [];
  let count = 0;
  let lineCount = 0;
  for (const line of source.split(EOL_REGEXP)) {
    lineCount++;
    const match = matchImport(line);

    if (match) {
      const value = match;
      imports.push({
        type: 'CommentImportStatement',
        name: {
          type: 'Name',
          value,
          loc: {
            start: {
              line: lineCount,
              column: 9,
            },
            end: {
              line: lineCount,
              column: 9 + value.length,
            },
          },
          tokens: [],
          comments: [],
          range: [count + 9, count + 9 + value.length],
        },
        loc: {
          start: {
            line: lineCount,
            column: 0,
          },
          end: {
            line: lineCount,
            column: 0 + line.length,
          },
        },
        tokens: [],
        comments: [],
        range: [count, count + line.length],
      });
    }
    count += line.length + 1 /* newline yo TODO: windows EOL */;
  }
  return imports;
};

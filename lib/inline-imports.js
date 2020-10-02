'use strict';

const matchImport = require('./match-import');

const EOL_REGEXP = require('./eol-regexp');

/*
 *
 * @param fileContents: String The graphql document to inline imports into
 * @param options: {
 *  basedir: String [required]
 *  resolve: (file, { baseDir: string }) => location of file || throws
 *  fs: fs alternative if you so desire
 * }
 */
function* linesWithInlinedImportsOf(fileContents, options, visited) {
  // TODO: I suspect we will need to implement a capable memoization plan, to ensure
  // performance in large code-bases, specifically when doing full code-base analysis,
  // is appropriate. But I won't implement that yet, as I would prefer to drive
  // it by real use-cases. To ensure I focus on the right issues.
  //
  // Before I leave this project in a good sustainable state, I will test in an
  // appropriately large code-base, and potentially leave benchmarks in place
  let basedir = typeof options === 'object' && options !== null && options.basedir;
  if (typeof basedir !== 'string') {
    throw new Error('inlineImports.lineToImports requires options.basedir be set');
  }

  const resolve = typeof options.resolve === 'function' ? options.resolve : require('resolve').sync;
  const fs = typeof options.fs === 'function' ? options.fs : require('fs');

  let lineNumber = 0;
  for (let line of fileContents.split(EOL_REGEXP)) {
    ++lineNumber;
    let matched = matchImport(line);
    if (matched) {
      const importIdentifier = matched.importIdentifier;
      let resolvedPath;

      try {
        resolvedPath = resolve(importIdentifier, { basedir });
      } catch (e) {
        // TODO: this is to improve the ability to provide linting errors
        if (options.throwIfImportNotFound === false) {
          continue;
        }
        throw e;
      }

      if (visited.has(resolvedPath)) {
        continue;
      } else {
        visited.add(resolvedPath);
      }

      const fragmentSource = fs.readFileSync(resolvedPath, 'utf8');
      const line = inlineImports(
        fragmentSource,
        {
          basedir,
          resolve,
        },
        visited,
      );
      yield { line, match: true, lineNumber };
    } else {
      yield { line, match: false, lineNumber };
    }
  }
}

function inlineImports(fileContents, options, visited = new Set()) {
  const result = [];
  for (let { line } of linesWithInlinedImportsOf(fileContents, options, visited)) {
    result.push(line);
  }
  return result.join('\n');
}

module.exports = inlineImports;
module.exports.lineToImports = function (fileContents, options, visited = new Set()) {
  const result = new Map();
  for (let { line, match, lineNumber } of linesWithInlinedImportsOf(
    fileContents,
    options,
    visited,
  )) {
    // We're only interested in the inlined import lines, ignore any
    // non-matching lines
    if (match) {
      result.set(lineNumber, line);
    }
  }
  return result;
};

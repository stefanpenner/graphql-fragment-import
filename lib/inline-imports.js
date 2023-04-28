'use strict';

const path = require('path');
const matchImport = require('./match-import');

const EOL_REGEXP = require('./eol-regexp');

function* linesWithInlinedImportsOf(
  fileContents,
  { resolveOptions = {}, resolveImport, fs, throwIfImportNotFound },
  visited,
  fragmentCollector,
) {
  // TODO: I suspect we will need to implement a capable memoization plan, to ensure
  // performance in large code-bases, specifically when doing full code-base analysis,
  // is appropriate. But I won't implement that yet, as I would prefer to drive
  // it by real use-cases. To ensure I focus on the right issues.
  //
  // Before I leave this project in a good sustainable state, I will test in an
  // appropriately large code-base, and potentially leave benchmarks in place
  const { basedir } = resolveOptions;
  if (typeof basedir !== 'string') {
    throw new Error('inlineImports requires options.resolverOptions.basedir be set');
  }

  const resolve = typeof resolveImport === 'function' ? resolveImport : require('resolve').sync;
  fs = typeof fs === 'function' ? fs : require('fs');

  let lineNumber = 0;
  for (let line of fileContents.split(EOL_REGEXP)) {
    ++lineNumber;
    let matched = matchImport(line);
    if (matched) {
      const importIdentifier = matched.importIdentifier;
      let filename;

      try {
        filename = resolve(importIdentifier, resolveOptions);
      } catch (e) {
        if (throwIfImportNotFound === false) {
          continue;
        }
        throw e;
      }
      // Add the filename to the visited set, to ensure we don't inline the same file over again
      if (visited.has(filename)) {
        continue;
      } else {
        visited.add(filename);
      }

      const fragmentSource = fs.readFileSync(filename, 'utf8');
      const { inlineImports } = inlineImportsWithLineToImports(
        fragmentSource,
        {
          resolveImport: resolve,
          resolveOptions: {
            basedir: path.dirname(filename),
          },
        },
        visited,
        false,
        fragmentCollector,
      );

      yield { line: inlineImports, match: true, lineNumber, filename, rawSource: fragmentSource };
    } else {
      yield { line, match: false, lineNumber };
    }
  }
}

/**
 * Returns an object containing the query/fragment with all fragements inlined,
 * as well as the matched imports (effectively, a combination of both the default
 * `inlineImports` function, and the `lineToImports` utility)
 *
 * @name inlineImportsWithLineToImports
 * @returns {inlineImports: string, lineToImports: Map<number, {filename: string, line: string}>}
 */
function inlineImportsWithLineToImports(
  fileContents,
  options = {},
  visited = new Set(),
  root = true,
  fragmentCollector = new Map(),
) {
  const inlineImportsResult = [];
  const lineToImports = new Map();
  /** Ideally lineToImports should look like this:
  // Map<lineNumber, Map<filename,source>>
**/
  for (let { line, match, lineNumber, filename, rawSource } of linesWithInlinedImportsOf(
    fileContents,
    options,
    visited,
    fragmentCollector,
  )) {
    inlineImportsResult.push(line);

    // We're only interested in the inlined import lines, ignore any
    // non-matching lines
    if (match) {
      fragmentCollector.set(filename, rawSource);
      if (root) {
        lineToImports.set(lineNumber, new Map([...fragmentCollector]));
        fragmentCollector.clear();
      }
    }
  }

  return {
    inlineImports: inlineImportsResult.join('\n'),
    lineToImports,
  };
}

/*
 * Inline any import statements of the graphql document string `fileContents`
 *
 * @typedef {{ basedir: string, ...args: [any]}} ResolverOptions
 * @property {string} basedir - The base directory to use when resolving import identifiers.  For most platforms this will be the absolute path to the directory containing the graphql query file with imports.
 * @property {...args} [any] - any other properties on a `ResolverOptions` will be passed through to the resolver.
 * @param {string} fileContents - The graphql document to inline imports into
 * @param {object} options
 * @param {(identifier: string, options: ResolverOptions) => string} [options.resolveImport=require.resolve] - a function for resolving imports.  It must support relative paths as well as any package specifiers that may be present as identifiers in the import statements of `fileContents`.  For invalid import identifiers, it should throw an error. Defaults to `resolve.sync` (i.e. treating imported packages as node modules).
 * @param {ResolverOptions} options.resolveOptions - options that are passed to `options.resolveImport` when resolving imports.
 * @param {boolean} [throwIfImportNotFound=true] - whether or not to throw for invalid imports, or to silently ignore them.
 */
function inlineImports(fileContents, options = {}, visited = new Set()) {
  return inlineImportsWithLineToImports(fileContents, options, visited).inlineImports;
}

module.exports = inlineImports;
module.exports.inlineImportsWithLineToImports = inlineImportsWithLineToImports;
module.exports.lineToImports = function (fileContents, options = {}, visited = new Set()) {
  return inlineImportsWithLineToImports(fileContents, options, visited).lineToImports;
};

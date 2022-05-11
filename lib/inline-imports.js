'use strict';

const path = require('path');
const matchImport = require('./match-import');

const EOL_REGEXP = require('./eol-regexp');

function* linesWithInlinedImportsOf(
  fileContents,
  { resolveOptions = {}, resolveImport, fs, throwIfImportNotFound },
  visited,
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

      if (visited.has(filename)) {
        continue;
      } else {
        visited.add(filename);
      }

      const fragmentSource = fs.readFileSync(filename, 'utf8');
      const line = inlineImports(
        fragmentSource,
        {
          resolveImport: resolve,
          resolveOptions: {
            basedir: path.dirname(filename),
          },
        },
        visited,
      );
      yield { line, match: true, lineNumber, filename };
    } else {
      yield { line, match: false, lineNumber };
    }
  }
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
  const result = [];
  for (let { line } of linesWithInlinedImportsOf(fileContents, options, visited)) {
    result.push(line);
  }
  return result.join('\n');
}

function getFilename(filePath, options = {}) {
  const { resolveImport, resolveOptions = {} } = options;

  const { basedir } = resolveOptions;
  if (typeof basedir !== 'string') {
    throw new Error('inlineImports requires options.resolverOptions.basedir be set');
  }
  const resolve = typeof resolveImport === 'function' ? resolveImport : require('resolve').sync;
  return resolve(filePath, resolveOptions);
}

function getFileContents(filePath, options = {}) {
  const { fs } = options;
  const resolvedFs = typeof fs === 'function' ? fs : require('fs');
  return resolvedFs.readFileSync(filePath, 'utf8');
}

/*
 * Inline any import statements of the graphql document from `fullFilePath`
 *
 * @typedef {{ basedir: string, ...args: [any]}} ResolverOptions
 * @property {string} basedir - The base directory to use when resolving import identifiers.  For most platforms this will be the absolute path to the directory containing the graphql query file with imports.
 * @property {...args} [any] - any other properties on a `ResolverOptions` will be passed through to the resolver.
 * @param {string} fullFilePath - The graphql document filepath to inline imports into
 * @param {object} options
 * @param {(identifier: string, options: ResolverOptions) => string} [options.resolveImport=require.resolve] - a function for resolving imports.  It must support relative paths as well as any package specifiers that may be present as identifiers in the import statements of `fileContents`.  For invalid import identifiers, it should throw an error. Defaults to `resolve.sync` (i.e. treating imported packages as node modules).
 * @param {ResolverOptions} options.resolveOptions - options that are passed to `options.resolveImport` when resolving imports.
 * @param {boolean} [throwIfImportNotFound=true] - whether or not to throw for invalid imports, or to silently ignore them.
 */
function inlineImportsFromFile(fullFilePath, options = {}) {
  const result = [];
  const filename = getFilename(fullFilePath, options);
  const fileSource = getFileContents(filename, options);

  for (let { line } of linesWithInlinedImportsOf(fileSource, options, new Set([filename]))) {
    result.push(line);
  }
  return result.join('\n');
}

module.exports = inlineImports;
module.exports.inlineImportsFromFile = inlineImportsFromFile;
module.exports.lineToImports = function (fileContents, options = {}, visited = new Set()) {
  const result = new Map();
  for (let { line, match, lineNumber, filename } of linesWithInlinedImportsOf(
    fileContents,
    options,
    visited,
  )) {
    // We're only interested in the inlined import lines, ignore any
    // non-matching lines
    if (match) {
      result.set(lineNumber, { filename, line });
    }
  }
  return result;
};

module.exports.lineToImportsFromFile = function (fullFilePath, options = {}) {
  const result = new Map();
  const originalFileName = getFilename(fullFilePath, options);
  const fileSource = getFileContents(originalFileName, options);
  for (let { line, match, lineNumber, filename } of linesWithInlinedImportsOf(
    fileSource,
    options,
    new Set([originalFileName]),
  )) {
    // We're only interested in the inlined import lines, ignore any
    // non-matching lines
    if (match) {
      result.set(lineNumber, { filename, line });
    }
  }
  return result;
};

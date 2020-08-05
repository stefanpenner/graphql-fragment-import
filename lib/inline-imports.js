'use strict';

const matchImport = require('./match-import');

// we use this rather then require('os').EOL since many windows developers end
// up using \n. So instead we split on \r\n and \n;
// TODO: do we need to care about just \r ?
// TODO: we likely should detect the preferred line ending of the fileContents and `join` based on that.
const EOL_REGEXP = /\r\n|\n/;
/*
 *
 * @param fileContents: String The graphql document to inline imports into
 * @param options: {
 *  basedir: String [required]
 *  resolve: (file, { baseDir: string }) => location of file || throws
 *  fs: fs alternative if you so desire
 * }
 */
module.exports = function inlineImports(fileContents, options, visited = new Set()) {
  // TODO: I suspect we will need to implement a capable memoization plan, to ensure
  // performance in large code-bases, specifically when doing full code-base analysis,
  // is appropriate. But I won't implement that yet, as I would prefer to drive
  // it by real use-cases. To ensure I focus on the right issues.
  //
  // Before I leave this project in a good sustainable state, I will test in an
  // appropriately large code-base, and potentially leave benchmarks in place
  let basedir = typeof options === 'object' && options !== null &&
    options.basedir;
  if (typeof basedir !== 'string') {
    throw new Error('inlineImports requires options.basedir be set')
  }

  const result = [];
  const files = Object.create(null);
  const resolve = typeof options.resolve === 'function' ? options.resolve : require('resolve').sync;
  const fs = typeof options.fs === 'function' ? options.fs : require('fs');

  for (const line of fileContents.split(EOL_REGEXP)) {
    const matched = matchImport(line);

    if (matched) {
      const importIdentifier = matched.importIdentifier;
      const resolvedPath = resolve(importIdentifier, { basedir });
      if (files[resolvedPath] === true) {
        continue;
      }

      if (visited.has(resolvedPath)) {
        continue;
      } else {
        visited.add(resolvedPath);
      }

      const fragmentSource = fs.readFileSync(resolvedPath, 'utf8');
      const inlined = inlineImports(fragmentSource, {
        basedir,
        resolve
      }, visited);

      result.push(inlined);

      files[resolvedPath] = true;
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
};

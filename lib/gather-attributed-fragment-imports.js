const path = require('path');

const inlineImports = require('./inline-imports');

/**
 * Helper function to fetch and parse all the direct and transitive imports starting
 * from the source. Return object is:
 *
 * {
 *   1: {
 *     resolvedPath: '/absolute/path/to/foo-fragments.graphql',
 *     fragmentDefinitionsByName: {
 *       Foo: fooFragment,
 *       Bar: barFragment,
 *     }
 *   }
 * }
 *
 * @param {string} source - .graphql source code
 * @param {string} sourceLocation - File path of the source code
 * @param {function} resolveImport - This function is used to resolve the path to file for import
 * @param {function} fragmentParserGenerator - Generator function that is passed source code. Expected to yield objects for each fragment definition
 * @param {boolean} throwIfImportNotFound - If set to true, throws error if import not found
 * @returns {Map<number, object}
 */
function gatherAttributedFragmentImports({
  source,
  sourceLocation,
  resolveImport,
  fragmentParserGenerator,
  throwIfImportNotFound,
}) {
  const lineNumberToFileFragmentsInfo = new Map();
  const importLinesToAttributedSource = inlineImports.lineToAttributedImports(source, {
    resolveOptions: {
      basedir: path.dirname(sourceLocation),
    },
    resolveImport,
    throwIfImportNotFound,
  });

  for (const [lineNumber, attributedSource] of importLinesToAttributedSource) {
    const { resolvedPath, line } = attributedSource;
    const fragmentDefinitionsByName = lineNumberToFileFragmentsInfo[lineNumber]
      ? lineNumberToFileFragmentsInfo[lineNumber].fragmentDefinitionsByName
      : new Map();
    for (const fragment of fragmentParserGenerator(line)) {
      fragmentDefinitionsByName.set(fragment.name.value, fragment);
    }
    const fileFragmentsInfo = {
      resolvedPath,
      fragmentDefinitionsByName,
    };
    lineNumberToFileFragmentsInfo.set(lineNumber, fileFragmentsInfo);
  }

  return lineNumberToFileFragmentsInfo;
}

module.exports = gatherAttributedFragmentImports;

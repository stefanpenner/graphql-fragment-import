const path = require('path');

const inlineImports = require('./inline-imports');

/**
 * Helper function to fetch and parse all the direct and transitive imports starting
 * from the source. Return object is:
 *
 * {
 *     1: {
 *         FooBar: fragment,
 *         Bar: fragment
 *     }
 * }
 *
 * @param {string} source - .graphql source code
 * @param {string} sourceLocation - File path of the source code
 * @param {function} resolveImport - This function is used to resolve the path to file for import
 * @param {function} fragmentParserGenerator - Generator function that is passed source code. Expected to yield objects for each fragment definition
 * @param {boolean} throwIfImportNotFound - If set to true, throws error if import not found
 */
function gatherFragmentImports({
  source,
  sourceLocation,
  resolveImport,
  fragmentParserGenerator,
  throwIfImportNotFound,
}) {
  /**
   * {
   *     1: {
   *         FooBar: fragment,
   *         Bar: fragment
   *     }
   * }
   * @type {Map<number, Map<string, object>>}
   */
  const lineToFragmentDefinitions = new Map();
  const importLinesToInlinedSource = inlineImports.lineToImports(source, {
    resolveOptions: {
      basedir: path.dirname(sourceLocation),
    },
    resolveImport,
    throwIfImportNotFound,
  });

  for (const [lineNumber, { filename, line: source }] of importLinesToInlinedSource) {
    const fragmentDefinitionsBucket = lineToFragmentDefinitions[lineNumber] || new Map();
    for (const fragment of fragmentParserGenerator(source)) {
      // Augment the FragmentDefinition by adding the resolved file path inside .loc.filename
      fragment.loc.filename = filename;

      fragmentDefinitionsBucket.set(fragment.name.value, fragment);
    }
    lineToFragmentDefinitions.set(lineNumber, fragmentDefinitionsBucket);
  }

  return lineToFragmentDefinitions;
}

module.exports = gatherFragmentImports;

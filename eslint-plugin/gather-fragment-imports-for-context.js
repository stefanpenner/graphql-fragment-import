const path = require('path');
const gatherFragmentImports = require('@graphql-fragment-import/lib/dist/gather-fragment-imports')
  .default;

/**
 * Wrapper function to setup most parameters from the context object to call gatherFragmentImports.
 *
 * @param {object} context - Context object that was passed to the `create` function of an eslint rule
 * @param {boolean} throwIfImportNotFound - If set to true, throws error if import not found
 * @returns {Map<number, Map<string, Object>>}
 */
function gatherFragmentImportsForContext(context, throwIfImportNotFound) {
  let resolveImport;

  let importResolver =
    Array.isArray(context.options) &&
    context.options.length > 0 &&
    context.options[0].importResolver;
  if (typeof importResolver === 'string') {
    if (!path.isAbsolute(importResolver)) {
      throw new Error(`Option "importResolver" must be an absolute path, not "${importResolver}"`);
    }

    resolveImport = require(importResolver);
  } else {
    resolveImport = require('resolve').sync;
  }

  return gatherFragmentImports(
    context.getSourceCode().text,
    context.getFilename(),
    resolveImport,
    context.parserServices.getFragmentDefinitionsFromSource,
    throwIfImportNotFound,
  );
}

module.exports = gatherFragmentImportsForContext;

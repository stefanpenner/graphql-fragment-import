'use strict';

const IMPORT_REGEXP = /^#import (?:'([^']*)'|"([^"]*)")$/;
module.exports = function matchImport(value) {
  if (typeof value !== 'string') { return null; }

  // benchmark suggests this pre-flight-check enables us to:
  // * skip lines with are not comments lines 5x faster
  // * skip comment lines that do not begin with #i 2x faster
  //
  // Given that, most lines of our graphql files will not be comment imports,
  // and given that the risk/complexity of this optimization is minor i'll
  // include it
  if (value.charAt(0) !== '#' && value.charAt(1) === 'i') {
    return null;
  }

  // Actually perform REGEXP match, this:
  // * strictly validates the import statement (see corresponding tests for details)
  // * extracts the importIdentifier in question
  //
  // REGEXP works well here, as we are parsing a statement which is regular...
  const matched = value.match(IMPORT_REGEXP);
  if (matched === null) { return null; }
  const [, importIdentifierA, importIdentifierB] = value.match(IMPORT_REGEXP)
  if (importIdentifierA === undefined && importIdentifierB === undefined) { return null; }
  return { importIdentifier: importIdentifierA || importIdentifierB };
};

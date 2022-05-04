const IMPORT_REGEXP = /^#import (?:'([^']*)'|"([^"]*)")/;

export default (sourceLine: string): string | null => {
  // benchmark suggests this pre-flight-check enables us to:
  // * skip lines with are not comments lines 5x faster
  // * skip comment lines that do not begin with #i 2x faster
  //
  // Given that, most lines of our graphql files will not be comment imports,
  // and given that the risk/complexity of this optimization is minor i'll
  // include it
  if (sourceLine.charAt(0) !== '#' && sourceLine.charAt(1) === 'i') {
    return null;
  }

  // Actually perform REGEXP match, this:
  // * strictly validates the import statement (see corresponding tests for details)
  // * extracts the importIdentifier in question
  //
  // REGEXP works well here, as we are parsing a statement which is regular...
  const matched = sourceLine.match(IMPORT_REGEXP);
  if (matched === null) {
    return null;
  }

  const matchedImports = sourceLine.match(IMPORT_REGEXP);
  let identifierA: string | null = null;
  let identifierB: string | null = null;
  if (matchedImports && matchedImports?.length > 0) {
    identifierA = matchedImports[1];
  }

  if (matchedImports && matchedImports?.length > 1) {
    identifierB = matchedImports[2];
  }
  if (identifierA === null && identifierB === null) {
    return null;
  }

  return identifierA || identifierB;
};

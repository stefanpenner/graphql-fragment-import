import {
  DefinitionNode,
  DocumentNode,
  FragmentDefinitionNode,
  Kind,
  parse,
  print,
  visit,
} from 'graphql';
import resolve, { SyncOpts } from 'resolve';
import { readFileSync } from 'fs';
import eolRegexp from './eol-regexp';
import matchImport from './match-import';

export type ResolveImportType = (identifier: string, options: SyncOpts) => string | undefined;

export interface InlineImportOptions {
  resolveImport?: ResolveImportType;
  resolveOptions: SyncOpts;
  throwIfImportNotFound?: boolean;
}

// Gather only top level imports
function gatherImports(sourceQuery: string): string[] {
  const imports: string[] = [];
  const lines = sourceQuery.split(eolRegexp);
  lines.forEach(line => {
    const matched = matchImport(line);
    if (matched) {
      imports.push(matched);
    }
  });
  return imports;
}

function resolveImportsWithTransitivesToDocuments(
  sourceQuery: string,
  importOptions: InlineImportOptions,
): Map<string, DocumentNode> {
  const toReturn: Map<string, DocumentNode> = new Map();
  const imports = gatherImports(sourceQuery).map(imprort => {
    const resolveStrategy = importOptions.resolveImport || resolve.sync;
    let filename;
    try {
      filename = resolveStrategy(imprort, importOptions.resolveOptions);
    } catch (e) {
      if (importOptions.throwIfImportNotFound === true) {
        throw e;
      }
    }
    return filename;
  });
  const stack = Array.from(imports);
  const visited: Set<string> = new Set();
  while (stack.length > 0) {
    const importToCheck = stack.pop();
    if (!importToCheck) {
      break;
    }

    if (!visited.has(importToCheck)) {
      visited.add(importToCheck);
      const source = readFileSync(importToCheck, 'utf8');
      const document = parse(source);
      toReturn.set(importToCheck, document);

      const transitiveImports = gatherImports(source);
      const resolveStrategy = importOptions.resolveImport || resolve.sync;
      transitiveImports.forEach(transitiveImport => {
        let transitiveFileName;
        try {
          transitiveFileName = resolveStrategy(transitiveImport, importOptions.resolveOptions);
        } catch (e) {
          if (importOptions.throwIfImportNotFound === true) {
            throw e;
          }
        }
        if (transitiveFileName && !visited.has(transitiveFileName)) {
          stack.push(transitiveFileName);
        }
      });
    }
  }
  return toReturn;
}

function filterToFragmentDefinitions(arr: readonly DefinitionNode[]): FragmentDefinitionNode[] {
  return arr.filter(el => el.kind === Kind.FRAGMENT_DEFINITION) as FragmentDefinitionNode[];
}

function fragmentNameToDefinition(
  fragmentDefinitions: FragmentDefinitionNode[],
): Map<string, FragmentDefinitionNode> {
  const fragmentNameToDefinition = new Map<string, FragmentDefinitionNode>();
  fragmentDefinitions.forEach(definition => {
    fragmentNameToDefinition.set(definition.name.value, definition);
  });
  return fragmentNameToDefinition;
}

function gatherImportsToFragmentNamesToFragmentDefinitionsWithTransitives(
  importToDocument: Map<string, DocumentNode>,
): Map<string, Map<string, FragmentDefinitionNode>> {
  const toReturn = new Map<string, Map<string, FragmentDefinitionNode>>();
  importToDocument.forEach((value, key) => {
    toReturn.set(key, fragmentNameToDefinition(filterToFragmentDefinitions(value.definitions)));
  });
  return toReturn;
}

function getDuplicates(
  importsToFragments: Map<string, Map<string, FragmentDefinitionNode>>,
): Set<string> {
  const duplicates: Set<string> = new Set();
  const seen = new Set();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  importsToFragments.forEach((value, _) => {
    value.forEach((_, fragmentName) => {
      if (seen.has(fragmentName)) {
        duplicates.add(fragmentName);
      } else {
        seen.add(fragmentName);
      }
    });
  });
  return duplicates;
}

function getUniqueFragmentSet(
  importsToFragments: Map<string, Map<string, FragmentDefinitionNode>>,
): Map<string, FragmentDefinitionNode> {
  const uniqueFragmentSet = new Map<string, FragmentDefinitionNode>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  importsToFragments.forEach((value, _) => {
    value.forEach((fragmentDefinition, fragmentName) => {
      uniqueFragmentSet.set(fragmentName, fragmentDefinition);
    });
  });
  return uniqueFragmentSet;
}

function resolveFragments(
  resolvedDefinitions: Map<string, Set<FragmentDefinitionNode>>,
  definition: FragmentDefinitionNode,
  duplicates: Set<string>,
  uniqueFragmentSet: Map<string, FragmentDefinitionNode>,
  visited: Set<string>,
  options: InlineImportOptions,
): FragmentDefinitionNode[] {
  if (!resolvedDefinitions.has(definition.name.value)) {
    resolvedDefinitions.set(definition.name.value, new Set());
  } else {
    const fragmentDefinitions = resolvedDefinitions.get(definition.name.value);
    if (fragmentDefinitions) {
      return Array.from(fragmentDefinitions);
    }
  }

  const dependents: Set<FragmentDefinitionNode> = new Set([definition]);
  visit(definition, {
    FragmentSpread(node) {
      const name = node.name.value;
      if (!uniqueFragmentSet.has(name) && options.throwIfImportNotFound) {
        throw 'Could not find definition for fragment spread';
      } else if (duplicates.has(name)) {
        throw 'Ambiguous fragment spread';
      }
      const referencedDependent = uniqueFragmentSet.get(name);
      if (referencedDependent) {
        visited.add(name);
        resolveFragments(
          resolvedDefinitions,
          referencedDependent,
          duplicates,
          uniqueFragmentSet,
          visited,
          options,
        ).forEach(dependent => {
          dependents.add(dependent);
        });
      }
    },
  });
  resolvedDefinitions.set(definition.name.value, dependents);
  visited.clear();
  return Array.from(dependents);
}

function generateFinalDocument(
  document: DocumentNode,
  duplicates: Set<string>,
  uniqueFragmentSet: Map<string, FragmentDefinitionNode>,
  options: InlineImportOptions,
): DocumentNode {
  // Map of fragment name to all dependent fragments
  // We hold this to lazily compute dependent fragments
  const resolvedDefinitions: Map<string, Set<FragmentDefinitionNode>> = new Map();
  const finalDefinitions: DefinitionNode[] = Array.from(document.definitions);
  visit(document, {
    FragmentSpread(node) {
      const name = node.name.value;
      if (!uniqueFragmentSet.has(name) && options.throwIfImportNotFound) {
        throw 'Could not find definition for fragment spread';
      } else if (duplicates.has(name)) {
        throw 'Ambiguous fragment spread';
      }

      const fragmentDefinition = uniqueFragmentSet.get(name);
      if (fragmentDefinition) {
        finalDefinitions.push(
          ...resolveFragments(
            resolvedDefinitions,
            fragmentDefinition,
            duplicates,
            uniqueFragmentSet,
            new Set([name]),
            options,
          ),
        );
      }
    },
  });
  return {
    kind: Kind.DOCUMENT,
    loc: document.loc,
    definitions: finalDefinitions,
  };
}

interface SourceFileAndFragmentDefinition {
  source: string;
  definition: FragmentDefinitionNode;
}

interface UpdatedSourceWithImportedFragments {
  updatedSource: string;
  importedFragmentsToSource?: Map<string, SourceFileAndFragmentDefinition>;
}

function getImportedFragmentsToSource(
  importsToFragments: Map<string, Map<string, FragmentDefinitionNode>>,
): Map<string, SourceFileAndFragmentDefinition> {
  const importedFragmentsToSource = new Map();
  importsToFragments.forEach((fragmentNameToDefinition, fileName) => {
    // blow away duplicates
    fragmentNameToDefinition.forEach((fragmentDefinition, fragmentName) => {
      importedFragmentsToSource.set(fragmentName, {
        source: fileName,
        definition: fragmentDefinition,
      });
    });
  });
  return importedFragmentsToSource;
}

function inlineImportsAndGiveImportedFragmentsToFiles(
  sourceQuery: string,
  options: InlineImportOptions,
): UpdatedSourceWithImportedFragments {
  if (!options.resolveOptions.basedir) {
    throw 'Basedir must be set';
  }

  const allImportsToDocuments = resolveImportsWithTransitivesToDocuments(sourceQuery, options);
  const importsToFragments = gatherImportsToFragmentNamesToFragmentDefinitionsWithTransitives(
    allImportsToDocuments,
  );
  const importedFragmentsToSource = getImportedFragmentsToSource(importsToFragments);
  let document;
  try {
    document = parse(sourceQuery);
  } catch (e) {
    return {
      updatedSource: '',
    };
  }
  const inDocumentDefinitions = fragmentNameToDefinition(
    filterToFragmentDefinitions(document.definitions),
  );
  importsToFragments.set('current-file', inDocumentDefinitions);
  const duplicates = getDuplicates(importsToFragments);
  const fragmentSet = getUniqueFragmentSet(importsToFragments);
  const finalDocument = generateFinalDocument(document, duplicates, fragmentSet, options);
  return {
    updatedSource: print(finalDocument),
    importedFragmentsToSource: importedFragmentsToSource,
  };
}

export default function inlineImports(sourceQuery: string, options: InlineImportOptions): string {
  return inlineImportsAndGiveImportedFragmentsToFiles(sourceQuery, options).updatedSource;
}

const FRAGMENT_NAME_REGEX = /fragment (.*?) on/;
export interface SourceFileAndFragmentSource {
  source: string;
  fragmentSource: string;
}
export const lineToImports = (
  sourceQuery: string,
  options: InlineImportOptions,
): Map<number, SourceFileAndFragmentSource> => {
  const result = new Map();
  const output: UpdatedSourceWithImportedFragments = inlineImportsAndGiveImportedFragmentsToFiles(
    sourceQuery,
    options,
  );
  const lines = output.updatedSource.split(eolRegexp);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(FRAGMENT_NAME_REGEX);
    let fragmentName;
    if (match && match.length > 1) {
      fragmentName = match[1];
    }
    if (
      fragmentName &&
      output.importedFragmentsToSource &&
      output.importedFragmentsToSource.has(fragmentName)
    ) {
      // Disable because typescript map get makes object destructuring painful
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { source, definition } = output.importedFragmentsToSource.get(fragmentName)!;
      result.set(i, {
        source: source,
        fragmentSource: print(definition),
      });
    }
  }
  return result;
};

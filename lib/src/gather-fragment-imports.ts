import { FragmentDefinitionNode } from 'graphql';
import path from 'path';
import { ResolveImportType, lineToImports } from './inline-imports';

type FragmentDefinitionWithoutLoc = Omit<FragmentDefinitionNode, 'loc'>;
export interface AugmentedFragmentDefinitionWithFileNameInLocation
  extends FragmentDefinitionWithoutLoc {
  // hack so we can extend keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loc: any;
}

export default function gatherFragmentImports(
  source: string,
  sourceLocation: string,
  resolveImport: ResolveImportType,
  fragmentParserGenerator: (source: string) => FragmentDefinitionNode[],
  throwIfImportNotFound: boolean,
): Map<number, Map<string, AugmentedFragmentDefinitionWithFileNameInLocation>> {
  const lineToFragmentDefinitions: Map<
    number,
    Map<string, AugmentedFragmentDefinitionWithFileNameInLocation>
  > = new Map();
  const importLinesToInlinedSource = lineToImports(source, {
    resolveOptions: {
      basedir: path.dirname(sourceLocation),
    },
    resolveImport,
    throwIfImportNotFound,
  });
  importLinesToInlinedSource.forEach((sourceFileToFragmentSource, lineNumber) => {
    // unnecessary but allows custom fragment parser implementations
    const fragments = fragmentParserGenerator(sourceFileToFragmentSource.fragmentSource);
    fragments.forEach(fragment => {
      // Hacky re-construction because we extend the existing object
      const augmentedFragment: AugmentedFragmentDefinitionWithFileNameInLocation = {
        ...fragment,
        loc: {
          ...fragment.loc,
          filename: sourceFileToFragmentSource.source,
        },
      };
      const toInsert = lineToFragmentDefinitions.get(lineNumber) || new Map();
      toInsert.set(fragment.name.value, augmentedFragment);
      lineToFragmentDefinitions.set(lineNumber, toInsert);
    });
  });
  return lineToFragmentDefinitions;
}

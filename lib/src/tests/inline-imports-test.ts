import { expect } from 'chai';
import path from 'path';
import inlineImports, { InlineImportOptions } from '../inline-imports';
import FixturifyProject from 'fixturify-project';
import { SyncOpts } from 'resolve';

describe('inline-imports', () => {
  let basedir: string | undefined;

  beforeEach(() => {
    const project = new FixturifyProject('my-example', '0.0.1', project => {
      project.files['apple.graphql'] = `
fragment apple on User {
  name
}`;
      project.files['orange.graphql'] = `
fragment orange on User {
  name
}`;
      project.files['parent.graphql'] = `
#import './apple.graphql'

fragment parent on User {
  name
}`;

      // used in custom resolution
      project.files.vendor = {
        '__inlined-fragment': `
fragment CustomResolutionFragment on User {
  name
}`,
      };

      project.files['cycle-1.graphql'] = `
#import './cycle-1.graphql'
fragment cycle on User {
  name
}`;

      project.files['from-dependency.graphql'] = `
#import 'my-dependency/_dependency-fragment.graphql'
query {
  myQuery {
    ...FromDependency
  }
}`;

      project.addDependency('my-dependency', '0.0.1', dependency => {
        dependency.files['_dependency-fragment.graphql'] = `
fragment FromDependency on User {
  name
}`;
      });
    });
    project.writeSync();
    basedir = project.baseDir;
  });

  function assertProjectImports(options: InlineImportOptions) {
    expect(inlineImports(``, options)).to.eql(``);
    expect(
      inlineImports(
        `
#import './apple.graphql'
query A {
  a {
    ...apple
  }
}
`,
        options,
      ),
    ).to.eql(
      `query A {
  a {
    ...apple
  }
}

fragment apple on User {
  name
}`,
    );

    expect(
      inlineImports(
        `
#import './apple.graphql'
#import './apple.graphql'
query A {
  a {
    ...apple
  }
}`,
        options,
      ),
    ).to.eql(
      `query A {
  a {
    ...apple
  }
}

fragment apple on User {
  name
}`,
    );

    expect(
      inlineImports(
        `
#import './apple.graphql'
#import './orange.graphql'
query A {
  a {
    ...apple
  }
  o {
    ...orange
  }
}
`,
        options,
      ),
    ).to.eql(`query A {
  a {
    ...apple
  }
  o {
    ...orange
  }
}

fragment apple on User {
  name
}

fragment orange on User {
  name
}`);

    expect(
      inlineImports(
        `
#import './parent.graphql'
query A {
  p {
    ...parent
  }
}
`,
        options,
      ),
    ).to.eql(`query A {
  p {
    ...parent
  }
}

fragment parent on User {
  name
}`);

    expect(
      inlineImports(
        `
#import './cycle-1.graphql'
query A {
  c {
    ...cycle
  }
}
`,
        options,
      ),
    ).to.eql(`query A {
  c {
    ...cycle
  }
}

fragment cycle on User {
  name
}`);
  }

  it('handles includes correctly', function () {
    const options = { resolveOptions: { basedir } };
    assertProjectImports(options);
    expect(
      inlineImports(
        `
#import "my-dependency/_dependency-fragment.graphql"
query A {
  fromDep {
    ...FromDependency
  }
}
    `,
        options,
      ),
    ).to.eql(`query A {
  fromDep {
    ...FromDependency
  }
}

fragment FromDependency on User {
  name
}`);
  });

  it('supports custom resolution strategies', function () {
    interface FileAndBaseDir {
      file: string;
      basedir: string;
    }
    const resolutions: FileAndBaseDir[] = [];

    function resolveImport(identifier: string, options: SyncOpts) {
      const basedir = options.basedir;
      if (!basedir) {
        return;
      }
      resolutions.push({
        file: identifier,
        basedir: basedir,
      });

      if (identifier.length > 0 && identifier.charAt(0) === '.') {
        // relative
        return path.join(basedir, identifier);
      }

      if (identifier === '@CUSTOM') {
        return path.join(basedir, 'vendor', '__inlined-fragment');
      }

      throw new Error(`Unexpected resolveImport('${identifier}')`);
    }

    const options: InlineImportOptions = {
      resolveImport,
      resolveOptions: {
        basedir,
      },
    };

    assertProjectImports(options);
    expect(resolutions).to.deep.equal([
      {
        file: './apple.graphql',
        basedir: basedir,
      },
      {
        file: './apple.graphql',
        basedir: basedir,
      },
      {
        file: './orange.graphql',
        basedir: basedir,
      },
      {
        file: './apple.graphql',
        basedir: basedir,
      },
      {
        file: './parent.graphql',
        basedir: basedir,
      },
      {
        file: './cycle-1.graphql',
        basedir: basedir,
      },
    ]);

    expect(
      inlineImports(
        `
#import "@CUSTOM"
query A {
  custom {
    ...CustomResolutionFragment
  }
}
    `,
        options,
      ),
    ).to.eql(`query A {
  custom {
    ...CustomResolutionFragment
  }
}

fragment CustomResolutionFragment on User {
  name
}`);
  });
});

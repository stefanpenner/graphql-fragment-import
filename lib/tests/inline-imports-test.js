'use strict';
const { expect } = require('chai');
const inlineImports = require('../inline-imports');
const FixturifyProject = require('fixturify-project');
describe('inline-imports', function () {
  let basedir;

  beforeEach(function () {
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

  it('handles includes correctly', function () {
    expect(inlineImports(``, { basedir })).to.eql(``);
    expect(
      inlineImports(
        `
#import './apple.graphql'
`,
        { basedir },
      ),
    ).to.eql(
      `

fragment apple on User {
  name
}
`,
    );

    expect(
      inlineImports(
        `
#import './apple.graphql'
#import './apple.graphql'
`,
        { basedir },
      ),
    ).to.eql(
      `

fragment apple on User {
  name
}
`,
    );

    expect(
      inlineImports(
        `
#import './apple.graphql'
#import './orange.graphql'
`,
        { basedir },
      ),
    ).to.eql(`

fragment apple on User {
  name
}

fragment orange on User {
  name
}
`);

    expect(
      inlineImports(
        `
#import './parent.graphql'
`,
        { basedir },
      ),
    ).to.eql(`


fragment apple on User {
  name
}

fragment parent on User {
  name
}
`);

    expect(
      inlineImports(
        `
#import './cycle-1.graphql'
`,
        { basedir },
      ),
    ).to.eql(`

fragment cycle on User {
  name
}
`);

    expect(
      inlineImports(
        `
#import "my-dependency/_dependency-fragment.graphql"
    `,
        { basedir },
      ),
    ).to.eql(`

fragment FromDependency on User {
  name
}
    `);
  });
});

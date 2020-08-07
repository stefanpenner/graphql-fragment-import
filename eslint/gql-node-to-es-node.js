'use strict';

module.exports = function gqlToEs(node) {
  // map from gql AST Node to one eslint understands
  // note this is destructive
  node.type = node.kind;
  const { loc } = node;

  node.loc = {
    start: {
      line: loc.startToken.line,
      column: loc.startToken.column,
    },
    end: {
      line: loc.endToken.line,
      column: loc.endToken.column,
    }
  }
  node.range = [loc.start, loc.end];
  node.comments = [];
  node.tokens = [];
}

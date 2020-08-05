'use strict';

module.exports = `
  Usage
    $ graphql-imports <input>
    $ graphql-imports <input-0> <input-1> ... <input-n> --output-dir=./path-to-output/

  Options
    --output, -o specify an output file [by default we print to stdout]
    --output-dir, -d specify an output directory [required if you want to perform import inlining on multiple files]

  Examples
    $ graphql-imports ./file.graphql
    $ graphql-imports ./file.graphql -o file-with-imports.graphql
`;

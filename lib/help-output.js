"use strict";

const chalk = require("chalk");
const terminalLink = require("terminal-link");
const pkg = require("../package.json");

module.exports = chalk`
{bold ${terminalLink("graphql-fragment-import", pkg.homepage)}}

  {bold Usage}
    {gray $} {cyan graphql-fragment-import <input-file>}
    {gray $} {cyan graphql-fragment-import <input-directory> --output-dir=./path-to-output/}

  {bold Options}
    {cyan --output, -o} specify an output file {italic [by default we print to stdout]}
    {cyan --output-dir, -d} specify an output directory {italic [required with directory input]}

  {bold Examples}
    {gray $} {cyan  graphql-fragment-import ./file.graphql}
    {gray $} {cyan  graphql-fragment-import ./file.graphql -o file-with-imports.graphql}
    {gray $} {cyan  graphql-fragment-import ./folder/ -d ./output-folder/}
`;

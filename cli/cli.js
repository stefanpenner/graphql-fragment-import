#!/usr/bin/env node
'use strict';

const meow = require('meow');
const inlineImports = require('@graphql-fragment-import/lib/inline-imports');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const walkSync = require('walk-sync');
const chalk = require('chalk');

const cli = meow(require('./help-output'), {
  flags: {
    output: {
      type: 'string',
      alias: 'o',
    },
    'output-dir': {
      type: 'string',
      alias: 'd',
    },
    'import-resolver': {
      type: 'string',
      alias: 'ir',
    },
  },
});

if ('output' in cli.flags && 'outputDir' in cli.flags) {
  throw new Error('Cannot have both --output and --output-dir specified');
}

function processFile(input, { resolver }) {
  const filename = path.resolve(input);
  const basedir = path.dirname(filename);
  const content = fs.readFileSync(filename, 'UTF8');

  return inlineImports(content, { resolveImport: resolver, resolveOptions: { basedir } });
}

if (cli.input.length === 0) {
  cli.showHelp(1);
} else if (cli.input.length === 1) {
  let resolver;
  if ('importResolver' in cli.flags) {
    resolver = require(cli.flags.importResolver);
  }
  const input = cli.input[0];
  const entry = fs.statSync(input);
  // handle scenario, were we walk an entire directory which may contain
  // graphql files, and produce a new directory with all found graphql files
  // but with their imports inlined.
  if (entry.isDirectory()) {
    if (!('outputDir' in cli.flags)) {
      throw new Error('When providing a directory of inputs, you must specify --output-dir');
    }

    const queryFiles = walkSync(input, {
      ignore: ['**/node_modules/**'],
    }).filter(file => {
      // don't use globs for this, since we must traverse all files anyways,
      // globs are only really useful when they can limit the directories we
      // traverse.
      //
      // Otherwise, grab on the files and perform filtering efficiently as follows
      return file.charAt(0) !== '_' && file.endsWith('.graphql');
    });

    for (const queryFile of queryFiles) {
      const outputFileName = path.resolve(`${cli.flags.outputDir}/${queryFile}`);
      const inputFileName = path.resolve(`${cli.input}/${queryFile}`);
      const dirname = path.dirname(outputFileName);
      const content = processFile(inputFileName, { resolver });

      console.log(chalk`  {green [processed]} ${queryFile} -> ${outputFileName}`);
      try {
        // mkdirp is slow, let's assume the dir exists. If it does not, we
        // "just in time" create it. This works well, based on that typically
        // their are way more files then new directories
        fs.writeFileSync(outputFileName, content);
      } catch (e) {
        if (typeof e === 'object' && (e !== null) & (e.code === 'ENOENT')) {
          mkdirp.sync(dirname);
          fs.writeFileSync(outputFileName, content);
        } else {
          throw e;
        }
      }
    }
  } else {
    if ('outputDir' in cli.flags) {
      throw new Error(
        'When providing an input file, you must specify --output or consume the result via stdout.',
      );
    }

    const output = processFile(input, { resolver });
    if (cli.flags.output) {
      fs.writeFileSync(cli.flags.output, output);
    } else {
      console.log(output);
    }
  }
} else {
  throw new Error(`invalid number of inputs, expected '1' but got '${cli.input.length}' `);
}

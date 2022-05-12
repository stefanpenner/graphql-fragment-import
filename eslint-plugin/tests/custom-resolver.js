const path = require('path');

module.exports = function resolveImport(importIdentifier, { basedir }) {
  if (/miss/i.test(importIdentifier)) {
    let err = new Error(`Cannot find module "${importIdentifier}"`);
    err.code = 'MODULE_NOT_FOUND';
    throw err;
  }

  return path.join(basedir, 'FRAGMENTS');
};

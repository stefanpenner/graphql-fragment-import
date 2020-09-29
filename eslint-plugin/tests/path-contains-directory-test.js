'use strict';

const pathContainsDirectory = require('../path-contains-directory');
const { expect } = require('chai');
const path = require('path');

describe('path-contains-directory', function () {
  it('works', function () {
    // posix paths
    expect(pathContainsDirectory('', 'node_modules')).to.eql(false);
    expect(pathContainsDirectory('some/dir', 'node_modules')).to.eql(false);
    expect(pathContainsDirectory('./some/dir', 'node_modules')).to.eql(false);
    expect(pathContainsDirectory('./node_module/dir', 'node_modules')).to.eql(false);
    expect(pathContainsDirectory('./node/modules/dir', 'node_modules')).to.eql(false);
    expect(pathContainsDirectory('./node_modules/dir', 'node_modules')).to.eql(true);
    expect(pathContainsDirectory('node_modules/dir', 'node_modules')).to.eql(true);
    expect(pathContainsDirectory('node_modules', 'node_modules')).to.eql(true);
    expect(pathContainsDirectory('./node_modules', 'node_modules')).to.eql(true);
    expect(pathContainsDirectory('./some-path/node_modules', 'node_modules')).to.eql(true);

    // win32 paths \\
    expect(pathContainsDirectory(path.win32.resolve(''), 'node_modules')).to.eql(false);
    expect(pathContainsDirectory(path.win32.resolve('some/dir'), 'node_modules')).to.eql(false);
    expect(pathContainsDirectory(path.win32.resolve('./some/dir'), 'node_modules')).to.eql(false);
    expect(pathContainsDirectory(path.win32.resolve('./node_module/dir'), 'node_modules')).to.eql(
      false,
    );
    expect(pathContainsDirectory(path.win32.resolve('./node/modules/dir'), 'node_modules')).to.eql(
      false,
    );
    expect(pathContainsDirectory(path.win32.resolve('./node_modules/dir'), 'node_modules')).to.eql(
      true,
    );
    expect(pathContainsDirectory(path.win32.resolve('node_modules/dir'), 'node_modules')).to.eql(
      true,
    );
    expect(pathContainsDirectory(path.win32.resolve('node_modules'), 'node_modules')).to.eql(true);
    expect(pathContainsDirectory(path.win32.resolve('./node_modules'), 'node_modules')).to.eql(
      true,
    );
    expect(
      pathContainsDirectory(path.win32.resolve('./some-path/node_modules'), 'node_modules'),
    ).to.eql(true);
  });
});

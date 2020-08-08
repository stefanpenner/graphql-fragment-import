'use strict';

const path = require('path');

module.exports = function pathContainsDirectory(fullPath, directory) {
  // gotta do what we gotta do for cross platform check
  return fullPath.toLowerCase().split(/[\/\\]/).includes(directory)
};


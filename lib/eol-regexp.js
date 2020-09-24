"use strict";
// we use this rather then require('os').EOL since many windows developers end
// up using \n. So instead we split on \r\n and \n;
// TODO: do we need to care about just \r ?
// TODO: we likely should detect the preferred line ending of the fileContents and `join` based on that.
module.exports = Object.freeze(/\r\n|\n/);

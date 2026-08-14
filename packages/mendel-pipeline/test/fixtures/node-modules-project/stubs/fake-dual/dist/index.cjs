'use strict';
const helper = require('helper-lib');
module.exports = function fakeDual() {
    return 'cjs:' + helper();
};

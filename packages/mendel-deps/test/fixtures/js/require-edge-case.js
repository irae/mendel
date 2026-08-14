'use strict';
exports.Foo = void 0;

var _oneDep = require('./index.js');

class Foo extends _oneDep.Foo {
    var1 = 10;

    method() {}

    var2 = ['a', 'b', 'c'];
}

exports.Foo = Foo;

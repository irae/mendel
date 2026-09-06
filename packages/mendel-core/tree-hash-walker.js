/* Copyright 2015, Yahoo Inc.
   Designed by Irae Carvalho
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var debug = require('debug')('mendel:tree-hash-walker');
var util = require('util');

var deserialize = require('./tree-deserialiser');
var MendelWalker = require('./tree-walker');

util.inherits(MendelHashWalker, MendelWalker);
module.exports = MendelHashWalker;

function MendelHashWalker(inputHash) {
    debug('init MendelHashWalker');
    if (!(this instanceof MendelHashWalker)) {
        return new MendelHashWalker(inputHash);
    }
    MendelWalker.call(this);

    var result = deserialize(inputHash);
    this.error = result.error;
    this.decoded = result.decoded;

    this.inputHash = inputHash;
    this.pathCount = 0;
}

MendelHashWalker.prototype._resolveBranch = function (module) {
    if (this.error) return {};

    var nextPath;
    var resolved;
    if (this.pathCount >= this.decoded.branches.length) {
        this._error('Tree has more paths than hash');
    } else {
        nextPath = this.decoded.branches[this.pathCount];
        resolved = module.data[nextPath];
        if (!resolved) {
            this._error('Hash branch not found in tree');
        }
    }
    this.pathCount++;
    return {
        index: nextPath,
        resolved: resolved || {},
    };
};

MendelHashWalker.prototype._error = function (msg) {
    this.error = this.error || new Error(msg);
    this.error.code = 'TRVRSL';
    debug(this.error);
};

MendelHashWalker.prototype.found = function () {
    this._result = MendelWalker.prototype.found.call(this);

    if (!this.error && this._result.hash !== this.inputHash) {
        var error = new Error('Tree Hash Mismatch');
        error.code = 'HASHMISS';
        this.error = error;
    }

    return Object.assign(this._result, {
        error: this.error,
    });
};

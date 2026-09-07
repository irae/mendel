/* Copyright 2015, Yahoo Inc.
   Designed by Irae Carvalho
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var debug = require('debug')('mendel:tree-variation-walker');
var util = require('util');

var MendelWalker = require('./tree-walker');

util.inherits(MendelVariationWalker, MendelWalker);
module.exports = MendelVariationWalker;

function MendelVariationWalker(path, variation) {
    debug('init MendelVariationWalker');
    if (!(this instanceof MendelVariationWalker)) {
        return new MendelVariationWalker(path, variation);
    }
    MendelWalker.call(this);

    this.path = path;
    this.variation = variation;
    this.variationMap = variation.variationMap;
    this.variationMap[path] = variation;
    this.variationMap[variation.id] = variation;
    this.variationMap[variation.path] = variation;
    this.conflicts = {};
    this.conflictList = [];
}

MendelVariationWalker.prototype._resolveBranch = function (module) {
    if (this.error) return {};

    var nextPath;
    var resolved;
    if (
        this.pathCount >= this.variationMap[this.variation.path].branches.length
    ) {
        this._error('Tree has more paths than variation');
    } else {
        nextPath =
            this.variationMap[this.variation.path].branches[this.pathCount];
        resolved = module.data[nextPath];
        if (!resolved) {
            this._error('Variation branch not found in tree');
        }
    }
    this.pathCount++;
    return {
        index: nextPath,
        resolved: resolved || {},
    };
};

MendelVariationWalker.prototype.found = function () {
    var result = MendelWalker.prototype.found.call(this);
    result.conflicts = this.conflicts;
    result.conflictList = this.conflictList;
    return result;
};

MendelVariationWalker.prototype._error = function (msg) {
    this.error = this.error || new Error(msg);
    this.error.code = 'TRVRSL';
    debug(this.error);
};

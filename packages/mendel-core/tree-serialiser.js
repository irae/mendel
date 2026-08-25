/* Copyright 2015, Yahoo Inc.
   Designed by Irae Carvalho
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var debug = require('debug')('mendel:tree-serializer');
var Concentrate = require('concentrate');
var crypto = require('crypto');
var util = require('util');
function TreeSerialiser() {
    if (!(this instanceof TreeSerialiser)) {
        return new TreeSerialiser();
    }

    Concentrate.call(this);

    this._result = false;
    this._files = 0;
    this._branches = []; // only for debug
    this._hash = crypto.createHash('sha1');
    this._metadata();
    return this;
}

util.inherits(TreeSerialiser, Concentrate);

TreeSerialiser.prototype._metadata = function () {
    if (this._meta) throw new Error('Double metadata');

    this._name = 'mendel';
    this._version = 2;
    this._meta = true;
    return this.string(this._name).uint8(this._version);
};

TreeSerialiser.prototype.pushBranch = function (index) {
    if (this._result) throw new Error("Can't pushBranch after result");
    this._branches.push(index); // only for debug
    if (index >= 254) {
        // 254 means overflow followed by uint16
        return this.uint8(254).uint16(index);
    }
    return this.uint8(index);
};

TreeSerialiser.prototype.pushFileHash = function (sha) {
    if (this._result) throw new Error("Can't pushFileHash after result");
    if (Buffer.isBuffer(sha)) {
        this._files++;
        this._hash.update(sha);
    }
    return this;
};

TreeSerialiser.prototype.result = function () {
    if (this._result) return this._result;

    this.uint8(255); // signals end of branches
    this.uint16(this._files);
    this._digest = this._hash.digest();
    this.buffer(this._digest);

    this._result = Concentrate.prototype.result
        .call(this)
        .toString('base64url');

    debug({
        result: this._result,
        branches: this._branches,
        files: this._files,
        hash: this._digest.toString('hex'),
        name: this._name,
        version: this._version,
    });

    return this._result;
};

module.exports = TreeSerialiser;

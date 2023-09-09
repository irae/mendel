/* Copyright 2015, Yahoo Inc.
   Designed by Irae Carvalho
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var Dissolve = require('dissolve');
var URLSafeBase64 = require('urlsafe-base64');

module.exports = deserialize;
function deserialize(treeHash) {
    var result = {
        error: null,
    };

    var branches = [];
    var parser = new Dissolve()
        .string('name', 6)
        .tap(function () {
            if (this.vars.name !== 'mendel') {
                result.error = error('not generated by mendel');
            }
        })
        .uint8('version')
        .tap(function () {
            if (this.vars.version !== 1) {
                result.error = error(': version mismatch');
            }
        })
        .loop('branches', function (end) {
            this.uint8('data').tap(function () {
                if (this.vars.data === 255) {
                    return end();
                }
                branches.push(this.vars.data);
            });
        })
        .tap(function () {
            this.vars.branches = branches;
        })
        .uint16('files')
        .buffer('hash', 20)
        .tap(function () {
            result.decoded = this.vars;
        });

    try {
        var binary = URLSafeBase64.decode(treeHash);
        parser.write(binary);
    } catch (e) {
        result.error = error('bad base64 input');
    }

    var ok = result.decoded && Buffer.isBuffer(result.decoded.hash);
    if (!ok) {
        result.error = result.error || error('short or missing sha');
    }

    return result;
}

function error(msg) {
    var error = new Error('Invalid hash: ' + msg);
    error.code = 'BADHASH';
    return error;
}

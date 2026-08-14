/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var path = require('path');
var fs = require('fs');
var tap = require('tap');
var mendelPlugin = 'skip'; //require('../packages/mendel-browserify');

var appPath = path.resolve(__dirname, 'app-samples/1/');
var appBuild = path.join(appPath, 'build');
fs.mkdirSync(appBuild, { recursive: true });
process.chdir(appPath);

tap.skip('mendel-browserify', function (t) {
    t.plan(3);
    var calls;

    function Bro(opts) {
        calls.push(opts);
        this._options = opts;
        this._transforms = [];
        this.transform = function () {};
        this.pipeline = {
            get: function () {
                return [];
            },
        };
        this.on = function () {};
        return this;
    }

    calls = [];
    mendelPlugin(
        new Bro({
            plugin: [mendelPlugin],
        }),
        { basedir: './' }
    );
    var callsWithPlugins = calls.filter(function (opts) {
        return opts.plugin.length;
    });
    t.equal(callsWithPlugins.length, 1);

    calls = [];

    mendelPlugin(
        new Bro({
            plugin: ['mendel-browserify', 2],
        }),
        { basedir: './' }
    );
    callsWithPlugins = calls.filter(function (opts) {
        return opts.plugin.length >= 2;
    });
    t.equal(callsWithPlugins.length, 1);

    calls = [];

    mendelPlugin(
        new Bro({
            plugin: [
                ['mendel-browserify', {}],
                [mendelPlugin, {}],
            ],
        }),
        { basedir: './' }
    );
    callsWithPlugins = calls.filter(function (opts) {
        return opts.plugin.length >= 2;
    });
    t.equal(callsWithPlugins.length, 1);

    return;
});

var t = require('tap');
var path = require('path');
var resolvePlugin = require('../src/resolve-plugin');

var basedir = path.resolve(__dirname, './config-samples/4/');

t.throws(
    function () {
        resolvePlugin('mendel-plugin-does-not-exist', basedir);
    },
    /Cannot find Mendel plugin "mendel-plugin-does-not-exist"/,
    'throws naming the unresolved plugin'
);

t.throws(
    function () {
        resolvePlugin(
            'mendel-plugin-does-not-exist',
            basedir,
            'transforms.my-transform'
        );
    },
    /referenced by transforms\.my-transform/,
    'throws naming the config entry that referenced it'
);

t.throws(
    function () {
        resolvePlugin('mendel-plugin-does-not-exist', basedir);
    },
    /npm install --save-dev mendel-plugin-does-not-exist/,
    'throws with an actionable install instruction'
);

t.match(
    resolvePlugin('mendel-outlet-manifest', basedir),
    {
        plugin: /.+mendel-outlet-manifest.*/,
        mode: 'ist',
    },
    'resolves an installed plugin without throwing'
);

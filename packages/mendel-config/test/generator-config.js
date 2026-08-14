var t = require('tap');
var path = require('path');
var GeneratorConfig = require('../src/generator-config');
var PostGeneratorConfig = require('../src/post-generator-config');

var basedir = path.resolve(__dirname, './config-samples/4/');
var contextConfig = { projectRoot: basedir };

t.throws(
    function () {
        GeneratorConfig(
            { id: 'my-gen', plugin: 'mendel-generator-does-not-exist' },
            contextConfig
        );
    },
    /Cannot find Mendel plugin "mendel-generator-does-not-exist"/,
    'GeneratorConfig throws naming the unresolved plugin'
);

t.throws(
    function () {
        GeneratorConfig(
            { id: 'my-gen', plugin: 'mendel-generator-does-not-exist' },
            contextConfig
        );
    },
    /referenced by generators\.my-gen/,
    'GeneratorConfig throws naming the config entry that referenced it'
);

t.throws(
    function () {
        GeneratorConfig(
            { id: 'my-gen', plugin: 'mendel-generator-does-not-exist' },
            contextConfig
        );
    },
    /npm install --save-dev mendel-generator-does-not-exist/,
    'GeneratorConfig throws with an actionable install instruction'
);

t.throws(
    function () {
        PostGeneratorConfig(
            { id: 'my-post', plugin: 'mendel-post-does-not-exist' },
            contextConfig
        );
    },
    /Cannot find Mendel plugin "mendel-post-does-not-exist"/,
    'PostGeneratorConfig throws naming the unresolved plugin'
);

t.throws(
    function () {
        PostGeneratorConfig(
            { id: 'my-post', plugin: 'mendel-post-does-not-exist' },
            contextConfig
        );
    },
    /referenced by postgenerators\.my-post/,
    'PostGeneratorConfig throws naming the config entry that referenced it'
);

t.throws(
    function () {
        PostGeneratorConfig(
            { id: 'my-post', plugin: 'mendel-post-does-not-exist' },
            contextConfig
        );
    },
    /npm install --save-dev mendel-post-does-not-exist/,
    'PostGeneratorConfig throws with an actionable install instruction'
);

t.match(
    new GeneratorConfig(
        { id: 'extract-bundles', plugin: 'mendel-extract-bundles' },
        contextConfig
    ),
    { id: 'extract-bundles', plugin: /.*mendel-extract-bundles.*/ },
    'GeneratorConfig resolves an installed plugin without throwing'
);

t.match(
    new PostGeneratorConfig(
        { id: 'test', plugin: 'mendel-extract-bundles' },
        contextConfig
    ),
    { id: 'test', plugin: /.*mendel-extract-bundles.*/ },
    'PostGeneratorConfig resolves an installed plugin without throwing'
);

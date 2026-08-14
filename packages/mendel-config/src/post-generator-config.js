var createValidator = require('./validator');
var nodeResolve = require('resolve').sync;

function PostGeneratorConfig(options, { projectRoot }) {
    const { id, plugin } = options;
    this.id = id;
    this.options = options;

    try {
        this.plugin = nodeResolve(plugin, { basedir: projectRoot });
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
        throw new Error(
            [
                `[Config][ERROR] Cannot find Mendel plugin "${plugin}"` +
                    ` (referenced by postgenerators.${id}).`,
                `Install it, e.g.: npm install --save-dev ${plugin}`,
                `(resolved from ${projectRoot})`,
            ].join(' ')
        );
    }

    PostGeneratorConfig.validate(this);
}

PostGeneratorConfig.validate = createValidator({
    id: { required: true },
    plugin: { required: true },
});

module.exports = PostGeneratorConfig;

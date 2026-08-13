var createValidator = require('./validator');
var resolvePlugin = require('./resolve-plugin');

function TransformConfig(id, transform, mendelConfig) {
    const { projectRoot, baseConfig, variationConfig } = mendelConfig;
    this.id = id;
    this.options = {
        ...transform.options,
        mendelConfig: { projectRoot, baseConfig, variationConfig },
    };

    var resolved = resolvePlugin(
        transform.plugin,
        projectRoot,
        `transforms.${id}`
    );
    this.plugin = resolved.plugin;
    this.mode = resolved.mode;

    TransformConfig.validate(this);
}

TransformConfig.validate = createValidator({
    id: { required: true },
    plugin: { required: true },
    mode: { required: true },
});

module.exports = TransformConfig;

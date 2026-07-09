const babel = require('@babel/core');
const path = require('path');

function optionDepPath(arr, optionName, projectRoot) {
    return (arr || []).map((el) => {
        const name = typeof el === 'string' ? el : el[0];
        let absPath = '';
        const paths = [projectRoot, process.cwd(), __dirname].reduce(
            (all, _) => {
                return [...all, _, path.join(_, 'node_modules')];
            },
            []
        );

        try {
            absPath = require.resolve(name, {
                paths,
            });
        } catch (e) {
            const defaultName =
                name.indexOf('@babel/') === 0
                    ? name
                    : `babel-${optionName.toLowerCase()}-${name}`;
            absPath = require.resolve(defaultName, { paths });
        }

        if (typeof el === 'string') return absPath;
        el[0] = absPath;
        return el;
    });
}

module.exports = function (
    { source, filename, map: inputSourceMap },
    optionsIn
) {
    const {
        mendelConfig: { projectRoot },
        ...options
    } = optionsIn;
    const { presets, plugins } = options;

    options.presets = optionDepPath(presets, 'preset', projectRoot);
    options.plugins = optionDepPath(plugins, 'plugin', projectRoot);

    const { code, map } = babel.transform(
        source,
        Object.assign(
            {
                babelrc: false, // babelrc is ignored and needs to be configured only with the option
                sourceMaps: true, // We don't need inline as we store them separately
                ast: false,
                // babel rejects null; pipeline may pass map: null for first transform
                inputSourceMap: inputSourceMap || undefined,
                filename,
                sourceFileName: filename, // sourcemap contains filename this way
            },
            options
        )
    );

    return { source: code, map };
};

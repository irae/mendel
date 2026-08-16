const debug = require('debug')('verbose:mendel:trasnform:uglify');
const uglify = require('uglify-js');

module.exports = function ({ source, filename, map: content }, optionsIn) {
    const { mendelConfig, ...options } = optionsIn;
    void mendelConfig;

    const mergedOptions = { ...options, sourceMap: { content } };

    const result = uglify.minify({ [filename]: source }, mergedOptions);

    try {
        debug(
            [filename, source.length, '->', result.code.length, 'bytes'].join(
                ' '
            )
        );
    } catch (e) {
        debug(e);
        debug(result);
    }

    if (result.error) {
        const { message, line, col } = result.error;
        throw new Error(
            `uglify-js failed on ${filename}:${line}:${col}: ${message}`
        );
    }

    const { code, map } = result;

    return { source: code, map };
};

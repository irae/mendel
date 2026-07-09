const less = require('less');

function LessTransformer({ source, filename }) {
    return less
        .render(source, {
            filename,
            sourceMap: {
                outputSourceFiles: true,
                sourceMapFileInline: false,
            },
        })
        .then(({ css, map }) => {
            // less may append a sourceMappingURL comment; mendel stores maps separately
            const cleaned = css.replace(
                /\n?\/\*# sourceMappingURL=[\s\S]*?\*\/\s*$/,
                ''
            );
            return {
                source: cleaned,
                map: map || null,
            };
        });
}

LessTransformer.parser = true;
LessTransformer.extensions = ['.less'];
LessTransformer.compatible = '.css';

module.exports = LessTransformer;

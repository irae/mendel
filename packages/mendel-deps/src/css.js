function walkAst(root) {
    const imports = [];
    const exports = [];

    root.walkAtRules('import', (atRule) => {
        let normImport = atRule.params.trim();
        if (!normImport.startsWith('url')) {
            const match = normImport.match(/^["']([^"']+)["']/);
            if (match) {
                normImport = match[1];
            } else {
                return;
            }
        }

        imports.push(normImport);
    });

    return { imports, exports };
}

module.exports = function cssDependency(source) {
    const postcss = require('postcss');
    const root = postcss.parse(source);
    return walkAst(root);
};

module.exports.supports = new Set(['.css']);

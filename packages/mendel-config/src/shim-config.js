const path = require('path');

function ShimConfig({ projectRoot, shim, defaultShim }) {
    const ret = Object.assign({}, defaultShim, shim);
    Object.keys(ret).forEach((moduleName) => {
        if (!ret[moduleName]) return;
        ret[moduleName] = path.relative(projectRoot, ret[moduleName]);
        // a shim outside projectRoot relativizes to "../…"; prefixing that
        // with "./" would mint a second spelling of the same file's id
        // ("./../../x" vs "../../x") and split it into duplicate entries
        if (!/^\.\.?\//.test(ret[moduleName]))
            ret[moduleName] = './' + ret[moduleName];
    });
    return ret;
}

module.exports = ShimConfig;

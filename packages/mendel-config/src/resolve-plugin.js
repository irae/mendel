var nodeResolveSync = require('resolve').sync;
var path = require('path');

function resolvePlugin(pluginName, basedir, context) {
    const pluginPath = _resolve(pluginName, { basedir });

    if (!pluginPath) {
        throw new Error(
            [
                `[Config][ERROR] Cannot find Mendel plugin "${pluginName}"` +
                    (context ? ` (referenced by ${context})` : '') +
                    '.',
                `Install it, e.g.: npm install --save-dev ${pluginName}`,
                `(resolved from ${basedir})`,
            ].join(' ')
        );
    }

    const pluginPackagePath = _resolve(path.join(pluginName, 'package.json'), {
        basedir,
    });

    const resolved = {
        plugin: pluginPath,
    };

    resolved.mode = [pluginPackagePath, pluginPath].reduce((mode, path) => {
        if (!mode) {
            try {
                const packageOrModule = require(path);
                mode = packageOrModule.mode || 'ist';
            } catch (e) {
                // Nice try, but we don't need to do anything yet
                // ¯\_(ツ)_/¯
            }
        }
        return mode;
    }, false);

    resolved.mode = resolved.mode || 'unknown';

    if (resolved.mode === 'unknown' && process.env.NODE_ENV !== 'production') {
        console.error(
            'WARN: ' +
                pluginName +
                ' resolved but failed to load; defaulting mode to "unknown". ' +
                'Check the plugin for load-time errors.'
        );
    }

    return resolved;
}

function _resolve(pluginPath, opt) {
    try {
        return nodeResolveSync(pluginPath, opt);
    } catch (e) {
        return false;
    }
}

module.exports = resolvePlugin;

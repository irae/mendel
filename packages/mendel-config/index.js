var path = require('path');
var yaml = require('js-yaml');
var fs = require('fs');
var xtend = require('xtend');

function findConfig(where) {
    var parts = where.split(path.sep);

    do {
        var loc = parts.join(path.sep);
        if (!loc) break;

        var config;
        var mendelrc = process.env.MENDELRC || '.mendelrc';
        var rc = path.join(loc, mendelrc);
        if (fs.existsSync(rc)) {
            config = loadFromYaml(rc);
            config.projectRoot = path.dirname(rc);
            return config;
        }

        var packagejson = path.join(loc, 'package.json');
        if (fs.existsSync(packagejson)) {
            var pkg = require(path.resolve(packagejson));
            if (pkg.mendel) {
                config = pkg.mendel;
                config.projectRoot = path.dirname(packagejson);
                return config;
            }
        }

        parts.pop();
    } while (parts.length);

    return {};
}

function loadFromYaml(path) {
    return yaml.load(fs.readFileSync(path, 'utf8'));
}

function parseConfig(config) {
    if (typeof config === 'string') config = { projectRoot: config };
    if (typeof config !== 'object') config = {};

    var projectRoot = config.projectRoot || config.basedir || process.cwd();

    // support --no-config or {config: false} to skip looking for file configs
    if (config.config !== false) {
        var fileConfig = findConfig(projectRoot);
        // in case we found a file config, assign by priority
        if (fileConfig.projectRoot) {
            config = xtend(fileConfig, config);
            // but force projectRoot to always be consistent
            config.projectRoot = fileConfig.projectRoot;
            // In case this config is passed to mendel-config again
            config.config = false;
        }
    }

    var v2probe = xtend(config);
    delete v2probe.skipPluginResolve;
    // require only inside conditional
    if (config['base-config'] || JSON.stringify(v2probe) === '{}') {
        // This requires node 6 - can use ES6 features
        return require('./src')(config);
    } else {
        config.basedir = config.projectRoot;
        // This requires node 0.10 - must be written in ES5
        return require('./legacy')(config);
    }
}

module.exports = parseConfig;
module.exports.devConfig = parseConfig;

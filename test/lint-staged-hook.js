var t = require('tap');
var fs = require('fs');
var path = require('path');
var { execFileSync, spawnSync } = require('child_process');

var repoRoot = path.resolve(__dirname, '..');
var binDir = path.join(repoRoot, 'node_modules', '.bin');
var env = Object.assign({}, process.env, {
    PATH: binDir + path.delimiter + process.env.PATH,
});

function readTaskGroups() {
    var lines = fs
        .readFileSync(path.join(repoRoot, '.lintstagedrc.yaml'), 'utf8')
        .split('\n');
    var groups = [];
    lines.forEach(function (line) {
        var pattern = /^'(.+)':\s*$/.exec(line);
        if (pattern) return groups.push({ pattern: pattern[1], commands: [] });
        var command = /^\s+-\s+(.+?)\s*$/.exec(line);
        if (command && groups.length)
            groups[groups.length - 1].commands.push(command[1]);
    });
    return groups;
}

function isPrettierIgnored(file) {
    var out = execFileSync('prettier', ['--file-info', file], {
        cwd: repoRoot,
        env: env,
        encoding: 'utf8',
    });
    return JSON.parse(out).ignored === true;
}

function findIgnoredTrackedFile(extension) {
    var tracked = execFileSync('git', ['ls-files'], {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
    })
        .split('\n')
        .filter(function (file) {
            return file.endsWith(extension) && file.includes('/node_modules/');
        });

    for (var i = 0; i < tracked.length; i++) {
        if (isPrettierIgnored(tracked[i])) return tracked[i];
    }
    return null;
}

function runGroup(group, file, message) {
    group.commands.forEach(function (command) {
        var result = spawnSync(command + ' ' + JSON.stringify(file), {
            cwd: repoRoot,
            env: env,
            shell: true,
            encoding: 'utf8',
        });
        t.equal(
            result.status,
            0,
            message +
                ': `' +
                command +
                '` exits 0 (' +
                result.stderr.trim() +
                ')'
        );
    });
}

var groups = readTaskGroups();

t.ok(groups.length >= 2, 'lint-staged config declares task groups');

var ignoredJson = findIgnoredTrackedFile('.json');
var ignoredJs = findIgnoredTrackedFile('.js');

t.ok(ignoredJson, 'repo has a tracked json fixture that prettier ignores');
t.ok(ignoredJs, 'repo has a tracked js fixture that prettier ignores');

if (ignoredJson) runGroup(groups[0], ignoredJson, 'ignored json fixture');
if (ignoredJs) runGroup(groups[1], ignoredJs, 'ignored js fixture');

t.equal(
    execFileSync('git', ['status', '--porcelain'], {
        cwd: repoRoot,
        encoding: 'utf8',
    }).includes(ignoredJson || 'no-file'),
    false,
    'running the hook tasks leaves the ignored fixture untouched'
);

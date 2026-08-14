const path = require('path');
const chokidar = require('chokidar');
const { Minimatch } = require('minimatch');
const FS_CHANGE_DELAY = process.env.MENDEL_FS_CHANGE_DELAY || 100;

class FsWatcher {
    constructor({ projectRoot, ignores }, cacheManager) {
        this.cacheManager = cacheManager;
        const ignoresArray = Array.isArray(ignores)
            ? ignores
            : ignores
              ? [ignores]
              : [];
        // Default ignore .dot files.
        this.ignored = [
            buildIgnoreMatcher(ignoresArray, projectRoot),
            dotSegmentInsideProject(projectRoot),
        ];

        // file size priority
        this.isInitialized = false;
        this.initialProrityQueue = [];
        this._changeSet = new Set();
        this._changeDelay = null;

        this.watcher = new chokidar.FSWatcher({
            cwd: projectRoot,
            ignored: this.ignored,
        });

        // chokidar reports per-path watch failures (EACCES after a mode change,
        // EMFILE/ENOSPC once the watch limit is reached) as "error" events. An
        // EventEmitter rethrows those when nothing listens, which lands in the
        // daemon's uncaughtException handler and force-closes the whole builder
        // over a single unreadable file.
        this.watcher.on('error', (error) => {
            console.error(
                `[Mendel] Ignoring a file watch error: ${
                    (error && error.message) || error
                }`
            );
        });

        this.watcher
            .on('change', (path) => {
                path = withPrefix(path);
                this._changeSet.add(path);
                if (!this._changeDelay) {
                    this._changeDelay = setTimeout(() => {
                        for (let path of this._changeSet.keys()) {
                            this.cacheManager.removeEntry(path);
                            this.cacheManager.addEntry(path);
                        }
                        this._changeDelay = null;
                        this._changeSet.clear();
                    }, FS_CHANGE_DELAY);
                }
            })
            .on('unlink', (path) => {
                this.cacheManager.removeEntry(withPrefix(path));
            })
            .on('add', (path, stats) => {
                path = withPrefix(path);
                if (!this.isInitialized) {
                    this.initialProrityQueue.push({
                        path,
                        size: stats.size,
                    });
                } else {
                    this.cacheManager.addEntry(path);
                }
            })
            .once('ready', () => {
                this.isInitialized = true;

                this.initialProrityQueue
                    .sort(({ size: aSize }, { size: bSize }) => bSize - aSize)
                    .sort((a, b) => packageJsonSort(b) - packageJsonSort(a))
                    .forEach(({ path }) => {
                        this.cacheManager.addEntry(path);
                    });

                // Cleanup the queue afterwards
                this.initialProrityQueue = [];
            });

        this.cacheManager.on('entryRequested', (path) => {
            // Adding entry upfront avoids filesystem async nature to make hard
            // to track how many files we have in the system
            this.cacheManager.addEntry(path);
            this.subscribe(path);
        });
    }

    onExit() {
        this.watcher.close();
    }

    onForceExit() {
        this.watcher.close();
    }

    subscribe(path) {
        this.watcher.add(path);
    }

    unsubscribe(path) {
        this.watcher.unwatch(path);
    }

    unwatchAll() {
        this.watcher.close();
    }
}

// chokidar tests `ignored` against absolute paths, so a bare /[/\\]\./ also
// matches dot directories in the project's ancestors (e.g. a checkout under
// ~/.anything) and silently ignores every file. Only dot segments inside the
// project should be ignored.
function dotSegmentInsideProject(projectRoot) {
    const DOT_SEGMENT = /(^|[/\\])\./;
    return function (testPath) {
        return DOT_SEGMENT.test(toProjectRelative(projectRoot, testPath));
    };
}

// chokidar tests `ignored` against absolute paths, so testing a user glob
// (e.g. `**/node_modules/**`) straight against testPath also matches when
// the checkout itself sits under a same-named ancestor directory (e.g.
// ~/work/node_modules-cache/mendel), ignoring the whole project. Match
// against the project-relative path instead.
function toProjectRelative(projectRoot, testPath) {
    const absolute = path.isAbsolute(testPath)
        ? testPath
        : path.resolve(projectRoot, testPath);
    const relative = path.relative(projectRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return testPath;
    }
    return relative;
}

function withPrefix(path) {
    if (/^\w[^:]/.test(path)) {
        path = './' + path;
    }
    return path;
}

function packageJsonSort(entry) {
    return path.basename(entry.path) === 'package.json' ? 1 : 0;
}

function buildIgnoreMatcher(ignores, projectRoot) {
    if (!ignores || ignores.length === 0) {
        return () => false;
    }

    const matchers = ignores.map((ignore) => {
        const negate = ignore[0] === '!';
        const glob = negate ? ignore.slice(1) : ignore;
        let pattern = negate ? '!' : '';
        if (!glob.startsWith('**/')) pattern += '**/';
        pattern += glob;
        return new Minimatch(pattern);
    });

    const positives = matchers.filter((m) => !m.negate);
    const negatives = matchers.filter((m) => m.negate);

    return function (testPath) {
        if (positives.length === 0) return false;
        const relative = toProjectRelative(projectRoot, testPath);
        return (
            positives.some((g) => g.match(relative)) &&
            negatives.every((g) => g.match(relative))
        );
    };
}

module.exports = FsWatcher;

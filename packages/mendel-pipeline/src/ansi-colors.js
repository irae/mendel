/* Minimal ANSI color helper — replaces chalk */

var LEVEL = 3;

function shouldColor() {
    return LEVEL > 0 && process.stdout.isTTY;
}

function color(code, str) {
    if (!shouldColor()) return str;
    return '\x1b[' + code + 'm' + str + '\x1b[39m';
}

function makeColor(code, base) {
    var fn = function (s) {
        return color(code, s);
    };
    fn.dim = function (s) {
        if (!shouldColor()) return s;
        return '\x1b[2;' + code + 'm' + s + '\x1b[39;22m';
    };
    fn.__proto__ = base;
    return fn;
}

var colors = {
    get level() {
        return LEVEL;
    },
    set level(v) {
        LEVEL = v;
    },
    red: makeColor(31, colors),
    green: makeColor(32, colors),
    yellow: makeColor(33, colors),
    blue: makeColor(34, colors),
    white: makeColor(37, colors),
    bold: function (s) {
        if (!shouldColor()) return s;
        return '\x1b[1m' + s + '\x1b[22m';
    },
    underline: function (s) {
        if (!shouldColor()) return s;
        return '\x1b[4m' + s + '\x1b[24m';
    },
    bgWhite: {
        black: function (s) {
            if (!shouldColor()) return s;
            return '\x1b[47;30m' + s + '\x1b[0m';
        },
    },
};

module.exports = { colors: colors, chalk: colors };

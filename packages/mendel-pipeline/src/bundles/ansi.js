const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

function escapeHTML(value) {
    return String(value == null ? '' : value).replace(
        /[&<>"']/g,
        (char) => HTML_ESCAPES[char]
    );
}

// eslint-disable-next-line no-control-regex
const ANSI_SEQUENCE = /\u001b\[[0-?]*[ -/]*[@-~]/g;
// eslint-disable-next-line no-control-regex
const SGR_SEQUENCE = /\u001b\[([0-9;]*)m/g;

// Terminal palette babel's code frames paint with, approximated for a dark page.
const COLORS = {
    30: '#3b4048',
    31: '#f14c4c',
    32: '#23d18b',
    33: '#e5c07b',
    34: '#4a9df8',
    35: '#d670d6',
    36: '#29b8db',
    37: '#d4d4d4',
    90: '#7d8590',
    91: '#ff7b72',
    92: '#7ee787',
    93: '#ffd479',
    94: '#79c0ff',
    95: '#d2a8ff',
    96: '#56d4dd',
    97: '#f0f0f0',
};

function stripANSI(value) {
    return String(value == null ? '' : value).replace(ANSI_SEQUENCE, '');
}

function styleFor(state) {
    const styles = [];
    if (state.color) styles.push(`color:${state.color}`);
    if (state.bold) styles.push('font-weight:bold');
    return styles.join(';');
}

function applyCodes(state, params) {
    params.split(';').forEach((raw) => {
        const code = Number(raw || '0');
        if (code === 0) {
            state.color = null;
            state.bold = false;
        } else if (code === 1) {
            state.bold = true;
        } else if (code === 22) {
            state.bold = false;
        } else if (code === 39) {
            state.color = null;
        } else if (COLORS[code]) {
            state.color = COLORS[code];
        }
    });
}

function ansiToHTML(value) {
    const text = String(value == null ? '' : value);
    const state = { color: null, bold: false };
    const out = [];
    let cursor = 0;

    const push = (chunk) => {
        if (!chunk) return;
        const escaped = escapeHTML(stripANSI(chunk));
        const style = styleFor(state);
        out.push(style ? `<span style="${style}">${escaped}</span>` : escaped);
    };

    SGR_SEQUENCE.lastIndex = 0;
    let match;
    while ((match = SGR_SEQUENCE.exec(text)) !== null) {
        push(text.slice(cursor, match.index));
        applyCodes(state, match[1]);
        cursor = match.index + match[0].length;
    }
    push(text.slice(cursor));

    return out.join('');
}

module.exports = { escapeHTML, stripANSI, ansiToHTML };

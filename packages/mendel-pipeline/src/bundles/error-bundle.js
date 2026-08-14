const { escapeHTML, stripANSI, ansiToHTML } = require('./ansi');

// A stack trace quoting source can contain "*/", which would close the comment
// early and let the rest of the trace through as (broken) CSS declarations.
function escapeCSSComment(value) {
    return String(value == null ? '' : value).replace(/\*\//g, '*\\/');
}

function normalize(errors, environment) {
    return (Array.isArray(errors) ? errors : [errors]).map((err) => ({
        id: err.id || 'unknown',
        environment: err.environment || environment || 'unknown',
        message: err.message || err.error?.message || 'Unknown error',
        stack: err.stack || err.error?.stack || '',
    }));
}

function errorSection(err) {
    return [
        '<section class="mendel-error">',
        `<h2>${escapeHTML(err.id)}</h2>`,
        `<p class="mendel-env">environment: ${escapeHTML(err.environment)}</p>`,
        `<pre class="mendel-message">${ansiToHTML(err.message)}</pre>`,
        '<details open><summary>Stack trace</summary>',
        `<pre class="mendel-stack">${ansiToHTML(
            err.stack || 'No stack available'
        )}</pre>`,
        '</details>',
        '</section>',
    ].join('\n');
}

const STYLE = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #111; color: #ccc; padding: 2rem; line-height: 1.6;
    }
    .mendel-container {
        max-width: 900px; margin: 0 auto; background: #1e1e1e;
        border: 1px solid #333; border-radius: 8px; padding: 2rem;
    }
    h1 { color: #f44; margin-bottom: 1.5rem; font-size: 1.5rem; }
    h2 { color: #f44; font-size: 1.1rem; margin-bottom: 0.25rem; }
    .mendel-env { color: #888; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .mendel-error { margin-bottom: 2rem; }
    pre {
        background: #0a0a0a; border: 1px solid #333; border-radius: 4px;
        padding: 1rem; overflow-x: auto; white-space: pre-wrap;
        word-break: break-word; font-family: 'Courier New', monospace;
    }
    .mendel-stack { color: #888; font-size: 0.85em; }
    summary { cursor: pointer; padding: 0.5rem 0; color: #aaa; }
`;

class ErrorBundleGenerator {
    static generateErrorPage(errors, environment) {
        const list = normalize(errors, environment);
        return [
            '<!DOCTYPE html>',
            '<html><head><meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>[Mendel] Build Error</title>',
            `<style>${STYLE}</style>`,
            '</head><body><div class="mendel-container">',
            '<h1>[Mendel] Build Error</h1>',
            '<p>Fix the error and save to rebuild.</p>',
            list.map(errorSection).join('\n'),
            '</div></body></html>',
        ].join('\n');
    }

    static generateJSErrorBundle(errors, environment) {
        const list = normalize(errors, environment);
        const page = this.generateErrorPage(list, environment);
        // Browser consoles print escape codes literally; only the page renders them.
        const logged = list.map((err) => ({
            ...err,
            message: stripANSI(err.message),
            stack: stripANSI(err.stack),
        }));

        return `
(function () {
    var errors = ${JSON.stringify(logged, null, 2)};
    errors.forEach(function (err) {
        console.error(
            '%c[Mendel Build Error]%c %s (%s)',
            'color: red; font-weight: bold;',
            'color: inherit;',
            err.id,
            err.environment
        );
        console.error(err.message);
        if (err.stack) console.error(err.stack);
    });

    if (typeof document !== 'undefined' && typeof document.write === 'function') {
        document.open();
        document.write(${JSON.stringify(page)});
        document.close();
    }
})();
`.trim();
    }

    static generateCSSErrorBundle(errors, environment) {
        const list = normalize(errors, environment);
        const messages = list
            .map(
                (err) =>
                    `${err.id} [${err.environment}]: ${stripANSI(
                        err.message
                    )}\n${stripANSI(err.stack)}`
            )
            .join('\n\n');

        return `/* [Mendel] Build Error\n${escapeCSSComment(messages)}\n*/`;
    }

    /**
     * @returns {String} bundle source; callers serve it as-is.
     */
    static generate(errors, { type = 'js', environment } = {}) {
        return type === 'css'
            ? this.generateCSSErrorBundle(errors, environment)
            : this.generateJSErrorBundle(errors, environment);
    }
}

module.exports = ErrorBundleGenerator;

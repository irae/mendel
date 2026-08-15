# Mendel Parser Plaintext

Wraps a plaintext file (markdown, templates, CSV, GraphQL, ...) in a JavaScript module so it can be bundled with the rest of your assets in [Mendel](https://github.com/irae/mendel). The module exports the file's content as a string:

```js
const template = require('./email-template.mustache');
// template is the raw file content as a string
```

The emitted string is JSON-encoded with `U+2028`/`U+2029` additionally escaped, so the module stays a syntactically valid JavaScript string in every serving context, not just as JSON. The content is not HTML-escaped: bundles are expected to be served as external scripts, not inlined into HTML.

## Configuration

Declare the parser as a transform plugin, then attach it to a type covering the extensions you want. The parser converts entries to the `js` type via `parser-to-type`:

```yaml
transforms:
    plaintext:
        plugin: mendel-parser-plaintext

types:
    templates:
        extensions:
            - .mustache
            - .md
            - .graphql
        parser: plaintext
        parser-to-type: js
```

The parser declares defaults for these extensions: `.md`, `.markdown`, `.txt`, `.csv`, `.tsv`, `.html`, `.hbs`, `.handlebars`, `.mustache`, `.ejs`, `.graphql`, `.gql`. Your type configuration decides which files it actually runs on.

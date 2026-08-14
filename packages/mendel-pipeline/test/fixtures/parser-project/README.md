# `parser-project`

One app covering every branch of the "is this extension parseable?" check.
`index.js` requires `notes.md`, an extension with no first-party type;
`index-other-handling.js` requires `data.txt`, an extension a project can
legitimately cover with a `resource` type and no parser at all.

Consumed by `parser-coverage-{missing,configured,production,other-handling}.js`.
The four differ only in the `.mendelrc` they generate through `baseYaml`, so
they share these sources and each stages its own run directory.

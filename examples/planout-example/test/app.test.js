// Test that uuid v4 produces valid UUIDs
const assert = require('assert');
const { randomUUID } = require('crypto');

// randomUUID should be a function
assert.ok(typeof randomUUID === 'function');

// randomUUID should produce a string
const id = randomUUID();
assert.ok(typeof id === 'string');

// randomUUID should produce a valid UUID format (8-4-4-4-12 hex)
const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
assert.ok(
    uuidRegex.test(id),
    `Generated UUID "${id}" does not match expected format`
);

// Two calls should produce different UUIDs
const id2 = randomUUID();
assert.notEqual(
    id,
    id2,
    'randomUUID should produce different values on each call'
);

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

test('crypto.randomUUID generates valid v4 UUID format', () => {
    const id = crypto.randomUUID();
    assert.ok(id);
    assert.strictEqual(typeof id, 'string');
    assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
});

test('crypto.randomUUID generates unique values', () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    assert.notStrictEqual(id1, id2);
});

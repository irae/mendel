import { expect } from 'chai';
import { createHash } from 'crypto';
import { PassThrough } from 'stream';

describe('node core shims in karma', function () {
    it('crypto shim hashes (ripemd160 → hash-base → readable-stream chain)', function () {
        const sha = createHash('sha1').update('mendel').digest('hex');
        expect(sha).to.equal('afbe95411b2e4bdda7271a932459d308c81f6155');
    });

    it('stream shim round-trips (stream-browserify → readable-stream)', function (done) {
        const stream = new PassThrough();
        let out = '';
        stream.on('data', (chunk) => (out += chunk));
        stream.on('end', () => {
            expect(out).to.equal('hello');
            done();
        });
        stream.end('hello');
    });
});

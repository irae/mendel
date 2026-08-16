import { expect } from 'chai';
import request from 'superagent';

describe('browser-field file mapping in karma', function () {
    it('serves the browser build, not the Buffer-reading node build', function () {
        // superagent maps ./lib/node/index.js -> ./lib/client.js in its
        // browser field; the node build reads the Buffer global at request
        // time and has no place in a browser graph
        expect(request.post).to.be.a('function');
        const req = request.post('/echo').send({ ok: true });
        expect(req.url).to.equal('/echo');
        req.abort();
    });
});

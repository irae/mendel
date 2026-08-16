import { expect } from 'chai';

const moduleScopeGlobal = global;

describe('karma global environment', function () {
    afterAll(function () {
        global.__mendel_global_check__ = true;
    });

    it('defines global like the browser-pack prelude does', function () {
        expect(moduleScopeGlobal).to.equal(window);
        expect(global).to.equal(window);
    });

    it('defines process.env', function () {
        expect(process.env).to.be.an('object');
    });
});

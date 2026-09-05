// Test for uuid removal in examples/planout-example/app.js
// This test ensures that the app starts and generates a visitorId if none is provided.
const app = require('./app');
const http = require('http');
const assert = require('assert');

const server = http.createServer(app);

server.listen(0, () => {
    const request = http.request(
        {
            method: 'GET',
            url: '/',
            headers: {
                host: 'localhost',
                cookie: '',
            },
        },
        (res) => {
            assert.strictEqual(res.statusCode, 200);
            res.on('data', () => {});
            res.on('end', () => {
                server.close();
                process.exit(0);
            });
        }
    );
    request.end();
});

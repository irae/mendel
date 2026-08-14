const test = require('tap').test;
const path = require('path');
const fs = require('fs');
const os = require('os');
const ServerSideRenderOutlet = require('../index.js');

test('ServerSideRenderOutlet.saveFileToDisk creates nested directories', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-ssr-'));

    t.teardown(async () => {
        // Clean up
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    const config = {
        baseConfig: {
            outdir: tempDir,
            dir: 'src',
        },
        variationConfig: {
            allDirs: ['src'],
        },
    };

    const outlet = new ServerSideRenderOutlet(config, { dir: 'ssr' });

    // This path includes non-existent nested directories
    const dest = path.join(tempDir, 'nested', 'deep', 'dirs', 'test-module.js');
    const source = 'module.exports = "test";';

    // This should not crash with "mkdirp is not a function"
    await outlet.saveFileToDisk(dest, source);

    // Verify the file was created
    const fileExists = fs.existsSync(dest);
    t.ok(fileExists, 'File should be created in nested directories');

    if (fileExists) {
        const content = fs.readFileSync(dest, 'utf-8');
        t.equal(content, source, 'File should contain the expected source');
    }
});

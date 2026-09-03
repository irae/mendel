#!/usr/bin/env node
/* eslint max-len: "off" */
const { Command } = require('commander');
const util = require('node:util');

const program = new Command();

function stringCollection(val = '', collection) {
    return collection.concat(
        val
            .split(',')
            .map((splitted) => splitted.trim())
            .filter(Boolean)
    );
}

program
    .version('0.1.0')
    .usage('[options]')
    .option(
        '-i, --ignore <patterns>',
        'Comma separated ignore glob patterns',
        stringCollection,
        []
    )
    // .option('-v, --verbose', 'Verbose mode')
    .option('-w, --watch', 'Watch mode', false)
    .option(
        '-l, --only <ids>',
        'Only build this list of bundleIds',
        stringCollection,
        []
    )
    .option('-o, --outlet', 'Write a mendel v1 compatible manifest', false)
    .parse(process.argv);

const opts = program.opts();
opts.ignores = opts.ignore;

if (opts.watch) {
    const MendelPipelineDaemon = require('./daemon');
    const daemon = new MendelPipelineDaemon(opts);
    daemon.watch();
} else {
    const Mendel = require('./main');
    const daemon = new Mendel(opts);
    daemon.run((error) => {
        if (error) process.exit(1);
        setImmediate(() => process.exit(0));
    });

    const AnalyticsCliPrinter = require('./helpers/analytics/cli-printer');
    const collector = require('./helpers/analytics/analytics-collector');
    collector.setOptions({
        printer: new AnalyticsCliPrinter({ enableColor: true }),
    });

    process.on('exit', (code) => {
        if (code > 0) {
            daemon.onForceExit();
        }
    });

    process.on('SIGINT', () => {
        console.error('SIGINT');
        daemon.onForceExit();
        process.exit(1);
    });

    process.on('uncaughtException', (error) => {
        console.error(
            [
                `Force closing due to a critical error:\n`,
                util.styleText(['red'], error.stack),
            ].join(' ')
        );
        daemon.onForceExit();
        process.exit(1);
    });

    // nodemon style shutdown
    process.once('SIGUSR2', () => process.kill(process.pid, 'SIGUSR2'));
}

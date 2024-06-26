const BaseNetwork = require('./base-network');
const net = require('net');
const fs = require('fs');
const { resolve } = require('path');
const chalk = require('chalk');
const verbose = require('debug')('verbose:mendel:net:unix-socket');

function patchSocket(socket) {
    const realWrite = net.Socket.prototype.write;
    // Consistent API as WS or others this way.
    const realEmit = net.Socket.prototype.emit;
    const CONTENT_DELIMITER = '\u0004';
    let buffer = '';
    socket.send = function (str) {
        if (typeof str === 'object') str = JSON.stringify(str);
        this.write(str);
    };

    socket.write = function (str) {
        // end of transmission
        realWrite.call(this, str + CONTENT_DELIMITER);
    };

    socket.emit = function (name, content) {
        if (name !== 'data') return realEmit.apply(this, arguments);

        let delimitInd;
        while ((delimitInd = content.indexOf(CONTENT_DELIMITER)) >= 0) {
            realEmit.call(this, 'data', buffer + content.slice(0, delimitInd));
            content = content.slice(delimitInd + CONTENT_DELIMITER.length);
            buffer = '';
        }

        buffer += content;
    };
}

class UnixSocketNetwork extends BaseNetwork {
    static _serverPrecondition(path) {
        path = resolve(path);
        try {
            fs.statSync(path);
        } catch (err) {
            // File descriptor does not exist. Good to go!
            verbose('file descriptor not found, starting server');
            return Promise.resolve();
        }
        verbose('file descriptor FOUND, connecting for double checking');

        return (
            new Promise((resolve, reject) => {
                const client = this.getClient({ path });
                client.unref();
                client.once('connect', () => {
                    verbose('able to connect, client really alive');
                    client.end();
                    reject(new Error('FOREIGN_SERVER'));
                });
                client.once('error', () => {
                    verbose('server irresponsive, starting server');
                    resolve();
                });
            })
                // If connection was not made, try to delete the ipc file.
                .then(() => fs.unlinkSync(path))
                // If connection was made OR unlink was unsuccessful
                // throw and exit -- cannot recover.
                .catch((error) => {
                    if (error.message === 'FOREIGN_SERVER') {
                        console.error(
                            chalk.red(
                                [
                                    '==================================================',
                                    '[Mendel][Error] Another builder is already running.',
                                    'If no server process is active, ',
                                    `please remove or kill "${chalk.bold(
                                        path
                                    )}" manually.`,
                                    '==================================================',
                                ].join('\n')
                            )
                        );
                        throw new ReferenceError('Other Daemon Active');
                    }
                    throw error;
                })
        );
    }

    // @override
    static getServer(connectionOptions) {
        const { path } = connectionOptions;

        return this._serverPrecondition(path).then(() => {
            const server = net.createServer().listen({ path });
            let isClosed = false;
            let close = server.close;

            server.on('connection', (socket) => {
                patchSocket(socket);
                socket.setEncoding('utf8');
            });
            server.on('close', () => (isClosed = true));
            server.close = function closeHelper() {
                // Cannot close already closed socket.
                // Socket should tell us instead :(
                if (isClosed) return;
                close.call(server);
            };
            server.once('error', (err) => {
                console.error('Unrecoverable Server Error', err);
                process.exit(1);
            });

            return server;
        });
    }

    // @override
    static getClient(connectionOptions) {
        verbose('client with options', connectionOptions);
        const connection = net.connect(connectionOptions);
        patchSocket(connection);
        connection.setEncoding('utf8');
        return connection;
    }
}

module.exports = UnixSocketNetwork;

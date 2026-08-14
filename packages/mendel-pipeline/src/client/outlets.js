const fs = require('fs');
const path = require('path');
const analyze = require('../helpers/analytics/analytics')('outlet');

class MendelOutlets {
    constructor(options) {
        this.options = options;
        this.outlets = options.outlets;
    }

    perform(bundles, variations = [this.options.baseConfig.dir]) {
        const promises = bundles.map((bundle) => {
            const outlet = this.outlets.find((outlet) => {
                return outlet.id === bundle.options.outlet;
            });

            const Plugin = require(outlet.plugin);
            const plugin = new Plugin(
                this.options, // Mendel config
                outlet.options // outlet options
            );

            if (bundle.options.outfile) {
                fs.mkdirSync(path.dirname(bundle.options.outfile), {
                    recursive: true,
                });
            }

            return Promise.resolve()
                .then(analyze.tic.bind(analyze, outlet.id))
                .then(() => plugin.perform(bundle, variations))
                .catch((e) => {
                    e.bundle = { id: bundle.id, options: bundle.options };
                    e.outletConfig = outlet;
                    throw e;
                })
                .then(analyze.toc.bind(analyze, outlet.id))
                .then((output) => (bundle.output = output));
        });
        return Promise.all(promises);
    }
}

module.exports = MendelOutlets;

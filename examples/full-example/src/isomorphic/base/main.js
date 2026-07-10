/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */
import App from './components/app';
import React from 'react';
import './config.json';

if (typeof document !== 'undefined') {
    const { hydrateRoot } = require('react-dom/client');
    const main = document.querySelector('#main');
    hydrateRoot(main, <App data={window.data} />);
} else {
    module.exports = function (data) {
        return <App data={data} />;
    };
}

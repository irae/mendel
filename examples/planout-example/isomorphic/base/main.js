/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   Contributed by Shalom Volchok <shalom@digitaloptgroup.com>
   See the accompanying LICENSE file for terms. */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/app';

if (typeof document !== 'undefined') {
    var main = document.querySelector('#main');
    const root = createRoot(main);
    root.render(<App data={window.data} />, main);
} else {
    module.exports = function (data) {
        return <App data={data} />;
    };
}

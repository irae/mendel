/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   Contributed by Shalom Volchok <shalom@digitaloptgroup.com>
   See the accompanying LICENSE file for terms. */

import React from 'react';
import Header from './header';
import Body from './body';
import Footer from './footer';
import Docs from './docs';

const style = {
    border: '2px solid grey',
    padding: '20px',
    margin: '20px',
};

export default () => {
    return (
        <div>
            <div style={style}>
                <b>app.js</b> <br />
                from base/components.app.js
                <Header />
                <Body />
                <Footer />
            </div>
            <Docs style={style} />
        </div>
    );
};

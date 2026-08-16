/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

import React from 'react';
import Header from './header';
import Body from './body';
import Footer from './footer';
import Charts from './pages/charts';
import Logs from './pages/logs';
import './about';

const PAGES = {
    home: Body,
    charts: Charts,
    logs: Logs,
};

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = { page: 'home' };
    }

    render() {
        const Page = PAGES[this.state.page];

        return (
            <div className="app">
                <Header />
                <nav>
                    {Object.keys(PAGES).map((page) => (
                        <a
                            key={page}
                            href={`#${page}`}
                            onClick={() => this.setState({ page })}
                        >
                            {page}
                        </a>
                    ))}
                </nav>
                <Page />
                <Footer />
            </div>
        );
    }
}

export default App;

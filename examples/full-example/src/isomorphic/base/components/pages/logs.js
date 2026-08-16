import React from 'react';
import createDebug from 'debug';
import Button from '../button';

createDebug.enable('example:*');
const log = createDebug('example:logs');

class Logs extends React.Component {
    constructor(props) {
        super(props);
        this.state = { entries: [] };
        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        const entry = `clicked at ${new Date().toISOString()}`;
        log(entry);
        this.setState({ entries: this.state.entries.concat(entry) });
    }

    render() {
        return (
            <section className="logs">
                <h2>Logs</h2>
                <Button onClick={this.handleClick}>Log a click</Button>
                <ul>
                    {this.state.entries.map((entry, index) => (
                        <li key={index}>{entry}</li>
                    ))}
                </ul>
            </section>
        );
    }
}

export default Logs;

import React from 'react';
import { extent, mean, ticks } from 'd3-array';

const SAMPLE = [4, 8, 15, 16, 23, 42];

class Charts extends React.Component {
    render() {
        const [min, max] = extent(SAMPLE);
        const avg = mean(SAMPLE);
        const axis = ticks(min, max, 5);

        return (
            <section className="charts">
                <h2>Charts</h2>
                <p>
                    Sample: {SAMPLE.join(', ')} — min {min}, max {max}, mean{' '}
                    {avg}
                </p>
                <p>Axis ticks: {axis.join(' | ')}</p>
            </section>
        );
    }
}

export default Charts;

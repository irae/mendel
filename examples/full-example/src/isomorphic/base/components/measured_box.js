/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

import React from 'react';
import useMeasure from 'react-use-measure';

export default function MeasuredBox({ children, className }) {
    const [ref, bounds] = useMeasure();
    return (
        <div ref={ref} className={className || 'measured-box'}>
            <span data-testid="measured-width">{Math.round(bounds.width)}</span>
            {children}
        </div>
    );
}

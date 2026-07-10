/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

import React from 'react';
import MeasuredBox from '../measured_box';
import { expect } from 'chai';
import { screen, render } from '@testing-library/react';

describe('MeasuredBox [base] (react-use-measure dual package)', function () {
    it('renders children and measures width slot', function () {
        render(
            <MeasuredBox>
                <span>inside-measure</span>
            </MeasuredBox>
        );
        expect(screen.getByText('inside-measure')).to.exist;
        // data-testid comes from the dual-package hook wiring
        expect(screen.getByTestId('measured-width')).to.exist;
    });
});

/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

import React from 'react';
import { findDOMNode } from 'react-dom';
import { screen, render } from '@testing-library/react';
import Toolbar from '../toolbar';
import { expect } from 'chai';

describe('toolbar [feature_B]', function () {
    it('contains 3 buttons', function () {
        render(<Toolbar />);

        screen.findAllByText('B');
        const buttons = screen.getAllByText('B');

        expect(buttons.length).to.equal(3);
        expect(findDOMNode(buttons[0]).innerText).to.equal('B');
        expect(findDOMNode(buttons[1]).innerText).to.equal('B');
        expect(findDOMNode(buttons[2]).innerText).to.equal('B');
    });
});

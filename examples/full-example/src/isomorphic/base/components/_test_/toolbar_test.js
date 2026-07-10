/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

import React from 'react';
import { findDOMNode } from 'react-dom'; // eslint-disable-line no-unused-vars
import { screen, render } from '@testing-library/react';
import Toolbar from '../toolbar';
import { expect } from 'chai';

describe('toolbar [base]', function () {
    it('contains a button with correct label', function () {
        render(<Toolbar />);
        screen.findAllByText('Toolbar');

        expect(screen.getAllByText('Toolbar').length).to.equal(1);
    });
});

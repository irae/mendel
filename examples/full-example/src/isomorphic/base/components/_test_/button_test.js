/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

import React from 'react';
import { findDOMNode } from 'react-dom'; // eslint-disable-line no-unused-vars
import Button from '../button';
import { expect } from 'chai';
import { screen, render } from '@testing-library/react';

describe('Button [base]', function () {
    it('renders with children', function () {
        render(<Button>meow</Button>);
        screen.findByText('meow');
        expect(screen.getByText('meow').innerText).to.equal('meow');
    });
});

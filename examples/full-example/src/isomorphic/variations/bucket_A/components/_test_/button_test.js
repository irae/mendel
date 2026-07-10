/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

import React from 'react';
import { findDOMNode } from 'react-dom'; // eslint-disable-line no-unused-vars
import Button from '../button';
import { expect } from 'chai';
import { screen, render } from '@testing-library/react';

describe('Button [bucket_A]', function () {
    beforeEach(function () {
        document.body.innerHTML = '';
    });
    it('Adds suffix to content', function () {
        render(<Button />);
        screen.findByText(/A#/);
        expect(screen.getByText(/A#/).innerText).to.contain('A#1');
    });
    it('global counter incremented', function () {
        render(<Button>bar</Button>);
        screen.findByText(/A#/);
        expect(screen.getByText(/A#/).innerText).to.contain('A#2');
    });
    it('renders with children', function () {
        render(<Button>foo</Button>);
        screen.findByText(/A#/);
        expect(screen.getByText(/A#/).innerText).to.contain('foo');
    });
});

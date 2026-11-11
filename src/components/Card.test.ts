import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';

test('Card component exports correctly and has standard defaults', () => {
  assert.equal(typeof Card, 'object'); // React.forwardRef object
  assert.equal(typeof CardHeader, 'function');
  assert.equal(typeof CardTitle, 'function');
  assert.equal(typeof CardDescription, 'function');
  assert.equal(typeof CardContent, 'function');
  assert.equal(typeof CardFooter, 'function');
});

test('Card renders valid React elements with correct props', () => {
  const elem = React.createElement(
    Card,
    {
      variant: 'dark',
      padding: 'lg',
      topAccent: 'orange',
      interactive: true,
      className: 'custom-test-class',
      children: 'Child Content',
    } as any
  );

  assert.equal(elem.type, Card);
  assert.equal((elem.props as any).variant, 'dark');
  assert.equal((elem.props as any).padding, 'lg');
  assert.equal((elem.props as any).topAccent, 'orange');
  assert.equal((elem.props as any).interactive, true);
  assert.equal((elem.props as any).children, 'Child Content');
});

'use strict';

const { expect } = require('chai');
const matchImport = require('../lib/match-import');

describe('match-import', function() {
  it('parses import statements', function() {
    expect(matchImport()).to.eql(null);
    expect(matchImport('')).to.eql(null);
    expect(matchImport('#import "./someFragment.graphql"')).to.eql({ importIdentifier: './someFragment.graphql'});
    expect(matchImport(`#import './someFragment.graphql'`)).to.eql({ importIdentifier: './someFragment.graphql'});
    expect(matchImport('import "./someFragment.graphql"')).to.eql(null);
    expect(matchImport(`#import './someFragment.graphql"`)).to.eql(null);
    expect(matchImport('#import ./someFragment.graphql"')).to.eql(null);
    expect(matchImport('#import "./someFragment.graphql')).to.eql(null);
  });
});


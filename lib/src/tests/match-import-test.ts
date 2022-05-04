import { expect } from 'chai';
import matchImport from '../match-import';

describe('match-import', () => {
  it('parses import statements', () => {
    expect(matchImport('')).to.eql(null);
    expect(matchImport('#import "./someFragment.graphql"')).to.eql('./someFragment.graphql');
    expect(matchImport(`#import './someFragment.graphql'`)).to.eql('./someFragment.graphql');
    expect(matchImport(`#import './someFragment.graphql';`)).to.eql('./someFragment.graphql');
    expect(matchImport(`#import './someFragment.graphql'    `)).to.eql('./someFragment.graphql');
    expect(matchImport('import "./someFragment.graphql"')).to.eql(null);
    expect(matchImport(`#import './someFragment.graphql"`)).to.eql(null);
    expect(matchImport('#import ./someFragment.graphql"')).to.eql(null);
    expect(matchImport('#import "./someFragment.graphql')).to.eql(null);
  });
});

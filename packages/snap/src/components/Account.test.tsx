/**
 * Account Component Rendering Tests
 *
 * Tests for the three account display components:
 * - NoAtom: Address has no atom on Intuition
 * - AtomWithoutTrustTriple: Atom exists but no trust data
 * - AtomWithTrustTriple: Full trust data available
 *
 * These tests verify that each component renders the correct UI structure,
 * text content, and CTAs based on the account state.
 */

import { expect, describe, it } from '@jest/globals';
import type { ChainId } from '@metamask/snaps-sdk';
import { NoAtom, AtomWithoutTrustTriple, AtomWithTrustTriple } from './Account';
import {
  AccountType,
  Account,
  TripleWithPositions,
  AddressClassification,
  AlternateTrustData,
} from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';
const TEST_CHAIN_ID: ChainId = 'eip155:13579';

const baseClassification: AddressClassification = {
  type: 'eoa',
  certainty: 'definite',
};

const contractClassification: AddressClassification = {
  type: 'contract',
  certainty: 'definite',
};

const noAlternateTrustData: AlternateTrustData = {
  hasAlternateTrustData: false,
};

const withAlternateTrustData: AlternateTrustData = {
  hasAlternateTrustData: true,
  alternateAtomId: '0xalternate123',
  alternateMarketCap: '1000000000000000000',
  alternateIsCaip: true,
};

const mockAccount: Account = {
  id: '1',
  data: TEST_ADDRESS,
  label: 'Test Account',
  term_id: '0xterm123',
};

const mockTriple: TripleWithPositions = {
  term_id: '0xtriple123',
  subject_id: '0xterm123',
  predicate_id: '0xpredicate',
  object_id: '0xobject',
  creator_id: '0xcreator',
  counter_term_id: '0xcounter123',
  term: {
    vaults: [
      {
        term_id: '0xtriple123',
        market_cap: '2500000000000000000', // 2.5 TRUST
        position_count: 5,
        curve_id: '1',
      },
    ],
  },
  counter_term: {
    vaults: [
      {
        term_id: '0xcounter123',
        market_cap: '750000000000000000', // 0.75 TRUST
        position_count: 2,
        curve_id: '1',
      },
    ],
  },
  triple_term: {
    term_id: '0xtriple123',
    counter_term_id: '0xcounter123',
    total_market_cap: '3250000000000000000',
    total_position_count: '7',
  },
  triple_vault: {
    term_id: '0xtriple123',
    counter_term_id: '0xcounter123',
    curve_id: '1',
    position_count: '7',
    market_cap: '3250000000000000000',
  },
  positions_aggregate: {
    aggregate: { count: 5, sum: { shares: 2500 }, avg: { shares: 500 } },
  },
  counter_positions_aggregate: {
    aggregate: { count: 2, sum: { shares: 750 }, avg: { shares: 375 } },
  },
  positions: [
    { id: 'pos1', account_id: '0xstaker1', term_id: '0xtriple123', curve_id: '1', shares: '1000000000000000000' },
    { id: 'pos2', account_id: '0xstaker2', term_id: '0xtriple123', curve_id: '1', shares: '500000000000000000' },
  ],
  counter_positions: [
    { id: 'cpos1', account_id: '0xopposer1', term_id: '0xcounter123', curve_id: '1', shares: '250000000000000000' },
  ],
};

// Helper to stringify JSX for content assertions
const renderToString = (jsx: JSX.Element): string => JSON.stringify(jsx);

// =============================================================================
// NoAtom Component Tests
// =============================================================================

describe('NoAtom Component', () => {
  const baseNoAtomProps = {
    accountType: AccountType.NoAtom as const,
    account: null,
    triple: null,
    address: TEST_ADDRESS,
    chainId: TEST_CHAIN_ID,
    alias: null,
    isContract: false,
    classification: baseClassification,
    alternateTrustData: noAlternateTrustData,
  };

  it('should render warning message for EOA', () => {
    const result = NoAtom(baseNoAtomProps);
    const rendered = renderToString(result);

    expect(rendered).toContain('No community data on Intuition');
    expect(rendered).toContain('Unknown');
    expect(rendered).toContain('address');
    expect(rendered).not.toContain('contract');
  });

  it('should render warning message for contract', () => {
    const result = NoAtom({
      ...baseNoAtomProps,
      isContract: true,
      classification: contractClassification,
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('No community data on Intuition');
    expect(rendered).toContain('contract');
  });

  it('should not show alternate trust note when no alternate data', () => {
    const result = NoAtom(baseNoAtomProps);
    const rendered = renderToString(result);

    expect(rendered).not.toContain('Also has data');
  });

  it('should show alternate trust note when alternate data exists', () => {
    const result = NoAtom({
      ...baseNoAtomProps,
      alternateTrustData: withAlternateTrustData,
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('Also has data as a contract');
  });

  it('should have Section as root element', () => {
    const result = NoAtom(baseNoAtomProps);

    expect(result.type).toBe('Section');
  });
});

// =============================================================================
// AtomWithoutTrustTriple Component Tests
// =============================================================================

describe('AtomWithoutTrustTriple Component', () => {
  const baseAtomNoTripleProps = {
    accountType: AccountType.AtomWithoutTrustTriple as const,
    account: mockAccount,
    triple: null,
    address: TEST_ADDRESS,
    chainId: TEST_CHAIN_ID,
    alias: null,
    isContract: false,
    classification: baseClassification,
    alternateTrustData: noAlternateTrustData,
  };

  it('should render status message for atom without trust triple', () => {
    const result = AtomWithoutTrustTriple(baseAtomNoTripleProps);
    const rendered = renderToString(result);

    expect(rendered).toContain('No trust rating yet');
    expect(rendered).toContain('Known address, awaiting community votes');
  });

  it('should display alias when present', () => {
    const result = AtomWithoutTrustTriple({
      ...baseAtomNoTripleProps,
      alias: 'Vitalik',
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('Alias');
    expect(rendered).toContain('Vitalik');
  });

  it('should not display alias row when alias is null', () => {
    const result = AtomWithoutTrustTriple(baseAtomNoTripleProps);
    const rendered = renderToString(result);

    // Should not have a Row with label "Alias"
    expect(rendered).not.toContain('"label":"Alias"');
  });

  it('should display alias when present', () => {
    const result = AtomWithoutTrustTriple({
      ...baseAtomNoTripleProps,
      alias: 'HasAlias',
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('HasAlias');
    expect(rendered).toContain('Alias');
  });

  it('should show alternate trust note when alternate data exists', () => {
    const result = AtomWithoutTrustTriple({
      ...baseAtomNoTripleProps,
      alternateTrustData: withAlternateTrustData,
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('Also has data as a contract');
  });
});

// =============================================================================
// AtomWithTrustTriple Component Tests
// =============================================================================

describe('AtomWithTrustTriple Component', () => {
  const baseAtomWithTripleProps = {
    accountType: AccountType.AtomWithTrustTriple as const,
    account: mockAccount,
    triple: mockTriple,
    address: TEST_ADDRESS,
    chainId: TEST_CHAIN_ID,
    alias: null,
    isContract: false,
    classification: baseClassification,
    alternateTrustData: noAlternateTrustData,
  };

  it('should display address', () => {
    const result = AtomWithTrustTriple(baseAtomWithTripleProps);
    const rendered = renderToString(result);

    expect(rendered).toContain('Address');
    expect(rendered).toContain(TEST_ADDRESS);
  });

  it('should display alias when present', () => {
    const result = AtomWithTrustTriple({
      ...baseAtomWithTripleProps,
      alias: 'Satoshi',
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('Alias');
    expect(rendered).toContain('Satoshi');
  });

  it('should display trust tier with FOR and AGAINST counts', () => {
    const result = AtomWithTrustTriple(baseAtomWithTripleProps);
    const rendered = renderToString(result);

    // mockTriple: 2.5 FOR / 0.75 AGAINST = 77% ratio → Red tier
    expect(rendered).toContain('Community Concern');
    expect(rendered).toContain('2 FOR');
    expect(rendered).toContain('1 AGAINST');
  });

  it('should display total market cap with currency symbol', () => {
    const result = AtomWithTrustTriple(baseAtomWithTripleProps);
    const rendered = renderToString(result);

    // Total is 3.25 TTRUST
    expect(rendered).toContain('3.25');
    expect(rendered).toContain('TTRUST');
  });

  it('should handle zero market cap gracefully', () => {
    const tripleWithZeroMarketCap: TripleWithPositions = {
      ...mockTriple,
      term: {
        vaults: [
          {
            term_id: mockTriple.term.vaults[0]!.term_id,
            market_cap: '0',
            position_count: mockTriple.term.vaults[0]!.position_count,
            curve_id: mockTriple.term.vaults[0]!.curve_id,
          },
        ],
      },
      counter_term: {
        vaults: [
          {
            term_id: mockTriple.counter_term.vaults[0]!.term_id,
            market_cap: '0',
            position_count: mockTriple.counter_term.vaults[0]!.position_count,
            curve_id: mockTriple.counter_term.vaults[0]!.curve_id,
          },
        ],
      },
    };

    const result = AtomWithTrustTriple({
      ...baseAtomWithTripleProps,
      triple: tripleWithZeroMarketCap,
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('No Stakes Yet');
    expect(rendered).toContain('No one has rated this yet');
  });

  it('should display alias when present', () => {
    const result = AtomWithTrustTriple({
      ...baseAtomWithTripleProps,
      alias: 'TestAlias',
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('Alias');
    expect(rendered).toContain('TestAlias');
  });

  it('should show alternate trust note when alternate data exists', () => {
    const result = AtomWithTrustTriple({
      ...baseAtomWithTripleProps,
      alternateTrustData: withAlternateTrustData,
    });
    const rendered = renderToString(result);

    expect(rendered).toContain('Also has data as a contract');
  });
});

// =============================================================================
// AlternateTrustNote Integration Tests
// =============================================================================

describe('AlternateTrustNote', () => {
  it('should show EOA note when alternate is not CAIP', () => {
    const noAtomProps = {
      accountType: AccountType.NoAtom as const,
      account: null,
      triple: null,
      address: TEST_ADDRESS,
      chainId: TEST_CHAIN_ID,
      alias: null,
      isContract: true,
      classification: contractClassification,
      alternateTrustData: {
        hasAlternateTrustData: true,
        alternateAtomId: '0xalternate',
        alternateMarketCap: '1000000000000000000',
        alternateIsCaip: false, // Plain address, so alternate is EOA
      },
    };

    const result = NoAtom(noAtomProps);
    const rendered = renderToString(result);

    expect(rendered).toContain('Also has data as wallet address');
  });

  it('should show contract note when alternate is CAIP', () => {
    const noAtomProps = {
      accountType: AccountType.NoAtom as const,
      account: null,
      triple: null,
      address: TEST_ADDRESS,
      chainId: TEST_CHAIN_ID,
      alias: null,
      isContract: false,
      classification: baseClassification,
      alternateTrustData: {
        hasAlternateTrustData: true,
        alternateAtomId: '0xalternate',
        alternateMarketCap: '1000000000000000000',
        alternateIsCaip: true, // CAIP address, so alternate is contract
      },
    };

    const result = NoAtom(noAtomProps);
    const rendered = renderToString(result);

    expect(rendered).toContain('Also has data as a contract');
  });
});

// =============================================================================
// Component Structure Tests
// =============================================================================

describe('Component Structure', () => {
  it('NoAtom should return valid JSX element', () => {
    const result = NoAtom({
      accountType: AccountType.NoAtom as const,
      account: null,
      triple: null,
      address: TEST_ADDRESS,
      chainId: TEST_CHAIN_ID,
      alias: null,
      isContract: false,
      classification: baseClassification,
      alternateTrustData: noAlternateTrustData,
    });

    expect(result).toBeDefined();
    expect(result.type).toBe('Section');
    expect(result.props).toBeDefined();
  });

  it('AtomWithoutTrustTriple should return valid JSX element', () => {
    const result = AtomWithoutTrustTriple({
      accountType: AccountType.AtomWithoutTrustTriple as const,
      account: mockAccount,
      triple: null,
      address: TEST_ADDRESS,
      chainId: TEST_CHAIN_ID,
      alias: null,
      isContract: false,
      classification: baseClassification,
      alternateTrustData: noAlternateTrustData,
    });

    expect(result).toBeDefined();
    expect(result.type).toBe('Section');
    expect(result.props).toBeDefined();
  });

  it('AtomWithTrustTriple should return valid JSX element', () => {
    const result = AtomWithTrustTriple({
      accountType: AccountType.AtomWithTrustTriple as const,
      account: mockAccount,
      triple: mockTriple,
      address: TEST_ADDRESS,
      chainId: TEST_CHAIN_ID,
      alias: null,
      isContract: false,
      classification: baseClassification,
      alternateTrustData: noAlternateTrustData,
    });

    expect(result).toBeDefined();
    expect(result.type).toBe('Section');
    expect(result.props).toBeDefined();
  });
});



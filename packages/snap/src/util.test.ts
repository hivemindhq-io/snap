/**
 * Unit tests for origin-suppression and first-party extension detection.
 *
 * These are pure functions (no network / no snap worker), so they are tested
 * directly rather than through `installSnap`.
 */

import { expect, describe, it } from '@jest/globals';

import { FIRST_PARTY_EXTENSION_IDS } from './config';
import {
  isExtensionOrigin,
  isFirstPartyExtensionOrigin,
  shouldSuppressOrigin,
} from './util';

const FIRST_PARTY_ID = FIRST_PARTY_EXTENSION_IDS[0];
const THIRD_PARTY_ID = 'oiakpihdlanleljppfdcghbbchokkdfl';

describe('isExtensionOrigin', () => {
  it('returns true for chrome-extension origins', () => {
    expect(
      isExtensionOrigin(`chrome-extension://${THIRD_PARTY_ID}/page.html`),
    ).toBe(true);
  });

  it('returns true for moz-extension origins', () => {
    expect(isExtensionOrigin(`moz-extension://${THIRD_PARTY_ID}/`)).toBe(true);
  });

  it('returns false for regular https dApp origins', () => {
    expect(isExtensionOrigin('https://app.uniswap.org')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isExtensionOrigin(undefined)).toBe(false);
  });
});

describe('isFirstPartyExtensionOrigin', () => {
  it('returns true only for our own extension ID', () => {
    expect(
      isFirstPartyExtensionOrigin(
        `chrome-extension://${FIRST_PARTY_ID}/index.html`,
      ),
    ).toBe(true);
  });

  it('returns false for a third-party extension', () => {
    expect(
      isFirstPartyExtensionOrigin(
        `chrome-extension://${THIRD_PARTY_ID}/index.html`,
      ),
    ).toBe(false);
  });

  it('returns false for a regular dApp origin', () => {
    expect(isFirstPartyExtensionOrigin('https://app.uniswap.org')).toBe(false);
  });
});

describe('shouldSuppressOrigin', () => {
  it('suppresses any browser-extension origin (third-party)', () => {
    expect(
      shouldSuppressOrigin(
        `chrome-extension://${THIRD_PARTY_ID}/page.html`,
        THIRD_PARTY_ID,
      ),
    ).toBe(true);
  });

  it('suppresses our own first-party extension origin', () => {
    expect(
      shouldSuppressOrigin(
        `chrome-extension://${FIRST_PARTY_ID}/index.html`,
        FIRST_PARTY_ID,
      ),
    ).toBe(true);
  });

  it('suppresses metamask and localhost', () => {
    expect(shouldSuppressOrigin('metamask')).toBe(true);
    expect(shouldSuppressOrigin('http://localhost:8080', 'localhost')).toBe(
      true,
    );
  });

  it('suppresses missing origins', () => {
    expect(shouldSuppressOrigin(undefined)).toBe(true);
  });

  it('does NOT suppress a real third-party dApp', () => {
    expect(
      shouldSuppressOrigin('https://app.uniswap.org', 'app.uniswap.org'),
    ).toBe(false);
  });
});

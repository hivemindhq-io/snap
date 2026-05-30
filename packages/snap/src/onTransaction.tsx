import type {
  ChainId,
  OnTransactionHandler,
  Transaction,
} from '@metamask/snaps-sdk';
import { Box } from '@metamask/snaps-sdk/jsx';

import { getAccountData, getAccountType, renderOnTransaction } from './account';
import { getOriginData, getOriginType, renderOriginInsight } from './origin';
import {
  AccountType,
  AccountProps,
  OriginType,
  OriginProps,
} from './types';
import { UnifiedFooter, renderSafetyInsight, renderNetworkInsight } from './components';
import {
  getTrustedCircle,
  getTrustedContactsWithPositions,
  enrichContactLabels,
  getNetworkFamiliarity,
  getExtendedNetwork,
  indexExtendedNetwork,
  TrustedCirclePositions,
  NetworkFamiliarity,
} from './trusted-circle';
import { EXTENDED_NETWORK_ENABLED } from './config';
import { getClaimTemplates } from './claim-templates';
import { getPublisherWhitelist } from './publisher-whitelist';
import { getSafetyData } from './safety';
import type { SafetyData } from './safety';
import { shouldSuppressOrigin } from './util';

export const onTransaction: OnTransactionHandler = async ({
  transaction,
  chainId,
  transactionOrigin,
}: {
  transaction: Transaction;
  chainId: ChainId;
  transactionOrigin?: string;
}) => {

  // "to" ENS addresses arrive here as EVM addresses, EVM addresses arrive as EVM addresses
  const userAddress: string | undefined = transaction.from;

  const [
    accountData,
    originData,
    trustedCircle,
    claimTemplates,
    publisherWhitelist,
  ] = await Promise.all([
    getAccountData(transaction, chainId, userAddress),
    getOriginData(transactionOrigin, userAddress),
    userAddress ? getTrustedCircle(userAddress) : Promise.resolve([]),
    // Claim-template registry: predicate/object term IDs the safety read
    // surface resolves against. Falls back to chainConfig constants internally.
    getClaimTemplates(),
    // Publisher whitelist: authority accounts whose hard reports surface
    // globally. Falls back to an empty whitelist internally.
    getPublisherWhitelist(),
  ]);

  const accountType = getAccountType(accountData);
  const originType = getOriginType(originData, transactionOrigin);

  // Derive the 2-hop "extended network" off the resolved 1-hop circle (cached;
  // one batched round-trip on cold start, ~0 in steady state). Seeds are the
  // viewer's follows ONLY — never the whitelist. Gated by EXTENDED_NETWORK_ENABLED.
  const extendedNetwork =
    EXTENDED_NETWORK_ENABLED && userAddress && trustedCircle.length > 0
      ? await getExtendedNetwork(userAddress, trustedCircle)
      : { contacts: [] };
  const extendedIndex = indexExtendedNetwork(extendedNetwork);

  // Calculate trusted circle positions for account trust triple
  let accountTrustedCircle: TrustedCirclePositions | undefined;
  if (trustedCircle.length > 0 && accountData.triple) {
    const positions = accountData.triple.positions || [];
    const counterPositions = accountData.triple.counter_positions || [];

    accountTrustedCircle = getTrustedContactsWithPositions(
      trustedCircle,
      positions,
      counterPositions,
      userAddress,
    );
    // Only include if there are contacts with positions
    if (
      accountTrustedCircle.forContacts.length === 0 &&
      accountTrustedCircle.againstContacts.length === 0
    ) {
      accountTrustedCircle = undefined;
    } else {
      // Enrich with resolved labels (ENS names, etc.)
      accountTrustedCircle = await enrichContactLabels(accountTrustedCircle);
    }
  }

  // Calculate network familiarity (trusted contacts with ANY claim about this address)
  let accountNetworkFamiliarity: NetworkFamiliarity | undefined;
  if (trustedCircle.length > 0 && accountData.account) {
    // Build set of account IDs already shown in TrustedCircle section for de-duplication
    const alreadyDisplayedIds = new Set<string>();
    if (accountTrustedCircle) {
      for (const c of accountTrustedCircle.forContacts) {
        alreadyDisplayedIds.add(c.accountId.toLowerCase());
      }
      for (const c of accountTrustedCircle.againstContacts) {
        alreadyDisplayedIds.add(c.accountId.toLowerCase());
      }
    }

    accountNetworkFamiliarity = await getNetworkFamiliarity(
      accountData.account.term_id,
      trustedCircle,
      alreadyDisplayedIds,
      userAddress,
      EXTENDED_NETWORK_ENABLED ? extendedIndex : undefined,
    );
  }

  // Compute the safety read surface (critical reports, soft flags, provenance).
  // Resolves predicate/object term IDs from the claim-template registry and
  // gates signals by the publisher whitelist + the user's trust circle.
  let accountSafety: SafetyData | undefined;
  if (accountData.account) {
    accountSafety = await getSafetyData(accountData.account.term_id, {
      registry: claimTemplates,
      trustedCircle,
      whitelist: publisherWhitelist,
      userAddress,
      isContract: accountData.isContract,
      extendedIndex: EXTENDED_NETWORK_ENABLED ? extendedIndex : undefined,
    });
  }

  // Calculate trusted circle positions for origin trust triple
  let originTrustedCircle: TrustedCirclePositions | undefined;
  if (trustedCircle.length > 0 && originData.triple) {
    const positions = originData.triple.positions || [];
    const counterPositions = originData.triple.counter_positions || [];
    originTrustedCircle = getTrustedContactsWithPositions(
      trustedCircle,
      positions,
      counterPositions,
      userAddress,
    );
    // Only include if there are contacts with positions
    if (
      originTrustedCircle.forContacts.length === 0 &&
      originTrustedCircle.againstContacts.length === 0
    ) {
      originTrustedCircle = undefined;
    } else {
      // Enrich with resolved labels (ENS names, etc.)
      originTrustedCircle = await enrichContactLabels(originTrustedCircle);
    }
  }

  // Create properly typed props based on account type
  const accountProps: AccountProps = {
    ...accountData,
    accountType,
    address: transaction.to,
    userAddress,
    chainId,
    transactionOrigin,
    trustedCircle: accountTrustedCircle,
    networkFamiliarity: accountNetworkFamiliarity,
    safety: accountSafety,
  } as AccountProps; // Type assertion needed due to the discriminated union

  // Create origin props
  const originProps: OriginProps = {
    ...originData,
    originType,
    originUrl: transactionOrigin,
    trustedCircle: originTrustedCircle,
  } as OriginProps; // Type assertion needed due to the discriminated union

  // Render the safety read surface (critical reports, soft flags, provenance).
  // Rendered ABOVE the existing insight sections so safety overrides reputation.
  const safetyUI = renderSafetyInsight(accountSafety);

  // Render the standalone "Your network" surface: 1-hop "Also Familiar" plus a
  // SEPARATE degree-2 "Extended Network" subsection. The legacy account card
  // that used to host familiarity is hidden, so this is its visible home.
  const networkUI = renderNetworkInsight(accountNetworkFamiliarity);

  // Render both account and origin insights (information sections only)
  // LEGACY-HIDDEN (Destination card): the account/destination insight (address,
  // positions, market cap, trust stats) is legacy. We're shifting focus to WHO
  // made claims rather than position/market-cap specifics. Hidden for now.
  // To restore: `const accountUI = renderOnTransaction(accountProps);`
  const accountUI = null;
  void renderOnTransaction; // retained import; remove this once we delete the card for good
  let originUI = null;
  if (!shouldSuppressOrigin(originProps?.originUrl, originProps?.hostname)) {
    originUI = renderOriginInsight(originProps);
  }

  // Render unified footer with all CTAs at the bottom
  const footerUI = (
    <UnifiedFooter
      accountProps={accountProps}
      originProps={originProps}
    />
  );

  // Combine into final UI: safety surface first (above all existing elements),
  // then info sections, then all CTAs at bottom.
  const initialUI = (
    <Box>
      {safetyUI}
      {networkUI}
      {accountUI}
      {originUI}
      {footerUI}
    </Box>
  );

  // The transaction insight has no interactive elements, so we return the
  // content directly instead of creating a managed interface.
  return {
    content: initialUI,
  };
};

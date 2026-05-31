import type {
  ChainId,
  OnTransactionHandler,
  Transaction,
} from '@metamask/snaps-sdk';

import { getAccountData, getAccountType, renderOnTransaction } from './account';
import { getOriginData, getOriginType } from './origin';
import {
  AccountProps,
  OriginProps,
} from './types';
import type { InsightModel } from './insight-view';
import {
  hasMoreInfo,
  buildPrimaryInsight,
  jsonClone,
  toInterfaceContext,
} from './insight-view';
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

  // Compute the safety read surface FIRST (critical reports, soft flags,
  // provenance). Resolves predicate/object term IDs from the claim-template
  // registry and gates signals by the publisher whitelist + the user's trust
  // circle. Computed before familiarity so the term_ids it surfaces can be
  // excluded from the familiarity section (Opt 3 dedup — one home per claim).
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

  // Collect the triple term_ids already surfaced by the safety lane (critical +
  // warnings + provenance). These claims have their home in the safety section,
  // so they are excluded from the familiarity section below.
  const safetyTermIds = new Set<string>();
  if (accountSafety) {
    for (const signal of [
      ...accountSafety.critical,
      ...accountSafety.warnings,
      ...accountSafety.provenance,
    ]) {
      safetyTermIds.add(signal.termId);
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
      safetyTermIds,
    );
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

  // LEGACY-HIDDEN (Destination card): the account/destination insight (address,
  // positions, market cap, trust stats) is legacy. We're shifting focus to WHO
  // made claims rather than position/market-cap specifics. Hidden for now.
  // To restore: render `renderOnTransaction(accountProps)` in the primary view.
  void renderOnTransaction; // retained import; remove this once we delete the card for good

  const suppressOrigin = shouldSuppressOrigin(
    originProps?.originUrl,
    originProps?.hostname,
  );

  // Build the serializable model that drives both the primary insight and the
  // interactive "More info" page. The nested `safety`/`networkFamiliarity` on
  // `accountProps` are dropped first (the model carries each payload exactly
  // once); JSON-cloning then guarantees a plain `Json` structure (drops
  // `undefined`/functions/Sets/Maps) before it enters the interface context.
  const {
    safety: _droppedSafety,
    networkFamiliarity: _droppedFamiliarity,
    ...footerAccountProps
  } = accountProps;
  const model: InsightModel = jsonClone({
    safety: accountSafety ?? null,
    familiarity: accountNetworkFamiliarity ?? null,
    accountProps: footerAccountProps as AccountProps,
    originProps,
    suppressOrigin,
  });

  // When there is content to expand (2nd-degree signals or a dApp origin
  // insight), return an interactive interface so the user can navigate to the
  // "More info" page. Otherwise return static content (no button rendered).
  if (hasMoreInfo(model)) {
    const id = await snap.request({
      method: 'snap_createInterface',
      params: {
        ui: buildPrimaryInsight(model),
        context: toInterfaceContext(model),
      },
    });
    return { id };
  }

  return { content: buildPrimaryInsight(model) };
};

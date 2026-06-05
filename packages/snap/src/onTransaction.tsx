import type {
  ChainId,
  OnTransactionHandler,
  Transaction,
} from '@metamask/snaps-sdk';

import { getAccountData, getAccountType } from './account';
import { getClaimTemplates } from './claim-templates';
import { EXTENDED_NETWORK_ENABLED } from './config';
import {
  hasMoreInfo,
  buildPrimaryInsight,
  jsonClone,
  toInterfaceContext,
} from './insight-view';
import type { InsightModel } from './insight-view';
import { getOriginData, getOriginType } from './origin';
import { getPublisherWhitelist } from './publisher-whitelist';
import { getSafetyData } from './safety';
import type { SafetyData } from './safety';
import {
  getTrustedCircle,
  getNetworkFamiliarity,
  getExtendedNetwork,
  indexExtendedNetwork,
} from './trusted-circle';
import type { NetworkFamiliarity } from './trusted-circle';
import type { AccountProps, OriginProps } from './types';
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
    getOriginData(transactionOrigin),
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

  // Calculate network familiarity (trusted contacts with ANY claim about this
  // address). The `has tag → trustworthy` triple is no longer special-cased —
  // it surfaces here as a regular claim like any other.
  let accountNetworkFamiliarity: NetworkFamiliarity | undefined;
  if (trustedCircle.length > 0 && accountData.account) {
    accountNetworkFamiliarity = await getNetworkFamiliarity(
      accountData.account.term_id,
      trustedCircle,
      new Set<string>(),
      userAddress,
      EXTENDED_NETWORK_ENABLED ? extendedIndex : undefined,
      safetyTermIds,
    );
  }

  // Whether the dApp-origin surface is suppressed (no origin, MetaMask, or a
  // localhost/dev URL). Computed here so origin safety/familiarity work can be
  // skipped entirely when there is nothing to show.
  const suppressOrigin = shouldSuppressOrigin(
    transactionOrigin,
    originData.hostname,
  );

  // Origin (dApp) safety read surface — same pipeline as the destination
  // address, scoped to the URL/site claim vocabulary (entity 'site'). Hard
  // reports (phishing / drainer / scam) are critical-worthy; the soft tag
  // (impersonation) is a warning. Positives are NOT safety — they surface via
  // origin familiarity below, mirroring how the address treats `trustworthy`.
  let originSafety: SafetyData | undefined;
  if (originData.origin && !suppressOrigin) {
    originSafety = await getSafetyData(originData.origin.term_id, {
      registry: claimTemplates,
      trustedCircle,
      whitelist: publisherWhitelist,
      userAddress,
      entity: 'site',
      extendedIndex: EXTENDED_NETWORK_ENABLED ? extendedIndex : undefined,
    });
  }

  // Term IDs already surfaced by the origin safety lane — excluded from the
  // origin familiarity section so each claim has exactly one home.
  const originSafetyTermIds = new Set<string>();
  if (originSafety) {
    for (const signal of [
      ...originSafety.critical,
      ...originSafety.warnings,
      ...originSafety.provenance,
    ]) {
      originSafetyTermIds.add(signal.termId);
    }
  }

  // Origin familiarity — trusted contacts (1-hop + 2-hop) with ANY claim about
  // the dApp atom, with the safety-surfaced claims excluded.
  let originNetworkFamiliarity: NetworkFamiliarity | undefined;
  if (trustedCircle.length > 0 && originData.origin && !suppressOrigin) {
    originNetworkFamiliarity = await getNetworkFamiliarity(
      originData.origin.term_id,
      trustedCircle,
      new Set<string>(),
      userAddress,
      EXTENDED_NETWORK_ENABLED ? extendedIndex : undefined,
      originSafetyTermIds,
    );
  }

  // Create properly typed props based on account type
  const accountProps: AccountProps = {
    ...accountData,
    accountType,
    address: transaction.to,
    userAddress,
    chainId,
    transactionOrigin,
    // The account-level "Your Trust Circle" FOR/AGAINST block (driven by the
    // `has tag → trustworthy` triple) is no longer surfaced; that signal now
    // flows through network familiarity as a regular claim. `trustedCircle` is
    // intentionally omitted here (optional on AccountProps).
    networkFamiliarity: accountNetworkFamiliarity,
    safety: accountSafety,
  } as AccountProps; // Type assertion needed due to the discriminated union

  // Create origin props
  const originProps: OriginProps = {
    ...originData,
    originType,
    originUrl: transactionOrigin,
  } as OriginProps; // Type assertion needed due to the discriminated union

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
    originSafety: originSafety ?? null,
    originFamiliarity: originNetworkFamiliarity ?? null,
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

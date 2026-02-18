import type {
  ChainId,
  OnTransactionHandler,
  Transaction,
  Json,
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
import { UnifiedFooter } from './components';
import {
  getTrustedCircle,
  getTrustedContactsWithPositions,
  enrichContactLabels,
  TrustedCirclePositions,
} from './trusted-circle';

/** Combined context for both account and origin data */
type TransactionContext = {
  account: AccountProps;
  origin: OriginProps;
};

/**
 * Converts props to a JSON-serializable context object.
 * MetaMask Snap context must be Record<string, Json> which doesn't allow undefined.
 * This function converts undefined values to null for JSON compatibility.
 */
const toSerializableContext = (context: TransactionContext): Record<string, Json> => {
  // JSON.parse(JSON.stringify()) handles the conversion cleanly:
  // - undefined values are stripped from objects
  // - null remains null
  // - All other values are preserved
  return JSON.parse(JSON.stringify(context)) as Record<string, Json>;
};

export const onTransaction: OnTransactionHandler = async ({
  transaction,
  chainId,
  transactionOrigin,
}: {
  transaction: Transaction;
  chainId: ChainId;
  transactionOrigin?: string;
}) => {

  console.log('transactionOrigin', transactionOrigin);
  // "to" ENS addresses arrive here as EVM addresses, EVM addresses arrive as EVM addresses
  const userAddress: string | undefined = transaction.from;

  const [accountData, originData, trustedCircle] = await Promise.all([
    getAccountData(transaction, chainId, userAddress),
    getOriginData(transactionOrigin, userAddress),
    userAddress ? getTrustedCircle(userAddress) : Promise.resolve([]),
  ]);

  const accountType = getAccountType(accountData);
  const originType = getOriginType(originData, transactionOrigin);

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
  } as AccountProps; // Type assertion needed due to the discriminated union

  // Create origin props
  const originProps: OriginProps = {
    ...originData,
    originType,
    originUrl: transactionOrigin,
    trustedCircle: originTrustedCircle,
  } as OriginProps; // Type assertion needed due to the discriminated union

  // Render both account and origin insights (information sections only)
  const accountUI = renderOnTransaction(accountProps);
  // only render origin if originProps.originUrl !== 'metamask'
  let originUI = null;
  if (originProps?.originUrl !== 'metamask') {
    originUI = renderOriginInsight(originProps);
  }

  // Render unified footer with all CTAs at the bottom
  const footerUI = (
    <UnifiedFooter accountProps={accountProps} originProps={originProps} />
  );

  // Combine into final UI: info sections first, then all CTAs at bottom
  const initialUI = (
    <Box>
      {accountUI}
      {originUI}
      {footerUI}
    </Box>
  );

  // Convert props to JSON-serializable context (strips undefined values)
  const context = toSerializableContext({
    account: accountProps,
    origin: originProps,
  });

  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: initialUI,
      context,
    },
  });
  return {
    id: interfaceId,
  };
};

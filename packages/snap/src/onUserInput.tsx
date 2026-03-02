import type { OnUserInputHandler } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { Box, Heading, Text, Button } from '@metamask/snaps-sdk/jsx';
import type { AccountProps, OriginProps } from './types';
import type { FeatureConfig } from './feature-config';
import { renderOnTransaction } from './account';
import { renderOriginInsight } from './origin';
import { UnifiedFooter, AISummaryLoading, AISummaryView, AISummaryError } from './components';
import { chainConfig } from './config';
import { shouldSuppressOrigin } from './util';

/** Shape of the context object passed from onTransaction via snap_createInterface */
type TransactionContext = {
  account: AccountProps;
  origin: OriginProps;
  featureConfig: FeatureConfig;
  aiAllowed: boolean;
};

const SUMMARY_TIMEOUT_MS = 30_000;

/**
 * Fetches an AI-generated summary from the hivemind-api for a given term.
 * Aborts automatically after 30 seconds.
 *
 * @param term - The search term (address, domain, label)
 * @param termType - Optional type hint for the summary service
 * @returns The summary response object
 */
const fetchAISummary = async (
  term: string,
  termType?: string,
): Promise<{ success: boolean; summary?: string; error?: string }> => {
  const baseUrl = chainConfig.hivemindApiUrl;
  const params = new URLSearchParams({ term });
  if (termType) {
    params.set('termType', termType);
  }

  const url = `${baseUrl}/summary?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.json();
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Rebuilds the original transaction insight UI from context data.
 * Used by the "Back" button to restore the view without re-fetching.
 *
 * @param context - The serialized TransactionContext from snap_createInterface
 * @returns JSX element representing the original transaction insight
 */
const rebuildOriginalUI = (context: TransactionContext) => {
  const accountProps = context.account;
  const originProps = context.origin;
  const featureConfig = context.featureConfig;
  const aiAllowed = context.aiAllowed ?? false;

  const accountUI = renderOnTransaction(accountProps);

  let originUI = null;
  if (!shouldSuppressOrigin(originProps?.originUrl, originProps?.hostname)) {
    originUI = renderOriginInsight(originProps);
  }

  const footerUI = (
    <UnifiedFooter
      accountProps={accountProps}
      originProps={originProps}
      featureConfig={featureConfig}
      aiAllowed={aiAllowed}
    />
  );

  return (
    <Box>
      {accountUI}
      {originUI}
      {footerUI}
    </Box>
  );
};

export const onUserInput: OnUserInputHandler = async ({ id, event, context }) => {
  console.log('KYLAN | onUserInput called', JSON.stringify({ id, event, context }, null, 2));
  if (event.type !== UserInputEventType.ButtonClickEvent) {
    return;
  }

  const txContext = context as unknown as TransactionContext;

  if (event.name === 'ai_summary') {
    // Defense-in-depth: re-check that AI is allowed via the context snapshot.
    // The button should be hidden when AI is disabled, but if the config
    // was updated between render and click, this prevents execution.
    if (!txContext?.aiAllowed) {
      return;
    }

    const address = txContext?.account?.address;
    if (!address) {
      return;
    }

    const label = txContext.account.account?.label || address;

    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: <AISummaryLoading label={label} />,
      },
    });

    try {
      const result = await fetchAISummary(address, 'address');

      if (result.success && result.summary) {
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: <AISummaryView summary={result.summary} label={label} />,
          },
        });
      } else {
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: (
              <AISummaryError
                error={result.error || 'No summary available for this address.'}
              />
            ),
          },
        });
      }
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const message = isTimeout
        ? 'The request timed out. Please try again later.'
        : 'Failed to connect to summary service.';

      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: <AISummaryError error={message} />,
        },
      });
    }
  } else if (event.name === 'back') {
    if (!txContext) {
      return;
    }

    const originalUI = rebuildOriginalUI(txContext);

    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: originalUI,
      },
    });
  } else if (event.name === 'test_create_session') {
    console.log('KYLAN | test_create_session called');
    const chainScope = `eip155:${chainConfig.chainId}`;
    console.log('KYLAN | chainScope', chainScope);
    try {
      console.log('KYLAN | calling wallet_createSession');
      const session = await (snap.request as any)({
        method: 'wallet_createSession',
        params: {
          optionalScopes: {
            [chainScope]: {
              methods: ['eth_sendTransaction', 'eth_getBalance', 'eth_chainId'],
              notifications: [],
              accounts: [],
            },
          },
        },
      });
      console.log('KYLAN | session', JSON.stringify(session, null, 2));
      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: (
            <Box>
              <Heading>Session Created</Heading>
              <Text>Scope: {chainScope}</Text>
              <Text>Result: {JSON.stringify(session).slice(0, 500)}</Text>
              <Button name="test_send_tx">Step 2: Send Transaction</Button>
            </Box>
          ),
        },
      });
      console.log('KYLAN | test_create_session updated interface');
    } catch (err: any) {
      console.log('KYLAN | test_create_session failed', JSON.stringify({ err }, null, 2));
      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: (
            <Box>
              <Heading>Session Failed</Heading>
              <Text>{String(err?.message || err)}</Text>
            </Box>
          ),
        },
      });
      console.log('KYLAN | test_create_session updated interface failed');
    }
  } else if (event.name === 'test_send_tx') {
    const chainScope = `eip155:${chainConfig.chainId}`;
    try {
      const session = await (snap.request as any)({ method: 'wallet_getSession' });
      const accounts = session.sessionScopes[chainScope]?.accounts ?? [];
      // accounts[0] is like "eip155:1155:0xAbC123..."
      const from = accounts[0]?.split(':').pop();

      const params = [{
        from,
        to: '0xCF806BacAFBbcf09959B1866b5c1479fbEF97e05',
        value: '0x0',
        data: '0x',
      }];
      console.log('KYLAN | test_send_tx calling wallet_invokeMethod', JSON.stringify({ params }, null, 2));
      const result = await (snap.request as any)({
        method: 'wallet_invokeMethod',
        params: {
          scope: chainScope,
          request: {
            method: 'eth_sendTransaction',
            params,
          },
        },
      });

      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: (
            <Box>
              <Heading>Transaction Sent</Heading>
              <Text>TX Hash: {String(result)}</Text>
            </Box>
          ),
        },
      });
    } catch (err: any) {
      console.log('KYLAN | test_send_tx failed', { err });
      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: (
            <Box>
              <Heading>Transaction Failed</Heading>
              <Text>{String(err?.message || err)}</Text>
            </Box>
          ),
        },
      });
    }
  }
};

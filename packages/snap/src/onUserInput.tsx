import type { OnUserInputHandler } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { Box } from '@metamask/snaps-sdk/jsx';
import type { AccountProps, OriginProps } from './types';
import { renderOnTransaction } from './account';
import { renderOriginInsight } from './origin';
import { UnifiedFooter, AISummaryLoading, AISummaryView, AISummaryError } from './components';
import { chainConfig } from './config';

/** Shape of the context object passed from onTransaction via snap_createInterface */
type TransactionContext = {
  account: AccountProps;
  origin: OriginProps;
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

  const accountUI = renderOnTransaction(accountProps);

  let originUI = null;
  if (originProps?.originUrl !== 'metamask') {
    originUI = renderOriginInsight(originProps);
  }

  const footerUI = (
    <UnifiedFooter accountProps={accountProps} originProps={originProps} />
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
  if (event.type !== UserInputEventType.ButtonClickEvent) {
    return;
  }

  const txContext = context as unknown as TransactionContext;

  if (event.name === 'ai_summary') {
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
  }
};

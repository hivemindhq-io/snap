import type { OnUserInputHandler } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { Box, Heading, Text, Button, Form, Field, Input } from '@metamask/snaps-sdk/jsx';
import { Interface, parseUnits } from 'ethers';
import type { AccountProps, OriginProps } from './types';
import { AccountType } from './types';
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

/** Temporary staking state persisted across button clicks via snap_manageState */
type StakingState = {
  direction: 'for' | 'against';
  termId: string;
};

const SUMMARY_TIMEOUT_MS = 30_000;

const DEPOSIT_IFACE = new Interface([
  'function deposit(address receiver, bytes32 termId, uint256 curveId, uint256 minShares) payable returns (uint256)',
]);

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

// ─── Staking helpers ──────────────────────────────────────────────────────────

/**
 * Persists staking direction/termId so subsequent button clicks can read it.
 */
const saveStakingState = async (state: StakingState) => {
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: { staking: state }, encrypted: false },
  });
};

/** Reads the staking state saved by a previous step. */
const getStakingState = async (): Promise<StakingState | null> => {
  const state = await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get', encrypted: false },
  });
  return (state as any)?.staking ?? null;
};

/** Clears the temporary staking state after completion or cancellation. */
const clearStakingState = async () => {
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: {}, encrypted: false },
  });
};

/**
 * Retrieves the user's address from the multichain session for the Intuition chain.
 * Returns null if no session or no accounts exist.
 */
const getSessionAccount = async (): Promise<string | null> => {
  const chainScope = `eip155:${chainConfig.chainId}`;
  const session = await (snap.request as any)({ method: 'wallet_getSession' });
  const accounts: string[] = session?.sessionScopes?.[chainScope]?.accounts ?? [];
  if (accounts.length === 0) return null;
  return accounts[0]!.split(':').pop() ?? null;
};

/**
 * Encodes a depositTriple transaction and sends it via wallet_invokeMethod.
 *
 * @param fromAddress - The sender/receiver address (user gets the shares)
 * @param termId - The triple vault term_id (bytes32)
 * @param amountWei - The TRUST amount in Wei (bigint)
 * @returns Transaction hash string
 */
const executeDeposit = async (
  fromAddress: string,
  termId: string,
  amountWei: bigint,
): Promise<string> => {
  const data = DEPOSIT_IFACE.encodeFunctionData('deposit', [
    fromAddress,
    termId,
    1,
    0,
  ]);

  const chainScope = `eip155:${chainConfig.chainId}`;
  const result = await (snap.request as any)({
    method: 'wallet_invokeMethod',
    params: {
      scope: chainScope,
      request: {
        method: 'eth_sendTransaction',
        params: [{
          from: fromAddress,
          to: chainConfig.multiVaultAddress,
          value: `0x${amountWei.toString(16)}`,
          data,
        }],
      },
    },
  });

  return String(result);
};

/** Shows the Trust / Distrust direction choice screen. */
const showDirectionUI = async (id: string) => {
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id,
      ui: (
        <Box>
          <Heading>Stake on this address</Heading>
          <Text>Do you trust or distrust this address?</Text>
          <Button name="stake_direction_for">Trust</Button>
          <Button name="stake_direction_against">Distrust</Button>
          <Button name="back">Back</Button>
        </Box>
      ),
    },
  });
};

/** Shows the amount selection screen (10 / 100 / 1000 / Custom). */
const showAmountUI = async (id: string, direction: 'for' | 'against') => {
  const label = direction === 'for' ? 'Trust' : 'Distrust';
  const symbol = chainConfig.currencySymbol;
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id,
      ui: (
        <Box>
          <Heading>Stake: {label}</Heading>
          <Text>Choose your stake amount:</Text>
          <Button name="stake_amount_10">10 {symbol}</Button>
          <Button name="stake_amount_100">100 {symbol}</Button>
          <Button name="stake_amount_1000">1000 {symbol}</Button>
          <Button name="stake_amount_custom">Custom amount</Button>
          <Button name="back">Back</Button>
        </Box>
      ),
    },
  });
};

/** Shows an error message with a Back button. */
const showErrorUI = async (id: string, title: string, message: string) => {
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id,
      ui: (
        <Box>
          <Heading>{title}</Heading>
          <Text>{message}</Text>
          <Button name="back">Back</Button>
        </Box>
      ),
    },
  });
};

/**
 * Executes a staking deposit for a given TRUST amount (in whole units),
 * updating the UI with pending/success/error states.
 */
const handleStakeExecution = async (id: string, trustAmount: number) => {
  const stakingState = await getStakingState();
  if (!stakingState) {
    await showErrorUI(id, 'Staking Error', 'No staking direction selected. Please start over.');
    return;
  }

  const fromAddress = await getSessionAccount();
  if (!fromAddress) {
    await showErrorUI(id, 'Session Lost', 'Your wallet session has expired. Please go back and try again.');
    return;
  }

  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id,
      ui: (
        <Box>
          <Heading>Sending Transaction...</Heading>
          <Text>Please confirm the transaction in MetaMask.</Text>
        </Box>
      ),
    },
  });

  try {
    const amountWei = parseUnits(String(trustAmount), 18);
    const txHash = await executeDeposit(fromAddress, stakingState.termId, amountWei);
    await clearStakingState();

    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: (
          <Box>
            <Heading>Stake Successful</Heading>
            <Text>Transaction: {txHash}</Text>
            <Button name="back">Back</Button>
          </Box>
        ),
      },
    });
  } catch (err: any) {
    await showErrorUI(id, 'Staking Failed', String(err?.message || err));
  }
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export const onUserInput: OnUserInputHandler = async ({ id, event, context }) => {
  const txContext = context as unknown as TransactionContext;

  // ── Form submissions (custom stake amount) ──────────────────────────────
  if (event.type === UserInputEventType.FormSubmitEvent) {
    if (event.name === 'stake_custom_form') {
      const rawValue = (event as any).value?.custom_amount;
      const amount = Number(rawValue);
      if (!rawValue || isNaN(amount) || amount <= 0) {
        await showErrorUI(id, 'Invalid Amount', 'Please enter a number greater than 0.');
        return;
      }
      await handleStakeExecution(id, amount);
    }
    return;
  }

  // ── Button clicks ───────────────────────────────────────────────────────
  if (event.type !== UserInputEventType.ButtonClickEvent) {
    return;
  }

  // ── AI Summary ──────────────────────────────────────────────────────────
  if (event.name === 'ai_summary') {
    if (!txContext?.aiAllowed) return;
    const address = txContext?.account?.address;
    if (!address) return;

    const label = txContext.account.account?.label || address;

    await snap.request({
      method: 'snap_updateInterface',
      params: { id, ui: <AISummaryLoading label={label} /> },
    });

    try {
      const result = await fetchAISummary(address, 'address');
      if (result.success && result.summary) {
        await snap.request({
          method: 'snap_updateInterface',
          params: { id, ui: <AISummaryView summary={result.summary} label={label} /> },
        });
      } else {
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: <AISummaryError error={result.error || 'No summary available for this address.'} />,
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
        params: { id, ui: <AISummaryError error={message} /> },
      });
    }

  // ── Back (return to original insight) ───────────────────────────────────
  } else if (event.name === 'back') {
    await clearStakingState();
    if (!txContext) return;
    const originalUI = rebuildOriginalUI(txContext);
    await snap.request({
      method: 'snap_updateInterface',
      params: { id, ui: originalUI },
    });

  // ── Stake entry point: check session ────────────────────────────────────
  } else if (event.name === 'stake_on_triple') {
    if (txContext?.account?.accountType !== AccountType.AtomWithTrustTriple) return;

    const chainScope = `eip155:${chainConfig.chainId}`;
    const session = await (snap.request as any)({ method: 'wallet_getSession' });
    const accounts: string[] = session?.sessionScopes?.[chainScope]?.accounts ?? [];

    if (accounts.length === 0) {
      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: (
            <Box>
              <Heading>Create Wallet Session</Heading>
              <Text>
                To stake on-chain, you need to create a wallet session first.
                This grants the Snap permission to send transactions on your behalf.
              </Text>
              <Button name="create_session_for_staking">Create Session</Button>
              <Button name="back">Back</Button>
            </Box>
          ),
        },
      });
    } else {
      await showDirectionUI(id);
    }

  // ── Create session inline ───────────────────────────────────────────────
  } else if (event.name === 'create_session_for_staking') {
    const chainScope = `eip155:${chainConfig.chainId}`;
    try {
      await (snap.request as any)({
        method: 'wallet_createSession',
        params: {
          optionalScopes: {
            [chainScope]: {
              methods: ['eth_sendTransaction'],
              notifications: [],
              accounts: [],
            },
          },
        },
      });
      await showDirectionUI(id);
    } catch (err: any) {
      await showErrorUI(id, 'Session Creation Failed', String(err?.message || err));
    }

  // ── Direction: Trust (FOR) ──────────────────────────────────────────────
  } else if (event.name === 'stake_direction_for') {
    if (txContext?.account?.accountType !== AccountType.AtomWithTrustTriple) return;
    const termId = txContext.account.triple.term_id;
    await saveStakingState({ direction: 'for', termId });
    await showAmountUI(id, 'for');

  // ── Direction: Distrust (AGAINST) ───────────────────────────────────────
  } else if (event.name === 'stake_direction_against') {
    if (txContext?.account?.accountType !== AccountType.AtomWithTrustTriple) return;
    const termId = txContext.account.triple.counter_term_id;
    await saveStakingState({ direction: 'against', termId });
    await showAmountUI(id, 'against');

  // ── Preset amounts ──────────────────────────────────────────────────────
  } else if (event.name === 'stake_amount_10') {
    await handleStakeExecution(id, 10);
  } else if (event.name === 'stake_amount_100') {
    await handleStakeExecution(id, 100);
  } else if (event.name === 'stake_amount_1000') {
    await handleStakeExecution(id, 1000);

  // ── Custom amount: show input form ──────────────────────────────────────
  } else if (event.name === 'stake_amount_custom') {
    const symbol = chainConfig.currencySymbol;
    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: (
          <Box>
            <Heading>Custom Stake Amount</Heading>
            <Form name="stake_custom_form">
              <Field label={`Amount (${symbol})`}>
                <Input name="custom_amount" type="number" placeholder="e.g. 50" min={0} step={1} />
              </Field>
              <Button type="submit">Stake</Button>
            </Form>
            <Button name="back">Back</Button>
          </Box>
        ),
      },
    });
  }
};

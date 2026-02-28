/**
 * Native TRUST balance check via JSON-RPC.
 *
 * TRUST is the native gas token on the Intuition chain, so we use
 * eth_getBalance (not an ERC-20 balanceOf). This follows the same
 * RPC call pattern as classifyAddress in account.tsx.
 *
 * @module feature-config/balance
 */

import { chainConfig } from '../config';

/**
 * Fetches the native TRUST balance for an address via eth_getBalance.
 *
 * @param userAddress - The wallet address to check
 * @returns Balance in wei as bigint, or 0n on failure
 */
export async function getNativeBalance(userAddress: string): Promise<bigint> {
  try {
    const response = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [userAddress, 'latest'],
        id: 1,
      }),
    });

    if (!response.ok) {
      return 0n;
    }

    const data = await response.json();
    if (!data.result) {
      return 0n;
    }

    return BigInt(data.result);
  } catch {
    return 0n;
  }
}

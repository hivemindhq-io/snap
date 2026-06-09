/**
 * Public-claims (escape-hatch) lane service.
 *
 * Fetches the highest-staked claims about a subject atom — UNFILTERED by the
 * viewer's network — and shapes them into {@link PublicClaim}s with per-side
 * stake totals, distinct staker counts, and a `disputed` verdict. The fetch is
 * intentionally dependency-free (no cross-lane exclusion) so it can run in
 * parallel with the safety / familiarity / self queries in `onTransaction`; the
 * cross-lane dedup + sort + top-N happens afterward in the pure
 * {@link finalizePublicClaims}.
 *
 * Resolution of predicate keys prefers the live claim-template registry and
 * falls back to nothing (verbatim labels) when absent. The blacklist mirrors the
 * familiarity / self lanes: the live registry's `blacklistedTermIds` unioned with
 * the local offline seed.
 *
 * @module public-claims/service
 */

import type { ClaimTemplateRegistry } from '../claim-templates';
import {
  BLACKLISTED_TERM_IDS,
  PUBLIC_CLAIM_DISPUTE_RATIO_PERCENT,
  PUBLIC_CLAIMS_FETCH_LIMIT,
} from '../config';
import { graphQLQuery, getPublicClaimsAboutAtomQuery } from '../queries';
import { sumMarketCap, type CurveVault } from '../term-stats';
import type { PublicClaim, PublicClaims } from './types';

/**
 * Raw triple shape returned by {@link getPublicClaimsAboutAtomQuery}.
 */
type PublicClaimTriple = {
  term_id: string;
  predicate_id: string;
  object_id: string;
  predicate: { label: string } | null;
  object: { label: string } | null;
  term: { vaults: CurveVault[] } | null;
  counter_term: { vaults: CurveVault[] } | null;
  positions_aggregate: { aggregate: { count: number } | null } | null;
  counter_positions_aggregate: { aggregate: { count: number } | null } | null;
};

type PublicClaimsResponse = {
  data: {
    triples: PublicClaimTriple[];
    triples_aggregate: { aggregate: { count: number } | null } | null;
  };
};

/**
 * Whether a claim is disputed: its AGAINST stake is at least
 * PUBLIC_CLAIM_DISPUTE_RATIO_PERCENT of its FOR stake. BigInt-safe, no absolute
 * floor (deferred). `against > for` is naturally covered by the ratio.
 *
 * @param forWei - FOR stake, wei-scale BigInt string.
 * @param againstWei - AGAINST stake, wei-scale BigInt string.
 * @returns True when the claim is contested.
 */
function isDisputed(forWei: string, againstWei: string): boolean {
  let forVal = 0n;
  let againstVal = 0n;
  try {
    forVal = BigInt(forWei);
  } catch {
    forVal = 0n;
  }
  try {
    againstVal = BigInt(againstWei);
  } catch {
    againstVal = 0n;
  }
  // No opposition ⇒ never disputed (also avoids 0-FOR / 0-AGAINST edge noise).
  if (againstVal === 0n) {
    return false;
  }
  // againstWei * 100 >= forWei * RATIO  ⇔  against is ≥ RATIO% of for.
  return (
    againstVal * 100n >= forVal * BigInt(PUBLIC_CLAIM_DISPUTE_RATIO_PERCENT)
  );
}

/**
 * Fetches the raw public claims about a subject atom.
 *
 * Applies ONLY the blacklist (rogue/duplicate atoms) — NO cross-lane exclusion,
 * NO sort beyond what the server returns, and NO top-N — so it stays
 * dependency-free and can run in parallel with the other lanes. The displayed
 * slice is produced later by {@link finalizePublicClaims}.
 *
 * @param subjectAtomId - The term_id of the subject atom (address or origin).
 * @param registry - Optional claim-template registry for predicate-key phrasing
 * and the live blacklist.
 * @returns The raw public claims (post-blacklist) + the true aggregate total, or
 * undefined when there are no claims about the subject.
 */
export async function getPublicClaims(
  subjectAtomId: string,
  registry?: ClaimTemplateRegistry,
): Promise<PublicClaims | undefined> {
  let response: PublicClaimsResponse;
  try {
    response = (await graphQLQuery(getPublicClaimsAboutAtomQuery, {
      subjectId: subjectAtomId,
      limit: PUBLIC_CLAIMS_FETCH_LIMIT,
    })) as PublicClaimsResponse;
  } catch (error) {
    console.error('[PublicClaims] query failed:', error);
    return undefined;
  }

  const triples = response?.data?.triples ?? [];
  if (triples.length === 0) {
    return undefined;
  }

  // Reverse the registry's `key -> term_id` predicate map for first-class
  // phrasing, mirroring the familiarity / self lanes. Empty when absent.
  const predIdToKey = new Map<string, string>(
    registry
      ? Object.entries(registry.predicates).map(([key, id]) => [id, key])
      : [],
  );

  // Suppression set: live registry blacklist unioned with the offline seed.
  const blacklist = new Set<string>([
    ...(registry?.blacklistedTermIds ?? []),
    ...BLACKLISTED_TERM_IDS,
  ]);

  const claims: PublicClaim[] = [];
  for (const triple of triples) {
    // Suppress blacklisted (non-canonical / duplicate) atoms.
    if (
      blacklist.has(triple.predicate_id) ||
      blacklist.has(triple.object_id) ||
      blacklist.has(triple.term_id)
    ) {
      continue;
    }

    const forStake = sumMarketCap(triple.term?.vaults);
    const againstStake = sumMarketCap(triple.counter_term?.vaults);
    const forStakers = triple.positions_aggregate?.aggregate?.count ?? 0;
    const againstStakers =
      triple.counter_positions_aggregate?.aggregate?.count ?? 0;
    const predicateKey = predIdToKey.get(triple.predicate_id);

    claims.push({
      predicateLabel: triple.predicate?.label || 'unknown',
      objectLabel: triple.object?.label || 'unknown',
      termId: triple.term_id,
      forStake,
      againstStake,
      forStakers,
      againstStakers,
      disputed: isDisputed(forStake, againstStake),
      ...(predicateKey ? { predicateKey } : {}),
    });
  }

  if (claims.length === 0) {
    return undefined;
  }

  // True total claim count about the subject (independent of the fetch cap and
  // the blacklist), so "View all N" reflects the real graph total.
  const total =
    response?.data?.triples_aggregate?.aggregate?.count ?? claims.length;

  return { claims, total };
}

/**
 * Sums a claim's two-sided stake into a single comparable BigInt (FOR +
 * AGAINST), the weight used to rank the lane. Defensive against unparseable
 * wei strings.
 *
 * @param claim - The public claim.
 * @returns The combined stake as a BigInt.
 */
function totalStake(claim: PublicClaim): bigint {
  let sum = 0n;
  try {
    sum += BigInt(claim.forStake);
  } catch {
    // ignore
  }
  try {
    sum += BigInt(claim.againstStake);
  } catch {
    // ignore
  }
  return sum;
}

/**
 * Finalizes the displayed public-claims slice (PURE — no I/O).
 *
 * Drops claims whose `termId` is in `excludeTermIds` (the cross-lane dedup set:
 * claims already shown by the safety / familiarity / self lanes), sorts the
 * remainder by combined FOR+AGAINST stake desc, and caps to `topN`. `total` is
 * preserved from the raw payload so the "View all N" line always reflects the
 * true graph total — not the post-exclusion count.
 *
 * @param raw - The raw public claims (from {@link getPublicClaims}), or null.
 * @param excludeTermIds - Triple term_ids already surfaced by another lane.
 * @param topN - Max claims to display.
 * @returns The displayed slice + true total, or null when nothing remains.
 */
export function finalizePublicClaims(
  raw: PublicClaims | null | undefined,
  excludeTermIds: Set<string>,
  topN: number,
): PublicClaims | null {
  if (!raw || raw.claims.length === 0) {
    return null;
  }

  const remaining = raw.claims.filter(
    (claim) => !excludeTermIds.has(claim.termId),
  );
  if (remaining.length === 0) {
    return null;
  }

  remaining.sort((a, b) => {
    const diff = totalStake(b) - totalStake(a);
    if (diff > 0n) {
      return 1;
    }
    if (diff < 0n) {
      return -1;
    }
    return 0;
  });

  return {
    claims: remaining.slice(0, topN),
    total: raw.total,
  };
}

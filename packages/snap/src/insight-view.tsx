/**
 * Insight view builders for the interactive transaction-insight panel.
 *
 * Implements the "Option 3 + 4" split (see the snap-redundancy canvas). The
 * primary (inline) insight shows critical safety reports, 1st-degree safety
 * flags and provenance, the 1-hop "Also Familiar" block, the unified footer,
 * and a "More info" button when there is deeper content to expand. The
 * secondary "More info" page shows a "Back" button, 2nd-degree safety
 * flags/provenance, the degree-2 "Extended Network" familiarity, and the dApp
 * origin insight.
 *
 * Both views are pure functions of a JSON-serializable {@link InsightModel} so
 * they can be re-rendered from `onUserInput` (via the interface context) without
 * re-fetching any data. This module is intentionally separate from
 * `onTransaction` / `onUserInput` to avoid a circular import.
 *
 * @module insight-view
 */

import type { InterfaceContext } from '@metamask/snaps-sdk';
import { Box, Button } from '@metamask/snaps-sdk/jsx';

import {
  UnifiedFooter,
  OriginBlock,
  renderPrimarySafety,
  renderExtendedSafety,
  renderOneHopFamiliarity,
  renderExtendedFamiliarity,
} from './components';
import type { SafetyData } from './safety/types';
import type { NetworkFamiliarity } from './trusted-circle/types';
import type { AccountProps, OriginProps } from './types';

/** Button names that drive navigation between the primary and More info pages. */
export const MORE_INFO_BUTTON = 'more-info';
export const BACK_BUTTON = 'back';

/**
 * The serializable state passed through the interface context. Everything here
 * must be JSON-serializable (no functions, Sets, Maps, or `undefined` values
 * once cloned) so it round-trips through `snap_createInterface` /
 * `snap_updateInterface`.
 */
export type InsightModel = {
  /** Destination address: classified safety data, or null. */
  safety: SafetyData | null;
  /** Destination address: 1-hop + 2-hop familiarity data, or null. */
  familiarity: NetworkFamiliarity | null;
  /** dApp origin: classified safety data (URL/site vocabulary), or null. */
  originSafety: SafetyData | null;
  /** dApp origin: 1-hop + 2-hop familiarity data, or null. */
  originFamiliarity: NetworkFamiliarity | null;
  /** Account props used by the footer CTAs. */
  accountProps: AccountProps;
  /** Origin props used by the origin block + footer. */
  originProps: OriginProps;
  /** Whether the origin section is suppressed (metamask/localhost/no origin). */
  suppressOrigin: boolean;
};

/**
 * Wraps an {@link InsightModel} into the interface context shape expected by
 * `snap_createInterface` / `snap_updateInterface`. The model is JSON-cloned so
 * it is a plain `Json` structure at runtime; the cast bridges the typed model
 * to the SDK's `InterfaceContext` (`Record<string, Json>`) at the boundary.
 *
 * @param model - The insight model (already JSON-serializable).
 * @returns The interface context carrying the model under `model`.
 */
export function toInterfaceContext(model: InsightModel): InterfaceContext {
  return { model } as unknown as InterfaceContext;
}

/**
 * Reads an {@link InsightModel} back out of an interface context, or null when
 * the context is missing/malformed.
 *
 * @param context - The interface context from `onUserInput`.
 * @returns The insight model, or null.
 */
export function modelFromContext(
  context: InterfaceContext | null,
): InsightModel | null {
  const model = (context as { model?: InsightModel } | null)?.model;
  return model ?? null;
}

/**
 * Deep-clones a value through JSON to guarantee it is a plain, serializable
 * `Json` structure (drops `undefined`, functions, Sets/Maps) before it enters
 * the interface context.
 *
 * @param value - The value to clone.
 * @returns A JSON-cloned copy.
 */
export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Whether the model has any content that belongs on the secondary "More info"
 * page. Data-driven: true when the destination address has 2nd-degree safety or
 * familiarity, OR the dApp origin has any non-critical safety / any familiarity
 * / a contextual link to render. When false, the primary insight is returned as
 * static content with no "More info" button.
 *
 * @param model - The insight model.
 * @returns True when there is more-info content to expand.
 */
export function hasMoreInfo(model: InsightModel): boolean {
  const safety = model.safety ?? undefined;
  const familiarity = model.familiarity ?? undefined;
  const originSafety = model.originSafety ?? undefined;
  const originFamiliarity = model.originFamiliarity ?? undefined;

  const addressMore =
    renderExtendedSafety(safety) !== null ||
    renderExtendedFamiliarity(familiarity) !== null;

  const originMore =
    OriginBlock({
      variant: 'more',
      originProps: model.originProps,
      safety: originSafety,
      familiarity: originFamiliarity,
    }) !== null;

  return addressMore || originMore;
}

/**
 * Builds the primary (inline) insight UI.
 *
 * @param model - The insight model.
 * @returns The primary insight JSX.
 */
export function buildPrimaryInsight(model: InsightModel) {
  const safety = model.safety ?? undefined;
  const familiarity = model.familiarity ?? undefined;
  const originSafety = model.originSafety ?? undefined;
  const originFamiliarity = model.originFamiliarity ?? undefined;

  return (
    <Box>
      {renderPrimarySafety(safety)}
      <OriginBlock
        variant="primary"
        originProps={model.originProps}
        safety={originSafety}
        familiarity={originFamiliarity}
      />
      {renderOneHopFamiliarity(familiarity)}
      {hasMoreInfo(model) ? (
        <Button name={MORE_INFO_BUTTON}>More info</Button>
      ) : null}
      <UnifiedFooter
        accountProps={model.accountProps}
        originProps={model.originProps}
      />
    </Box>
  );
}

/**
 * Builds the secondary "More info" insight UI.
 *
 * @param model - The insight model.
 * @returns The more-info insight JSX.
 */
export function buildMoreInfoInsight(model: InsightModel) {
  const safety = model.safety ?? undefined;
  const familiarity = model.familiarity ?? undefined;
  const originSafety = model.originSafety ?? undefined;
  const originFamiliarity = model.originFamiliarity ?? undefined;

  return (
    <Box>
      {renderExtendedSafety(safety)}
      {renderExtendedFamiliarity(familiarity)}
      <OriginBlock
        variant="more"
        originProps={model.originProps}
        safety={originSafety}
        familiarity={originFamiliarity}
      />
      <Button name={BACK_BUTTON}>Back</Button>
    </Box>
  );
}

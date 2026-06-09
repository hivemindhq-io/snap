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
import { Box, Button, Text } from '@metamask/snaps-sdk/jsx';

import {
  UnifiedFooter,
  AddressBlock,
  OriginBlock,
  EmptyStateNotice,
  renderFirstPartyProvenance,
  renderPrimarySafety,
  renderExtendedSafety,
  renderCriticalSafety,
  renderOneHopFamiliarity,
  renderExtendedFamiliarity,
  renderSelfClaims,
  renderPublicClaims,
} from './components';
import type { PublicClaims } from './public-claims/types';
import type { SafetyData } from './safety/types';
import type { NetworkFamiliarity, SelfClaims } from './trusted-circle/types';
import { AccountType, OriginType } from './types';
import type { AccountProps, OriginProps } from './types';
import { vendor } from './vendors';

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
  /** Destination address: the viewer's OWN staked claims ("Your take"), or null. */
  selfClaims: SelfClaims | null;
  /** dApp origin: classified safety data (URL/site vocabulary), or null. */
  originSafety: SafetyData | null;
  /** dApp origin: 1-hop + 2-hop familiarity data, or null. */
  originFamiliarity: NetworkFamiliarity | null;
  /** dApp origin: the viewer's OWN staked claims ("Your take"), or null. */
  originSelfClaims: SelfClaims | null;
  /**
   * Destination address: the stake-weighted "Public claims" escape-hatch lane
   * (ANY claim, unfiltered by the viewer's network), or null. More-info-only.
   */
  publicClaims: PublicClaims | null;
  /** dApp origin: the stake-weighted "Public claims" lane, or null. */
  originPublicClaims: PublicClaims | null;
  /** Account props used by the footer CTAs. */
  accountProps: AccountProps;
  /** Origin props used by the origin block + footer. */
  originProps: OriginProps;
  /** Whether the origin section is suppressed (metamask/localhost/no origin). */
  suppressOrigin: boolean;
  /**
   * Whether the destination-address section is suppressed. True for self-calls
   * (`to === from`), i.e. smart-account batch executions where the real targets
   * live inside the calldata and vetting the user's own address is meaningless.
   */
  suppressAccount: boolean;
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
 * familiarity, OR the dApp origin (site) has any non-critical safety / any
 * familiarity signal to render. (Outbound links no longer live in the cards —
 * they are consolidated in the {@link UnifiedFooter} — so they never gate
 * "More info".) When false, the primary insight is returned as static content
 * with no "More info" button.
 *
 * @param model - The insight model.
 * @returns True when there is more-info content to expand.
 */
export function hasMoreInfo(model: InsightModel): boolean {
  const safety = model.safety ?? undefined;
  const familiarity = model.familiarity ?? undefined;
  const originSafety = model.originSafety ?? undefined;
  const originFamiliarity = model.originFamiliarity ?? undefined;

  // When the destination is suppressed (self-call) the address card never
  // renders, so it can never contribute "More info" content.
  const addressMore =
    !model.suppressAccount &&
    (renderExtendedSafety(safety) !== null ||
      renderExtendedFamiliarity(familiarity) !== null);

  // When the origin is suppressed (no origin / metamask / localhost / any
  // browser-extension origin) the dApp block never renders, so it can never
  // contribute "More info" content — and the stray "More info" button on an
  // otherwise-empty panel disappears.
  const originMore =
    !model.suppressOrigin &&
    OriginBlock({
      variant: 'more',
      originProps: model.originProps,
      safety: originSafety,
      familiarity: originFamiliarity,
    }) !== null;

  return addressMore || originMore;
}

/**
 * Whether the model carries any renderable public claims (the escape-hatch
 * lane), respecting the per-subject suppress flags. Public claims are
 * more-info-only and never promoted inline, so they are tracked separately from
 * {@link hasMoreInfo} (which gates the network/safety "more" content).
 *
 * @param model - The insight model.
 * @returns True when there is at least one public claim to show.
 */
export function hasPublicClaims(model: InsightModel): boolean {
  const addressPublic =
    !model.suppressAccount && (model.publicClaims?.claims.length ?? 0) > 0;
  const originPublic =
    !model.suppressOrigin && (model.originPublicClaims?.claims.length ?? 0) > 0;
  return addressPublic || originPublic;
}

/**
 * Total number of public claims across the (non-suppressed) destination address
 * and dApp origin lanes — the count surfaced in the muted "{n} public claims"
 * line that motivates the escape-hatch "More info" button.
 *
 * @param model - The insight model.
 * @returns The combined shown public-claim count.
 */
function publicClaimsCount(model: InsightModel): number {
  const addressCount = model.suppressAccount
    ? 0
    : model.publicClaims?.claims.length ?? 0;
  const originCount = model.suppressOrigin
    ? 0
    : model.originPublicClaims?.claims.length ?? 0;
  return addressCount + originCount;
}

/**
 * The destination-address "View all on Hive Mind" URL for the public-claims
 * lane, or undefined when no atom is present (the vendor URL builders require an
 * atom). Guarded so a subject with claims-by-id-only never throws.
 *
 * @param model - The insight model.
 * @returns The address atom view URL, or undefined.
 */
function addressViewHref(model: InsightModel): string | undefined {
  const { accountProps } = model;
  if (
    accountProps.accountType === AccountType.NoAtom ||
    !accountProps.account
  ) {
    return undefined;
  }
  try {
    return vendor.viewAtom(accountProps).url;
  } catch {
    return undefined;
  }
}

/**
 * The dApp-origin "View all on Hive Mind" URL for the public-claims lane, or
 * undefined when no origin atom is present.
 *
 * @param model - The insight model.
 * @returns The origin atom view URL, or undefined.
 */
function originViewHref(model: InsightModel): string | undefined {
  const { originProps } = model;
  if (originProps.originType !== OriginType.HasAtom) {
    return undefined;
  }
  try {
    return vendor.viewOriginAtom(originProps).url;
  } catch {
    return undefined;
  }
}

/**
 * Whether the primary (inline) tier has any renderable content: a 1st-degree
 * destination-address safety flag/provenance, the 1-hop "People you follow"
 * familiarity block, or an inline dApp critical danger banner. When this is
 * false there is nothing to anchor the primary view, so any available
 * "More info" content is promoted into the primary frame (rather than leaving a
 * bare panel whose only affordance is a "More info" button).
 *
 * @param model - The insight model.
 * @returns True when the primary tier has content to render inline.
 */
export function hasPrimaryContent(model: InsightModel): boolean {
  const hasAddressSafety =
    !model.suppressAccount &&
    renderPrimarySafety(model.safety ?? undefined) !== null;
  const hasAddressFamiliarity =
    !model.suppressAccount &&
    renderOneHopFamiliarity(model.familiarity ?? undefined) !== null;
  // The viewer's own staked claims ("Your take") are primary content: a personal
  // signal anchors the inline insight even when nothing else does.
  const hasAddressSelf =
    !model.suppressAccount &&
    renderSelfClaims(model.selfClaims ?? undefined) !== null;
  const hasDappPrimary =
    !model.suppressOrigin &&
    renderCriticalSafety(model.originSafety ?? undefined) !== null;
  const hasDappSelf =
    !model.suppressOrigin &&
    renderSelfClaims(model.originSelfClaims ?? undefined) !== null;
  return (
    hasAddressSafety ||
    hasAddressFamiliarity ||
    hasAddressSelf ||
    hasDappPrimary ||
    hasDappSelf
  );
}

/**
 * Whether the panel has no substantive insight to show: no primary-tier content
 * and nothing behind "More info" to promote. In this case the panel should read
 * as an honest "nothing here yet" empty state rather than an implied clean bill
 * of health.
 *
 * @param model - The insight model.
 * @returns True when the empty-state notice should be shown.
 */
export function isEmptyInsight(model: InsightModel): boolean {
  return !hasPrimaryContent(model) && !hasMoreInfo(model);
}

/**
 * Whether the panel renders a "More info" button — and therefore needs an
 * interactive interface. True only when the primary tier has content AND there
 * is additional content behind "More info". When the primary tier is empty the
 * more-info content is promoted inline instead (no button, no second page); when
 * there is no more-info content there is nothing to expand.
 *
 * Public claims are more-info-only and ALSO gate the button: when the primary
 * tier is empty (cold start) but public claims exist, the button is the
 * escape-hatch into the "Public claims" lane. When the primary tier has content,
 * the button shows if there is network/safety "more" content OR public claims.
 *
 * @param model - The insight model.
 * @returns True when a "More info" button (and interactive interface) is needed.
 */
export function showsMoreInfoButton(model: InsightModel): boolean {
  return hasPrimaryContent(model)
    ? hasMoreInfo(model) || hasPublicClaims(model)
    : hasPublicClaims(model);
}

/**
 * Whether a safety payload carries a critical (danger-banner) report.
 *
 * @param safety - The classified safety data, or undefined.
 * @returns True when there is at least one critical report.
 */
function hasCriticalSafety(safety: SafetyData | undefined): boolean {
  return Boolean(safety && safety.critical.length > 0);
}

/**
 * Whether the dApp subject card should float above the address card. A subject
 * with a critical safety report wins the top slot; when both subjects (or
 * neither) carry a critical report the address card stays first — the
 * address-first tiebreak. Subjects are never interleaved: each is a single
 * contiguous card.
 *
 * @param addressCritical - Whether the address has a critical report.
 * @param dappCritical - Whether the dApp has a critical report (and is shown).
 * @returns True when the dApp card should render first.
 */
function dappCardFirst(
  addressCritical: boolean,
  dappCritical: boolean,
): boolean {
  return dappCritical && !addressCritical;
}

/**
 * Builds the primary (inline) insight UI. Three branches, in priority order.
 *
 * Empty: no primary-tier content and nothing to promote — renders the neutral
 * "nothing here yet" notice (never an implied clean bill of health).
 *
 * Promote: the primary tier is bare but there IS "More info" content — renders
 * that content inline (its 'more' variant, address-first) within the primary
 * frame so the panel is never a dead end whose only affordance is a "More info"
 * button. No critical tiebreak (the 'more' tier never carries critical reports)
 * and no "More info" button (everything is already shown).
 *
 * Primary populated: renders the primary-tier cards (a critical report floats to
 * the top, address-first tiebreak) with a "More info" button when additional
 * content sits behind it.
 *
 * The first-party provenance line and the unified footer render in all three
 * branches (each handles its own null/empty conditions).
 *
 * @param model - The insight model.
 * @returns The primary insight JSX.
 */
export function buildPrimaryInsight(model: InsightModel) {
  const safety = model.safety ?? undefined;
  const familiarity = model.familiarity ?? undefined;
  const selfClaims = model.selfClaims ?? undefined;
  const originSafety = model.originSafety ?? undefined;
  const originFamiliarity = model.originFamiliarity ?? undefined;
  const originSelfClaims = model.originSelfClaims ?? undefined;

  const provenance = renderFirstPartyProvenance(model.originProps.originUrl);
  const footer = (
    <UnifiedFooter
      accountProps={model.accountProps}
      originProps={model.originProps}
      suppressOrigin={model.suppressOrigin}
      suppressAccount={model.suppressAccount}
    />
  );

  // Escape-hatch affordance shared by the empty + promote branches: a muted
  // "{n} public claims" line plus the "More info" button, shown only when there
  // are public claims behind the click. Branch 3 emits its own button, so this
  // is only used where the primary tier is bare.
  const publicCount = publicClaimsCount(model);
  const escapeHatch =
    !hasPrimaryContent(model) && showsMoreInfoButton(model) ? (
      <Box>
        {publicCount > 0 ? (
          <Text color="muted">
            {publicCount === 1
              ? '1 public claim from outside your network'
              : `${publicCount} public claims from outside your network`}
          </Text>
        ) : null}
        <Button name={MORE_INFO_BUTTON}>More info</Button>
      </Box>
    ) : null;

  // Branch 1 — Empty: honest "nothing here yet" notice. Still surfaces the
  // destination's account type (contract vs wallet) when known and the
  // destination isn't suppressed (self-calls have no meaningful destination).
  // When public claims exist, the escape-hatch button opens the "Public claims"
  // lane on the More info page.
  if (isEmptyInsight(model)) {
    return (
      <Box>
        <EmptyStateNotice
          classification={
            model.suppressAccount
              ? undefined
              : model.accountProps.classification
          }
          hasPublicClaims={hasPublicClaims(model)}
        />
        {provenance}
        {escapeHatch}
        {footer}
      </Box>
    );
  }

  // Branch 2 — Promote: no primary tier, but more-info content exists. Render
  // the 'more' variant cards inline (address-first, no tiebreak, no button).
  if (!hasPrimaryContent(model)) {
    const addressCard = model.suppressAccount ? null : (
      <AddressBlock
        variant="more"
        accountProps={model.accountProps}
        safety={safety}
        familiarity={familiarity}
      />
    );
    const dappCard = model.suppressOrigin ? null : (
      <OriginBlock
        variant="more"
        originProps={model.originProps}
        safety={originSafety}
        familiarity={originFamiliarity}
      />
    );
    return (
      <Box>
        {addressCard}
        {dappCard}
        {provenance}
        {escapeHatch}
        {footer}
      </Box>
    );
  }

  // Branch 3 — Primary populated. Each subject is grouped into a single labeled
  // card (no interleaving), then ordered so a critical report floats to the top
  // (address-first tiebreak).
  const addressCard = model.suppressAccount ? null : (
    <AddressBlock
      variant="primary"
      accountProps={model.accountProps}
      safety={safety}
      familiarity={familiarity}
      selfClaims={selfClaims}
    />
  );
  const dappCard = model.suppressOrigin ? null : (
    <OriginBlock
      variant="primary"
      originProps={model.originProps}
      safety={originSafety}
      familiarity={originFamiliarity}
      selfClaims={originSelfClaims}
    />
  );
  const dappFirst = dappCardFirst(
    hasCriticalSafety(safety),
    !model.suppressOrigin && hasCriticalSafety(originSafety),
  );

  return (
    <Box>
      {dappFirst ? dappCard : addressCard}
      {dappFirst ? addressCard : dappCard}
      {provenance}
      {showsMoreInfoButton(model) ? (
        <Button name={MORE_INFO_BUTTON}>More info</Button>
      ) : null}
      {footer}
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

  // The network/safety "more" cards belong here ONLY when the primary tier had
  // content. When the primary tier was bare, Branch 2 already PROMOTED the 'more'
  // cards inline, so re-rendering them here would double-render. The public
  // claims lane is unaffected — it is never promoted inline, so it always renders
  // on this page.
  const showNetworkMore = hasPrimaryContent(model);

  // Same subject grouping as the primary view. The "More info" page never
  // carries critical reports (those float up to the primary view), so ordering
  // falls back to the address-first default.
  const addressCard =
    showNetworkMore && !model.suppressAccount ? (
      <AddressBlock
        variant="more"
        accountProps={model.accountProps}
        safety={safety}
        familiarity={familiarity}
      />
    ) : null;
  const dappCard =
    showNetworkMore && !model.suppressOrigin ? (
      <OriginBlock
        variant="more"
        originProps={model.originProps}
        safety={originSafety}
        familiarity={originFamiliarity}
      />
    ) : null;

  // The "Public claims" escape-hatch lane: ANY claim about the subject,
  // unfiltered by the viewer's network. Always rendered here (more-info-only),
  // for the destination address and the dApp origin, each guarded by its
  // suppress flag and its atom-presence-gated "View all" href. Each block is
  // subject-scoped in its heading ("This address" / "This site") so the two are
  // distinguishable; the shared "unverified" subtitle renders only on the FIRST
  // visible block to avoid stacking the same caveat twice.
  const addressHasPublic =
    !model.suppressAccount && (model.publicClaims?.claims.length ?? 0) > 0;
  const addressPublic = model.suppressAccount
    ? null
    : renderPublicClaims(model.publicClaims, {
        subject: 'address',
        viewHref: addressViewHref(model),
        showSubtitle: true,
      });
  const originPublic = model.suppressOrigin
    ? null
    : renderPublicClaims(model.originPublicClaims, {
        subject: 'site',
        viewHref: originViewHref(model),
        // Subtitle goes on the first visible block: the site block owns it only
        // when the address block isn't showing public claims above it.
        showSubtitle: !addressHasPublic,
      });

  return (
    <Box>
      {addressCard}
      {dappCard}
      {addressPublic}
      {originPublic}
      <Button name={BACK_BUTTON}>Back</Button>
    </Box>
  );
}

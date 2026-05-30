/**
 * Types for the remote structured claim-template registry.
 *
 * The snap fetches this from the Hive Mind API (`GET /atoms/claim-templates`)
 * and caches it via snap_manageState. Today the snap consumes the
 * predicate/object term-ID maps so its read surface can resolve safety
 * predicates (`reported for`, `malicious`, `suspicious`, …) without
 * hardcoding term IDs. The structured `templates` are carried through for
 * future use (e.g. surfacing creatable claims).
 *
 * @module claim-templates/types
 */

export interface ClaimSlot {
  type: 'detected' | 'fixed' | 'user-input';
  atomRef?: string;
  label?: string;
  inputType?: 'text' | 'search';
  placeholder?: string;
  inputLabel?: string;
  schemaType?: string;
}

export interface ClaimTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  iconColor?: string;
  disabled?: boolean;
  disabledReason?: string;
  subject: ClaimSlot;
  predicate: ClaimSlot;
  object: ClaimSlot;
}

export interface ClaimTemplateMapping {
  id: string;
  name: string;
  match: {
    entityType?: string;
    addressKind?: string;
    labelPatterns?: string[];
  };
  potentialTriples: ClaimTemplate[];
}

/** Shape returned by GET /atoms/claim-templates on the Hive Mind API. */
export interface ClaimTemplateRegistry {
  version: number;
  /** Named predicate term IDs (e.g. { reportedFor: "0x…" }). */
  predicates: Record<string, string>;
  /** Named object term IDs (e.g. { malicious: "0x…", suspicious: "0x…" }). */
  objects: Record<string, string>;
  templates: ClaimTemplateMapping[];
}

/** Wrapper stored in snap_manageState with a timestamp for TTL validation. */
export interface CachedClaimTemplates {
  registry: ClaimTemplateRegistry;
  /** Unix timestamp (ms) when this cache entry was written. */
  timestamp: number;
}

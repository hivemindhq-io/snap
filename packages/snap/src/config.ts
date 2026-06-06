export type ChainConfig = {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  chainKey: string;
  currencySymbol: string;
  decimalPrecision: number;
  hasTagAtomId: string;
  trustworthyAtomId: string;
  hasAliasAtomId: string;
  /** "follow" predicate atom (Schema.org FollowAction) — used in `[I] follow [target]` triples. */
  followAtomId: string;
  /** Shared first-person "I" atom — the subject of every `[I] follow [target]` triple. */
  iAtomId: string;
  rpcUrl: string;
  hivemindApiUrl: string;
};

export const INTUITION_TESTNET = {
  backendUrl: 'https://testnet.intuition.sh/v1/graphql',
  rpcUrl: 'https://testnet.rpc.intuition.systems',
  chainId: 13579,
  chainIdHex: '0x350B',
  chainName: 'Intuition Testnet',
  chainKey: 'intuition-testnet',
  currencySymbol: 'TTRUST',
  decimalPrecision: 18,
  hasTagAtomId:
    '0x7ec36d201c842dc787b45cb5bb753bea4cf849be3908fb1b0a7d067c3c3cc1f5',
  trustworthyAtomId:
    '0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a',
  hasAliasAtomId:
    '0xf8cfb4e3f1db08f72f255cf7afaceb4b32684a64dac0f423cdca04dd15cf4fd6',
  followAtomId:
    '0xffd07650dc7ab341184362461ebf52144bf8bcac5a19ef714571de15f1319260',
  iAtomId: '0x7ab197b346d386cd5926dbfeeb85dade42f113c7ed99ff2046a5123bb5cd016b',
  hivemindApiUrl: 'https://api.hivemindhq.io',
};

export const INTUITION_MAINNET = {
  backendUrl: 'https://mainnet.intuition.sh/v1/graphql',
  rpcUrl: 'https://rpc.intuition.systems',
  chainId: 1155,
  chainIdHex: '0x483',
  chainName: 'Intuition Mainnet',
  chainKey: 'intuition-mainnet',
  currencySymbol: 'TRUST',
  decimalPrecision: 18,
  hasTagAtomId:
    '0x7ec36d201c842dc787b45cb5bb753bea4cf849be3908fb1b0a7d067c3c3cc1f5',
  trustworthyAtomId:
    '0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a',
  hasAliasAtomId:
    '0xf8cfb4e3f1db08f72f255cf7afaceb4b32684a64dac0f423cdca04dd15cf4fd6',
  followAtomId:
    '0xffd07650dc7ab341184362461ebf52144bf8bcac5a19ef714571de15f1319260',
  iAtomId: '0x7ab197b346d386cd5926dbfeeb85dade42f113c7ed99ff2046a5123bb5cd016b',
  hivemindApiUrl: 'http://localhost:3333', // 'https://api.hivemindhq.io',
};

export const CHAIN_CONFIGS = [INTUITION_TESTNET, INTUITION_MAINNET];
export const chainConfig =
  process.env.CHAIN === 'mainnet' ? INTUITION_MAINNET : INTUITION_TESTNET;

/**
 * Browser-extension IDs for our own (first-party) Hive Mind extension.
 *
 * When a transaction is initiated from one of these extensions, the dApp-origin
 * surface is meaningless (it is our own product, not a third-party site), so we
 * suppress the origin block and instead show a neutral provenance line. Add new
 * IDs here as additional builds/channels ship.
 */
export const FIRST_PARTY_EXTENSION_IDS = [
  // Production Chrome extension.
  'ofdljmglgaephaljlmbgafdgciiaggbg',
] as const;

/**
 * Extended-network (2-hop "friend-of-a-friend") feature gate + knobs.
 * See docs/extended-network-spec.md. Local flag (no remote feature-config).
 */

/**
 * Master switch for the 2-hop extended-network layer.
 * Phase 1 wiring (onTransaction fetch + standalone "Extended Network" familiarity
 * subsection) has landed, so this is ON. Flip to `false` to disable the 2-hop
 * round-trip and hide all degree-2 surfaces.
 */
export const EXTENDED_NETWORK_ENABLED = true;

/**
 * Max number of 1-hop follows used as seeds for the 2-hop expansion.
 * Matches the 1-hop query limit. Seeds taken in 1-hop list order (NOT by stake).
 */
export const MAX_SEED_FOLLOWS = 200;

/**
 * Minimum distinct bridges (direct follows that reach a FoaF) required before a
 * degree-2 contact surfaces ANYWHERE — familiarity, soft flags, attribution.
 * One follow-of-a-follow is noise; ≥2 independent paths is signal.
 */
export const MIN_BRIDGES = 2;

/**
 * Offline-fallback safety vocabulary term IDs for the read surface.
 *
 * These mirror `hivemind-api/config/claim-templates.json` and are the offline
 * fallback the snap uses when the claim-template registry can't be fetched.
 * Intuition atom term IDs are content-addressed (hash of content), so they are
 * identical across testnet and mainnet — hence a single shared map rather than
 * per-chain duplication (same convention as `hasTagAtomId` above).
 *
 * The read surface prefers the live `registry.predicates` / `registry.objects`
 * maps and only falls back to these when the API is unreachable.
 */

/** Predicate term IDs used by the safety + provenance read surface. */
export const SAFETY_PREDICATE_IDS = {
  hasTag: '0x7ec36d201c842dc787b45cb5bb753bea4cf849be3908fb1b0a7d067c3c3cc1f5',
  reportedFor:
    '0x51f1febac0b9d05953442f082597c5d1ce827bd2f888446ad811692e0a0f428d',
  createdBy:
    '0x91166c51840ff83d71e7aa0e72583d7eb5f9d85d826984688eb6f52142a91b15',
  auditedBy:
    '0xe0d54a7d932039a2878d97ffdc0ebee432ea2bcbc0a8f42ddb279688636aabc2',
  evaluatedBy:
    '0xb769bc51460e2dc29927c825f743238174c02901603a0c9604dd2e8ea40f8226',
  sameAs: '0xbeebfb7d177cbd96ffc239d2196c72ec346efe81f39dc595773f13d83506f5f0',
} as const;

/** Object (label) term IDs used by the safety read surface. */
export const SAFETY_OBJECT_IDS = {
  // Soft lane (universal-claim-tag TextObjects, surfaced via `has tag`).
  malicious:
    '0x36ff684db9493a6ea39b81beca986660f47738b48888fa5f6fe0c4679fd30453',
  suspicious:
    '0x3af71485cc5a507aa56fdfbc1b5f40f47accdf96da2a98da7b2141278ae0f843',
  scammer: '0x813f0ebb4e65d1126637bebb31ad997fc2b923475b70115ee4b3dde3636fbbde',
  bot: '0xa5efe1a5108ad72a52c2b52eac00342f08520f9d4496c60caebcf34feda3603a',
  impersonation:
    '0x57497549d222a27e9e91ba8dfb299fb9bb08e1054cfde4ce8e933ddfe17cb191',
  // Hard lane (categorical report objects, surfaced via `reported for`).
  scam: '0x27f33aaa8e3ff821e0eff6fedfec0b20a29164e21848c5f33e736eede13c39ba',
  spam: '0x6ae6a37850484a61d76ad868c83d1bbe4d6975fa29cd724d7485141a03cde78f',
  injection:
    '0x8e7674f0813f000a12951d8bf1ea4c8ffac05a2ab5d56fc4f9550a0a19a5887a',
  phishing:
    '0x17ea05befad2c4ab6dd95a41177a6a0657ea31966c15ceb6939ed63c2c0fe00b',
  drainer: '0xb695c13188f0a67f36a7d13f21859900bd929a3793b95b9aab574db7b6b36529',
  honeypot:
    '0xfe8368e39da75a1b43d80633d8ea865456713be53e4e61493f43845c89c29e26',
  exploit: '0x21d9e43be9d812babe25a7dcf0dafed4552dfd1dca1109b37b07125744eeef7d',
  sybil: '0xc16b37fb39ec7b14ad3309f0192cc8a3bf32a2eaa1195f137f12d515cd591bea',
  botReport:
    '0x5f4460e803c8f155a59b1cac08049130ea8846d4b7a37fa90e03ac5935d0e726',
} as const;

/**
 * Offline-fallback blacklist of term IDs suppressed from the read surface.
 *
 * These are non-canonical / duplicate atoms (e.g. a rogue "has tag" predicate)
 * whose triples would otherwise show up as duplicate claims. Like the safety
 * vocab above, term IDs are content-addressed so this list is chain-agnostic.
 *
 * The live registry's `blacklistedTermIds` (served by hivemind-api) is the
 * dynamic source; the read surface unions it with this seed so the known rogue
 * atom is always suppressed even from a stale cache or when the API is down.
 * Scoped to non-safety vocab — never list a canonical safety predicate here.
 */
export const BLACKLISTED_TERM_IDS = [
  // Non-canonical "has tag" predicate (duplicate of the canonical hasTagAtomId).
  '0x6de69cc0ae3efe4000279b1bf365065096c8715d8180bc2a98046ee07d3356fd',
  // Deprecated "has characteristic" predicate (superseded by canonical "has tag").
  '0x5cc843bd9ba824dbef4e80e7c41ced4ccde30a7b9ac66f0499c5766dc8811801',
] as const;

/**
 * Offline-fallback familiarity vocabulary (default-deny allowlist).
 *
 * Mirrors `familiarityVocab` in `hivemind-api/config/claim-templates.json`. The
 * familiarity read surface is default-deny: only claims whose (predicate, object)
 * pair matches an entry here ever render as familiarity. `object: '*'` matches any
 * object for a self-describing predicate (e.g. `vouchFor`). `tier` is the
 * placement ceiling — `'primary'` is inline-eligible (1-hop) + More info (2-hop);
 * `'secondary'` is always demoted to More info even from a direct follow.
 *
 * Keys reference the named predicate/object maps the snap already resolves
 * (`SAFETY_PREDICATE_IDS` / `SAFETY_OBJECT_IDS` / `chainConfig`). The live
 * registry's `familiarityVocab` supersedes this whenever the API is reachable;
 * the read surface unions the two so a known-good claim still surfaces from a
 * stale cache or when the API is down. NOT used by the safety surface, which
 * keeps its own stricter whitelist.
 */
export const FAMILIARITY_VOCAB = [
  { predicate: 'hasTag', object: 'trustworthy', tier: 'primary' },
  { predicate: 'hasTag', object: 'credible', tier: 'primary' },
  { predicate: 'hasTag', object: 'insightful', tier: 'primary' },
  { predicate: 'hasTag', object: 'helpful', tier: 'primary' },
  { predicate: 'hasTag', object: 'bullish', tier: 'primary' },
  { predicate: 'vouchFor', object: '*', tier: 'primary' },
  { predicate: 'hasTag', object: 'misleading', tier: 'secondary' },
  { predicate: 'hasTag', object: 'misinformation', tier: 'secondary' },
  { predicate: 'hasTag', object: 'clickbait', tier: 'secondary' },
  { predicate: 'hasTag', object: 'aiSlop', tier: 'secondary' },
  { predicate: 'sameAs', object: '*', tier: 'secondary' },
] as const;

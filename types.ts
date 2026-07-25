/**
 * TypeScript types for the RoR2ItemSync WebSocket protocol.
 *
 * See docs.html for the full reference (open it in a browser).
 * See examples/ for real captured payloads.
 *
 * Live messages: schema_version = 2.
 * Dump messages: schema_version = 1.
 */

// ============================================================================
// Versions
// ============================================================================

export type LiveSchemaVersion = 2;
export type DumpSchemaVersion = 1;

// ============================================================================
// Game lifecycle
// ============================================================================

export type GameState = "menu" | "pregame" | "in_run";

// ============================================================================
// Item / equipment / pickup identity
// ============================================================================

/**
 * The canonical `ItemTier` enum string. Used by `ItemRef.tier` and as keys in
 * `RunSummaryMessage.items_by_tier`.
 *
 * NOT a closed set. Mods can register custom tiers (R2API TierAPI,
 * `AssignedAtRuntime`) and their enum names arrive here verbatim; refs for
 * pickups that have no item tier — currencies via the `"pickup"` path —
 * report `"NoTier"`. The trailing `(string & {})` keeps autocomplete for the
 * known values while still accepting anything the host sends, so match on
 * what you know and pass unknown tiers through rather than rejecting them.
 */
export type ItemTier =
  | "Tier1"
  | "Tier2"
  | "Tier3"
  | "Boss"
  | "Lunar"
  | "VoidTier1"
  | "VoidTier2"
  | "VoidTier3"
  | "VoidBoss"
  | "Equipment"
  | "LunarEquipment"
  | "NoTier"
  | (string & {});

/**
 * A reference to an item, equipment, or pickup. Used wherever the protocol
 * surfaces a real-world item: player inventories, shop terminals, ground items,
 * printers, command essences (with the `tier` field only), and `pickup_granted`
 * events.
 *
 * When `hidden: true` (unrevealed shop terminal), `id`, `qualified_id`,
 * `pack_id`, and `name` are blanked but `tier` and `is_equipment` are still
 * accurate.
 */
export interface ItemRef {
  /** `ItemDef.name` (or `EquipmentDef.name`) verbatim. The canonical RoR2 internal name. Null if hidden. */
  id: string | null;

  /** `pack_id + "|" + id`. Globally unique. Use as your app's cache key. Null if hidden. */
  qualified_id: string | null;

  /** `ContentPack.identifier` (e.g. "RoR2.BaseContent", "com.TeamMoonstorm"). Null if hidden. */
  pack_id: string | null;

  /** True for Q-slot equipment. Accurate even for hidden shop terminals. */
  is_equipment: boolean;

  /**
   * Gameplay-effective stack count — what the in-game HUD shows. For held
   * inventory items this is `permanent + temp + channeled` (see the breakdown
   * fields below). Always 1 for equipment and pickups.
   */
  count: number;

  /** Raw `ItemTier` enum. */
  tier: ItemTier;

  /** Localized display name. "???" if hidden. */
  name: string;

  /** True for unrevealed shop terminals. */
  hidden: boolean;

  /**
   * Explicit real-vs-temporary flag. `true` when the stack/grant includes
   * decaying temporary copies (the `temp`/`temp_decay` fields carry the detail).
   * Present ONLY where temp-ness is actually known: per-player inventory item
   * stacks (`inventory_update.players[].items`), minion bot inventories
   * (`inventory_update.world.minions.by_owner[].bots[].items` — bots reuse the
   * player item shape), and `pickup_granted.item`.
   * Omitted on world refs (shop/printer/ground), equipment, and hidden refs,
   * where it isn't determined.
   */
  temporary?: boolean;

  /**
   * Seekers of the Storm splits each held stack into three buckets. These
   * breakdown fields appear on per-player inventory item refs
   * (`inventory_update.players[].items`), on minion bot inventories
   * (`inventory_update.world.minions.by_owner[].bots[].items`), and on
   * `pickup_granted.item` (where they describe just the grant that fired,
   * not the cumulative stack), and
   * only when the value is not a plain permanent one — i.e. when
   * `permanent != count` or any temp/channeled copies exist. They never appear
   * on world refs (`shop_items`, `printer_items`, `ground_items`) or
   * hidden/shop pickups. A vanilla permanent item omits all of them and you
   * just read `count`. For `pickup_granted`, `count == permanent + temp +
   * channeled` for the grant, so a temporary-item pickup reports `temp > 0`
   * instead of being silently counted as permanent.
   */

  /** Permanent stacks — normal pickups you keep. Present only when the breakdown applies. */
  permanent?: number;

  /** Temporary (decaying) stacks. Present only when non-zero. */
  temp?: number;

  /**
   * Decay progress of the soonest-to-expire temp stack: the fractional part of
   * RoR2's internal raw temp value (`raw - floor(raw)`), in `[0, 1)`. `temp` is
   * the ceiling of that raw value. Ticks down toward 0 as the stack nears
   * expiry; a stack drops when it crosses an integer boundary. Not a seconds
   * timer — RoR2 only exposes this normalized value. Present only when `temp` is.
   */
  temp_decay?: number;

  /**
   * Channeled stacks — items borrowed while a share effect is active (e.g. a
   * Drifter Hoard tether). No decay; snaps to 0 when the effect ends. Present
   * only when non-zero.
   */
  channeled?: number;
}

/**
 * Variant of `ItemRef` used only in `inventory_update.world.command_items[]`.
 * Artifact of Command essences only expose their tier — the user picks from
 * many options of the same tier.
 */
export interface CommandItemMarker {
  tier: ItemTier;
}

// ============================================================================
// Player / survivor / stats
// ============================================================================

export interface SurvivorRef {
  /** Localized survivor name (e.g. "Commando", "Bandit"). */
  name: string;
  /** Canonical body identifier (e.g. "CommandoBody", "Bandit2Body") with `(Clone)` suffix stripped. */
  body_name: string;
}

export interface PlayerStats {
  /** Current health (live fill of the HP bar). */
  health: number;
  max_health: number;
  /** Current shield. */
  shield: number;
  max_shield: number;
  /** Current barrier (the temporary yellow overshield). */
  barrier: number;
  /** Convenience: `health + shield + barrier`. */
  combined_health: number;
  /** False when the body is dead/downed. Note: once a dead player's body
   *  despawns, their whole PlayerRecord is omitted from `players[]` until they
   *  respawn — `is_alive: false` is only visible in the brief window where the
   *  downed body still exists. */
  is_alive: boolean;
  /** Curse penalty (e.g. Shrine of Blood, Stone Titan). 0 when uncursed; higher
   *  values raise the effective cost of the current max-health pool. */
  curse_penalty: number;
  regen: number;
  armor: number;
  damage: number;
  attack_speed: number;
  crit: number;
  crit_multiplier: number;
  move_speed: number;
  level: number;
}

export interface PlayerRecord {
  /** Steam name when available, body display name otherwise. */
  display_name: string;
  /** Steam ID (76561...) when available; stable `"bot:"`-prefixed fallback for
   *  bots — the same id used by event Player blocks and run_summary, so all
   *  surfaces join on this key. Stable across rejoins (and within a run for bots). */
  network_user_id: string;
  /** True if this player is local to the host machine running the mod. */
  is_local: boolean;
  /** Heuristic: true if the PCMC has no network user (bot-controlled). */
  is_bot: boolean;
  /** Run-scoped gold (standard purchase currency). */
  gold: number;
  /** Void coins (Void Fields / Void Locus currency). Not lunar coins — those are cross-run profile currency. */
  void_coins: number;
  survivor: SurvivorRef;
  stats: PlayerStats;
  /** Current inventory + equipped equipment slot(s). */
  items: ItemRef[];
  /** Active buffs/debuffs, HUD-parity: buffs flagged `isHidden` or shipping no
   *  icon are filtered out, so this matches what the player sees in-game.
   *  Empty array when none. */
  buffs: BuffRef[];
}

/** One active buff/debuff stack on a player. */
export interface BuffRef {
  /** `BuffDef.name` verbatim — canonical RoR2 internal name (e.g. "bdOnFire",
   *  "bdCloak"). Same identity style as `ItemRef.id`; modded buffs use their
   *  mod's internal name. */
  id: string;
  /** Current stack count (≥ 1). */
  stacks: number;
  /** True for debuffs (rendered red-ish in the game HUD). */
  is_debuff: boolean;
}

// ============================================================================
// World blocks
// ============================================================================

export interface Timer {
  /** Total in-run elapsed seconds. Pauses in shops, pause menu, etc. */
  run_seconds: number;
  /** Time on the current stage. */
  stage_seconds: number;
  /** Actual difficulty scaling multiplier. 1.0 at start; grows with `run_seconds`. */
  difficulty_coefficient: number;
  /** True whenever `run_seconds` isn't advancing — derived empirically from
   *  stopwatch behavior, so it catches every freeze condition (pause menu,
   *  Bazaar, singleplayer focus-loss auto-pause, dev console, cutscenes).
   *  Pair with `has_focus` to distinguish user-paused from alt-tab pause.
   *  One broadcast interval of latency (~500ms at the default cadence) before
   *  a transition is reflected. */
  is_paused: boolean;
  /** True while the RoR2 window is the OS focus target. False while the
   *  user has another window in front (e.g. your companion app).
   *
   *  Broadcasts keep flowing either way — the mod forces Unity's
   *  `runInBackground` on so an alt-tab never interrupts the feed. */
  has_focus: boolean;
}

export interface Stage {
  /** 1-indexed stage number in the current run. NOTE: interstitials (Bazaar,
   *  etc.) don't advance the count, so they repeat the next real stage's number
   *  — use `is_interstitial` / `scene_type` to tell them apart. */
  number: number;
  /** Localized stage name. */
  name: string;
  /** Localization key. */
  name_token: string;
  /** Canonical Unity scene name (e.g. "blackbeach", "village", "bazaar"). */
  scene_name: string;
  /** RoR2 `SceneType`: "Stage" | "Intermission" | "TimedIntermission" |
   *  "Cutscene" | "UntimedStage" | "Menu" | "Junk" | "Invalid". */
  scene_type: string;
  /** True for "between" stages (Bazaar Between Time, etc.) — `number` is not a
   *  real stage index for these. */
  is_interstitial: boolean;
}

export interface Difficulty {
  /** RoR2 difficulty enum index. 0=Drizzle, 1=Rainstorm, 2=Monsoon, etc. */
  index: number;
  /** Localized name. */
  name: string;
  /** Localization key. */
  name_token: string;
}

export interface ArtifactRef {
  /** Canonical artifact identifier (e.g. "Command", "Sacrifice"). */
  id: string;
  /** Localized name. */
  name: string;
}

/** Live vitals for one bot — the lean subset of `PlayerStats` that makes
 *  sense for drones/turrets. World-scan cadence: up to one scan interval
 *  stale (see `hello.broadcast_intervals.world_scan_ms`). */
export interface MinionStats {
  health: number;
  max_health: number;
  shield: number;
  barrier: number;
  is_alive: boolean;
}

/** One live player-owned bot (drone, turret, Beetle Guard, Goobo Jr., …).
 *  One entry per bot instance — two Gunner Drones are two entries. */
export interface MinionBot {
  /** Canonical body identifier (e.g. "Drone1Body", "EngiTurretBody"), `(Clone)` stripped. */
  body_name: string;
  /** Localized display name. */
  name: string;
  /** Live vitals (world-scan cadence). */
  stats: MinionStats;
  /** The bot's own inventory — identical `ItemRef`/`EquipRef` entries to
   *  `players[].items`. Engineer turrets copy their owner's items, equipment
   *  drones carry their held equipment as an `EquipRef`, Spare Drone Parts
   *  grants show up here; most combat drones are just `[]`. */
  items: ItemRef[];
}

/** A player's owned minions, grouped under their identity. */
export interface MinionOwnerGroup {
  /** Owning player's `network_user_id` — matches `PlayerRecord.network_user_id`. */
  owner_network_user_id: string;
  owner_display_name: string;
  /** Live bots this owner holds (`bots.length`). */
  count: number;
  bots: MinionBot[];
}

/**
 * Player-owned minions on the current stage (drones, turrets, guards, …).
 * A snapshot — refreshed on the world-scan cadence (see `hello.broadcast_intervals.world_scan_ms`),
 * NOT per broadcast — so counts can lag a beat behind live spawns/deaths.
 * Only live minions (with a spawned body) owned by a player are counted;
 * enemy/monster minions are excluded.
 */
export interface MinionsSummary {
  /** Total live player-owned minions across all owners. */
  total: number;
  by_owner: MinionOwnerGroup[];
}

/**
 * Live teleporter state. Read fresh every broadcast tick (not world-scan
 * cadence), so `charge_fraction` is smooth enough for a charge ring.
 */
export interface TeleporterBlock {
  /** RoR2 `ActivationState` verbatim: "Idle" | "IdleToCharging" | "Charging" |
   *  "Charged" | "Finished". Future game states pass through unchanged. */
  state: string;
  /** Holdout zone charge, 0..1. */
  charge_fraction: number;
  /** Convenience: state is Charging or IdleToCharging. */
  is_charging: boolean;
  /** True once fully charged (exit available). */
  is_charged: boolean;
}

/**
 * Live boss health bar. Mirrors the in-game HUD boss bar: same name,
 * subtitle, and combined-health aggregates across the boss group.
 */
export interface BossBlock {
  /** Boss display name as the HUD shows it (e.g. "Stone Titan"). */
  name: string;
  /** Flavor subtitle (e.g. "Crisis of Faith"). May be empty. */
  subtitle: string;
  /** Combined current health across all living members of the boss group. */
  health: number;
  /** Combined max health (highest observed). */
  max_health: number;
}

export interface WorldBlock {
  chests_remaining: number;
  shops_remaining: number;
  equipment_barrels_remaining: number;
  /** Visible/hidden shop terminal contents. */
  shop_items: ItemRef[];
  /** 3D printer offerings. */
  printer_items: ItemRef[];
  /** Items dropped on the floor. */
  ground_items: ItemRef[];
  /** Pending Artifact of Command essences. Just the tier — user picks from options. */
  command_items: CommandItemMarker[];
  /** Player-owned minions, owner-keyed. World-scan cadence (not per-tick). */
  minions: MinionsSummary;
  /** Live teleporter state. Null when the scene has no teleporter (menus,
   *  Bazaar, Void Fields). Per-tick. */
  teleporter: TeleporterBlock | null;
  /** Live boss health bar. Null when no boss group is displaying a HUD bar.
   *  Per-tick. */
  boss: BossBlock | null;
}

// ============================================================================
// Loadout / skills
// ============================================================================

export interface SkillRef {
  /** `SkillDef.skillName` verbatim. The canonical RoR2 skill identifier. */
  id: string;
  /** Localized skill display name. */
  name: string;
  /** Position in the `SkillFamily.variants[]` array; -1 if not found (rare). 0 is the default. */
  variant_index: number;
}

export interface PlayerLoadout {
  display_name: string;
  network_user_id: string;
  survivor: SurvivorRef;
  skills: {
    primary: SkillRef | null;
    secondary: SkillRef | null;
    utility: SkillRef | null;
    special: SkillRef | null;
  };
}

// ============================================================================
// Player block + journal severity model
// ============================================================================

/**
 * Per-player identity block carried by every journalable player-affecting
 * event (pickup_granted, player_died, chest_opened, shrine_used,
 * purchase_made, …). Always key per-player state by `network_user_id`.
 *
 * For real players this is the Steam ID (or platform equivalent). For bots and
 * NetworkUser-less modded characters, `network_user_id` is a synthetic id
 * prefixed `"bot:"` built from a stable runtime id. The synthetic id stays
 * stable within a run; the format may change in future versions.
 */
export interface Player {
  display_name: string;
  network_user_id: string;
  /** True if this player is local to the host machine running the mod. */
  is_local: boolean;
  /** True if there's no associated NetworkUser (drones, bot survivors). */
  is_bot: boolean;
  /**
   * Present only when `is_bot` and this character is a player-owned minion
   * (drone, turret, guard, …): the `network_user_id` of the owning player.
   * Use it to attribute a bot's events to its human. Omitted for human
   * players and ownerless characters.
   */
  owner_network_user_id?: string;
  /**
   * Whether the mod actually identified a character for this event.
   *
   * `false` means a hook fired without a usable interactor and this block is a
   * placeholder, not a player: `network_user_id` is `""`, `display_name` is
   * `"?"`, `survivor` is `null`, and **`is_bot` / `is_local` carry no meaning**
   * — they are not claims about anyone. Gate identity UI (name badges,
   * you-vs-bot labels, per-player keying) on this before using those fields.
   *
   * Rare in practice — vanilla always supplies an interactor on these paths.
   */
  resolved: boolean;
  /**
   * Best-effort survivor sub-block. `null` if the body hasn't spawned yet
   * (very early in a run) or went away before the event fired.
   */
  survivor: SurvivorRef | null;
}

/**
 * Run-scoped currency balances for the acting player, sampled immediately
 * after a spend settled. Attached to `purchase_made`, `chest_opened` and
 * `shrine_used`.
 *
 * Exists so "gold after this purchase" is exact rather than inferred. Pairing
 * an event with the next `inventory_update` balance works live but is wrong on
 * reconnect, because journal-backfilled events have no adjacent sample.
 *
 * Both currencies are always present because purchases can be priced in either
 * (see `purchase.currency`). Lunar coins are deliberately excluded — they're
 * cross-run profile currency, not run state.
 */
export interface Balances {
  gold: number;
  void_coins: number;
}

/**
 * Severity tier carried by every journalable run event.
 *
 * - `"major"` — narrative beats (run_started, stage_changed, player_died,
 *   player_respawned, run_ended, red-tier pickup_granted, boss/teleporter
 *   events).
 * - `"minor"` — granular tactical detail (non-red pickup_granted, plus the
 *   chest_opened / shrine_used / purchase_made / scrapper_used /
 *   item_transformed events).
 * - `"snapshot"` — journal-only: stamped on the periodic `inventory_update`
 *   state copies AND the periodic `run_summary` stat sheets the journal
 *   records (see `RunJournalRequest.include_snapshots`). Never appears on a
 *   live broadcast.
 *
 * Caller-only responses (and the journal's `loadout_response` entry and its
 * final `run_summary`) do NOT carry severity — for `run_summary`, severity's
 * absence is what marks the authoritative final recap.
 *
 * Forward-compat: ignore unknown severity values; future versions may add
 * tiers like `"trivia"`.
 */
export type EventSeverity = "major" | "minor" | "snapshot";

/**
 * Optional callout reason on `pickup_granted`. Present when the pickup
 * deserves UI emphasis (red-tier badge, etc.). Forward-compat: treat
 * unknown values as no-op highlight.
 */
export type HighlightReason = "legendary_pickup";

/**
 * Which code path the item grant came through.
 *
 * - `"pickup"` — `GenericPickupController.AttemptGrant`. The "walked-over"
 *   path: chest rewards, drone bay items, shrine drops, ground items,
 *   command essences. Currency pickups (gold, lunar coins) also use this.
 * - `"give_item"` — `Inventory.GiveItem`. Starting items at run start,
 *   Bottled Chaos auto-procs, scrapper / printer / shop grants, mod-
 *   driven gifts, dev cheats. Items only — no currency.
 *
 * Both sources fire `pickup_granted` events; reentrancy guard prevents
 * a single walked-over grant from emitting twice.
 */
export type PickupSource = "pickup" | "give_item";

// ============================================================================
// Envelope (live messages)
// ============================================================================

/**
 * Every server-to-client live message starts with these fields.
 *
 * - `sequence` is process-monotonic, increases on every server message.
 *   Resets when the mod restarts. Gaps are normal (caller-only responses to
 *   other clients consume sequence numbers your session never sees).
 *
 * - `timestamp` is server-clock UTC ISO 8601. Not guaranteed monotonic across
 *   reconnects — use `sequence` for ordering.
 *
 * - `run_id` is a fresh GUID per run. Empty string outside a run.
 */
export interface LiveEnvelope {
  schema_version: LiveSchemaVersion;
  timestamp: string;
  sequence: number;
  state: GameState;
  run_id: string;
}

// ============================================================================
// Server → client messages (live)
// ============================================================================

export interface HelloMessage extends LiveEnvelope {
  type: "hello";
  mod_name: string;
  mod_version: string;
  ror2_version: string;
  broadcast_intervals: {
    inventory_update_ms: number;
    world_scan_ms: number;
  };
  /** Every command this server understands. Feature-detect against this. */
  capabilities: string[];
}

export interface InventoryUpdateMessage extends LiveEnvelope {
  type: "inventory_update";
  /** Multiplayer fidelity signal. `true` when the mod's machine is the host
   *  (every solo run, or hosting a lobby) — full fidelity, everything in this
   *  file works. `false` when the player JOINED someone else's lobby: state
   *  (this message) keeps streaming, but nearly all *event* messages ride
   *  server-side hooks and will never fire, `run_summary` is degraded, the
   *  journal is sparse, and `timer.stage_seconds` is unreliable. Check once
   *  per run; lean on state diffing when false. See docs.html
   *  § "Hosting vs joining". */
  is_host: boolean;
  timer: Timer;
  stage: Stage;
  difficulty: Difficulty;
  artifacts: ArtifactRef[];
  world: WorldBlock;
  players: PlayerRecord[];
}

export interface RunStartedMessage extends LiveEnvelope {
  type: "run_started";
  severity: "major";
  /** The run's RNG seed as a decimal string. It's a ulong — values above
   *  2^53 lose precision as JSON numbers, so it's stringified. Stable key
   *  for run-history / seed-sharing features. `""` if unreadable. */
  seed: string;
  /** Internal game-mode name verbatim (e.g. "ClassicRun", "InfiniteTowerRun",
   *  "EclipseRun", "WeeklyRun"). Forward-compat: pass unknown values through. */
  game_mode: string;
  /** Selected difficulty. For Eclipse runs this is the Eclipse difficulty
   *  index; pair with `eclipse_level`. */
  difficulty: Difficulty;
  /** 1–8 for Eclipse runs, 0 otherwise. */
  eclipse_level: number;
  /** Artifacts enabled for this run (same shape as `inventory_update.artifacts`). */
  artifacts: ArtifactRef[];
  /** Player slots at run start (bodies may not have spawned yet — the
   *  journal's `loadout_response` entry moments later has the full roster). */
  player_count: number;
}

/**
 * How a run finished.
 *
 * - `"completed"` — a winning ending (`ending.is_win`): the standard escape,
 *   Obliteration, the Voidling kill, and so on. Read `ending.name` to tell
 *   those apart; they are all wins.
 * - `"defeated"`  — a losing ending. The party died out.
 * - `"quit"`      — the player left a live run (quit to menu). RoR2 raises no
 *   game-over for this, which is exactly how it's detected.
 * - `"unknown"`   — a game over fired but carried no ending. Shouldn't happen
 *   in vanilla; treat as "the run ended, outcome unavailable".
 *
 * Not a closed set — treat unrecognized values as `"unknown"`.
 *
 * Note there is NO `run_ended` at all when the game is closed mid-run; the
 * process dies before it can send one. See the run journal's "file ends with
 * a run_summary and no run_ended" signature.
 */
export type RunOutcome = "completed" | "defeated" | "quit" | "unknown" | (string & {});

/** The specific RoR2 ending that fired. Absent (`null`) for `"quit"`. */
export interface GameEnding {
  /** `GameEndingDef.cachedName` verbatim — the canonical RoR2 identifier for
   *  the ending. Stable across languages; use it as your key. */
  name: string;
  /** RoR2's own win flag for this ending. `outcome` is derived from it. */
  is_win: boolean;
  /** Localized ending line as shown in-game. `""` when the mod couldn't
   *  resolve the token (modded endings that ship no localization). */
  text: string;
}

export interface RunEndedMessage extends LiveEnvelope {
  type: "run_ended";
  severity: "major";
  timer: Timer;
  /** How the run finished. Always present. */
  outcome: RunOutcome;
  /** The ending that fired, or `null` when there wasn't one (`"quit"`). */
  ending: GameEnding | null;
}

export interface StageChangedMessage extends LiveEnvelope {
  type: "stage_changed";
  severity: "major";
  stage: Stage;
  timer: Timer;
}

/**
 * Death attribution on `player_died`. Always present; discriminate on `kind`:
 *
 * - `"monster"` — killed by an enemy (or an enemy-owned minion, which
 *   attributes to the minion's own body: "killed by Engineer Turret").
 *   DoT deaths (burn, bleed) attribute to whoever applied the DoT.
 * - `"player"` — killed by another player (Artifact of Chaos friendly fire).
 * - `"fall"` — fall damage; no attacker fields.
 * - `"unknown"` — no attacker and not a fall: void fog, map hazards, mod
 *   damage with no source. No attacker fields.
 *
 * Forward-compat: treat unknown `kind` values like `"unknown"`.
 */
export interface KilledBy {
  kind: "monster" | "player" | "fall" | "unknown" | (string & {});
  /** Attacker's canonical body id (e.g. "GolemBody"), `(Clone)` stripped.
   *  Present for `"monster"` / `"player"`. */
  body_name?: string;
  /** Attacker's localized display name (e.g. "Stone Golem"). */
  name?: string;
  /** True when the attacker body was elite. */
  is_elite?: boolean;
}

export interface PlayerDiedMessage extends LiveEnvelope {
  type: "player_died";
  severity: "major";
  player: Player;
  /** Who or what killed them. */
  killed_by: KilledBy;
  timer: Timer;
  stage: Stage;
}

export interface PickupGrantedMessage extends LiveEnvelope {
  type: "pickup_granted";
  /** `"major"` if `item.tier === "Tier3"` (red), else `"minor"`. */
  severity: EventSeverity;
  /** Present and `"legendary_pickup"` for red-tier items; omitted otherwise. */
  highlight_reason?: HighlightReason;
  /** Which code path the grant came through. See `PickupSource`. */
  source: PickupSource;
  /**
   * Present when this grant could be linked to the interaction that produced
   * it — e.g. `"chest:<id>"` echoing the `chest_opened` this pickup dropped
   * from. Best-effort: matched by item + timing, so it may be absent or (rarely,
   * with several identical drops in flight) attributed to the wrong open.
   */
  source_id?: string;
  player: Player;
  /**
   * The granted item. Carries the `permanent`/`temp`/`temp_decay`/`channeled`
   * breakdown for THIS grant (see `ItemRef`) — a temporary-item pickup reports
   * `temp > 0` rather than appearing as a permanent grant.
   */
  item: ItemRef;
  timer: Timer;
  stage: Stage;
}

/** Holdout charging begins — boss fight kicks off. */
export interface TeleporterActivatedMessage extends LiveEnvelope {
  type: "teleporter_activated";
  severity: "major";
  timer: Timer;
  stage: Stage;
}

/** Holdout zone hits 100%; post-charge exit opens. Bosses may still be alive. */
export interface TeleporterChargedMessage extends LiveEnvelope {
  type: "teleporter_charged";
  severity: "major";
  timer: Timer;
  stage: Stage;
}

/** Shrine of the Mountain activated. `stack_count` is the new total. */
export interface ShrineMountainActivatedMessage extends LiveEnvelope {
  type: "shrine_mountain_activated";
  severity: "major";
  /** Always present. If the acting character couldn't be resolved you get a
   *  placeholder block (`network_user_id: ""`), never `null` — see `Player`. */
  player: Player;
  timer: Timer;
  stage: Stage;
  stack_count: number;
}

/** Newt altar purchased — Bazaar entry portal will spawn at end-of-stage. */
export interface NewtAltarUsedMessage extends LiveEnvelope {
  type: "newt_altar_used";
  severity: "major";
  /** Always present. If the acting character couldn't be resolved you get a
   *  placeholder block (`network_user_id: ""`), never `null` — see `Player`. */
  player: Player;
  timer: Timer;
  stage: Stage;
}

/**
 * Container opened. Emitted when the chest rolls and drops its reward, so
 * `pickup` carries the rolled item inline (`null` only if the chest dropped
 * nothing or the roll couldn't be read). `source_id` (`"chest:<id>"`) links
 * this open to the `pickup_granted` fired when a player collects the drop —
 * see `PickupGrantedMessage.source_id`.
 */
export interface ChestOpenedMessage extends LiveEnvelope {
  type: "chest_opened";
  severity: "minor";
  /** Stable id for this open; echoed on the resulting `pickup_granted`. */
  source_id: string;
  /** `null` when the chest was opened without a tracked player interaction —
   *  the only event where this block can be absent entirely. */
  player: Player | null;
  timer: Timer;
  stage: Stage;
  chest: {
    kind:
      | "small"
      | "large"
      | "legendary"
      | "lunar"
      | "cloaked"
      | "scavenger"
      | "adaptive"
      | "equipment"
      /** Fallback when the container's prefab name isn't recognized. */
      | "unknown";
    cost: number;
    /**
     * The container's dominant drop tier — derived from `kind`, NOT the tier
     * of the item actually rolled (read `pickup.tier` for that).
     *
     * The tracked path only ever emits `Tier1` / `Tier2` / `Tier3` / `Lunar` /
     * `Equipment`. When `kind` is `"unknown"` there's no container to derive
     * from and this falls back to the rolled pickup's own tier, which can be
     * any `ItemTier` — `Boss`, the `Void*` tiers, or a modded one.
     */
    tier: ItemTier;
  };
  /** Balances after paying `chest.cost`, captured when the chest was paid for
   *  rather than when it dropped. `null` for an untracked open (no payer). */
  balances_after: Balances | null;
  /** The rolled reward, inline. `null` if the chest produced no item. */
  pickup: ItemRef | null;
}

/** Shrine activation (Chance / Combat / Blood / Order / Woods). Mountain
 *  shrine is its own event. Shrine of Chance drops an item, so it carries
 *  `source_id` and an inline `pickup`; the other kinds carry neither. */
export interface ShrineUsedMessage extends LiveEnvelope {
  type: "shrine_used";
  severity: "minor";
  /** Always present. Check `player.resolved` before trusting its identity. */
  player: Player;
  timer: Timer;
  stage: Stage;
  shrine: {
    kind: "chance" | "combat" | "blood" | "order" | "woods";
    cost: number;
    outcome: "success" | "fail";
  };
  /** Balances after paying `shrine.cost`. `null` if unreadable. */
  balances_after: Balances | null;
  /** Present for Shrine of Chance drops; echoed on the resulting `pickup_granted`. */
  source_id?: string;
  /** The rolled reward (Shrine of Chance), inline. Best-effort — absent if the
   *  roll couldn't be captured. Other shrine kinds omit this. */
  pickup?: ItemRef | null;
}

/** Generic purchase from shop / multishop / printer / lunar_pod. */
export interface PurchaseMadeMessage extends LiveEnvelope {
  type: "purchase_made";
  severity: "minor";
  /** Always present. Check `player.resolved` before trusting its identity. */
  player: Player;
  timer: Timer;
  stage: Stage;
  purchase: {
    source: "shop" | "multishop" | "printer" | "lunar_pod";
    cost: number;
    currency: "gold" | "lunar" | "voidcoin" | "items";
    /** The interactable's localized display name (e.g. "Gunner Drone",
     *  "Legged Bench"). Present when it resolved to a real string — useful for
     *  drones/turrets/chairs that otherwise fall through to source "shop".
     *  Omitted when unresolved; fall back to the source label. */
    name?: string;
  };
  /** Balances after paying `purchase.cost`. `null` if unreadable. */
  balances_after: Balances | null;
  pickup: null;
}

/** Encounter-level boss defeat. `bosses[]` aggregates distinct body types
 *  with counts; one event per BossGroup, not per corpse. */
export interface BossDefeatedMessage extends LiveEnvelope {
  type: "boss_defeated";
  severity: "major";
  timer: Timer;
  stage: Stage;
  bosses: Array<{
    body_name: string;
    count: number;
    is_elite: boolean;
  }>;
}

/**
 * Known `transform_type` values (RoR2 `TransformationType` enum names,
 * verbatim). Forward-compat: treat unknown strings as a generic transform.
 *
 * - `"ContagiousVoid"` — void item corruption (items → their void versions).
 * - `"CloverVoid"` — Benthic Bloom upgrades.
 * - `"Suppressed"` — Seeker item suppression.
 * - `"RegeneratingScrapRegen"` / `"SaleStarRegen"` /
 *   `"TeleportOnLowHealthRegen"` — consumed-item regeneration at stage start.
 * - `"LunarSun"` — Egocentrism. Listed for completeness, but Egocentrism
 *   bypasses the code path this event hooks, so you will normally NOT see it
 *   here — watch journal snapshots for its conversions instead.
 */
export type ItemTransformType =
  | "Default"
  | "ContagiousVoid"
  | "CloverVoid"
  | "Suppressed"
  | "LunarSun"
  | "RegeneratingScrapRegen"
  | "SaleStarRegen"
  | "TeleportOnLowHealthRegen"
  | (string & {});

/**
 * An item stack was fed to a scrapper. `item` is what went in (`count` =
 * stacks consumed), `scrap` is what came out (`count` = scrap produced).
 * The scrap drops from the scrapper as a ground pickup, so collecting it
 * later fires a normal `pickup_granted` — this event is the only record of
 * WHAT was sacrificed.
 */
export interface ScrapperUsedMessage extends LiveEnvelope {
  type: "scrapper_used";
  severity: "minor";
  player: Player;
  timer: Timer;
  stage: Stage;
  /** The item consumed. `count` = stacks scrapped. */
  item: ItemRef;
  /** The scrap produced (e.g. "ScrapWhite"). `count` = scrap created. */
  scrap: ItemRef;
}

/**
 * Items changed identity inside a player's inventory — void corruption,
 * Benthic Bloom, suppression, consumed-item regeneration. One event per
 * transformation (a whole stack converting at once is one event with
 * `taken_item.count` = the stack size).
 */
export interface ItemTransformedMessage extends LiveEnvelope {
  type: "item_transformed";
  severity: "minor";
  /** What kind of transformation this was. */
  transform_type: ItemTransformType;
  player: Player;
  timer: Timer;
  stage: Stage;
  /** The stack consumed. */
  taken_item: ItemRef;
  /** The stack produced in its place. */
  given_item: ItemRef;
}

/**
 * A previously-dead player got a new body: Dio's Best Friend, Pluripotent
 * Larva, or the automatic multiplayer respawn when the next stage loads.
 * Only fires for players that emitted `player_died` earlier — regular stage
 * transitions of living players do NOT emit this.
 */
export interface PlayerRespawnedMessage extends LiveEnvelope {
  type: "player_respawned";
  severity: "major";
  player: Player;
  timer: Timer;
  stage: Stage;
}

export interface PongMessage extends LiveEnvelope {
  type: "pong";
}

/**
 * Machine-readable code on an `error` reply. Stable vocabulary:
 * - `"bad_json"` — the message couldn't be parsed as JSON at all.
 * - `"unknown_request"` — parsed fine, but `type` isn't a request this mod
 *   version serves. Feature-detect against `hello.capabilities`.
 * - `"rate_limited"` — a per-client request limit was hit; `retry_after_ms`
 *   says how long until the window opens.
 * Forward-compat: treat unknown codes as a generic error.
 */
export type ErrorCode = "bad_json" | "unknown_request" | "rate_limited";

/**
 * Caller-only error reply. Sent instead of silence when a request is
 * malformed, unrecognized, or over a rate limit — a typo'd request is
 * debuggable from the client without host log access. Never broadcast.
 * Feature-detect via `"error"` in `hello.capabilities`.
 */
export interface ErrorMessage extends LiveEnvelope {
  type: "error";
  error: ErrorCode;
  /** Human-readable explanation. Display or log; don't parse. */
  detail: string;
  /** The offending request's `type`, echoed back ("" when unparseable). */
  request_type: string;
  /** The offending request's `request_id`, echoed back ("" when absent). */
  request_id: string;
  /** Only on `rate_limited`: milliseconds until the limit window reopens. */
  retry_after_ms?: number;
}

/**
 * Per-player combat stats from RoR2's stat system, included in `run_summary`.
 * Counts are integers; `damage_*`, `distance_traveled`, and `health_healed`
 * are floating-point. Any field RoR2 doesn't track for a player reads as 0.
 */
export interface RunSummaryPlayerStats {
  /** Matches `PlayerRecord.network_user_id` (`"bot:"` fallback for bots). */
  network_user_id: string;
  display_name: string;
  kills: number;
  minion_kills: number;
  elite_kills: number;
  deaths: number;
  damage_dealt: number;
  minion_damage_dealt: number;
  damage_taken: number;
  health_healed: number;
  gold_collected: number;
  distance_traveled: number;
  items_collected: number;
  stages_completed: number;
  highest_level: number;
}

export interface RunSummaryMessage extends LiveEnvelope {
  type: "run_summary";
  /**
   * Journal-only: `run_summary` stat sheets recorded on the snapshot cadence
   * carry `severity: "snapshot"` (excluded from `request_run_journal` replies
   * unless you opt in — stat progression over time, not the final recap).
   * The final authoritative summary — broadcast at run end and journaled just
   * before `run_ended` — never carries severity.
   */
  severity?: "snapshot";
  timer: Timer;
  stage_clear_count: number;
  /**
   * Item counts aggregated across every active player inventory (party-wide,
   * not per player). Keys are `ItemTier` values.
   *
   * Counts **permanent stacks only** — temp and channeled copies are excluded,
   * unlike `PlayerRecord.items[].count`, which is the effective total. Holding
   * temporary items makes the two surfaces disagree by design. `NoTier` items
   * are excluded entirely, and players whose body has despawned still count
   * here even though they're absent from `inventory_update.players[]`.
   */
  items_by_tier: Partial<Record<ItemTier, number>>;
  total_deaths: number;
  /** Deaths keyed by `network_user_id` (`"bot:"`-prefixed fallback for bots). */
  deaths_by_player: Record<string, number>;
  /** Per-player combat stats (kills, damage, gold, distance, …). One per player master. */
  players: RunSummaryPlayerStats[];
}

export interface LoadoutResponseMessage extends LiveEnvelope {
  type: "loadout_response";
  players: PlayerLoadout[];
}

/**
 * A single journal entry. Most entries are verbatim copies of broadcast
 * events; four journal-only entry kinds round the journal out into a
 * complete, self-contained run record:
 *
 * - a `loadout_response` right after `run_started` — the opening roster
 *   (who's playing which survivor with which skills);
 * - `inventory_update` state snapshots stamped with `severity: "snapshot"` —
 *   periodic (cadence set by the mod's `snapshot_interval_seconds` config)
 *   plus boundary snapshots at each stage start, at game over, and a final
 *   one at run end — the exact final build when run state is still readable
 *   (always the case for death/victory via the game-over capture), else a
 *   reissue of the last live capture. Excluded from `request_run_journal`
 *   responses unless you opt in;
 * - `run_summary` stat sheets stamped `severity: "snapshot"` on the same
 *   cadence — kills/damage/deaths over time. Same opt-in as state snapshots;
 * - a final `run_summary` (no severity) just before `run_ended` — the
 *   authoritative recap.
 *
 * Use the `type` discriminator to narrow to the specific shape.
 */
export type JournalEntry =
  | RunStartedMessage
  | RunEndedMessage
  | StageChangedMessage
  | PlayerDiedMessage
  | PlayerRespawnedMessage
  | PickupGrantedMessage
  | TeleporterActivatedMessage
  | TeleporterChargedMessage
  | ShrineMountainActivatedMessage
  | NewtAltarUsedMessage
  | ChestOpenedMessage
  | ShrineUsedMessage
  | PurchaseMadeMessage
  | BossDefeatedMessage
  | ScrapperUsedMessage
  | ItemTransformedMessage
  // Journal-only entries (never re-broadcast):
  | LoadoutResponseMessage
  | RunSummaryMessage
  | (InventoryUpdateMessage & { severity: "snapshot" });

export interface RunJournalResponseMessage extends LiveEnvelope {
  type: "run_journal_response";
  /** Echoed from the matching `RunJournalRequest.request_id` (or `""`). */
  request_id: string;
  /** Entries currently held in the ring buffer (unfiltered). */
  buffer_count: number;
  /** Entries matching the request filters before `limit` was applied. */
  matched_count: number;
  /** Entries actually returned in `entries[]` (post-filter, post-limit). */
  returned_count: number;
  /** `true` if more matching entries exist after this page. */
  has_more: boolean;
  /** `true` if any entries have been dropped from the head over this run. */
  history_truncated: boolean;
  /** Total entries dropped from the head over the whole run. */
  dropped_count: number;
  /** Sequence range currently held in the buffer (regardless of filters). */
  oldest_sequence: number;
  newest_sequence: number;
  /** Verbatim event payloads, in sequence order. */
  entries: JournalEntry[];
}

/**
 * Union of every live (schema_version 2) server-to-client message. Narrow on
 * the `type` discriminator to access fields specific to each.
 */
export type LiveMessage =
  | HelloMessage
  | InventoryUpdateMessage
  | RunStartedMessage
  | RunEndedMessage
  | StageChangedMessage
  | PlayerDiedMessage
  | PickupGrantedMessage
  | TeleporterActivatedMessage
  | TeleporterChargedMessage
  | ShrineMountainActivatedMessage
  | NewtAltarUsedMessage
  | ChestOpenedMessage
  | ShrineUsedMessage
  | PurchaseMadeMessage
  | BossDefeatedMessage
  | ScrapperUsedMessage
  | ItemTransformedMessage
  | PlayerRespawnedMessage
  | PongMessage
  | RunSummaryMessage
  | LoadoutResponseMessage
  | RunJournalResponseMessage
  | ErrorMessage;

// ============================================================================
// Server → client messages (dump v1)
// ============================================================================

export interface ModdedItemsStartMessage {
  type: "modded_items_start";
  schema_version: DumpSchemaVersion;
  count: number;
  mods: Array<{
    id: string;
    name: string;
    version: string;
    count: number;
  }>;
}

/**
 * One catalog record in the modded-item dump. It keeps the legacy v1 fields
 * (`id`, `rarity`, `source_mod*`) for backwards compatibility AND carries the
 * live v2 identity (`qualified_id`, `pack_id`, `tier`) so a catalog entry joins
 * directly against the `ItemRef` you see in `inventory_update` / `pickup_granted`.
 *
 * Fields sourced from optional/localized data are omitted when empty, so treat
 * everything except `id`, `is_equipment`, `tier`, `rarity_color`, `source_mod`,
 * and `source_mod_id` as possibly absent.
 */
export interface ModdedItemRecord {
  /** Legacy dump id, e.g. `"item_fork"` / `"equipment_something"`. Snake-cased, prefixed. */
  id: string;
  /** Live join key — equals `ItemRef.qualified_id` (`pack_id + "|" + ItemDef.name`). Use this to link to live data. */
  qualified_id?: string;
  /** Raw `ContentPack.identifier` — equals `ItemRef.pack_id`. */
  pack_id?: string;
  name?: string;
  basic_description?: string;
  detailed_description?: string;
  /** Human-friendly rarity label (`"Common"`, `"Legendary"`, `"Void"`, …). */
  rarity?: string;
  /** Raw `ItemTier` enum string — same vocabulary as `ItemRef.tier`. */
  tier: string;
  /** Tier color as `#RRGGBB`. */
  rarity_color: string;
  is_equipment: boolean;
  category?: string[];
  dlc?: string;
  lore?: string[];
  /** Humanized source-mod name (e.g. `"Team Moonstorm"`). Display only — join on `pack_id`. */
  source_mod: string;
  /** Derived snake-case mod segment (e.g. `"team_moonstorm"`). NOT the pack id — use `pack_id` to join. */
  source_mod_id: string;
  /** Inline base64-encoded PNG icon. */
  image_base64?: string;
}

export interface ModdedItemMessage {
  type: "modded_item";
  schema_version: DumpSchemaVersion;
  item: ModdedItemRecord;
}

export interface ModdedItemsEndMessage {
  type: "modded_items_end";
  schema_version: DumpSchemaVersion;
  /** Whether the host produced the full catalog. Note this reports what the
   *  host BUILT and queued, not what reached you — sends are handed to a
   *  background writer, so a transport failure shows up as a closed socket or
   *  a short stream, not as `ok: false`. Count the `modded_item` messages you
   *  actually received and compare against `sent`. */
  ok: boolean;
  /** Number of `modded_item` messages the host queued for you. Matches
   *  `modded_items_start.count`. */
  sent: number;
  /** Records the host failed to build. Items that throw while being built are
   *  skipped and logged host-side; in practice this is 0. */
  failed: number;
}

export interface ChallengesMessage {
  type: "challenges";
  schema_version: DumpSchemaVersion;
  challenges: Array<{
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
  }>;
}

/**
 * Union of every dump (schema_version 1) server-to-client message.
 */
export type DumpMessage =
  | ModdedItemsStartMessage
  | ModdedItemMessage
  | ModdedItemsEndMessage
  | ChallengesMessage;

// ============================================================================
// Server → client (combined)
// ============================================================================

/**
 * Union of every message your app might receive. Narrow first on
 * `schema_version` (or `type`) to get either a live or dump message.
 */
export type ServerMessage = LiveMessage | DumpMessage;

// ============================================================================
// Client → server requests
// ============================================================================

export interface PingRequest {
  type: "ping";
}

export interface WorldStateRequest {
  type: "request_world_state";
}

/**
 * Mid-run: replies with live current-run totals. Between runs the mod serves
 * the just-ended run's final summary from its last-known-good capture — the
 * reply keeps that run's `run_id`, which is how you tell "current run" from
 * "last run's finals". An empty summary only appears before the first capture
 * of the session (fresh boot, no run played yet).
 */
export interface RunSummaryRequest {
  type: "request_run_summary";
}

export interface LoadoutRequest {
  type: "request_loadout";
}

export interface ModdedItemsRequest {
  type: "request_modded_items";
}

export interface ChallengesRequest {
  type: "request_challenges";
}

/**
 * Fetch the run journal — see docs.html §"Run journal & reconnect".
 *
 * All filter fields are optional and AND-style. Default and max `limit` are
 * both 2000. `since_sequence` is exclusive — use the last sequence your app
 * processed as a cursor for keyset pagination.
 *
 * Rate-limited 1/sec per session, independent of `request_world_state`.
 */
export interface RunJournalRequest {
  type: "request_run_journal";
  request_id?: string;
  /** Return only entries with `sequence > since_sequence`. */
  since_sequence?: number;
  /** Max entries to return. Default and max are both 2000. */
  limit?: number;
  /** Filter to these severities. Empty/omitted = no filter. */
  severities?: EventSeverity[];
  /** Filter to these exact event-type strings. Empty/omitted = no filter. */
  event_types?: string[];
  /** Filter to entries whose `stage.number` matches. */
  stage_number?: number;
  /** Snapshot-severity entries (full `inventory_update` state copies AND
   *  periodic `run_summary` stat sheets, both `severity: "snapshot"`) are
   *  EXCLUDED from responses by default — they would bloat a reconnect
   *  catch-up. Set `true` to include them (naming `"snapshot"` in
   *  `severities` also opts in). Default `false`. */
  include_snapshots?: boolean;
}

/**
 * Union of every client-to-server request your app can send.
 */
export type ClientRequest =
  | PingRequest
  | WorldStateRequest
  | RunSummaryRequest
  | LoadoutRequest
  | ModdedItemsRequest
  | ChallengesRequest
  | RunJournalRequest;

// ============================================================================
// Type guards
// ============================================================================

/** True if `msg` is a live-protocol message (schema_version 2). */
export function isLiveMessage(msg: unknown): msg is LiveMessage {
  return !!msg && typeof msg === "object"
    && (msg as { schema_version?: unknown }).schema_version === 2;
}

/** True if `msg` is a dump-protocol message (schema_version 1). */
export function isDumpMessage(msg: unknown): msg is DumpMessage {
  return !!msg && typeof msg === "object"
    && (msg as { schema_version?: unknown }).schema_version === 1;
}

/** Returns the `type` discriminator from any message, or undefined. */
export function messageType(msg: unknown): string | undefined {
  if (!msg || typeof msg !== "object") return undefined;
  const t = (msg as { type?: unknown }).type;
  return typeof t === "string" ? t : undefined;
}

// ============================================================================
// Feature detection
// ============================================================================

/**
 * Tiny helper for feature-detecting against `hello.capabilities`.
 *
 * ```ts
 * const caps = capabilitySet(hello);
 * if (caps.has("request_loadout")) ws.send(JSON.stringify({ type: "request_loadout" }));
 * ```
 */
export function capabilitySet(hello: HelloMessage): Set<string> {
  return new Set(hello.capabilities);
}

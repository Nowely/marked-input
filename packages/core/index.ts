// ═══ Public API v2 (spec §2.3) ════════════════════════════════════════════════
export {MarkputApi} from './src/store/MarkputApi'
// The ONLY resolution path for both adapters, which import it as a value and construct it.
export {Store} from './src/store'
// `Anchors` is public because `OverlayMatch.range` is one (S2.5): the overlay contract both
// adapters carry names nodes now, so the type has to be nameable outside core.
export type {Anchors, Id, MarkNode, MarkPatch, NodeAnchor, TextNode, TreeNode} from './src/features/tokens'

// String-domain utilities (spec §2.3: keep)
export {annotate, denote} from './src/features/tokens'
export type {Markup} from './src/features/tokens'

// Adapter utilities (spec §2.3: keep)
export {cx} from './src/shared/utils'
export {key} from './src/shared/classes'
export {filterSuggestions, navigateSuggestions} from './src/features/overlay'
export {getAlwaysShowHandle} from './src/features/block'
export type {
	OverlayMatch,
	OverlayTrigger,
	CoreOption,
	CSSProperties,
	CoreSlots,
	DataAttributes,
	DraggableConfig,
	Slot,
	// NOT dead, and invisible to grep: both adapters carry
	// `declare module '@markput/core' { interface SlotRegistry {…} }` (react/vue
	// src/augment.ts). Drop the export and `Slot` collapses to `unknown`, which fails
	// every slot component as a JSX element (TS2604/TS2786, 8 errors). §2.3's table
	// lists it among the zero-importer drops; a module augmentation is not an import.
	SlotRegistry,
} from './src/shared/types'

// The `useMarkput` runtime. §2.3's "signal/computed/watch/batch not exported from root"
// row is WRONG for these five and for `watch`'s role as the `changed` subscription verb:
// `computed` + `watch` are react `useMarkput`'s runtime (useMarkput.ts:1), `effect` is
// vue's (:1), and `Computed`/`SignalValues` are in their signatures. The rest of the
// reactive system — signal, batch, event, isReactive, Signal, Event — has zero non-core
// importers and is gone.
export {computed, effect, watch} from './src/shared/signals'
export type {Computed, SignalValues} from './src/shared/signals'
export {readSelected} from './src/shared/readSelected'
export type {Selectable, ObjectSelector} from './src/shared/readSelected'

// Mark metadata (spec §2.3: keep — the whole implementation of useMarkInfo)
export {toMarkInfo} from './src/shared/editorContracts'
export type {MarkInfo} from './src/shared/editorContracts'

// ═══ Snapshot render loop ═════════════════════════════════════════════════════
// `Token[]` is the RENDER PROJECTION. It has exactly two production readers outside core
// — react `Container.tsx` and vue `Container.vue`, both off `renderTree`; the dozen other
// adapter files only TYPE on the `Token` family. Moving the loop onto `input.nodes()`
// would NOT move `bind`/`commit` with it: those already run off the commit pipeline's
// private `latest`, deliberately never `renderTree` (`dom/commit.ts`, the `latest`
// declaration and `bindAndAnnounce`). An earlier version of this comment claimed
// otherwise; that claim was the premise behind phase S1.10, which was investigated and
// REJECTED (spec §11). `Token` stays regardless of where the loop reads from: it is the
// parser's output type (`parser/Parser.ts#parse`) and the §7.1 correctness oracle the
// tree specs assert through (`stripIds`).
export type {Token, TextToken, MarkToken} from './src/features/tokens'
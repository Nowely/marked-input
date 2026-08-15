import {defineMark} from '../../shared/lib/marks'

/**
 * The page's one framework-resolved fixture. Its stories mount the seam's marks directly, so
 * nothing else here has a framework half.
 *
 * Spec fixture: the adapter-owned text surface the cross-select spec configures.
 */
export const Span = defineMark({tag: 'strong'})
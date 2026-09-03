/**
 * The people a `@` can name. `meta` is the id the document stores, `value` is what it shows.
 *
 * Shared by both fixtures rather than declared in each: the picker's contents are what the specs
 * type against — `@Mi` narrows to Milo Freeman in both projects — so a list spelled twice is a
 * divergence waiting to happen. The type is each adapter's own `Suggestion`, applied where it is
 * used; this module imports nothing.
 */
export const TEAM = [
	{value: 'Kara Vance', meta: 'kara.vance'},
	{value: 'Ines Duarte', meta: 'ines.duarte'},
	{value: 'Milo Freeman', meta: 'milo.freeman'},
	{value: 'Priya Raman', meta: 'priya.raman'},
	{value: 'Tomas Alvarez', meta: 'tomas.alvarez'},
	{value: 'Platform', meta: 'team-platform'},
] as const
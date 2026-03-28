export function getAlwaysShowHandleDrag(drag: boolean | {alwaysShowHandle: boolean}): boolean {
	return typeof drag === 'object' && !!drag.alwaysShowHandle
}
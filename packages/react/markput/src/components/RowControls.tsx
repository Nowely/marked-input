import {ROW_MENU_ITEMS, cx, getAlwaysShowHandle} from '@markput/core'
import type {RowBox} from '@markput/core'
import {memo, useEffect, useLayoutEffect, useMemo, useState} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {List} from './Popup/List'
import {ListItem} from './Popup/ListItem'
import {Popup} from './Popup/Popup'

import styles from '@markput/core/styles.module.css'

/**
 * ONE absolutely positioned row-controls layer per editor: it paints the grip, the drop indicator
 * and the row menu at row boxes it MEASURES, where `.Row { position: relative }` used to make
 * them free inside every row.
 *
 * `RowControls`, not `BlockLayer`: `Block.tsx` is the row WRAPPER, and two near-identical names
 * beside each other is the ambiguity this one is named to avoid.
 *
 * It lives INSIDE the container — the alternative, a new wrapper element in `MarkedInput`, would
 * impose a published DOM change on every consumer for internal convenience. That puts it inside
 * the editing host, so it registers as a `control()` root: one registration for the whole editor,
 * where the per-row controls filed up to four PER ROW, and everything painted inside it inherits
 * `isContentEditable === false` from it.
 */
const iconGrip = `${styles.Icon} ${styles.IconGrip}`

export const RowControls = memo(() => {
	const {controller, tokens, readOnly, draggable, rows, hovered, dragging, drop, menu, geometry} = useMarkput(s => ({
		controller: s.rows,
		tokens: s.tokens,
		readOnly: s.props.readOnly,
		draggable: s.props.draggable,
		rows: s.tokens.nodes,
		hovered: s.rows.state.hovered,
		dragging: s.rows.state.dragging,
		drop: s.rows.state.drop,
		menu: s.rows.state.menu,
		geometry: s.rows.state.geometry,
	}))
	const controlRef = useMemo(() => tokens.control(), [tokens])
	const alwaysShowHandle = useMemo(() => getAlwaysShowHandle(draggable), [draggable])

	// The row the grip decorates: the dragged row while a drag is live, else the hovered one.
	// The fallback is what `alwaysShowHandle` now means — one layer cannot paint a grip on every
	// row, so the option is "one grip, on the row nearest the pointer", resting on the first row
	// while the pointer is away. DECLARED BEHAVIOUR CHANGE on a published option.
	const gripRow = dragging ?? hovered ?? (alwaysShowHandle ? (rows[0]?.id ?? null) : null)

	// Geometry is MEASURED, not inherited from a `position: relative` ancestor. In a layout
	// effect, so it sees the painted DOM of this very commit, and re-run on `geometry` — the
	// container's own resize/scroll clock.
	//
	// The GRIP alone: the drop indicator's line arrives already resolved on `state.drop`, measured
	// by the `dragover` that resolved the placement it will perform, so the layer cannot paint an
	// indicator anywhere but where the drop will land.
	const [gripBox, setGripBox] = useState<RowBox | null>(null)
	useLayoutEffect(() => {
		setGripBox(gripRow === null ? null : (controller.boxOf(gripRow) ?? null))
	}, [controller, gripRow, geometry])

	// A row that GROWS as the user types moves the grip with it, and the container's own observer
	// says nothing when the container's size is fixed. Observing the ONE decorated row is the
	// cheapest correct trigger.
	useEffect(() => {
		if (gripRow === null) return
		const element = tokens.handle(gripRow)?.element()
		if (!element) return
		const observer = new ResizeObserver(() => setGripBox(controller.boxOf(gripRow) ?? null))
		observer.observe(element)
		return () => observer.disconnect()
	}, [controller, tokens, gripRow])

	return (
		<div ref={controlRef} className={styles.RowControls}>
			{!readOnly && gripRow !== null && gripBox !== null && (
				<div
					className={cx(
						styles.SidePanel,
						// Painted but INVISIBLE while its row is being dragged, as the per-row
						// panel was: the grip stays mounted so its own `dragend` still fires
						// (Chromium sends no mouseup for a drag), and the pointer is away with
						// the drag image anyway.
						alwaysShowHandle ? styles.SidePanelAlways : dragging === null && styles.SidePanelVisible
					)}
					// `left` is the ROW's left edge; `.SidePanel`'s negative margin hangs the
					// band off it. The layer's own origin would put it on top of the text
					// wherever core reserves no gutter — `draggable: false`.
					style={{top: gripBox.top, left: gripBox.left, height: gripBox.height}}
				>
					<button
						type="button"
						// The grip is also the menu trigger, so it renders in block mode regardless;
						// `draggable` gates only the drag affordance it carries.
						draggable={!!draggable}
						className={cx(styles.GripButton, dragging !== null && styles.GripButtonDragging)}
						aria-label={draggable ? 'Drag to reorder or click for options' : 'Block options'}
						onMouseDown={controller.pinHover}
						onDragStart={e => controller.beginDrag(gripRow, e.nativeEvent)}
						onDragEnd={() => controller.endDrag()}
						onClick={e => {
							e.preventDefault()
							controller.openMenu(gripRow, e.currentTarget.getBoundingClientRect())
						}}
					>
						<span className={iconGrip} />
					</button>
				</div>
			)}

			{drop && (
				<div
					className={styles.DropIndicator}
					// `left` says the DEPTH the drop will land at: core indents the line by the
					// measured indent unit, so the indicator answers "where" and "how deep" at once.
					style={{top: drop.line.top - 1, left: drop.line.left, width: drop.line.width}}
				/>
			)}

			{menu && (
				<Popup
					ref={(el: HTMLElement | null) => {
						controller.menuElement(el)
					}}
					style={{top: menu.top, left: menu.left, pointerEvents: 'auto'}}
				>
					<List>
						{ROW_MENU_ITEMS.map(item => (
							<ListItem key={item.label} onClick={() => item.run(controller)}>
								<span className={item.iconClass} />
								<span>{item.label}</span>
							</ListItem>
						))}
					</List>
				</Popup>
			)}
		</div>
	)
})

RowControls.displayName = 'RowControls'
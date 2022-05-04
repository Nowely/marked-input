export function getCaretIndex(element: HTMLElement) {
    let position = 0;

    const selection = window.getSelection();
    // Check if there is a selection (i.e. cursor in place)
    if (!selection?.rangeCount) return position;

    // Store the original range
    const range = selection.getRangeAt(0);
    //selection.setPosition(element, 1)
    // Clone the range
    const preCaretRange = range.cloneRange();
    // Select all textual contents from the contenteditable element
    preCaretRange.selectNodeContents(element);
    // And set the range end to the original clicked position
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    // Return the text length from contenteditable start to the range end
    position = preCaretRange.toString().length;

    return position
}

export function setCaretToEnd(element: HTMLElement) {
    const selection = window.getSelection();
    selection?.setPosition(element, 1)
}

export function setCaretTo(element: HTMLElement, offset: number) {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    range?.setStart(range.startContainer, offset)
    range?.setEnd(range.startContainer, offset)
}

export function setCaretRightTo(element: HTMLElement, offset: number) {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    range?.setStart(range.endContainer, offset)
    range?.setEnd(range.endContainer, offset)
}

export enum PLACEHOLDER {
    Id = '__id__',
    Value = '__value__',
}

type id = `${string}${PLACEHOLDER.Id}${string}`
type value = `${string}${PLACEHOLDER.Value}${string}`
export type Mark = `${value}${id}` | `${id}${value}` | `${id}`

export const markupToRegex = (markup: string) => {
    const escapedMarkup = escapeRegex(markup)
    const charAfterDisplay = markup[markup.indexOf(PLACEHOLDER.Value) + PLACEHOLDER.Value.length]
    const charAfterId = markup[markup.indexOf(PLACEHOLDER.Id) + PLACEHOLDER.Id.length]
    return new RegExp(escapedMarkup
        .replace(PLACEHOLDER.Value, `([^${escapeRegex(charAfterDisplay || '')}]+?)`)
        .replace(PLACEHOLDER.Id, `([^${escapeRegex(charAfterId || '')}]+?)`),
    )
}

export const makeMentionsMarkup = (markup: string, id: string, value: string) => {
    return markup
        .replace(PLACEHOLDER.Id, id)
        .replace(PLACEHOLDER.Value, value)
}

// escape RegExp special characters https://stackoverflow.com/a/9310752/5142490
export const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
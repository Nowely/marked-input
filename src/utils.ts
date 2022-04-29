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
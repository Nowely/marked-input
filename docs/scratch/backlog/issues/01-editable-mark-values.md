# Editable mark values

Status: needs-info

A mark's own text has never been editable, on any branch: a `contenteditable` nested inside another editable element is not its own editing host, so a consumer's `onInput` never fires. Core has to own it — keep a consumer-declared attribute, exempt the island on both guard tiers, stop pulling the caret out of it, route the edit into `mark.update({value})`. Choose the last step: compute the new value from the event (keeps the DOM out of the value; recommended) or read the element's text back afterwards. Unmeasured: whether the caret survives the re-parse. One medium task plus an edge-case pass.

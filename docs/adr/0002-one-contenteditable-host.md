# One contenteditable host, not one per text token

Every text token used to be its own editing host, which made mark atomicity a side effect of "my parent is not an editing host" and required a focus transition for every caret move between spans. That focus machinery actively fought the mouse: clicking from one span into an adjacent one never placed the caret, Tab was dead, and a finished cross-mark drag left the editor non-editable with focus on `BODY`. The container is now the single host and mark roots are `contenteditable=false` atomics by contract, which deletes the whole class of defects because there is no longer a transition to trigger them.

Accepted costs: Tab leaves the field (marks are no longer tab stops), `onFocus`/`onBlur` fire once per real entry rather than per span switch, and triple-click still selects one span — an engine limit, control-measured in Chromium without markput.

Full record with the measurements: [`docs/records/one-host-migration.md`](../records/one-host-migration.md).

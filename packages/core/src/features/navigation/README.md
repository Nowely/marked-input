# Navigation Feature

Navigation is now owned by keyboard and caret features through `store.dom` and token addresses.

The old standalone DOM walkers were removed with the legacy locator compatibility layer. Arrow-key navigation reads the current caret location, resolves neighboring token addresses through the parse index, and asks `store.caret` / `store.dom` to focus the target.

## Current Responsibilities

- Keep token navigation address-based instead of DOM-child-order based.
- Use `store.caret.focus(address, boundary)` for mark focus.
- Use `store.caret.placeAt(rawPosition)` for raw-position text recovery.

The feature folder is retained for historical documentation only; production navigation code lives with the keyboard/caret pipeline.

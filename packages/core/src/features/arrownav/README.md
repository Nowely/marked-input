# ArrowNav Feature

Handles left/right arrow key navigation between text spans and marks in non-drag mode. When the caret reaches the boundary of a text span, it shifts focus to the previous/next focusable element, skipping non-editable marks.

## Components

- **ArrowNavFeature**: Feature class that listens for `keydown` events and manages arrow-left/arrow-right navigation, plus delegates Ctrl+A / Cmd+A to `selectAllText`

## Usage

The feature is automatically registered and enabled by the Store. It activates only when drag mode is off (`store.props.drag()` is false). No direct usage is needed — it hooks into the editor's event system internally.

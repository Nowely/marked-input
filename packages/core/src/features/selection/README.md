# Selection Feature

Manages text selection state, particularly cross-element drag selection across multiple contentEditable elements. Detects when a selection spans multiple spans and temporarily disables `contentEditable` to allow coherent browser selection rendering.

## Components

- **TextSelectionFeature**: Feature class that detects cross-element drag selection (mousedown + mousemove) and sets `store.state.selecting('drag')` to trigger ContentEditableFeature adjustments
- **isFullSelection**: Checks if the current browser selection covers content within the container
- **selectAllText**: Implements Ctrl+A / Cmd+A to select all content in the container (non-drag mode only)

## Usage

The feature is registered by the Store automatically. `selectAllText` is also called by `ArrowNavFeature` for Ctrl+A handling.

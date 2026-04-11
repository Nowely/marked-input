# Input Feature

Core input handling for the contentEditable editor in non-drag mode. Attaches `keydown`, `paste`, and `beforeinput` handlers and processes text editing operations including mark deletion, span input, and paste with markup preservation.

## Components

- **InputFeature**: Feature class handling Backspace/Delete on marks and span boundaries, BeforeInput events (insertText, deleteContent\*, insertFromPaste, insertReplacementText), paste with markput custom MIME support, and select-all replacement
- **handleBeforeInput**: Processes `beforeinput` events for text insertion and deletion
- **handlePaste**: Handles paste events with markput MIME support
- **replaceAllContentWith**: Replaces entire editor content and schedules focus recovery
- **applySpanInput**: Generic span content mutation for various `inputType` values

## Usage

The feature is registered by the Store and activates in non-drag mode. Exported helper functions are used by BlockEditFeature for drag-mode editing.

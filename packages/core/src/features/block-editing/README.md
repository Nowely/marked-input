# Block Editing Feature

Provides full editing support in drag/block mode where each token is rendered as a separate block-level element. Handles keyboard input, cursor positioning, text insertion, deletion, and merging of blocks — all with raw-value position mapping.

## Components

- **BlockEditFeature**: Feature class that handles arrow key navigation between blocks, Backspace/Delete to merge or delete blocks, Enter to split blocks, and BeforeInput events in block mode
- **getCaretRawPosInBlock**: Gets the caret's absolute raw-value position within a block
- **getDomRawPos**: Converts a raw-value position to a DOM position within a block
- **getDomRawPosInMark**: Converts a raw-value position to a DOM position within a nested mark
- **setCaretAtRawPos**: Sets the caret at an absolute raw-value position in a block

## Usage

The feature is registered by the Store and activates when drag mode is enabled. Raw position utilities are used internally for mapping between DOM cursor positions and raw-value offsets.

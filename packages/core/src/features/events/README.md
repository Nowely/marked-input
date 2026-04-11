# Events Feature

Central event wiring that connects store events to data flow. Handles change detection, token deletion, overlay selection, inner value updates, and re-parsing.

## Components

- **SystemListenerFeature**: Feature class that subscribes to store events and orchestrates data flow:
    - **change event** — syncs DOM content back to token state, calls `onChange`, and triggers re-parse
    - **delete event** — removes a token by position from the raw value
    - **innerValue signal** — re-parses the new value into tokens and calls `onChange`
    - **select event** — handles overlay selection by creating annotated markup and replacing trigger text

## Usage

The feature is registered by the Store and runs automatically. It acts as the bridge between raw DOM events and the reactive store state.

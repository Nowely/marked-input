# Lifecycle Feature

Orchestrates the enable/disable lifecycle of all features. Watches store events to enable features on first update and disable all features on unmount, with guards against double-enable/disable.

## Components

- **Lifecycle**: Class that manages feature lifecycle:
    - Watches `store.event.updated` to enable all registered features on first update
    - Watches `store.event.unmounted` to disable all features on unmount
    - `enable()` — enables all features in `store.features`
    - `disable()` — disables all features
    - Internal flags guard against double-enable/disable

## Usage

The Lifecycle instance is created by the Store and manages all feature lifecycles automatically. No direct interaction is needed from other features or framework wrappers.

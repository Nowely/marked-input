# Backlog

Work that is known to be needed, with the evidence that says so. Nothing goes in without a measurement; nothing stays in once its commit lands.

One file per item under `issues/`, each carrying a `Status:` line. Read by status: `needs-info` is blocked on a measurement or a decision, `ready-for-agent` can be picked up today, `ready-for-human` needs a person because the behaviour change needs sign-off. `issues/closed.md` holds what is closed, so it is not proposed again.

Within `ready-for-agent` the items are independent of each other and numbered smallest first.

Context for every item: PR #274 moved the editor to a single `contenteditable` host and block onto tree anchors. `docs/adr/0002-one-host-migration.md` holds the design and the post-migration measurements; `packages/website/src/content/docs/development/inconsistencies.md` holds the behaviour differences from a native field.

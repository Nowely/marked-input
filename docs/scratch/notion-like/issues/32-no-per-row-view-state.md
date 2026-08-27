# A cross-parent drop keeps the NODE and loses the COMPONENT

Type: task
Status: needs-triage
Blocked by: —

## Problem

`outcome.md`'s item 20:

> **A cross-parent drop keeps the NODE and loses the COMPONENT**, measured in both adapters.
> `store.rows.collapsed` — a core-owned per-row view store — is what would fix it and was not built.

The showcase's own docblock records the measurement that forced the workaround
(`packages/storybook/src/pages/Notion/notion/options.tsx:447-452`): openness *"was `useState` and
that made it a fact only the component knew — so it could not be authored …, could not be undone,
and did not survive a drop into a different parent, because that re-parents the element between two
framework parents and neither adapter carries a component instance across it."*

Verified at `52ef65ae`: there is no `collapsed` store in core — `grep -rn collapsed
packages/core/src` returns only `RowController`'s hit-test comments about a collapsed subtree
having no box.

## Why it matters here

The showcase escaped by making its one piece of view state a DOCUMENT fact, and paid for it with
[31](31-find-in-page-edits-the-document.md): every open/close is now an edit. Any consumer with row
view state that must NOT be in the value — a hover expansion, a per-row editing mode, a loaded
preview — has no place to put it and no way to survive a drag.

## Shape of a fix

A core-owned per-row store keyed by row id, surviving a re-parent because core keeps the row's
identity across it (`rowKeys.ts`) while the frameworks do not. It is new published surface with one
would-be caller today, so it wants the maintainer's yes and a second caller before it is worth its
own weight.

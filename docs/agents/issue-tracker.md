# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `docs/scratch/`.

## Conventions

- One feature per directory: `docs/scratch/<feature-slug>/`
- The spec is `docs/scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at
  `docs/scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` —
  never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file
  (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a
  `## Comments` heading
- A directory that is a standing queue rather than one feature carries a
  `README.md` in place of `spec.md`, and may collect its closed items in a
  single `issues/closed.md` rather than one file each
- Everything here is markdown, with one exception: a visual exploration whose
  rendering IS the content (SVG, a rendered layout) stays HTML under
  `docs/scratch/design/`

## When a skill says "publish to the issue tracker"

Create a new file under `docs/scratch/<feature-slug>/` (creating the directory
if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or
the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `docs/scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog
  body.
- **Child ticket**: `docs/scratch/<effort>/issues/NN-<slug>.md`, numbered from
  `01`, with the question in the body. A `Type:` line records the ticket type
  (`research`/`prototype`/`grilling`/`task`); a `Status:` line records
  `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked
  when every file it lists is `resolved`.
- **Frontier**: scan `docs/scratch/<effort>/issues/` for files that are open,
  unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set
  `Status: resolved`, then append a context pointer (gist + link) to the map's
  Decisions-so-far in `map.md`.

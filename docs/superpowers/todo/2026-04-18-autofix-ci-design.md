# Autofix CI Workflow

## Problem

Developers forget to run formatters and linters before opening PRs. The existing `CI.yml` only checks formatting (`oxfmt --check`) and linting (`oxlint`) — it reports failures but doesn't fix them. This causes unnecessary back-and-forth.

## Solution

Add a self-contained GitHub Actions workflow that automatically fixes formatting and lint issues on pull requests by committing fixes directly to the PR branch.

No external services or GitHub Apps required.

## Design

### New file

`.github/workflows/autofix.yml`

### Workflow behavior

```
PR opened/updated
  → checkout PR branch head (not the synthetic merge ref)
  → early exit if last commit is the bot (message prefix or email)
  → setup node + install deps
  → run oxfmt (write mode)
  → run oxlint --fix
  → stage changes
    → no changes: exit
    → changes found: commit + push with PAT to PR head ref
  → PAT push triggers a new CI run → validates fixes
```

### Checkout semantics (critical)

On `pull_request` events the default `actions/checkout` checks out `refs/pull/<n>/merge` (detached HEAD on a synthetic merge commit). That ref cannot be pushed back to the PR branch, and `git log -1` on it returns the merge commit's author, not the PR tip author.

Autofix therefore must check out the PR head explicitly:

- `ref: ${{ github.event.pull_request.head.ref }}`
- `repository: ${{ github.event.pull_request.head.repo.full_name }}`
- `token: ${{ secrets.PAT }}` (so the clone's remote is already authenticated for push)

This work lives in the shared `nowely/action-setup-node` composite — see the "Extend `nowely/action-setup-node`" task below.

### Loop termination

The real guarantee against infinite loops is **idempotency of the fixers**: a second run of `oxfmt` + `oxlint --fix` on already-fixed code produces no diff, so no commit is made. The bot-author check is an additional early-exit that saves ~30–60s of install + format + lint work per bot-triggered PR update; it is not what stops the loop.

The early-exit looks for both the commit trailer/message (`style: autofix …`) and the bot email, so it still fires even if the commit author name is spoofed or localized.

No `[skip ci]` tokens — the downstream CI always validates.

### Authentication

- Uses `secrets.PAT` (fine-grained Personal Access Token) stored in repository secrets.
- A PAT is required because pushes made with the workflow's `GITHUB_TOKEN` do not trigger subsequent workflow runs (GitHub's recursion guard).
- The token is injected into `git` via an HTTP auth header (`http.https://github.com/.extraheader`), not embedded in the remote URL. This keeps the token out of `argv` / process-listing audit logs.
- Workflow-level `permissions` are set to `{}` to emphasize that the default `GITHUB_TOKEN` is not used to push.

### Concurrency

A `concurrency` group with `cancel-in-progress: true` is required: rapid successive pushes would otherwise race and produce non-fast-forward push rejections.

### Fork PRs

Fork PRs are **not supported** — the PAT cannot write to forks, and `pull_request_target` is intentionally avoided (it would execute untrusted base-branch code with write credentials).

The job guards itself with `if: github.event.pull_request.head.repo.full_name == github.repository` so fork PRs skip cleanly instead of failing red on the push step.

### Push-race handling

If the developer pushes a commit while autofix is running, `git push` is rejected (non-fast-forward). The job fails; the developer's new push triggers another autofix run, which reconciles. `--force-with-lease` is explicitly **not** used — it could drop the developer's commit when autofix branched from an older tip. `cancel-in-progress: true` minimizes the window.

### Scope

- **Format**: `pnpm run format:fix` (oxfmt write mode)
- **Lint**: `pnpm run lint:fix` (oxlint --fix, auto-fixable rules only; unfixable violations remain and are caught by the existing `lint` job in `CI.yml`)
- **Triggers**: `pull_request` targeting `next`. `main` tracks releases (pushed from `next` by `Release.yml`) and does not receive direct PRs, so no `main` trigger is needed.
- **Does not regenerate**: `pnpm-lock.yaml`, typegen outputs, build artifacts.
- **Husky hooks** are skipped with `--no-verify` on the bot commit — otherwise `lint-staged` would re-run the same fixers and potentially loop.

### Limitations

- Does not work on fork PRs (PAT cannot authorize writes to forks).
- Non-auto-fixable lint errors still fail the `lint` job in `CI.yml` — autofix reduces noise, it does not replace enforcement.
- Does not fix lockfile drift; `pnpm install --frozen-lockfile` in setup will fail first if the lockfile is stale.
- PAT expiry (fine-grained PATs cap at 1 year) silently breaks autofix; rotation must be tracked out-of-band.

### Future extraction (DX)

The commit-and-push logic is designed to be extractable into a reusable composite action, provisionally `nowely/action-autofix`. Goals for that extraction:

- Inputs: `token`, `commit-message`, `commit-user-name`, `commit-user-email`, `commands` (array of fix commands to run), `branches` (pass-through filter).
- Output: `committed` (bool), `commit-sha`.
- Adopt the placeholder + file-replace pattern from `peter-evans/create-pull-request` so the PAT never crosses a shell argv boundary even in the internal implementation.
- Once extracted, `.github/workflows/autofix.yml` in this repo collapses to ~10 lines: trigger + one `uses:` step.

This is the DX target: any Nowely repo that wants autofix adds a single workflow file with one action reference and a list of fix commands.

## Implementation

### 1. Extend `nowely/action-setup-node` with checkout inputs

**Why:** the autofix workflow (and any future workflow that needs to commit back to a PR) must check out the PR head with push credentials, not the default merge ref. The current composite hardcodes `actions/checkout@v4` with no arguments, which is the wrong ref for anything that writes back.

This change is backwards-compatible — all existing inputs default to current behavior, so `CI.yml` and `Release.yml` continue working unchanged.

**Ready code for `action.yml` in `nowely/action-setup-node`:**

```yaml
name: 'Node.js Environment Setup'
description: 'Checkout repository, install pnpm, setup Node.js, and install dependencies'

inputs:
    ref:
        description: 'Git ref to check out. Defaults to the event ref (merge ref on pull_request).'
        required: false
        default: ''
    repository:
        description: 'Repository to check out (owner/name). Defaults to the current repository.'
        required: false
        default: ''
    token:
        description: 'Token used to fetch the repository and configure the pushable remote. Defaults to GITHUB_TOKEN.'
        required: false
        default: ${{ github.token }}
    fetch-depth:
        description: 'Number of commits to fetch. 0 for full history. Defaults to 1.'
        required: false
        default: '1'
    node-version:
        description: 'Node.js version to install.'
        required: false
        default: '22.x'
    pnpm-version:
        description: 'pnpm major version to install.'
        required: false
        default: '10'
    install:
        description: 'Whether to run `pnpm install --frozen-lockfile`.'
        required: false
        default: 'true'

runs:
    using: 'composite'
    steps:
        - name: Checkout Repo
          uses: actions/checkout@v4
          with:
              ref: ${{ inputs.ref }}
              repository: ${{ inputs.repository }}
              token: ${{ inputs.token }}
              fetch-depth: ${{ inputs.fetch-depth }}

        - name: Install pnpm
          uses: pnpm/action-setup@v4
          with:
              version: ${{ inputs.pnpm-version }}

        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
              node-version: ${{ inputs.node-version }}
              cache: 'pnpm'

        - name: Install Dependencies
          if: inputs.install == 'true'
          run: pnpm install --frozen-lockfile
          shell: bash
```

After merging and tagging (e.g. `v1.1.0`, moving `v1`), existing callers in this repo need no change; autofix.yml can then pass `ref`/`repository`/`token`.

### 2. Create `.github/workflows/autofix.yml`

```yaml
name: autofix

on:
    pull_request:
        branches: [next]

concurrency:
    group: autofix-${{ github.ref }}
    cancel-in-progress: true

permissions: {}

jobs:
    autofix:
        if: github.event.pull_request.head.repo.full_name == github.repository
        runs-on: ubuntu-latest
        timeout-minutes: 10
        steps:
            - name: Checkout PR head
              uses: actions/checkout@v4
              with:
                  token: ${{ secrets.PAT }}
                  ref: ${{ github.event.pull_request.head.ref }}
                  repository: ${{ github.event.pull_request.head.repo.full_name }}
                  fetch-depth: 1

            - name: Skip if last commit is bot
              id: guard
              run: |
                  msg=$(git log -1 --format='%s')
                  email=$(git log -1 --format='%ae')
                  if [[ "$email" == *"github-actions[bot]"* ]] \
                     || [[ "$msg" == style:\ autofix* ]]; then
                    echo "Skipping: last commit made by autofix bot"
                    echo "skip=1" >> "$GITHUB_OUTPUT"
                  fi

            - name: Setup Environment
              if: steps.guard.outputs.skip != '1'
              uses: nowely/action-setup-node@v1
              with:
                  ref: ${{ github.event.pull_request.head.ref }}
                  repository: ${{ github.event.pull_request.head.repo.full_name }}
                  token: ${{ secrets.PAT }}

            - name: Fix Formatting
              if: steps.guard.outputs.skip != '1'
              run: pnpm run format:fix

            - name: Fix Lint Issues
              if: steps.guard.outputs.skip != '1'
              run: pnpm run lint:fix

            - name: Commit and Push Changes
              if: steps.guard.outputs.skip != '1'
              env:
                  GIT_TOKEN: ${{ secrets.PAT }}
              run: |
                  git -c core.fileMode=false add --all
                  if [ -z "$(git status --porcelain)" ]; then
                    echo "No changes to push"
                    exit 0
                  fi
                  git -c user.name='github-actions[bot]' \
                      -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
                      commit --no-verify -m "style: autofix formatting and lint"
                  git -c http.https://github.com/.extraheader="AUTHORIZATION: bearer ${GIT_TOKEN}" \
                      push origin "HEAD:${{ github.event.pull_request.head.ref }}"
```

Notes on the snippet:

- The initial `actions/checkout@v4` runs before `nowely/action-setup-node@v1` so the bot-guard can inspect the real PR head before paying for install. The setup action's own checkout is effectively a no-op (same ref, same token) and is cheap.
- The commit email `41898282+github-actions[bot]@users.noreply.github.com` is the canonical form that GitHub attributes to the bot avatar.
- `git status --porcelain` replaces `git diff --staged --name-only --no-renames` — simpler and catches untracked files symmetrically.
- Token is passed via `http.extraheader`, never via remote URL.

## Prerequisites

- `secrets.PAT` configured in repository settings. Use a **fine-grained** PAT limited to this repository with: `Contents: Read and write`, `Pull requests: Read`. Set the shortest acceptable expiry and document the rotation owner.
- `nowely/action-setup-node@v1` updated and re-tagged per the task above (callers in `CI.yml` / `Release.yml` are unaffected thanks to input defaults).

# Website

A standing queue for `packages/website` work — the docs site itself, not the API documentation
that ships with a behaviour change. Docs that describe core behaviour get updated in the PR that
changes the behaviour; only work whose subject *is* the site belongs here.

One file per item under `issues/` once an item is picked up. Until then they live in this list.

- **"Common Patterns" guide article.** Not written. Decide its scope against the existing
  guides first — the overlap candidates are the nested-marks and dynamic-marks guides.
- **Starlight Obsidian theme.** Evaluate and integrate. Pairs with the Astro/Starlight version
  policy: Starlight majors move with Astro majors.
- **MDX-powered view/edit mode for the docs.** The largest of the three and the least specified:
  it means embedding a live markput instance in MDX, which is a docs-site feature with a real
  build cost. Needs a shape before it is a task.
- **Deploy from `main`, develop on `next`.** Currently both live on `next`. A release/branch
  policy change, so it touches CI and the deploy target, not just the site.

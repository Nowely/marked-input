# The website build warns about an `i18n` collection the site does not define

Status: needs-info

Since Astro 7.3 (5e5d231d), every website build prints:

```
[WARN] [content] The collection "i18n" does not exist or is empty. Please check your content config file for errors.
```

The site defines only `docs` (`packages/website/src/content.config.ts`) and needs no custom UI
strings. The query is Starlight's: 0.42.4 calls `getCollection("i18n")` unconditionally while it
loads translations, and silences `console.warn` around that call — it expects this warning and
means to hide it. Astro 7.3 reports it through its own logger (the `[WARN] [content]` prefix), which
that silencing does not reach. The last step is read from the output, not from Astro's source.

Needs a check upstream before any local change: whether Starlight has an issue or a fix for Astro
7.3. Defining an empty `i18n` collection to quiet it would likely still count as "empty".

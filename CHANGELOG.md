# Changelog

## [0.10.1](https://github.com/Nowely/marked-input/compare/0.10.0...0.10.1) (2026-04-11)


### Refactoring

* **core:** restructure Store, extract ParseFeature, remove Lifecycle, migrate signal API ([#185](https://github.com/Nowely/marked-input/issues/185)) ([afd5b1c](https://github.com/Nowely/marked-input/commit/afd5b1c78d15e4528b99ff5d89e0c39831ad1118))


### Build

* inline @markput/core types into published packages ([#187](https://github.com/Nowely/marked-input/issues/187)) ([d8f44ff](https://github.com/Nowely/marked-input/commit/d8f44ff4d421812844b6ffe87f827b6e8e923470))

## [0.10.0](https://github.com/Nowely/marked-input/compare/0.9.0...0.10.0) (2026-04-10)


### Features

* **clipboard:** implement enhanced copy/cut/paste with cross-token selection support ([#176](https://github.com/Nowely/marked-input/issues/176)) ([09a3ea0](https://github.com/Nowely/marked-input/commit/09a3ea09218aee0d8b0d93a8cf29f0e03155f667))
* **react:** migrate from @vitejs/plugin-react-swc to @vitejs/plugin-react ([#179](https://github.com/Nowely/marked-input/issues/179)) ([62d9b36](https://github.com/Nowely/marked-input/commit/62d9b362889de1fb3584aad132f92eab435dea85))


### Refactoring

* **core:** event-driven features architecture ([#183](https://github.com/Nowely/marked-input/issues/183)) ([17e6c5c](https://github.com/Nowely/marked-input/commit/17e6c5c2c2a180e0094123f3670e80face703b9b))
* **core:** modernize signal/event system and simplify store architecture ([#180](https://github.com/Nowely/marked-input/issues/180)) ([34a9fd5](https://github.com/Nowely/marked-input/commit/34a9fd5b37f19e7d32cef681c59805c3e302dfc4))
* **core:** move BlockStore state init to class field ([#182](https://github.com/Nowely/marked-input/issues/182)) ([e28c9c2](https://github.com/Nowely/marked-input/commit/e28c9c2d65bb9241bfa8873bd7e14773f5932220))
* **core:** remove defaultSpan from Store constructor ([#181](https://github.com/Nowely/marked-input/issues/181)) ([2257f96](https://github.com/Nowely/marked-input/commit/2257f96199223c938d1f8bd9c52b806f98bb05d8))
* **core:** simplify event bus, lifecycle, parser derivation, and store structure ([#184](https://github.com/Nowely/marked-input/issues/184)) ([10c9971](https://github.com/Nowely/marked-input/commit/10c9971ba2bacb2d0a0b917e0162cdacd0d1af7a))
* Migrate on alien signals ([#178](https://github.com/Nowely/marked-input/issues/178)) ([8de20b9](https://github.com/Nowely/marked-input/commit/8de20b95af4b4346a0c140263794cf4aff48cf6a))

## [0.9.0](https://github.com/Nowely/marked-input/compare/0.8.0...0.9.0) (2026-04-05)


### Features

* **selection:** enable cross-element text selection across mark tokens ([#172](https://github.com/Nowely/marked-input/issues/172)) ([b19b926](https://github.com/Nowely/marked-input/commit/b19b926f4fd19cf35c7c6889817d7c0ea138eb71))
* **storybook:** consolidate React and Vue packages into unified storybook ([#170](https://github.com/Nowely/marked-input/issues/170)) ([8b6f560](https://github.com/Nowely/marked-input/commit/8b6f560376f03eeafedd401f05387d2e0c278cb4))


### Refactoring

* extract shared Popup/List/ListItem from Suggestions and BlockMenu ([#168](https://github.com/Nowely/marked-input/issues/168)) ([3c07bb8](https://github.com/Nowely/marked-input/commit/3c07bb833e5622173c166d6f22782816bc898db9))
* move @markput/core from packages/common/core to packages/core ([#171](https://github.com/Nowely/marked-input/issues/171)) ([6a0a7d2](https://github.com/Nowely/marked-input/commit/6a0a7d238746c527c2a1b134ff29191f2d002c2a))


### Miscellaneous

* remove .npmrc hoisting workaround for storybook ([#175](https://github.com/Nowely/marked-input/issues/175)) ([178a246](https://github.com/Nowely/marked-input/commit/178a246d6c69209e28180870236f73d058136b5f))
* rename root package to @markput/monorepo ([#173](https://github.com/Nowely/marked-input/issues/173)) ([cfe91f9](https://github.com/Nowely/marked-input/commit/cfe91f9a5eb729e84ff33a5fb3efcc68ab6ea6f7))

## [0.8.0](https://github.com/Nowely/marked-input/compare/0.7.0...0.8.0) (2026-03-31)


### Features

* **drag:** refactor drag-and-drop into Block system ([#160](https://github.com/Nowely/marked-input/issues/160)) ([a3098b7](https://github.com/Nowely/marked-input/commit/a3098b7980cffa40179a8303c603c04e3ab5bd9c))


### Refactoring

* **core:** centralize slot resolution, batch state updates, and trim public API ([#163](https://github.com/Nowely/marked-input/issues/163)) ([b0687e7](https://github.com/Nowely/marked-input/commit/b0687e7afd8cc1ffe57d9c4456ba29e686933dcf))
* resolve all lint warnings and enforce type-safety rules ([#167](https://github.com/Nowely/marked-input/issues/167)) ([a77e942](https://github.com/Nowely/marked-input/commit/a77e94209e638d90aa574ac50d8a5aa4876db163))


### Documentation

* update AGENTS.md, add CLAUDE.md, and refresh architecture docs ([#162](https://github.com/Nowely/marked-input/issues/162)) ([45e585c](https://github.com/Nowely/marked-input/commit/45e585c95b3d197cc602637cf6b075d97ecd23a5))


### Miscellaneous

* **deps:** update package dependencies and versions ([#164](https://github.com/Nowely/marked-input/issues/164)) ([1e3ddb2](https://github.com/Nowely/marked-input/commit/1e3ddb28c1a0ced3f1084e8472e71d0a13ff85da))
* improve type safety and fix lint rules across packages ([#166](https://github.com/Nowely/marked-input/issues/166)) ([084b6f8](https://github.com/Nowely/marked-input/commit/084b6f8e7a1a930954c28b2e3698e59fe86122e1))
* **lint:** update ESLint configuration and add TypeScript rules ([#165](https://github.com/Nowely/marked-input/issues/165)) ([fa56e39](https://github.com/Nowely/marked-input/commit/fa56e39616eb0d4b97a127501095745d6cef4c60))

## [0.7.0](https://github.com/Nowely/marked-input/compare/0.6.0...0.7.0) (2026-03-24)


### ⚠ BREAKING CHANGES

* rename __nested__ placeholder to __children__ ([#156](https://github.com/Nowely/marked-input/issues/156))
* **types:** replace slot properties with top-level Mark/Overlay on Option ([#155](https://github.com/Nowely/marked-input/issues/155))

### Features

* **BlockContainer:** drag-and-drop reordering for mark blocks ([#153](https://github.com/Nowely/marked-input/issues/153)) ([e9f18ff](https://github.com/Nowely/marked-input/commit/e9f18ffc783b55d39051c79b4491142db5628e32))


### Bug Fixes

* **KeyDownController:** prioritize previousValue over value for input handling ([#158](https://github.com/Nowely/marked-input/issues/158)) ([dbac2d4](https://github.com/Nowely/marked-input/commit/dbac2d4882066ecfc98f327a2ec7a220a95c228d))


### Refactoring

* rename __nested__ placeholder to __children__ ([#156](https://github.com/Nowely/marked-input/issues/156)) ([eb797a5](https://github.com/Nowely/marked-input/commit/eb797a5d6d4671b339a077ace81b1f00e80f5255))
* Replace __children__ with __slot__, consolidate token rendering, and enhance drag mode ([#157](https://github.com/Nowely/marked-input/issues/157)) ([00d57ed](https://github.com/Nowely/marked-input/commit/00d57edf780b8919dab64fc9954d7a9015d66cce))
* **types:** replace slot properties with top-level Mark/Overlay on Option ([#155](https://github.com/Nowely/marked-input/issues/155)) ([2b5d558](https://github.com/Nowely/marked-input/commit/2b5d558147f6c6797650a1b1c98e5529f9190b67))


### Documentation

* rewrite AGENTS.md  ([#159](https://github.com/Nowely/marked-input/issues/159)) ([4fc49b7](https://github.com/Nowely/marked-input/commit/4fc49b78b937619e0c6ed3b29e083139e467d6d1))

## [0.6.0](https://github.com/Nowely/marked-input/compare/0.5.0...0.6.0) (2026-03-15)


### Features

* **blocks:** add block merging via Backspace/Delete and TodoList story ([#148](https://github.com/Nowely/marked-input/issues/148)) ([0685033](https://github.com/Nowely/marked-input/commit/0685033578d702aa223686f67f95fca656ea6a1f))
* **blocks:** Notion-like block editor with keyboard navigation, block operations, and drag-and-drop ([#146](https://github.com/Nowely/marked-input/issues/146)) ([4bd5534](https://github.com/Nowely/marked-input/commit/4bd5534859238019200eba2498b19590afec125a))
* **drag:** replace block mode with drag-and-drop row management ([#149](https://github.com/Nowely/marked-input/issues/149)) ([83034e8](https://github.com/Nowely/marked-input/commit/83034e8725994bd807cfeb93f05b02b3a0a668c8))
* **storybook:** add withPlainValue decorator and enhance drag/text stories ([#151](https://github.com/Nowely/marked-input/issues/151)) ([1d76c1f](https://github.com/Nowely/marked-input/commit/1d76c1fbeea2f790b672c3122dfed9f388d7434e))


### Refactoring

* **storybook:** standardize stories with PlainValuePanel and StoryObj types across React and Vue ([#152](https://github.com/Nowely/marked-input/issues/152)) ([42d21f3](https://github.com/Nowely/marked-input/commit/42d21f3ce949fc893f58181b6ea7da1c53fc0b32))


### Miscellaneous

* upgrade to Vite 8, Vitest 4.1, and Astro 6 ([#150](https://github.com/Nowely/marked-input/issues/150)) ([693966d](https://github.com/Nowely/marked-input/commit/693966d122260d5da28a4cba7cb53df10fea969a))

## [0.5.0](https://github.com/Nowely/marked-input/compare/0.4.0...0.5.0) (2026-03-07)


### Features

* **core:** add ContentEditableController for DOM-based editing ([#134](https://github.com/Nowely/marked-input/issues/134)) ([633133b](https://github.com/Nowely/marked-input/commit/633133bd924ecb1e96f48d0f3526d4e19b004041))


### Refactoring

* extract shared logic from framework adapters to core ([#145](https://github.com/Nowely/marked-input/issues/145)) ([795c0e8](https://github.com/Nowely/marked-input/commit/795c0e82d38c065f1f4e25c5695d1c0decd814cc))
* improve Signal typing with interface augmentation for framework-specific use() return types ([#143](https://github.com/Nowely/marked-input/issues/143)) ([e6d4efc](https://github.com/Nowely/marked-input/commit/e6d4efc5168029c6c75c60b43d2e6abc8ad654bb))


### Miscellaneous

* migrate to pnpm catalog for centralized dependency management ([#140](https://github.com/Nowely/marked-input/issues/140)) ([b71cd55](https://github.com/Nowely/marked-input/commit/b71cd55ad88966d629f4c90733488bfc73869f5d))
* update oxlint configuration ([#144](https://github.com/Nowely/marked-input/issues/144)) ([1db73ec](https://github.com/Nowely/marked-input/commit/1db73eca4d8846b911aa2c6875caf6b95bed228e))


### Tests

* add comprehensive Vue component tests with Vitest ([#142](https://github.com/Nowely/marked-input/issues/142)) ([231f3dc](https://github.com/Nowely/marked-input/commit/231f3dc902b88f6bfa683df5346c6343a6adbb0e))

## [0.4.0](https://github.com/Nowely/marked-input/compare/0.3.0...0.4.0) (2026-03-06)


### Features

* **core:** predictive input model via beforeinput ([#131](https://github.com/Nowely/marked-input/issues/131)) ([80d0369](https://github.com/Nowely/marked-input/commit/80d036958862b342a013eb189a60671614b25d62))


### Documentation

* Add AGENTS.md ([#135](https://github.com/Nowely/marked-input/issues/135)) ([675a8e2](https://github.com/Nowely/marked-input/commit/675a8e203c0abe8434e5c4d062a3cb1ac9e183d6))
* update Storybook links and reorganize badges by framewor ([#137](https://github.com/Nowely/marked-input/issues/137)) ([9884dc1](https://github.com/Nowely/marked-input/commit/9884dc14d61680f1a0394e8667be924344f8abd6))


### Miscellaneous

* migrate from prettier to oxfmt ([#139](https://github.com/Nowely/marked-input/issues/139)) ([4349b1b](https://github.com/Nowely/marked-input/commit/4349b1b0210c91119a872246a4ac94628da668c5))
* remove unused EditableSpan components ([#133](https://github.com/Nowely/marked-input/issues/133)) ([2e5388a](https://github.com/Nowely/marked-input/commit/2e5388afe14e51df44c34c82f89602f14f48f994))
* remove unused Vercel configuration file from Storybook ([#136](https://github.com/Nowely/marked-input/issues/136)) ([60129be](https://github.com/Nowely/marked-input/commit/60129be7ec1f530031e495035f5f113a73a551e4))
* upgrade vue-tsc to v3.2.5 ([#138](https://github.com/Nowely/marked-input/issues/138)) ([a189b53](https://github.com/Nowely/marked-input/commit/a189b532ddf373b57083e7ff52144edd6617eb27))

## [0.3.0](https://github.com/Nowely/marked-input/compare/0.2.0...0.3.0) (2026-03-04)


### Features

* add block reordering with drag-and-drop support ([#130](https://github.com/Nowely/marked-input/issues/130)) ([511c973](https://github.com/Nowely/marked-input/commit/511c9731aabe1251bf35ed14ce1e15ebf259cc12))
* **storybook:** add Vue Storybook ([#129](https://github.com/Nowely/marked-input/issues/129)) ([06f75c3](https://github.com/Nowely/marked-input/commit/06f75c39a20028e5147b85093f07f78bab7b5001))


### Documentation

* update README to include Vue package information and badges ([3a87989](https://github.com/Nowely/marked-input/commit/3a879893aae8ebc03e16c9a0a73d6a9eeab370ad))


### Miscellaneous

* add sync step to release workflow for main branch updates ([bde610f](https://github.com/Nowely/marked-input/commit/bde610fc35d41e7059bb9b8785ca9d532731f3e1))
* rename package from root to markput in package.json ([1cb8a8a](https://github.com/Nowely/marked-input/commit/1cb8a8a9146fb5b732509bdf54c26ac9a4ba204a))
* update release-please config to exclude component in tag ([1555898](https://github.com/Nowely/marked-input/commit/1555898f840c65fbebd96193758d44fd79d2dde5))

## [0.2.0](https://github.com/Nowely/marked-input/compare/root-0.1.0...root-0.2.0) (2026-03-03)


### Features

* **vue:** add initial Vue support ([#125](https://github.com/Nowely/marked-input/issues/125)) ([c479853](https://github.com/Nowely/marked-input/commit/c47985352e2dd8fbe3f0f735d249f9bcc386f723))


### Bug Fixes

* **storybook:** prevent caret reset in TextSpan and fix Storybook issues ([#122](https://github.com/Nowely/marked-input/issues/122)) ([3472085](https://github.com/Nowely/marked-input/commit/3472085bf7406448e9f2f6aac9eb44c5a9b88954))


### Refactoring

* extract core features and controllers from React package ([#124](https://github.com/Nowely/marked-input/issues/124)) ([c0ad3d7](https://github.com/Nowely/marked-input/commit/c0ad3d7e309404f98bf962d881fe4c5d2de2c5d8))


### Miscellaneous

* add release-please config for unified versioning ([db07f5e](https://github.com/Nowely/marked-input/commit/db07f5ee2e20016905058769190e17dc73f5cdfe))
* upgrade to React 19 ([#121](https://github.com/Nowely/marked-input/issues/121)) ([d9c9531](https://github.com/Nowely/marked-input/commit/d9c953144b2ce674f6a8e8a99dba0c4eb5328862))


### CI

* add automated release workflow and PR validation ([#120](https://github.com/Nowely/marked-input/issues/120)) ([85b6fc4](https://github.com/Nowely/marked-input/commit/85b6fc476a655447e9f24706734efd057453b8f2))

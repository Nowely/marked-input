# Changelog

## [0.16.0](https://github.com/Nowely/marked-input/compare/0.15.0...0.16.0) (2026-09-03)


### ⚠ BREAKING CHANGES

* **core:** typed nested rows, and a Notion-shaped editor built from the published API alone ([#302](https://github.com/Nowely/marked-input/issues/302))
* **core:** the layout enum shrinks to one line, and four crash paths close ([#301](https://github.com/Nowely/marked-input/issues/301))

### Features

* **core:** typed nested rows, and a Notion-shaped editor built from the published API alone ([#302](https://github.com/Nowely/marked-input/issues/302)) ([0f6b1a0](https://github.com/Nowely/marked-input/commit/0f6b1a0c6a8789265bf472b36dba381787e0ea55))
* roll the Markput logo out across the repo ([#299](https://github.com/Nowely/marked-input/issues/299)) ([1c3bcc9](https://github.com/Nowely/marked-input/commit/1c3bcc9584b364f5cf1fe4ac04198d2dc5f401c5))


### Bug Fixes

* **core:** close row-mark round-1 defects — drop provenance, resting-grip drift, anchorAt side ([#297](https://github.com/Nowely/marked-input/issues/297)) ([494a722](https://github.com/Nowely/marked-input/commit/494a722299eb904b78a44223c9f8fbcbe2151417))
* **core:** the grip stays hit-testable while it is dragged, so the drag can start at all ([#300](https://github.com/Nowely/marked-input/issues/300)) ([8ef1a30](https://github.com/Nowely/marked-input/commit/8ef1a30a1fb5239a0c8602a59b0e12d7c259df1a))
* **core:** the parser stops two silent misparses, and four dead rules go with them ([#295](https://github.com/Nowely/marked-input/issues/295)) ([e97512a](https://github.com/Nowely/marked-input/commit/e97512a80aab63173d4426324504f121b85d5809))


### Refactoring

* **core,react,vue:** the row controls leave the row, and the input pipeline stops being two ([#296](https://github.com/Nowely/marked-input/issues/296)) ([d2cfb35](https://github.com/Nowely/marked-input/commit/d2cfb350768e0e9eb42aa2e2636a698b0ee96145))
* **core:** simplification round 2 — the sweep lands, and the seven ownership moves with it ([#292](https://github.com/Nowely/marked-input/issues/292)) ([98fa92c](https://github.com/Nowely/marked-input/commit/98fa92c563d7d3dba37b0ce9ee59fde50192acf6))
* **core:** the commit becomes atomic, and the token layer sheds its compensating state ([#294](https://github.com/Nowely/marked-input/issues/294)) ([1f616a6](https://github.com/Nowely/marked-input/commit/1f616a69a2c5b06b0c1701ad852a0f1cfc807eab))
* **core:** the layout enum shrinks to one line, and four crash paths close ([#301](https://github.com/Nowely/marked-input/issues/301)) ([1235da9](https://github.com/Nowely/marked-input/commit/1235da9a778cb611064d6870031db1e05952c759))


### Documentation

* **website:** adopt the Mention Aperture logo and refresh the favicon ([#298](https://github.com/Nowely/marked-input/issues/298)) ([bf8fa6b](https://github.com/Nowely/marked-input/commit/bf8fa6b745bab7403ee58a987cf2c24e2ffe754e))

## [0.15.0](https://github.com/Nowely/marked-input/compare/0.14.3...0.15.0) (2026-08-20)


### Features

* **core:** the row separator is structural — block layout cuts over to RowNodes ([#291](https://github.com/Nowely/marked-input/issues/291)) ([31fac6d](https://github.com/Nowely/marked-input/commit/31fac6d1f13110a630bd177af6b9061bd5642456))
* **tokens:** consolidate the token layer into one DOM-encapsulated module with stable-identity handles ([#267](https://github.com/Nowely/marked-input/issues/267)) ([39c721f](https://github.com/Nowely/marked-input/commit/39c721fe03ac4bb41b1a2d546be6a0014d91d2dd))


### Bug Fixes

* **build:** the DTS pass overwrote the published bundle, and no check consumed it ([#288](https://github.com/Nowely/marked-input/issues/288)) ([e259efc](https://github.com/Nowely/marked-input/commit/e259efc9e5f97e39559eb0d2969a2c16fc53989a))
* **core:** invert the core — token tree as the source of truth, public API v2 ([#271](https://github.com/Nowely/marked-input/issues/271)) ([a558bf4](https://github.com/Nowely/marked-input/commit/a558bf443a36bee08522e8706ca77c6c979de833))
* **tokens:** extract DomModel for DOM interaction and selection management ([#270](https://github.com/Nowely/marked-input/issues/270)) ([6d6db5d](https://github.com/Nowely/marked-input/commit/6d6db5dc0986e6070f9617943812782ade612a3e))


### Refactoring

* **block:** consolidate BlockRegistry into BlockController ([#265](https://github.com/Nowely/marked-input/issues/265)) ([6805461](https://github.com/Nowely/marked-input/commit/6805461d32b809343cbada235b7d2638b36d9b17))
* **core:** block row edits address their own nodes, and reorder keeps its identity ([#283](https://github.com/Nowely/marked-input/issues/283)) ([1a1751d](https://github.com/Nowely/marked-input/commit/1a1751dad515471a1ae78e8f295ef073c2f94969))
* **core:** delete three commit-pipeline concepts the census called irreducible ([#285](https://github.com/Nowely/marked-input/issues/285)) ([258e214](https://github.com/Nowely/marked-input/commit/258e21494e336f7573754417065dfaf80c4eb7a7))
* **core:** one address space, one node representation — retire the S1 compat layers ([#272](https://github.com/Nowely/marked-input/issues/272)) ([36a621c](https://github.com/Nowely/marked-input/commit/36a621c880639c5715e006e49533541efb170e46))
* **core:** one contenteditable host, block on tree anchors ([#274](https://github.com/Nowely/marked-input/issues/274)) ([9f82482](https://github.com/Nowely/marked-input/commit/9f8248294e552eaa31b34986d1a5324886e2854a))
* **core:** retire the migration archaeology, fix two shipped defects ([#273](https://github.com/Nowely/marked-input/issues/273)) ([0883d32](https://github.com/Nowely/marked-input/commit/0883d32547f0e9c721334e811735c6ad1af73074))
* **core:** the dom/tree/seam sweep — four files dissolve and the change feed keeps one field ([#290](https://github.com/Nowely/marked-input/issues/290)) ([f86832c](https://github.com/Nowely/marked-input/commit/f86832cfef477b955d004cdd4536012ac0652be3))
* **core:** the framework consigns its elements, and a ref binds one token ([#286](https://github.com/Nowely/marked-input/issues/286)) ([93d84a3](https://github.com/Nowely/marked-input/commit/93d84a3fc075bfa986fb47e704919e9cc15db1d9))
* **core:** the ref handle keeps two members, and the withdrawn verbs take five internals with them ([#289](https://github.com/Nowely/marked-input/issues/289)) ([6be66f5](https://github.com/Nowely/marked-input/commit/6be66f5b01dc4b10b9f63a7181dac987fdbf45ce))
* **core:** two measured defects, four dead members, five false claims ([#287](https://github.com/Nowely/marked-input/issues/287)) ([8752d27](https://github.com/Nowely/marked-input/commit/8752d27d8dc5c2a40e58f82931d38d18d1c89cb9))
* **storybook:** collapse the fixture layer onto the mark seam ([#281](https://github.com/Nowely/marked-input/issues/281)) ([874ec0b](https://github.com/Nowely/marked-input/commit/874ec0b6d004b9f264aace3e0a04f7210b1389a5))
* **storybook:** one story file and one spec per page, shared by both frameworks ([#276](https://github.com/Nowely/marked-input/issues/276)) ([e7055ac](https://github.com/Nowely/marked-input/commit/e7055ac80f758eaf09d967fa4f4f34d4cfc90b63))


### Documentation

* adopt the agent-skills layout — CONTEXT.md, short ADRs, one issue queue ([#278](https://github.com/Nowely/marked-input/issues/278)) ([ca50a03](https://github.com/Nowely/marked-input/commit/ca50a037d1bccdb1d9ae9b20523cacce20508f99))
* **scratch:** the Token-born editing arc — spec, phases, and the parser record ([#284](https://github.com/Nowely/marked-input/issues/284)) ([a4089db](https://github.com/Nowely/marked-input/commit/a4089dba0d7e969070341be5585e2d26a8e42a71))
* **scratch:** triage the note sweep into issues ([#280](https://github.com/Nowely/marked-input/issues/280)) ([cef9f26](https://github.com/Nowely/marked-input/commit/cef9f264b94ade0a61d498d85489c32741a177e5))


### Miscellaneous

* add a one-command branch restart, under a git: namespace ([#277](https://github.com/Nowely/marked-input/issues/277)) ([359d4eb](https://github.com/Nowely/marked-input/commit/359d4ebf33ec7db301a01505af000b49e8d65252))
* dependency updates and TypeScript linting improvements ([#268](https://github.com/Nowely/marked-input/issues/268)) ([f2de0bd](https://github.com/Nowely/marked-input/commit/f2de0bd0000dafa929c2d8488f86ff6bab91ef6f))
* drop .cursor/rules ([#275](https://github.com/Nowely/marked-input/issues/275)) ([1648822](https://github.com/Nowely/marked-input/commit/164882239c8f640421541ed2724933cf737c4b2e))
* move storybook deps out of root catalog, enable typecheck everywhere ([#269](https://github.com/Nowely/marked-input/issues/269)) ([396ad41](https://github.com/Nowely/marked-input/commit/396ad41a7be8926545ba91871c37edf19ffb8929))


### Tests

* **storybook:** drop the duplicate Selection page, move Api onto the shared harness ([#282](https://github.com/Nowely/marked-input/issues/282)) ([90c7062](https://github.com/Nowely/marked-input/commit/90c70622d3726be0c68c57560bfacfbe1772b707))

## [0.14.3](https://github.com/Nowely/marked-input/compare/0.14.2...0.14.3) (2026-05-26)


### Refactoring

* **block:** collapse BlockController, declarative BlockStore wiring ([#263](https://github.com/Nowely/marked-input/issues/263)) ([2f3da8e](https://github.com/Nowely/marked-input/commit/2f3da8ed1bbaa1a484b7ea519ec701979f6ae61c))
* **core:** inline TextSurfaces & DomBoundary, simplify signal init ([#259](https://github.com/Nowely/marked-input/issues/259)) ([d1c5aed](https://github.com/Nowely/marked-input/commit/d1c5aed23c1fb4ebd110ba6e0d1260bcf3a60aac))
* **core:** redesign signal() API — options object, default vs initial, typed computed companions ([#252](https://github.com/Nowely/marked-input/issues/252)) ([62aa5d6](https://github.com/Nowely/marked-input/commit/62aa5d63346c211b950ace1bc325ca04dd8f7aef))
* **core:** replace Lifecycle with Host and clean up container usage ([#255](https://github.com/Nowely/marked-input/issues/255)) ([9dd769c](https://github.com/Nowely/marked-input/commit/9dd769c7064bf2e51da2cf2b80d73576b8806e88))
* **core:** route block/keyboard edits through EditController with batched writes ([#254](https://github.com/Nowely/marked-input/issues/254)) ([e9b013a](https://github.com/Nowely/marked-input/commit/e9b013a2bcd4abf6b9fe713a8c819d5ff566f0c8))
* **core:** split DomModel into DomTokenBridge and DomSelectionBridge ([#256](https://github.com/Nowely/marked-input/issues/256)) ([6ef0ae0](https://github.com/Nowely/marked-input/commit/6ef0ae0c9131d8469ac6f409ea349427e67f3036))
* **dom:** replace DomTokenBridge with DomIndex and related features ([#258](https://github.com/Nowely/marked-input/issues/258)) ([c812739](https://github.com/Nowely/marked-input/commit/c81273995dcc593e00797e895de3aadddac0ef4b))
* **dom:** simplify DomIndex ([#260](https://github.com/Nowely/marked-input/issues/260)) ([574e98f](https://github.com/Nowely/marked-input/commit/574e98fa4c40dced4fff6624a1244699c075394f))
* **keyboard:** simplify blockEdit + input cleanup ([#261](https://github.com/Nowely/marked-input/issues/261)) ([033784e](https://github.com/Nowely/marked-input/commit/033784edbe84c18fda6057aa5382446b43f1d900))
* **selection:** extract pure helpers as free functions ([#262](https://github.com/Nowely/marked-input/issues/262)) ([3c565e7](https://github.com/Nowely/marked-input/commit/3c565e7d9a10775d1625f5b1c1e860257b061ff4))
* **selection:** inline DomSelectionBridge into SelectionController and drop Result type ([#257](https://github.com/Nowely/marked-input/issues/257)) ([2c73ae6](https://github.com/Nowely/marked-input/commit/2c73ae6e502a37f52a354ffe02143c8bc8ea80aa))

## [0.14.2](https://github.com/Nowely/marked-input/compare/0.14.1...0.14.2) (2026-05-22)


### Refactoring

* **caret:** consolidate caret placement into CaretModel ([#245](https://github.com/Nowely/marked-input/issues/245)) ([c12e7f6](https://github.com/Nowely/marked-input/commit/c12e7f6fdce53e2f68702bb30049ff0a8d90c85f))
* **core:** dead-code cleanup and keyboard deduplication ([#249](https://github.com/Nowely/marked-input/issues/249)) ([d41317e](https://github.com/Nowely/marked-input/commit/d41317ec5c406f008dd686e0b934bad0ed126f14))
* **core:** decouple TokenModel from SlotsFeature and clean up Store initialization ([#251](https://github.com/Nowely/marked-input/issues/251)) ([6072273](https://github.com/Nowely/marked-input/commit/6072273900b70e52aae58a99dc383a4d7520d015))
* **core:** derive tokens from computed, add watch immediate option ([#250](https://github.com/Nowely/marked-input/issues/250)) ([01482f5](https://github.com/Nowely/marked-input/commit/01482f58f7d419e0830c350ff5dc474970840862))
* **core:** rename ParseController→TokenModel and CaretModel→SelectionController ([#247](https://github.com/Nowely/marked-input/issues/247)) ([0962102](https://github.com/Nowely/marked-input/commit/096210229b20e6c20ea93ed3872363a1c25e379b))
* **core:** reorganize features into block/parsing/state modules ([#246](https://github.com/Nowely/marked-input/issues/246)) ([647f7d7](https://github.com/Nowely/marked-input/commit/647f7d73050a5854795db661d02940f917fded62))
* **dom:** split DomModel into focused subsystems ([#243](https://github.com/Nowely/marked-input/issues/243)) ([df86f3e](https://github.com/Nowely/marked-input/commit/df86f3e2a9536103ac39da9dae426e0b2fb626f7))
* **parsing:** simplify TokenModel, slots, and remove unused abstractions ([#248](https://github.com/Nowely/marked-input/issues/248)) ([b8f318b](https://github.com/Nowely/marked-input/commit/b8f318bfb3b75f35b315d71c85539447705b4135))

## [0.14.1](https://github.com/Nowely/marked-input/compare/0.14.0...0.14.1) (2026-05-13)


### Refactoring

* **caret:** consolidate caret model and improve model() primitive ([#240](https://github.com/Nowely/marked-input/issues/240)) ([4a5c7af](https://github.com/Nowely/marked-input/commit/4a5c7af78f9ebf22a2796972adda3100f0f1b3c1))
* **caret:** consolidate caret model and migrate DOM handling ([#239](https://github.com/Nowely/marked-input/issues/239)) ([e8eedf8](https://github.com/Nowely/marked-input/commit/e8eedf8968cf0f13de5a626192f5a1d150317a22))
* **core:** add lifecycle.onMounted helper, remove queueMicrotask workarounds and dead code ([#231](https://github.com/Nowely/marked-input/issues/231)) ([7b1f2c8](https://github.com/Nowely/marked-input/commit/7b1f2c81340da009e7502b992d5ace84d6fed43f))
* **core:** add model() primitive to signals ([#238](https://github.com/Nowely/marked-input/issues/238)) ([a44bcb0](https://github.com/Nowely/marked-input/commit/a44bcb007a06897ed5aee5fe109f557d7746f166))
* **core:** add writable computed primitive and refactor ValueFeature ([#232](https://github.com/Nowely/marked-input/issues/232)) ([1cde9f2](https://github.com/Nowely/marked-input/commit/1cde9f2838769c191d66a3e079158fbaf0ee3ffb))
* **core:** explicit feature dependencies, remove feature cycles ([#234](https://github.com/Nowely/marked-input/issues/234)) ([fa18ca5](https://github.com/Nowely/marked-input/commit/fa18ca5e942582240e81bb1d4e25c9b8e9288327))
* **core:** rename Features to Controllers/Models ([#237](https://github.com/Nowely/marked-input/issues/237)) ([c827334](https://github.com/Nowely/marked-input/commit/c82733400ea0c42732bbd38a308857ac47f727ca))
* **edit:** introduce EditController for centralized single-range edits ([#242](https://github.com/Nowely/marked-input/issues/242)) ([c84518b](https://github.com/Nowely/marked-input/commit/c84518b43d8203f5af13a3d4b6b95350a20c65bd))
* remove enable/disable from Feature interface ([#229](https://github.com/Nowely/marked-input/issues/229)) ([f7cbe40](https://github.com/Nowely/marked-input/commit/f7cbe40f48574543e0889063a3d9521f00977fc0))
* simplify value API and centralize caret selecting state transitions ([#236](https://github.com/Nowely/marked-input/issues/236)) ([d8be05a](https://github.com/Nowely/marked-input/commit/d8be05a1d59d94e2d6c97db054758c5f3f493015))

## [0.14.0](https://github.com/Nowely/marked-input/compare/0.13.0...0.14.0) (2026-05-06)


### ⚠ BREAKING CHANGES

* **core:** clean up event bus, simplify trigger, and remove dead props ([#202](https://github.com/Nowely/marked-input/issues/202))
* rename __nested__ placeholder to __children__ ([#156](https://github.com/Nowely/marked-input/issues/156))
* **types:** replace slot properties with top-level Mark/Overlay on Option ([#155](https://github.com/Nowely/marked-input/issues/155))

### Features

* add block reordering with drag-and-drop support ([#130](https://github.com/Nowely/marked-input/issues/130)) ([511c973](https://github.com/Nowely/marked-input/commit/511c9731aabe1251bf35ed14ce1e15ebf259cc12))
* **BlockContainer:** drag-and-drop reordering for mark blocks ([#153](https://github.com/Nowely/marked-input/issues/153)) ([e9f18ff](https://github.com/Nowely/marked-input/commit/e9f18ffc783b55d39051c79b4491142db5628e32))
* **blocks:** add block merging via Backspace/Delete and TodoList story ([#148](https://github.com/Nowely/marked-input/issues/148)) ([0685033](https://github.com/Nowely/marked-input/commit/0685033578d702aa223686f67f95fca656ea6a1f))
* **blocks:** Notion-like block editor with keyboard navigation, block operations, and drag-and-drop ([#146](https://github.com/Nowely/marked-input/issues/146)) ([4bd5534](https://github.com/Nowely/marked-input/commit/4bd5534859238019200eba2498b19590afec125a))
* **clipboard:** implement enhanced copy/cut/paste with cross-token selection support ([#176](https://github.com/Nowely/marked-input/issues/176)) ([09a3ea0](https://github.com/Nowely/marked-input/commit/09a3ea09218aee0d8b0d93a8cf29f0e03155f667))
* **core:** add ContentEditableController for DOM-based editing ([#134](https://github.com/Nowely/marked-input/issues/134)) ([633133b](https://github.com/Nowely/marked-input/commit/633133bd924ecb1e96f48d0f3526d4e19b004041))
* **core:** add DOM location engine and structural token rendering ([#220](https://github.com/Nowely/marked-input/issues/220)) ([64d5dfa](https://github.com/Nowely/marked-input/commit/64d5dfa9ec617f1956bf96ff69f4b51d83e6fadc))
* **core:** add effect cleanup, listen() helper, and refactor features to use them ([#194](https://github.com/Nowely/marked-input/issues/194)) ([c68ba9b](https://github.com/Nowely/marked-input/commit/c68ba9b0e8b75ecc07145d5c1b2c005006abd179))
* **core:** predictive input model via beforeinput ([#131](https://github.com/Nowely/marked-input/issues/131)) ([80d0369](https://github.com/Nowely/marked-input/commit/80d036958862b342a013eb189a60671614b25d62))
* **docs:** add logo directions for version 18 ([#223](https://github.com/Nowely/marked-input/issues/223)) ([fa1b733](https://github.com/Nowely/marked-input/commit/fa1b733a5064751c2953476c786181487023c96b))
* **drag:** refactor drag-and-drop into Block system ([#160](https://github.com/Nowely/marked-input/issues/160)) ([a3098b7](https://github.com/Nowely/marked-input/commit/a3098b7980cffa40179a8303c603c04e3ab5bd9c))
* **drag:** replace block mode with drag-and-drop row management ([#149](https://github.com/Nowely/marked-input/issues/149)) ([83034e8](https://github.com/Nowely/marked-input/commit/83034e8725994bd807cfeb93f05b02b3a0a668c8))
* reactive props via store.props/setProps and store.computed slots ([#188](https://github.com/Nowely/marked-input/issues/188)) ([6146513](https://github.com/Nowely/marked-input/commit/6146513fe1be38d2dbbefb26e543dea6e06ab5d1))
* **react:** migrate from @vitejs/plugin-react-swc to @vitejs/plugin-react ([#179](https://github.com/Nowely/marked-input/issues/179)) ([62d9b36](https://github.com/Nowely/marked-input/commit/62d9b362889de1fb3584aad132f92eab435dea85))
* replace signal.use() with useMarkput hook ([#190](https://github.com/Nowely/marked-input/issues/190)) ([b05e90d](https://github.com/Nowely/marked-input/commit/b05e90dbef91172157849f448303a94d5e3ea456))
* replace Slot tuple API with named component/props computeds ([#191](https://github.com/Nowely/marked-input/issues/191)) ([9fc4a5f](https://github.com/Nowely/marked-input/commit/9fc4a5f8360686ab9492d93e15775027feae3c7d))
* **selection:** enable cross-element text selection across mark tokens ([#172](https://github.com/Nowely/marked-input/issues/172)) ([b19b926](https://github.com/Nowely/marked-input/commit/b19b926f4fd19cf35c7c6889817d7c0ea138eb71))
* **storybook:** add HTML snapshot tests for all stories ([#207](https://github.com/Nowely/marked-input/issues/207)) ([6d2f987](https://github.com/Nowely/marked-input/commit/6d2f987cfb2771a8fe1d7d307a0547b3f2a9174a))
* **storybook:** add Vue Storybook ([#129](https://github.com/Nowely/marked-input/issues/129)) ([06f75c3](https://github.com/Nowely/marked-input/commit/06f75c39a20028e5147b85093f07f78bab7b5001))
* **storybook:** add withPlainValue decorator and enhance drag/text stories ([#151](https://github.com/Nowely/marked-input/issues/151)) ([1d76c1f](https://github.com/Nowely/marked-input/commit/1d76c1fbeea2f790b672c3122dfed9f388d7434e))
* **storybook:** consolidate React and Vue packages into unified storybook ([#170](https://github.com/Nowely/marked-input/issues/170)) ([8b6f560](https://github.com/Nowely/marked-input/commit/8b6f560376f03eeafedd401f05387d2e0c278cb4))
* **vue:** add initial Vue support ([#125](https://github.com/Nowely/marked-input/issues/125)) ([c479853](https://github.com/Nowely/marked-input/commit/c47985352e2dd8fbe3f0f735d249f9bcc386f723))


### Bug Fixes

* **ci:** use PAT for release-please to trigger CI on release PRs ([#225](https://github.com/Nowely/marked-input/issues/225)) ([57025dc](https://github.com/Nowely/marked-input/commit/57025dc8de34cb936cab779ec2eb407ff274955a))
* **core:** enforce readonly value writes ([#219](https://github.com/Nowely/marked-input/issues/219)) ([987fa0c](https://github.com/Nowely/marked-input/commit/987fa0c2fa09377897ed12378a0a91ad78362647))
* **core:** improve signal handling and reactive type guards ([#195](https://github.com/Nowely/marked-input/issues/195)) ([a2704a8](https://github.com/Nowely/marked-input/commit/a2704a82506457da4bdc542927e85809ebb7eb0d))
* **KeyDownController:** prioritize previousValue over value for input handling ([#158](https://github.com/Nowely/marked-input/issues/158)) ([dbac2d4](https://github.com/Nowely/marked-input/commit/dbac2d4882066ecfc98f327a2ec7a220a95c228d))
* **storybook:** prevent caret reset in TextSpan and fix Storybook issues ([#122](https://github.com/Nowely/marked-input/issues/122)) ([3472085](https://github.com/Nowely/marked-input/commit/3472085bf7406448e9f2f6aac9eb44c5a9b88954))
* support nested token sequence hosts ([#221](https://github.com/Nowely/marked-input/issues/221)) ([3a92a37](https://github.com/Nowely/marked-input/commit/3a92a37d824b145430afe0f1ab99d90cc33f201d))
* **vue:** suppress Component made reactive warnings ([#213](https://github.com/Nowely/marked-input/issues/213)) ([d41cce1](https://github.com/Nowely/marked-input/commit/d41cce1022f7997aa0f7dc96c73d1351937a7eb3))


### Refactoring

* **core:** centralize slot resolution, batch state updates, and trim public API ([#163](https://github.com/Nowely/marked-input/issues/163)) ([b0687e7](https://github.com/Nowely/marked-input/commit/b0687e7afd8cc1ffe57d9c4456ba29e686933dcf))
* **core:** clean up event bus, simplify trigger, and remove dead props ([#202](https://github.com/Nowely/marked-input/issues/202)) ([2032d6c](https://github.com/Nowely/marked-input/commit/2032d6cf2883ee7c7a25dde93e1cdd0ebc941c4c))
* **core:** collapse signal layer to use createReactiveSystem directly ([#193](https://github.com/Nowely/marked-input/issues/193)) ([f735a23](https://github.com/Nowely/marked-input/commit/f735a233c7113b90fb52ed85201d4594d8b687bf))
* **core:** decouple drag prop into layout + draggable API with computed accessors ([#196](https://github.com/Nowely/marked-input/issues/196)) ([05ad6c5](https://github.com/Nowely/marked-input/commit/05ad6c54258780e9362f39087c3469457c6c9b74))
* **core:** event-driven features architecture ([#183](https://github.com/Nowely/marked-input/issues/183)) ([17e6c5c](https://github.com/Nowely/marked-input/commit/17e6c5c2c2a180e0094123f3670e80face703b9b))
* **core:** extract feature modules from Store ([#214](https://github.com/Nowely/marked-input/issues/214)) ([a6e4704](https://github.com/Nowely/marked-input/commit/a6e470475790301b52d867e1cd90583d34827a6e))
* **core:** flatten feature API — drop state/computed/emit containers, promote to store.* ([#215](https://github.com/Nowely/marked-input/issues/215)) ([71133bf](https://github.com/Nowely/marked-input/commit/71133bfe8584274f43a1035f4f001c1f6167bc20))
* **core:** make value current source of truth ([#218](https://github.com/Nowely/marked-input/issues/218)) ([fa18b43](https://github.com/Nowely/marked-input/commit/fa18b43fde06fe770024b6c6cb8fd3b542625a0f))
* **core:** migrate refs to state signals, add typed SlotRegistry, and CI autofix ([#200](https://github.com/Nowely/marked-input/issues/200)) ([5a09ef4](https://github.com/Nowely/marked-input/commit/5a09ef411ccdc8083203d03365fdf9d101759f99))
* **core:** modernize signal/event system and simplify store architecture ([#180](https://github.com/Nowely/marked-input/issues/180)) ([34a9fd5](https://github.com/Nowely/marked-input/commit/34a9fd5b37f19e7d32cef681c59805c3e302dfc4))
* **core:** move BlockStore state init to class field ([#182](https://github.com/Nowely/marked-input/issues/182)) ([e28c9c2](https://github.com/Nowely/marked-input/commit/e28c9c2d65bb9241bfa8873bd7e14773f5932220))
* **core:** reactive parse pipeline, overlay & MarkHandler cleanup ([#199](https://github.com/Nowely/marked-input/issues/199)) ([bd6640b](https://github.com/Nowely/marked-input/commit/bd6640b1d53780fd18c0b09b3b016d72b9c39cc2))
* **core:** remove defaultSpan from Store constructor ([#181](https://github.com/Nowely/marked-input/issues/181)) ([2257f96](https://github.com/Nowely/marked-input/commit/2257f96199223c938d1f8bd9c52b806f98bb05d8))
* **core:** rename reactive symbols for clarity across 4 features ([#216](https://github.com/Nowely/marked-input/issues/216)) ([5442075](https://github.com/Nowely/marked-input/commit/54420750ccd7079f147d2b88b51b7d5f03c83df4))
* **core:** restructure Store, extract ParseFeature, remove Lifecycle, migrate signal API ([#185](https://github.com/Nowely/marked-input/issues/185)) ([afd5b1c](https://github.com/Nowely/marked-input/commit/afd5b1c78d15e4528b99ff5d89e0c39831ad1118))
* **core:** simplify event bus, lifecycle, parser derivation, and store structure ([#184](https://github.com/Nowely/marked-input/issues/184)) ([10c9971](https://github.com/Nowely/marked-input/commit/10c9971ba2bacb2d0a0b917e0162cdacd0d1af7a))
* **core:** store layer improvements — computed equals, container props, bug fixes ([#192](https://github.com/Nowely/marked-input/issues/192)) ([f89bd60](https://github.com/Nowely/marked-input/commit/f89bd60fec12427edd2f195678e32f4278e51cec))
* extract core features and controllers from React package ([#124](https://github.com/Nowely/marked-input/issues/124)) ([c0ad3d7](https://github.com/Nowely/marked-input/commit/c0ad3d7e309404f98bf962d881fe4c5d2de2c5d8))
* extract shared logic from framework adapters to core ([#145](https://github.com/Nowely/marked-input/issues/145)) ([795c0e8](https://github.com/Nowely/marked-input/commit/795c0e82d38c065f1f4e25c5695d1c0decd814cc))
* extract shared Popup/List/ListItem from Suggestions and BlockMenu ([#168](https://github.com/Nowely/marked-input/issues/168)) ([3c07bb8](https://github.com/Nowely/marked-input/commit/3c07bb833e5622173c166d6f22782816bc898db9))
* improve Signal typing with interface augmentation for framework-specific use() return types ([#143](https://github.com/Nowely/marked-input/issues/143)) ([e6d4efc](https://github.com/Nowely/marked-input/commit/e6d4efc5168029c6c75c60b43d2e6abc8ad654bb))
* Migrate on alien signals ([#178](https://github.com/Nowely/marked-input/issues/178)) ([8de20b9](https://github.com/Nowely/marked-input/commit/8de20b95af4b4346a0c140263794cf4aff48cf6a))
* move @markput/core from packages/common/core to packages/core ([#171](https://github.com/Nowely/marked-input/issues/171)) ([6a0a7d2](https://github.com/Nowely/marked-input/commit/6a0a7d238746c527c2a1b134ff29191f2d002c2a))
* **react:** remove useStore hook, consolidate into useMarkput ([#204](https://github.com/Nowely/marked-input/issues/204)) ([8501dd6](https://github.com/Nowely/marked-input/commit/8501dd65bfbf17203bb69796616f615bb228fa06))
* rename __nested__ placeholder to __children__ ([#156](https://github.com/Nowely/marked-input/issues/156)) ([eb797a5](https://github.com/Nowely/marked-input/commit/eb797a5d6d4671b339a077ace81b1f00e80f5255))
* rename Store.features to feature, store.event to emit ([#205](https://github.com/Nowely/marked-input/issues/205)) ([3af9c45](https://github.com/Nowely/marked-input/commit/3af9c451ba8d2660841d2ea431e15eda079556c3))
* Replace __children__ with __slot__, consolidate token rendering, and enhance drag mode ([#157](https://github.com/Nowely/marked-input/issues/157)) ([00d57ed](https://github.com/Nowely/marked-input/commit/00d57edf780b8919dab64fc9954d7a9015d66cce))
* resolve all lint warnings and enforce type-safety rules ([#167](https://github.com/Nowely/marked-input/issues/167)) ([a77e942](https://github.com/Nowely/marked-input/commit/a77e94209e638d90aa574ac50d8a5aa4876db163))
* **storybook:** replace fragile setTimeout with vitest-browser locator assertions ([#197](https://github.com/Nowely/marked-input/issues/197)) ([f638f63](https://github.com/Nowely/marked-input/commit/f638f637fe4c306162eaace4a727fbb1c7e4a53c))
* **storybook:** standardize stories with PlainValuePanel and StoryObj types across React and Vue ([#152](https://github.com/Nowely/marked-input/issues/152)) ([42d21f3](https://github.com/Nowely/marked-input/commit/42d21f3ce949fc893f58181b6ea7da1c53fc0b32))
* **types:** replace slot properties with top-level Mark/Overlay on Option ([#155](https://github.com/Nowely/marked-input/issues/155)) ([2b5d558](https://github.com/Nowely/marked-input/commit/2b5d558147f6c6797650a1b1c98e5529f9190b67))
* **website:** remove Tailwind CSS ([#209](https://github.com/Nowely/marked-input/issues/209)) ([557b89a](https://github.com/Nowely/marked-input/commit/557b89acc6e4b6e07f8826045ba46e0af5e35629))


### Documentation

* Add AGENTS.md ([#135](https://github.com/Nowely/marked-input/issues/135)) ([675a8e2](https://github.com/Nowely/marked-input/commit/675a8e203c0abe8434e5c4d062a3cb1ac9e183d6))
* refresh contributor instructions ([#224](https://github.com/Nowely/marked-input/issues/224)) ([48ed5b8](https://github.com/Nowely/marked-input/commit/48ed5b8e799e5679470a8b86e16bdbb2a8122a4f))
* rewrite AGENTS.md  ([#159](https://github.com/Nowely/marked-input/issues/159)) ([4fc49b7](https://github.com/Nowely/marked-input/commit/4fc49b78b937619e0c6ed3b29e083139e467d6d1))
* update AGENTS.md, add CLAUDE.md, and refresh architecture docs ([#162](https://github.com/Nowely/marked-input/issues/162)) ([45e585c](https://github.com/Nowely/marked-input/commit/45e585c95b3d197cc602637cf6b075d97ecd23a5))
* update README to include Vue package information and badges ([3a87989](https://github.com/Nowely/marked-input/commit/3a879893aae8ebc03e16c9a0a73d6a9eeab370ad))
* update Storybook links and reorganize badges by framewor ([#137](https://github.com/Nowely/marked-input/issues/137)) ([9884dc1](https://github.com/Nowely/marked-input/commit/9884dc14d61680f1a0394e8667be924344f8abd6))


### Miscellaneous

* add release-please config for unified versioning ([db07f5e](https://github.com/Nowely/marked-input/commit/db07f5ee2e20016905058769190e17dc73f5cdfe))
* add sync step to release workflow for main branch updates ([bde610f](https://github.com/Nowely/marked-input/commit/bde610fc35d41e7059bb9b8785ca9d532731f3e1))
* **deps:** update package dependencies and versions ([#164](https://github.com/Nowely/marked-input/issues/164)) ([1e3ddb2](https://github.com/Nowely/marked-input/commit/1e3ddb28c1a0ced3f1084e8472e71d0a13ff85da))
* improve type safety and fix lint rules across packages ([#166](https://github.com/Nowely/marked-input/issues/166)) ([084b6f8](https://github.com/Nowely/marked-input/commit/084b6f8e7a1a930954c28b2e3698e59fe86122e1))
* **lint:** update ESLint configuration and add TypeScript rules ([#165](https://github.com/Nowely/marked-input/issues/165)) ([fa56e39](https://github.com/Nowely/marked-input/commit/fa56e39616eb0d4b97a127501095745d6cef4c60))
* migrate from prettier to oxfmt ([#139](https://github.com/Nowely/marked-input/issues/139)) ([4349b1b](https://github.com/Nowely/marked-input/commit/4349b1b0210c91119a872246a4ac94628da668c5))
* migrate lint/format configs to TypeScript and update script conventions ([#208](https://github.com/Nowely/marked-input/issues/208)) ([b0850b5](https://github.com/Nowely/marked-input/commit/b0850b573dbee47959dc4f047ddaa65761e0e7af))
* migrate to pnpm catalog for centralized dependency management ([#140](https://github.com/Nowely/marked-input/issues/140)) ([b71cd55](https://github.com/Nowely/marked-input/commit/b71cd55ad88966d629f4c90733488bfc73869f5d))
* migrate to TypeScript 6.0 ([#210](https://github.com/Nowely/marked-input/issues/210)) ([a68a186](https://github.com/Nowely/marked-input/commit/a68a186f7a62a6a8c583cebddfab30b8ce857d08))
* **next:** release 0.10.0 ([#177](https://github.com/Nowely/marked-input/issues/177)) ([f506887](https://github.com/Nowely/marked-input/commit/f5068872242a9a9bdb53602bb364393cca7ae58c))
* **next:** release 0.10.1 ([#186](https://github.com/Nowely/marked-input/issues/186)) ([e04bdf2](https://github.com/Nowely/marked-input/commit/e04bdf27d305d037b2033dd6e6e6a26deedba652))
* **next:** release 0.11.0 ([#189](https://github.com/Nowely/marked-input/issues/189)) ([2224956](https://github.com/Nowely/marked-input/commit/222495670625f381d5c34fb8efb3dcdef929f666))
* **next:** release 0.12.0 ([#201](https://github.com/Nowely/marked-input/issues/201)) ([7e3a952](https://github.com/Nowely/marked-input/commit/7e3a9524353520bf1df08efc2438dc61e3a477a9))
* **next:** release 0.12.1 ([#211](https://github.com/Nowely/marked-input/issues/211)) ([426f1fe](https://github.com/Nowely/marked-input/commit/426f1fe0b0979b885a98c3ca5911c60dd192e66b))
* **next:** release 0.13.0 ([#217](https://github.com/Nowely/marked-input/issues/217)) ([1581544](https://github.com/Nowely/marked-input/commit/15815449fbcc7550f8638eff922c055fe4a28ed5))
* **next:** release 0.3.0 ([#128](https://github.com/Nowely/marked-input/issues/128)) ([fe0bc60](https://github.com/Nowely/marked-input/commit/fe0bc6045bcf36546c4c05dba10154e610b2a002))
* **next:** release 0.4.0 ([#132](https://github.com/Nowely/marked-input/issues/132)) ([86c24c9](https://github.com/Nowely/marked-input/commit/86c24c9442d3c0d9db5a9d7be59704ead4dcde03))
* **next:** release 0.5.0 ([#141](https://github.com/Nowely/marked-input/issues/141)) ([ac6af98](https://github.com/Nowely/marked-input/commit/ac6af98878fc14941870751d6b1708cf9c6d8649))
* **next:** release 0.6.0 ([#147](https://github.com/Nowely/marked-input/issues/147)) ([7d275e5](https://github.com/Nowely/marked-input/commit/7d275e5ca7f20f5fd51f2c68a24a642ea115796b))
* **next:** release 0.7.0 ([#154](https://github.com/Nowely/marked-input/issues/154)) ([d3b5173](https://github.com/Nowely/marked-input/commit/d3b51730bd7f81033ebde26e27c1572286a610aa))
* **next:** release 0.8.0 ([#161](https://github.com/Nowely/marked-input/issues/161)) ([7a7383b](https://github.com/Nowely/marked-input/commit/7a7383b873a183e924a7d0e9f84a612ee885e4af))
* **next:** release 0.9.0 ([#174](https://github.com/Nowely/marked-input/issues/174)) ([d0e9783](https://github.com/Nowely/marked-input/commit/d0e978386fb31ed23ba3482f8e54c044011041e4))
* **next:** release root 0.2.0 ([#127](https://github.com/Nowely/marked-input/issues/127)) ([b42e4d3](https://github.com/Nowely/marked-input/commit/b42e4d34adf60be246031a4a039a1bc47d0fa8ba))
* remove .npmrc hoisting workaround for storybook ([#175](https://github.com/Nowely/marked-input/issues/175)) ([178a246](https://github.com/Nowely/marked-input/commit/178a246d6c69209e28180870236f73d058136b5f))
* remove unused EditableSpan components ([#133](https://github.com/Nowely/marked-input/issues/133)) ([2e5388a](https://github.com/Nowely/marked-input/commit/2e5388afe14e51df44c34c82f89602f14f48f994))
* remove unused Vercel configuration file from Storybook ([#136](https://github.com/Nowely/marked-input/issues/136)) ([60129be](https://github.com/Nowely/marked-input/commit/60129be7ec1f530031e495035f5f113a73a551e4))
* rename package from root to markput in package.json ([1cb8a8a](https://github.com/Nowely/marked-input/commit/1cb8a8a9146fb5b732509bdf54c26ac9a4ba204a))
* rename root package to @markput/monorepo ([#173](https://github.com/Nowely/marked-input/issues/173)) ([cfe91f9](https://github.com/Nowely/marked-input/commit/cfe91f9a5eb729e84ff33a5fb3efcc68ab6ea6f7))
* update lint config, deps, and readonly constructors ([#198](https://github.com/Nowely/marked-input/issues/198)) ([b819325](https://github.com/Nowely/marked-input/commit/b819325e4a1d09bc7be7d10a5a8141a16e2bdbe0))
* update oxlint configuration ([#144](https://github.com/Nowely/marked-input/issues/144)) ([1db73ec](https://github.com/Nowely/marked-input/commit/1db73eca4d8846b911aa2c6875caf6b95bed228e))
* update release-please config to exclude component in tag ([1555898](https://github.com/Nowely/marked-input/commit/1555898f840c65fbebd96193758d44fd79d2dde5))
* upgrade to React 19 ([#121](https://github.com/Nowely/marked-input/issues/121)) ([d9c9531](https://github.com/Nowely/marked-input/commit/d9c953144b2ce674f6a8e8a99dba0c4eb5328862))
* upgrade to Vite 8, Vitest 4.1, and Astro 6 ([#150](https://github.com/Nowely/marked-input/issues/150)) ([693966d](https://github.com/Nowely/marked-input/commit/693966d122260d5da28a4cba7cb53df10fea969a))
* upgrade vue-tsc to v3.2.5 ([#138](https://github.com/Nowely/marked-input/issues/138)) ([a189b53](https://github.com/Nowely/marked-input/commit/a189b532ddf373b57083e7ff52144edd6617eb27))


### CI

* add automated release workflow and PR validation ([#120](https://github.com/Nowely/marked-input/issues/120)) ([85b6fc4](https://github.com/Nowely/marked-input/commit/85b6fc476a655447e9f24706734efd057453b8f2))


### Tests

* add comprehensive Vue component tests with Vitest ([#142](https://github.com/Nowely/marked-input/issues/142)) ([231f3dc](https://github.com/Nowely/marked-input/commit/231f3dc902b88f6bfa683df5346c6343a6adbb0e))
* **core:** migrate all specs to vitest browser mode with playwright ([#206](https://github.com/Nowely/marked-input/issues/206)) ([5b3f80a](https://github.com/Nowely/marked-input/commit/5b3f80af0a8861ede4a6cb06f4bc3ca5328e9c19))
* fix broken tests, close react/vue parity, unify vitest workspace config ([#212](https://github.com/Nowely/marked-input/issues/212)) ([b4bd339](https://github.com/Nowely/marked-input/commit/b4bd3393fe64f05523c5628ee56f0b0af6108927))
* **storybook:** format html snapshots ([#222](https://github.com/Nowely/marked-input/issues/222)) ([5cb1771](https://github.com/Nowely/marked-input/commit/5cb17710dbc6bc90f6e184850153146bbcda374c))


### Build

* inline @markput/core types into published packages ([#187](https://github.com/Nowely/marked-input/issues/187)) ([d8f44ff](https://github.com/Nowely/marked-input/commit/d8f44ff4d421812844b6ffe87f827b6e8e923470))

## [0.13.0](https://github.com/Nowely/marked-input/compare/0.12.1...0.13.0) (2026-05-05)


### Features

* **core:** add DOM location engine and structural token rendering ([#220](https://github.com/Nowely/marked-input/issues/220)) ([64d5dfa](https://github.com/Nowely/marked-input/commit/64d5dfa9ec617f1956bf96ff69f4b51d83e6fadc))
* **docs:** add logo directions for version 18 ([#223](https://github.com/Nowely/marked-input/issues/223)) ([fa1b733](https://github.com/Nowely/marked-input/commit/fa1b733a5064751c2953476c786181487023c96b))


### Bug Fixes

* **ci:** use PAT for release-please to trigger CI on release PRs ([#225](https://github.com/Nowely/marked-input/issues/225)) ([57025dc](https://github.com/Nowely/marked-input/commit/57025dc8de34cb936cab779ec2eb407ff274955a))
* **core:** enforce readonly value writes ([#219](https://github.com/Nowely/marked-input/issues/219)) ([987fa0c](https://github.com/Nowely/marked-input/commit/987fa0c2fa09377897ed12378a0a91ad78362647))
* support nested token sequence hosts ([#221](https://github.com/Nowely/marked-input/issues/221)) ([3a92a37](https://github.com/Nowely/marked-input/commit/3a92a37d824b145430afe0f1ab99d90cc33f201d))


### Refactoring

* **core:** make value current source of truth ([#218](https://github.com/Nowely/marked-input/issues/218)) ([fa18b43](https://github.com/Nowely/marked-input/commit/fa18b43fde06fe770024b6c6cb8fd3b542625a0f))


### Documentation

* refresh contributor instructions ([#224](https://github.com/Nowely/marked-input/issues/224)) ([48ed5b8](https://github.com/Nowely/marked-input/commit/48ed5b8e799e5679470a8b86e16bdbb2a8122a4f))


### Tests

* **storybook:** format html snapshots ([#222](https://github.com/Nowely/marked-input/issues/222)) ([5cb1771](https://github.com/Nowely/marked-input/commit/5cb17710dbc6bc90f6e184850153146bbcda374c))

## [0.12.1](https://github.com/Nowely/marked-input/compare/0.12.0...0.12.1) (2026-04-23)


### Bug Fixes

* **vue:** suppress Component made reactive warnings ([#213](https://github.com/Nowely/marked-input/issues/213)) ([d41cce1](https://github.com/Nowely/marked-input/commit/d41cce1022f7997aa0f7dc96c73d1351937a7eb3))


### Refactoring

* **core:** extract feature modules from Store ([#214](https://github.com/Nowely/marked-input/issues/214)) ([a6e4704](https://github.com/Nowely/marked-input/commit/a6e470475790301b52d867e1cd90583d34827a6e))
* **core:** flatten feature API — drop state/computed/emit containers, promote to store.* ([#215](https://github.com/Nowely/marked-input/issues/215)) ([71133bf](https://github.com/Nowely/marked-input/commit/71133bfe8584274f43a1035f4f001c1f6167bc20))
* **core:** rename reactive symbols for clarity across 4 features ([#216](https://github.com/Nowely/marked-input/issues/216)) ([5442075](https://github.com/Nowely/marked-input/commit/54420750ccd7079f147d2b88b51b7d5f03c83df4))


### Miscellaneous

* migrate to TypeScript 6.0 ([#210](https://github.com/Nowely/marked-input/issues/210)) ([a68a186](https://github.com/Nowely/marked-input/commit/a68a186f7a62a6a8c583cebddfab30b8ce857d08))


### Tests

* fix broken tests, close react/vue parity, unify vitest workspace config ([#212](https://github.com/Nowely/marked-input/issues/212)) ([b4bd339](https://github.com/Nowely/marked-input/commit/b4bd3393fe64f05523c5628ee56f0b0af6108927))

## [0.12.0](https://github.com/Nowely/marked-input/compare/0.11.0...0.12.0) (2026-04-22)


### ⚠ BREAKING CHANGES

* **core:** clean up event bus, simplify trigger, and remove dead props ([#202](https://github.com/Nowely/marked-input/issues/202))

### Features

* **storybook:** add HTML snapshot tests for all stories ([#207](https://github.com/Nowely/marked-input/issues/207)) ([6d2f987](https://github.com/Nowely/marked-input/commit/6d2f987cfb2771a8fe1d7d307a0547b3f2a9174a))


### Refactoring

* **core:** clean up event bus, simplify trigger, and remove dead props ([#202](https://github.com/Nowely/marked-input/issues/202)) ([2032d6c](https://github.com/Nowely/marked-input/commit/2032d6cf2883ee7c7a25dde93e1cdd0ebc941c4c))
* **core:** migrate refs to state signals, add typed SlotRegistry, and CI autofix ([#200](https://github.com/Nowely/marked-input/issues/200)) ([5a09ef4](https://github.com/Nowely/marked-input/commit/5a09ef411ccdc8083203d03365fdf9d101759f99))
* **react:** remove useStore hook, consolidate into useMarkput ([#204](https://github.com/Nowely/marked-input/issues/204)) ([8501dd6](https://github.com/Nowely/marked-input/commit/8501dd65bfbf17203bb69796616f615bb228fa06))
* rename Store.features to feature, store.event to emit ([#205](https://github.com/Nowely/marked-input/issues/205)) ([3af9c45](https://github.com/Nowely/marked-input/commit/3af9c451ba8d2660841d2ea431e15eda079556c3))
* **website:** remove Tailwind CSS ([#209](https://github.com/Nowely/marked-input/issues/209)) ([557b89a](https://github.com/Nowely/marked-input/commit/557b89acc6e4b6e07f8826045ba46e0af5e35629))


### Miscellaneous

* migrate lint/format configs to TypeScript and update script conventions ([#208](https://github.com/Nowely/marked-input/issues/208)) ([b0850b5](https://github.com/Nowely/marked-input/commit/b0850b573dbee47959dc4f047ddaa65761e0e7af))


### Tests

* **core:** migrate all specs to vitest browser mode with playwright ([#206](https://github.com/Nowely/marked-input/issues/206)) ([5b3f80a](https://github.com/Nowely/marked-input/commit/5b3f80af0a8861ede4a6cb06f4bc3ca5328e9c19))

## [0.11.0](https://github.com/Nowely/marked-input/compare/0.10.1...0.11.0) (2026-04-14)


### Features

* **core:** add effect cleanup, listen() helper, and refactor features to use them ([#194](https://github.com/Nowely/marked-input/issues/194)) ([c68ba9b](https://github.com/Nowely/marked-input/commit/c68ba9b0e8b75ecc07145d5c1b2c005006abd179))
* reactive props via store.props/setProps and store.computed slots ([#188](https://github.com/Nowely/marked-input/issues/188)) ([6146513](https://github.com/Nowely/marked-input/commit/6146513fe1be38d2dbbefb26e543dea6e06ab5d1))
* replace signal.use() with useMarkput hook ([#190](https://github.com/Nowely/marked-input/issues/190)) ([b05e90d](https://github.com/Nowely/marked-input/commit/b05e90dbef91172157849f448303a94d5e3ea456))
* replace Slot tuple API with named component/props computeds ([#191](https://github.com/Nowely/marked-input/issues/191)) ([9fc4a5f](https://github.com/Nowely/marked-input/commit/9fc4a5f8360686ab9492d93e15775027feae3c7d))


### Bug Fixes

* **core:** improve signal handling and reactive type guards ([#195](https://github.com/Nowely/marked-input/issues/195)) ([a2704a8](https://github.com/Nowely/marked-input/commit/a2704a82506457da4bdc542927e85809ebb7eb0d))


### Refactoring

* **core:** collapse signal layer to use createReactiveSystem directly ([#193](https://github.com/Nowely/marked-input/issues/193)) ([f735a23](https://github.com/Nowely/marked-input/commit/f735a233c7113b90fb52ed85201d4594d8b687bf))
* **core:** decouple drag prop into layout + draggable API with computed accessors ([#196](https://github.com/Nowely/marked-input/issues/196)) ([05ad6c5](https://github.com/Nowely/marked-input/commit/05ad6c54258780e9362f39087c3469457c6c9b74))
* **core:** reactive parse pipeline, overlay & MarkHandler cleanup ([#199](https://github.com/Nowely/marked-input/issues/199)) ([bd6640b](https://github.com/Nowely/marked-input/commit/bd6640b1d53780fd18c0b09b3b016d72b9c39cc2))
* **core:** store layer improvements — computed equals, container props, bug fixes ([#192](https://github.com/Nowely/marked-input/issues/192)) ([f89bd60](https://github.com/Nowely/marked-input/commit/f89bd60fec12427edd2f195678e32f4278e51cec))
* **storybook:** replace fragile setTimeout with vitest-browser locator assertions ([#197](https://github.com/Nowely/marked-input/issues/197)) ([f638f63](https://github.com/Nowely/marked-input/commit/f638f637fe4c306162eaace4a727fbb1c7e4a53c))


### Miscellaneous

* update lint config, deps, and readonly constructors ([#198](https://github.com/Nowely/marked-input/issues/198)) ([b819325](https://github.com/Nowely/marked-input/commit/b819325e4a1d09bc7be7d10a5a8141a16e2bdbe0))

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

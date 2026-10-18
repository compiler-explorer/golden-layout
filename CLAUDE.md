# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Compiler Explorer's fork of [Golden Layout](https://golden-layout.com/) 1.5.x — a multi-window/multi-screen JavaScript layout manager. The default branch is `ce-main`. The library is plain ES5 JavaScript (not TypeScript) and has a hard runtime dependency on **jQuery**, expected to be available as `window.$`.

## Commands

- `npm run build` — full build (`build/build.js`): generates `index.html` (from `index.hbs`), compiles the `src/less/*.less` themes into `src/css/*.css` with source maps, concatenates `dist/goldenlayout.js` and minifies it into `dist/goldenlayout.min.js` with UglifyJS. None of this output is committed (see `.gitignore`); `npm pack`/`npm publish` run the build first via the `prepack` script.
- `npm test` — runs the Vitest suite once (browser mode, headless Chrome) then `npm run typecheck`. Playwright drives the system Chrome (`channel: 'chrome'` in `vitest.config.mjs`), so Chrome must be installed; Playwright's own browsers are not used.
- `npx vitest` — the same suite in watch mode. `npx vitest run test/title-tests.js` runs one file; `-t '<name>'` filters by spec name.
- `npm run typecheck` — type-checks `index.d.ts` with `tsc` (strict, no emit); config in `tsconfig.json`.

The build is plain Node with no task runner: `less` for the themes, `uglify-js` for the minified file and `handlebars` for `index.html`; everything else is `fs`.

PR titles must be conventional commits (`fix:`, `feat:`, `chore:`, ...; checked by `.github/workflows/pr-title.yml`): PRs are squash-merged, and Release Please builds releases and `CHANGELOG.md` from those titles. Don't bump `version` by hand; see "Releasing" in the README.

Many specs share state across the `it` blocks of a `describe` and rely on running in order, so `vitest.config.mjs` turns off shuffling and Vitest's default `clearMocks` (spies keep their calls across `it` blocks). Specs that wait for something are `async` and use `testTools.waitsFor`.

## Build model (important)

The shipped file is produced by **plain concatenation, not a module bundler**. There is no `require`/`import` between source files — everything hangs off a single global `lm` namespace object.

- The build starts with `var lm = {config, container, controls, errors, items, utils}`, generated from the directories under `src/js`, so a new subdirectory gets a namespace slot automatically.
- Concatenation order (`sources()` in `build/build.js`): after that declaration, `utils/utils.js`, `utils/EventEmitter.js`, `utils/DragListener.js`, then the rest of `src/js/**/*.js` sorted by path, ignoring case. The three utils come first because other files reference them at definition time.
- The concatenated result is wrapped in `(function($){ ... })(window.$)`, which is how `$` is in scope everywhere without an explicit import.

Consequence: when adding a file, place classes on the correct `lm.<namespace>.<Name>` slot, and remember that anything referenced at load time (not just call time) must be concatenated earlier.

## Architecture

Everything is a mixin-based ES5 "class" using `lm.utils.copy(Proto.prototype, {...})` for methods and `lm.utils.extend` for inheritance. `lm.utils.EventEmitter.call(this)` is mixed into most constructors.

- **`lm.LayoutManager`** (`src/js/LayoutManager.js`) — the public entry point, exported as `GoldenLayout`. Owns the config, the root content item, popout windows, drag sources, and the component registry. `registerComponent(name, ctor)` maps a `componentName` to a constructor; `_typeToItem` maps config `type` (`row`/`column`/`stack`/`component`) to item classes. `LayoutManager.__lm = lm` exposes the private namespace.
- **Content items** (`src/js/items/`) — all inherit from `AbstractContentItem`, which provides the tree (`contentItems`, `parent`, traversal, lifecycle `_$init`/`_$show`/`_$hide`/`_$destroy`) and event bubbling. Concrete types: `Root`, `RowOrColumn` (one class, `isColumn` flag), `Stack`, `Component`. `Component` wraps a user-registered constructor and instantiates an `lm.container.ItemContainer`.
- **Controls** (`src/js/controls/`) — UI/interaction pieces: `Header`, `Tab`, `HeaderButton`, `Splitter`, `DragProxy`/`DragSource`, `DropTargetIndicator`, `TransitionIndicator`, `BrowserPopout` (native popup windows).
- **Container** (`src/js/container/ItemContainer.js`) — the object handed to user components; bridges component state/size to the layout.
- **Utils** (`src/js/utils/`) — `EventEmitter`, `EventHub` (cross-window events), `DragListener`, `ConfigMinifier` (the one-letter key compression behind `LayoutManager.minifyConfig`/`unminifyConfig`), `ReactComponentHandler` (registered automatically as the `lm-react-component`), and `utils.js` helpers.
- **Config** (`src/js/config/`) — `defaultConfig.js`, `ItemDefaultConfig.js`.

State persistence: layouts serialize to/from a config object (`toConfig()` / construct from config), optionally minified via `ConfigMinifier`.

## Types and tests

- `index.d.ts` is the hand-maintained TypeScript declaration for the public API. Keep it in sync when changing public methods/signatures; it is what `npm run typecheck` checks.
- Tests are Vitest specs in `test/*tests.js`, run in headless Chrome via Vitest browser mode (they need real layout, so not jsdom). `test/setup.js` loads `lib/jquery.js` and the concatenated build as classic scripts; `vitest.config.mjs` builds it in memory with `concatenated()` from `build/build.js`, so it's the same as what `npm run build` writes to `dist/goldenlayout.js` from the current `src/js`, and needs no build first. Watch mode (`npx vitest`) rebuilds it when a source file is edited, added or removed, or `build/build.js` changes. The build wraps `lm` in an IIFE, so the setup exposes `window.lm` for the specs that use it. `test/test-tools.js` holds shared helpers. Titles are text: tabs, drag proxies and popout windows set them with `.text()`/attributes, never as HTML, and `test/title-xss-tests.js` checks that markup in a title never renders or runs. Keep it that way when touching titles; the callers (Compiler Explorer) pass raw, unescaped titles.

## Manual dev harness

`index.html` (generated) + `start.js` load the built library against `?layout=responsive|tab-dropdown` query params for manual testing of standard/responsive/tab-dropdown layouts and theme switching.

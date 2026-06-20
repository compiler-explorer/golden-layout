# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Compiler Explorer's fork of [Golden Layout](https://golden-layout.com/) 1.5.x — a multi-window/multi-screen JavaScript layout manager. The default branch is `ce-main`. The library is plain ES5 JavaScript (not TypeScript) and has a hard runtime dependency on **jQuery**, expected to be available as `window.$`.

## Commands

The build is driven by Grunt (needs `grunt-cli` installed globally: `npm install -g grunt-cli`).

- `grunt dist` — full build: regenerates the namespace + index, compiles LESS themes, and concatenates `dist/goldenlayout.js` and `dist/goldenlayout.min.js`. Run this to produce distributable output.
- `grunt build` — only the codegen step (`build/task.js`): walks `src/js`, regenerates `build/ns.js` and `index.html` (from `index.hbs`).
- `grunt less` — compile `src/less/*.less` themes into `src/css/*.css`.
- `grunt watch` (the default task) — rebuild and re-test on changes to `src/**` / `test/**`, with livereload.
- `npm test` — runs `grunt test` (Karma single-run under headless Chrome) then `npm run tslint`. Needs Chrome/Chromium on `PATH` (or `CHROME_BIN` set); the `ChromeHeadlessNoSandbox` launcher in `karma.conf.js` runs with `--no-sandbox` for CI/root.
- `grunt karma:unit` — local Karma runner (Chrome, watch mode, `singleRun: false`).
- `npm run tslint` — lints `**/*.ts` (primarily `index.d.ts`); config in `tslint.json`.

There is no single-test runner flag; narrow a Karma run by temporarily editing the `files` globs in `karma.conf.js`, or `fdescribe`/`fit` in the relevant `test/*.js` spec.

The dist pipeline uses native grunt plugins: `grunt-contrib-concat` (wraps the concatenated sources in the `(function($){…})(window.$)` IIFE via its banner/footer) then `grunt-contrib-uglify` for the `.min.js`. The old gulp/`grunt-gulp` pipeline (and the long-deprecated `gulpfile.js`) were removed — they pinned `gulp@3`, which is incompatible with modern Node.

The specs were written for Jasmine 1.x (legacy `runs`/`waits`/`waitsFor` + `spy.calls.length`/`spy.mostRecentCall`). `test/jasmine-compat.js` shims that API onto Jasmine 2+ and must load before the spec files (it's listed first in `karma.conf.js`). Jasmine randomisation is disabled (`client.jasmine.random = false`) because specs share state across `it` blocks.

## Build model (important)

The shipped file is produced by **plain concatenation, not a module bundler**. There is no `require`/`import` between source files — everything hangs off a single global `lm` namespace object.

- `build/ns.js` declares `var lm = {config, container, controls, errors, items, utils}` and is the **first** file concatenated. It is generated from the `src/js` directory tree by `grunt build`, so adding a new subdirectory under `src/js` requires regenerating it.
- Concatenation order (from `Gruntfile.js` / `karma.conf.js`): `build/ns.js`, then `utils/utils.js`, `utils/EventEmitter.js`, `utils/DragListener.js`, then the rest of `src/js/**/*.js`. These are loaded early because other files reference them at definition time. (grunt's globbing dedupes the explicitly-listed utils against the trailing glob, preserving first-occurrence order.)
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

- `index.d.ts` is the hand-maintained TypeScript declaration for the public API. Keep it in sync when changing public methods/signatures; it is what `tslint` checks.
- Tests are Jasmine specs in `test/*.js`, run in a real/headless browser via Karma (they need jQuery + the concatenated source, see `karma.conf.js` file list). `test/test-tools.js` holds shared helpers. Note `test/xss_tests.js` — title/HTML sanitization is security-relevant; preserve escaping (`lm.utils.stripTags`) when touching titles/tabs.

## Manual dev harness

`index.html` (generated) + `start.js` load the built library against `?layout=responsive|tab-dropdown` query params for manual testing of standard/responsive/tab-dropdown layouts and theme switching.

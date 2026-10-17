# Golden Layout 1.x: Compiler Explorer fork

This is [Compiler Explorer](https://godbolt.org)'s fork of [Golden Layout](https://golden-layout.com/) 1.x. We maintain it only for Compiler Explorer: it's based on upstream 1.5.9 with a few fixes and modernised tooling. It's published to npm as [`@compiler-explorer/golden-layout`](https://www.npmjs.com/package/@compiler-explorer/golden-layout).

**If you want Golden Layout for your own project, use [upstream](https://github.com/golden-layout/golden-layout) (`golden-layout` on npm)**, not this fork. We don't support other uses, and we only make changes Compiler Explorer needs.

## How Compiler Explorer uses it

Compiler Explorer installs it through an npm alias, so code and CSS still refer to `golden-layout`:

```json
"golden-layout": "npm:@compiler-explorer/golden-layout@1.6.0"
```

## Development

```bash
npm ci
npm install -g grunt-cli
grunt dist   # rebuild dist/ and src/css from the sources
npm test     # Karma tests in headless Chrome, plus tslint
```

`dist/` and `src/css` are committed and published as they are, so commit the output of `grunt dist` with any source change. CI fails if they're out of date. See [`CLAUDE.md`](CLAUDE.md) for how the build fits together.

## Releasing a new version (CE admins)

1. **Agree the change with the other CE admins first.** Every release goes straight to npm, and from there into Compiler Explorer.
2. In the PR making the change, run `grunt dist`, and bump `version` in `package.json` and `package-lock.json` (`npm version <x.y.z> --no-git-tag-version`).
3. Once it's merged to `ce-main`, publish a GitHub release tagged `v<x.y.z>`:
   ```bash
   gh release create v<x.y.z> -R compiler-explorer/golden-layout --target ce-main --generate-notes
   ```
4. The [publish workflow](.github/workflows/publish.yml) then publishes to npm through Trusted Publishing, with provenance; no npm token is involved. It refuses to publish if the tag doesn't match `package.json` or if the committed build is out of date.
5. Update Compiler Explorer's `package.json` and `package-lock.json` to the new version in a CE PR.

## License

MIT, copyright deepstream.io; see [LICENSE](LICENSE).

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
npm run build  # build dist/ and src/css from the sources (not committed)
npm test       # Vitest tests in headless Chrome, plus a type-check of index.d.ts
```

The tests use [Vitest browser mode](https://vitest.dev/guide/browser/) with Playwright driving the system Chrome, so Chrome must be installed. They load jQuery and the concatenated build, made in memory from the sources exactly as `npm run build` makes `dist/goldenlayout.js`. Run one file with `npx vitest run test/title-tests.js`, or filter by name with `-t`.

`dist/` and the compiled `src/css` themes are build output: they aren't committed, and `npm pack`/`npm publish` build them first. See [`CLAUDE.md`](CLAUDE.md) for how the build fits together.

## Releasing a new version (CE admins)

Releases are made by [Release Please](https://github.com/googleapis/release-please) from the PR titles merged to `ce-main`.

1. **Agree the change with the other CE admins first.** Every release goes straight to npm, and from there into Compiler Explorer.
2. Give the PR a [conventional commit](https://www.conventionalcommits.org/) title, which CI checks: `fix: ...` for a patch release, `feat: ...` for a minor one, or `chore:`, `docs:`, `ci:`, `build:`, `test:` or `refactor:` for no release. Squash-merge it, so the title becomes the commit message.
3. Release Please then opens (or updates) a release PR that bumps the version in `package.json` and `package-lock.json` and adds the changes to `CHANGELOG.md`. Merge it when you want to release.
4. Merging the release PR tags `v<x.y.z>`, creates the GitHub release, and the [release workflow](.github/workflows/publish.yml) publishes to npm through Trusted Publishing, with provenance; no npm token is involved. It refuses to publish if the package is missing its built files.
5. Update Compiler Explorer's `package.json` and `package-lock.json` to the new version in a CE PR.

## License

MIT, copyright deepstream.io; see [LICENSE](LICENSE).

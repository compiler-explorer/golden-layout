import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const require = createRequire( import.meta.url );
const root = path.dirname( fileURLToPath( import.meta.url ) );

/**
 * Builds dist/goldenlayout.js in memory, exactly as `grunt concat` does, by
 * reading the concat settings from Gruntfile.js. The tests run against this
 * concatenated build rather than the individual source files, so they
 * exercise the code that ships, without needing a `grunt dist` first.
 * Returns the build and the source files it was made from.
 */
function concatenatedBuild() {
	const grunt = require( 'grunt' );
	let config;
	require( './Gruntfile.js' )( {
		registerTask() {},
		loadNpmTasks() {},
		initConfig( c ) { config = c; },
		file: grunt.file
	} );
	const { src, options } = config.concat.dist;
	const files = grunt.file.expand( { cwd: root }, src ).map( file => path.join( root, file ) );
	const sources = files.map( file => grunt.file.read( file ) );
	return { code: options.banner + sources.join( grunt.util.linefeed ) + options.footer, files };
}

const virtualId = 'virtual:goldenlayout';

export default defineConfig( {
	plugins: [ {
		name: 'goldenlayout-build',
		configureServer( server ) {
			server.watcher.add( [ path.join( root, 'src/js' ), path.join( root, 'build/ns.js' ) ] );
		},
		resolveId( id ) {
			return id === virtualId ? '\0' + virtualId : null;
		},
		load( id ) {
			if ( id === '\0' + virtualId ) {
				const build = concatenatedBuild();
				// So that watch mode (`npx vitest`) reruns when a source changes.
				build.files.forEach( file => this.addWatchFile( file ) );
				return 'export default ' + JSON.stringify( build.code ) + ';';
			}
			return null;
		}
	} ],
	test: {
		include: [ 'test/*tests.js' ],
		setupFiles: [ 'test/setup.js' ],
		// The build is a virtual module, so tell watch mode (`npx vitest`) to
		// rerun everything when its inputs change.
		forceRerunTriggers: [ ...configDefaults.forceRerunTriggers, 'src/js/**', 'build/ns.js', 'Gruntfile.js' ],
		// The specs share state, spies included, across the `it` blocks of a
		// describe, and rely on running in declaration order.
		clearMocks: false,
		sequence: { shuffle: false },
		// One browser page at a time: the files run one after another.
		fileParallelism: false,
		// Longer than testTools.waitsFor's 5s, so a wait that times out
		// reports as such rather than as a generic test timeout.
		testTimeout: 10000,
		browser: {
			enabled: true,
			headless: true,
			screenshotFailures: false,
			// Use the system Chrome (preinstalled on GitHub's ubuntu runners)
			// rather than downloading Playwright's own Chromium.
			provider: playwright( { launchOptions: { channel: 'chrome' } } ),
			instances: [ { browser: 'chromium' } ]
		}
	}
} );

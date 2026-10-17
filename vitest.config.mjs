import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const require = createRequire( import.meta.url );

/**
 * Builds dist/goldenlayout.js in memory, exactly as `grunt concat` does, by
 * reading the concat settings from Gruntfile.js. The tests run against this
 * concatenated build rather than the individual source files, so they
 * exercise the code that ships, without needing a `grunt dist` first.
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
	const sources = grunt.file.expand( src ).map( file => grunt.file.read( file ) );
	return options.banner + sources.join( grunt.util.linefeed ) + options.footer;
}

const virtualId = 'virtual:goldenlayout';

export default defineConfig( {
	plugins: [ {
		name: 'goldenlayout-build',
		resolveId( id ) {
			return id === virtualId ? '\0' + virtualId : null;
		},
		load( id ) {
			if ( id === '\0' + virtualId ) {
				return 'export default ' + JSON.stringify( concatenatedBuild() ) + ';';
			}
			return null;
		}
	} ],
	test: {
		include: [ 'test/*tests.js' ],
		setupFiles: [ 'test/setup.js' ],
		// The specs share state, spies included, across the `it` blocks of a
		// describe, and rely on running in declaration order.
		clearMocks: false,
		sequence: { shuffle: false },
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

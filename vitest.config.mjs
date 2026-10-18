import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const require = createRequire( import.meta.url );
const root = path.dirname( fileURLToPath( import.meta.url ) );

/**
 * Builds the library in memory, exactly as `grunt concat` does (the step of
 * `grunt dist` that writes dist/goldenlayout.js from build/ns.js and src/js),
 * by reading the concat settings from Gruntfile.js. The tests run against this
 * concatenated build rather than the individual source files, so they
 * exercise the code that ships, without needing a `grunt dist` first.
 * Paths resolve against this file's directory, whatever the working directory.
 */
function concatenatedBuild() {
	const grunt = require( 'grunt' );
	const gruntfile = require.resolve( './Gruntfile.js' );
	delete require.cache[ gruntfile ];
	let config;
	require( gruntfile )( {
		registerTask() {},
		loadNpmTasks() {},
		initConfig( c ) { config = c; },
		file: Object.assign( Object.create( grunt.file ), {
			readJSON: file => grunt.file.readJSON( path.resolve( root, file ) )
		} )
	} );
	const { src, options } = config.concat.dist;
	const sources = grunt.file.expand( { cwd: root }, src ).map( file => grunt.file.read( path.join( root, file ) ) );
	return options.banner + sources.join( grunt.util.linefeed ) + options.footer;
}

// What the build is made from: watch mode rebuilds when any of these changes.
function isBuildInput( file ) {
	file = path.resolve( root, file );
	return file.startsWith( path.join( root, 'src/js' ) + path.sep ) ||
		file === path.join( root, 'build/ns.js' ) ||
		file === path.join( root, 'Gruntfile.js' );
}

const virtualId = 'virtual:goldenlayout';

export default defineConfig( {
	plugins: [ {
		name: 'goldenlayout-build',
		configureServer( server ) {
			// The build is a virtual module, so nothing else knows to rebuild it
			// in watch mode (`npx vitest`) when a source is edited, added or
			// removed. forceRerunTriggers below then reruns the tests.
			server.watcher.on( 'all', ( event, file ) => {
				if ( !isBuildInput( file ) ) {
					return;
				}
				const module = server.moduleGraph.getModuleById( '\0' + virtualId );
				if ( module ) {
					server.moduleGraph.invalidateModule( module );
				}
				// Vitest doesn't rerun when a non-test file is deleted, so
				// report a deleted source as a change to Gruntfile.js.
				if ( event === 'unlink' ) {
					server.watcher.emit( 'change', path.join( root, 'Gruntfile.js' ) );
				}
			} );
		},
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
		// Rerun everything in watch mode when the build's inputs change
		// (Vitest matches these against absolute paths).
		forceRerunTriggers: [ ...configDefaults.forceRerunTriggers, '**/src/js/**', '**/build/ns.js', '**/Gruntfile.js' ],
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

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

const gruntfile = path.join( root, 'Gruntfile.js' );

// What the build is made from: watch mode rebuilds when any of these changes.
function isBuildInput( file ) {
	file = path.resolve( root, file );
	return ( file.startsWith( path.join( root, 'src/js' ) + path.sep ) && file.endsWith( '.js' ) ) ||
		file === path.join( root, 'build/ns.js' ) ||
		file === gruntfile;
}

const virtualId = 'virtual:goldenlayout';

export default defineConfig( {
	plugins: [ {
		name: 'goldenlayout-build',
		configureServer( server ) {
			// The build is a virtual module, so nothing else knows to rebuild it
			// in watch mode (`npx vitest`) when a source is edited, added or
			// removed. Invalidate it, then report the event as a change to
			// Gruntfile.js, which forceRerunTriggers below turns into a rerun.
			server.watcher.on( 'all', ( event, file ) => {
				if ( !isBuildInput( file ) ) {
					return;
				}
				// Drop the build from whichever environment loaded it.
				for ( const environment of Object.values( server.environments ) ) {
					const module = environment.moduleGraph.getModuleById( '\0' + virtualId );
					if ( module ) {
						environment.moduleGraph.invalidateModule( module );
					}
				}
				// (Vitest wouldn't rerun for a deleted source on its own, and
				// glob triggers for src/js broke its watcher.)
				if ( path.resolve( root, file ) !== gruntfile ) {
					server.watcher.emit( 'change', gruntfile );
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
		// Rerun everything in watch mode when the build's inputs change (see
		// the plugin above). An exact absolute path, unlike a **/ glob, also
		// matches in checkouts under dot directories.
		forceRerunTriggers: [ ...configDefaults.forceRerunTriggers, gruntfile ],
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

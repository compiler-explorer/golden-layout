/* eslint-env node */
/**
 * Runs the pre-Vitest Karma/Jasmine suite from an old checkout and writes
 * one JSON record per spec. Used by test/mutations/run.js; see the comment at the top of run.js.
 *
 *   KARMA_BASE=<old checkout> KARMA_JSON_OUT=<file> \
 *     <old checkout>/node_modules/.bin/karma start test/mutations/karma-json.conf.js
 */
var fs = require( 'fs' );
var path = require( 'path' );

var base = process.env.KARMA_BASE;
var out = process.env.KARMA_JSON_OUT;

function JsonSpecReporter() {
	var results = [];
	var errors = [];
	this.onSpecComplete = function( browser, result ) {
		results.push( {
			suite: result.suite,
			description: result.description,
			success: result.success,
			skipped: result.skipped || result.pending || false,
			log: result.log
		} );
	};
	this.onBrowserError = function( browser, error ) {
		errors.push( String( error && error.message || error ) );
	};
	this.onBrowserLog = function() {};
	this.onRunComplete = function() {
		fs.writeFileSync( out, JSON.stringify( { specs: results, errors: errors }, null, 1 ) );
	};
}
JsonSpecReporter.$inject = [];

module.exports = function( config ) {
	require( path.join( base, 'karma.conf.js' ) )( config );
	config.set( {
		basePath: base,
		singleRun: true,
		autoWatch: false,
		logLevel: config.LOG_ERROR,
		hostname: '127.0.0.1',
		listenAddress: '127.0.0.1',
		// The compat shim's waitsFor gives up after 5s. Jasmine's own spec
		// timeout must be longer, or it fires first and the shim's failure
		// lands on a later spec (mirrors Vitest's testTimeout of 10s).
		client: {
			jasmine: {
				random: false,
				timeoutInterval: 10000
			}
		},
		reporters: [ 'jsonspec' ],
		plugins: [
			require( path.join( base, 'node_modules/karma-jasmine' ) ),
			require( path.join( base, 'node_modules/karma-chrome-launcher' ) ),
			{ 'reporter:jsonspec': [ 'type', JsonSpecReporter ] }
		]
	} );
};

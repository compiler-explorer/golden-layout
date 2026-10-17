#!/usr/bin/env node
/* eslint-env node */
/**
 * Mutation check for the test suite.
 *
 * For each mutation in mutations.js: apply it to src/js, run the Vitest suite
 * (and, with --karma-dir, the old Karma/Jasmine suite from a pre-Vitest
 * checkout), restore the source, and check that every spec the mutation
 * claims to kill fails in each suite. Also checks that every claimed spec
 * passes on unmodified code first.
 *
 *   node test/mutations/run.js [--karma-dir DIR] [--out FILE] [ID...]
 *
 * With no IDs, every mutation runs. DIR is a checkout of the last Karma-based
 * commit, with its dependencies installed, for example:
 *
 *   git worktree add ../gl-karma 2b773c4 && (cd ../gl-karma && npm ci)
 *
 * Its src/js must match this checkout's; Karma runs in a temporary copy of it.
 * Only one browser runs at a time (Vitest, then Karma, per mutation), at
 * nice 19. --out writes the full results as JSON.
 *
 * src/js is modified in place while a mutation runs and restored afterwards
 * (also on Ctrl-C), so the script refuses to start if src/js has local
 * changes. It exits non-zero if a listed spec survives its mutation or, when
 * running everything, if an active spec has no mutation and isn't listed as
 * vacuous.
 */
'use strict';

var childProcess = require( 'child_process' );
var fs = require( 'fs' );
var os = require( 'os' );
var path = require( 'path' );

var repo = path.resolve( __dirname, '../..' );
var mutations = require( './mutations.js' );

function parseArgs( argv ) {
	var args = { karmaDir: null, out: null, ids: [] };
	for( var i = 0; i < argv.length; i++ ) {
		if( argv[ i ] === '--karma-dir' ) {
			args.karmaDir = path.resolve( argv[ ++i ] );
		} else if( argv[ i ] === '--out' ) {
			args.out = path.resolve( argv[ ++i ] );
		} else {
			args.ids.push( argv[ i ] );
		}
	}
	return args;
}

function run( cmd, cmdArgs, options ) {
	return new Promise( function( resolve ) {
		var child = childProcess.spawn( 'nice', [ '-n', '19', cmd ].concat( cmdArgs ), Object.assign( { stdio: [ 'ignore', 'pipe', 'pipe' ] }, options ) );
		var output = '';
		child.stdout.on( 'data', function( d ) { output += d; } );
		child.stderr.on( 'data', function( d ) { output += d; } );
		child.on( 'close', function( code ) { resolve( { code: code, output: output } ); } );
	} );
}

function applyMutation( root, mutation ) {
	var file = path.join( root, mutation.file );
	var original = fs.readFileSync( file, 'utf8' );
	var count = original.split( mutation.from ).length - 1;
	if( count !== 1 ) {
		throw new Error( mutation.id + ': expected exactly one match in ' + mutation.file + ', found ' + count );
	}
	fs.writeFileSync( file, original.replace( mutation.from, function() { return mutation.to; } ) );
	return function restore() {
		fs.writeFileSync( file, original );
	};
}

// Spec keys look like "file.js > describe > it".
function key( file, ancestors, title ) {
	return [ path.basename( file ) ].concat( ancestors, [ title ] ).join( ' > ' );
}

var tmpRoot = fs.mkdtempSync( path.join( os.tmpdir(), 'gl-mutations-' ) );
var vitestRuns = 0;

/**
 * Runs the Vitest suite in the repo. Returns { key: 'passed'|'failed'|'skipped' }
 * in the suite's file order, plus any file-level errors.
 */
function runVitest() {
	var out = path.join( tmpRoot, 'vitest-' + ( vitestRuns++ ) + '.json' );
	return run( process.execPath, [ path.join( repo, 'node_modules/vitest/vitest.mjs' ), 'run', '--reporter=json', '--outputFile=' + out ], { cwd: repo } ).then( function( r ) {
		var results = {}, errors = [];
		var json;
		try {
			json = JSON.parse( fs.readFileSync( out, 'utf8' ) );
		} catch( e ) {
			return { results: results, errors: [ 'no JSON output: ' + r.output.slice( -2000 ) ] };
		}
		json.testResults.slice().sort( function( a, b ) {
			return path.basename( a.name ) < path.basename( b.name ) ? -1 : 1;
		} ).forEach( function( file ) {
			if( file.status === 'failed' && file.message ) {
				errors.push( path.basename( file.name ) + ': ' + file.message.split( '\n' )[ 0 ] );
			}
			file.assertionResults.forEach( function( a ) {
				results[ key( file.name, a.ancestorTitles, a.title ) ] = a.status === 'pending' ? 'skipped' : a.status;
			} );
		} );
		return { results: results, errors: errors };
	} );
}

/**
 * Runs the Karma suite in an old checkout. Karma doesn't report file names, so
 * spec results are matched, in order, against the spec list from Vitest's
 * baseline run (same files, same order: Karma loads test/**\/*.js sorted).
 */
function runKarma( dir, order ) {
	var out = path.join( dir, 'karma-results.json' );
	try { fs.unlinkSync( out ); } catch( e ) { /* not there */ }
	return run( path.join( dir, 'node_modules/.bin/karma' ), [ 'start', path.join( __dirname, 'karma-json.conf.js' ) ], {
		cwd: dir,
		env: Object.assign( {}, process.env, { KARMA_BASE: dir, KARMA_JSON_OUT: out } )
	} ).then( function( r ) {
		var results = {}, errors = [], json;
		try {
			json = JSON.parse( fs.readFileSync( out, 'utf8' ) );
		} catch( e ) {
			return { results: results, errors: [ 'no JSON output: ' + r.output.slice( -2000 ) ] };
		}
		errors = json.errors;
		var next = 0;
		json.specs.forEach( function( spec ) {
			var suffix = spec.suite.concat( [ spec.description ] ).join( ' > ' );
			for( var i = next; i < order.length; i++ ) {
				if( order[ i ].slice( order[ i ].indexOf( ' > ' ) + 3 ) === suffix ) {
					results[ order[ i ] ] = spec.skipped ? 'skipped' : ( spec.success ? 'passed' : 'failed' );
					next = i + 1;
					return;
				}
			}
			errors.push( 'unmatched Karma spec: ' + suffix );
		} );
		return { results: results, errors: errors };
	} );
}

// A spec that didn't report at all (e.g. its file failed to load) failed.
function status( results, spec ) {
	return results[ spec ] || 'failed';
}

function copyKarmaDir( src, dest ) {
	fs.mkdirSync( dest );
	fs.readdirSync( src ).forEach( function( entry ) {
		if( entry === 'node_modules' ) {
			fs.symlinkSync( path.join( src, entry ), path.join( dest, entry ) );
		} else {
			fs.cpSync( path.join( src, entry ), path.join( dest, entry ), { recursive: true } );
		}
	} );
	return dest;
}

function checkSourcesMatch( karmaDir ) {
	var r = childProcess.spawnSync( 'diff', [ '-r', path.join( repo, 'src/js' ), path.join( karmaDir, 'src/js' ) ], { encoding: 'utf8' } );
	if( r.status !== 0 ) {
		throw new Error( 'src/js differs between the repo and --karma-dir:\n' + r.stdout );
	}
}

function main() {
	var args = parseArgs( process.argv.slice( 2 ) );
	var selected = mutations.list.filter( function( m ) {
		return args.ids.length === 0 || args.ids.indexOf( m.id ) !== -1;
	} );

	var dirty = childProcess.spawnSync( 'git', [ 'status', '--porcelain', '--', 'src/js' ], { cwd: repo, encoding: 'utf8' } ).stdout;
	if( dirty ) {
		throw new Error( 'src/js has local changes; commit or stash them first:\n' + dirty );
	}
	if( args.karmaDir ) {
		checkSourcesMatch( args.karmaDir );
	}
	// Check every mutation applies before running anything.
	selected.forEach( function( m ) {
		applyMutation( repo, m )();
	} );

	// Restore the sources if interrupted mid-mutation.
	var pendingRestores = [];
	process.on( 'SIGINT', function() {
		pendingRestores.forEach( function( restore ) { restore(); } );
		process.exit( 130 );
	} );

	var karmaDir = args.karmaDir ? copyKarmaDir( args.karmaDir, path.join( tmpRoot, 'karma' ) ) : null;

	var report = { baseline: {}, mutations: [] };

	console.log( 'Baseline (unmodified source)...' );
	return runVitest().then( function( vitestBase ) {
		var order = Object.keys( vitestBase.results );
		return ( args.karmaDir ? runKarma( karmaDir, order ) : Promise.resolve( null ) ).then( function( karmaBase ) {
			report.baseline = { vitest: vitestBase, karma: karmaBase };
			var problems = [];
			order.forEach( function( spec ) {
				if( vitestBase.results[ spec ] === 'failed' ) problems.push( 'Vitest baseline failure: ' + spec );
				if( karmaBase && status( karmaBase.results, spec ) !== vitestBase.results[ spec ] ) {
					problems.push( 'Karma baseline differs (' + status( karmaBase.results, spec ) + '): ' + spec );
				}
			} );
			if( karmaBase && Object.keys( karmaBase.results ).length !== order.length ) {
				problems.push( 'Karma reported ' + Object.keys( karmaBase.results ).length + ' specs, Vitest ' + order.length );
			}
			mutations.list.forEach( function( m ) {
				m.specs.forEach( function( spec ) {
					if( !( spec in vitestBase.results ) ) problems.push( m.id + ' names an unknown spec: ' + spec );
				} );
			} );
			mutations.vacuous.forEach( function( spec ) {
				if( !( spec in vitestBase.results ) ) problems.push( 'vacuous list names an unknown spec: ' + spec );
			} );
			if( problems.length ) {
				throw new Error( problems.join( '\n' ) );
			}
			console.log( 'Baseline OK: ' + order.length + ' specs, all pass or are skipped in ' + ( karmaBase ? 'both suites' : 'Vitest' ) + '.' );
			return runMutations( selected, karmaDir, order, report, pendingRestores );
		} );
	} ).then( function() {
		return summarise( report, args, mutations );
	} );
}

// Apply a mutation in `root`, run `suite`, and restore the source.
function withMutation( root, m, pendingRestores, suite ) {
	var restore = applyMutation( root, m );
	pendingRestores.push( restore );
	var done = function() {
		restore();
		pendingRestores.splice( pendingRestores.indexOf( restore ), 1 );
	};
	return suite().then( function( r ) {
		done();
		return r;
	}, function( e ) {
		done();
		throw e;
	} );
}

function runMutations( selected, karmaDir, order, report, pendingRestores ) {
	// Strictly one browser at a time: each mutation runs Vitest, then Karma.
	return selected.reduce( function( chain, m ) {
		return chain.then( function() {
			return withMutation( repo, m, pendingRestores, runVitest );
		} ).then( function( vitest ) {
			if( !karmaDir ) {
				return [ vitest, null ];
			}
			return withMutation( karmaDir, m, pendingRestores, function() {
				return runKarma( karmaDir, order );
			} ).then( function( karma ) {
				return [ vitest, karma ];
			} );
		} ).then( function( res ) {
			var vitest = res[ 0 ], karma = res[ 1 ];
			var entry = {
				id: m.id,
				file: m.file,
				from: m.from,
				to: m.to,
				specs: m.specs.map( function( spec ) {
					return {
						spec: spec,
						vitest: status( vitest.results, spec ),
						karma: karma ? status( karma.results, spec ) : null
					};
				} ),
				vitestFailed: order.filter( function( s ) { return status( vitest.results, s ) === 'failed'; } ),
				karmaFailed: karma ? order.filter( function( s ) { return status( karma.results, s ) === 'failed'; } ) : null,
				errors: { vitest: vitest.errors, karma: karma ? karma.errors : null }
			};
			// karmaTimingDependent: Karma only sometimes catches this one (see
			// mutations.js), so its Karma result is reported but not required.
			entry.killed = entry.specs.every( function( s ) {
				return s.vitest === 'failed' && ( s.karma === null || s.karma === 'failed' || m.karmaTimingDependent === true );
			} );
			entry.sameFailures = karma ? JSON.stringify( entry.vitestFailed ) === JSON.stringify( entry.karmaFailed ) : null;
			report.mutations.push( entry );
			console.log( ( entry.killed ? 'KILLED  ' : 'SURVIVED' ) + ' ' + m.id +
				' (Vitest fails ' + entry.vitestFailed.length +
				( karma ? ', Karma fails ' + entry.karmaFailed.length + ( entry.sameFailures ? ', same specs' : ', DIFFERENT specs' ) : '' ) + ')' );
			entry.specs.forEach( function( s ) {
				if( s.vitest !== 'failed' || ( s.karma !== null && s.karma !== 'failed' ) ) {
					console.log( '    not killed: ' + s.spec + ' (vitest ' + s.vitest + ( s.karma ? ', karma ' + s.karma : '' ) + ')' +
						( m.karmaTimingDependent ? ' [Karma result is timing-dependent]' : '' ) );
				}
			} );
		} );
	}, Promise.resolve() );
}

function summarise( report, args, mutations ) {
	report.mutations.sort( function( a, b ) {
		return mutations.list.findIndex( function( m ) { return m.id === a.id; } ) -
			mutations.list.findIndex( function( m ) { return m.id === b.id; } );
	} );
	var order = Object.keys( report.baseline.vitest.results );
	var covered = {};
	report.mutations.forEach( function( m ) {
		m.specs.forEach( function( s ) { covered[ s.spec ] = covered[ s.spec ] || ( m.killed ? m.id : null ); } );
	} );
	var active = order.filter( function( s ) { return report.baseline.vitest.results[ s ] === 'passed'; } );
	var unproven = active.filter( function( s ) { return !covered[ s ] && mutations.vacuous.indexOf( s ) === -1; } );
	var survived = report.mutations.filter( function( m ) { return !m.killed; } );

	console.log( '' );
	console.log( 'Active specs: ' + active.length + ', proven by a mutation in this run: ' + Object.keys( covered ).filter( function( s ) { return covered[ s ]; } ).length +
		', listed as vacuous: ' + mutations.vacuous.length );
	if( args.ids.length === 0 && unproven.length ) {
		console.log( 'Specs with no killing mutation:' );
		unproven.forEach( function( s ) { console.log( '    ' + s ); } );
	}
	if( args.out ) {
		fs.writeFileSync( args.out, JSON.stringify( report, null, 1 ) );
		console.log( 'Full results written to ' + args.out );
	}
	fs.rmSync( tmpRoot, { recursive: true, force: true } );
	if( survived.length || ( args.ids.length === 0 && unproven.length ) ) {
		process.exitCode = 1;
	}
}

main().catch( function( e ) {
	fs.rmSync( tmpRoot, { recursive: true, force: true } );
	console.error( e.stack || e );
	process.exitCode = 2;
} );

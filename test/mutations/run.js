#!/usr/bin/env node
/* eslint-env node */
/**
 * Mutation check for the test suite.
 *
 * For each mutation in mutations.js: apply it to src/js, run the Vitest suite
 * (and, with --karma-dir, the old Karma/Jasmine suite from a pre-Vitest
 * checkout), restore the source, and check that every spec the mutation is
 * credited with fails, for the right reason, in each suite.
 *
 *   node test/mutations/run.js [--karma-dir DIR] [--repeat N] [--karma-repeat N]
 *                              [--baseline-runs N] [--out FILE] [ID...]
 *
 * With no IDs, every mutation runs. DIR is a checkout of the last Karma-based
 * commit, with its dependencies installed, for example:
 *
 *   git worktree add ../gl-karma 2b773c4 && (cd ../gl-karma && npm ci)
 *
 * Its src/js must match this checkout's; Karma runs in a temporary copy of it.
 *
 * What counts as a kill, for a credited spec in one run of one suite:
 *   - the run is valid: no file-level errors (unless the mutation is marked
 *     expectLoadFailure) and every baseline spec reported a result;
 *   - the spec failed on its own check: an assertion, or a waitsFor that
 *     timed out. A thrown error (TypeError, RangeError...) only counts for
 *     specs in the vacuous list, which have no assertions to fail;
 *   - in a describe whose specs share state, no earlier spec in that describe
 *     failed, so the failure isn't left over from an earlier one (in a
 *     readOnlyAfterSetup describe, no earlier setup spec failed).
 * Specs listed as vacuous or crashOnly in mutations.js may be killed by a
 * thrown error instead.
 * A mutation must kill each of its specs in every repeat (a mutation's
 * karmaNotRequired lists specs whose Karma result is reported but not
 * required, with the reason): --repeat Vitest runs
 * (default 2) and --karma-repeat Karma runs (default 1). The two suites must
 * fail the same specs, unless the mutation is in allowedDifferences. The
 * unmutated baseline runs --baseline-runs times (default 3) in each suite.
 *
 * One browser runs at a time (Vitest, then Karma), at nice 19. src/js is
 * modified in place while a mutation runs and restored afterwards (also on
 * SIGINT, SIGTERM and SIGHUP), so the script refuses to start if src/js has
 * local changes. --out writes the full results, with failure messages, as
 * JSON. It exits non-zero if any mutation fails the check or, when running
 * everything, if an active spec isn't killed by any mutation.
 */
'use strict';

var childProcess = require( 'child_process' );
var fs = require( 'fs' );
var os = require( 'os' );
var path = require( 'path' );

var repo = path.resolve( __dirname, '../..' );
var mutations = require( './mutations.js' );

// Generous: a normal run takes seconds, a run full of waitsFor timeouts a minute.
var CHILD_TIMEOUT_MS = 5 * 60 * 1000;

var tmpRoot = null;
var activeChildren = [];
var pendingRestores = [];

function cleanup() {
	pendingRestores.splice( 0 ).forEach( function( restore ) { restore(); } );
	activeChildren.splice( 0 ).forEach( killGroup );
	if( tmpRoot ) {
		fs.rmSync( tmpRoot, { recursive: true, force: true } );
		tmpRoot = null;
	}
}

[ 'SIGINT', 'SIGTERM', 'SIGHUP' ].forEach( function( signal ) {
	process.on( signal, function() {
		cleanup();
		process.exit( 128 + os.constants.signals[ signal ] );
	} );
} );

function parseArgs( argv ) {
	var args = { karmaDir: null, out: null, repeat: 2, karmaRepeat: 1, baselineRuns: 3, ids: [] };
	for( var i = 0; i < argv.length; i++ ) {
		if( argv[ i ] === '--karma-dir' ) {
			args.karmaDir = path.resolve( argv[ ++i ] );
		} else if( argv[ i ] === '--out' ) {
			args.out = path.resolve( argv[ ++i ] );
		} else if( argv[ i ] === '--repeat' ) {
			args.repeat = parseInt( argv[ ++i ], 10 );
		} else if( argv[ i ] === '--karma-repeat' ) {
			args.karmaRepeat = parseInt( argv[ ++i ], 10 );
		} else if( argv[ i ] === '--baseline-runs' ) {
			args.baselineRuns = parseInt( argv[ ++i ], 10 );
		} else {
			args.ids.push( argv[ i ] );
		}
	}
	return args;
}

function killGroup( child ) {
	try {
		process.kill( -child.pid, 'SIGKILL' );
	} catch( e ) { /* already gone */ }
}

/**
 * Runs a command at nice 19 in its own process group, so that it and any
 * browser it starts can be killed together on timeout or interruption.
 */
function run( cmd, cmdArgs, options ) {
	return new Promise( function( resolve ) {
		var child = childProcess.spawn( 'nice', [ '-n', '19', cmd ].concat( cmdArgs ), Object.assign( {
			stdio: [ 'ignore', 'pipe', 'pipe' ],
			detached: true
		}, options ) );
		activeChildren.push( child );
		var output = '';
		var timedOut = false;
		var timer = setTimeout( function() {
			timedOut = true;
			killGroup( child );
		}, CHILD_TIMEOUT_MS );
		child.stdout.on( 'data', function( d ) { output += d; } );
		child.stderr.on( 'data', function( d ) { output += d; } );
		child.on( 'close', function( code ) {
			clearTimeout( timer );
			activeChildren.splice( activeChildren.indexOf( child ), 1 );
			// Make sure nothing it started (e.g. a browser) outlives it.
			killGroup( child );
			resolve( { code: code, output: output, timedOut: timedOut } );
		} );
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

// Apply a mutation in `root`, run `suite`, and restore the source.
function withMutation( root, m, suite ) {
	var restore = m ? applyMutation( root, m ) : function() {};
	pendingRestores.push( restore );
	var done = function() {
		pendingRestores.splice( pendingRestores.indexOf( restore ), 1 );
		restore();
	};
	return suite().then( function( r ) {
		done();
		return r;
	}, function( e ) {
		done();
		throw e;
	} );
}

// Spec keys look like "file.js > describe > it".
function key( file, ancestors, title ) {
	return [ path.basename( file ) ].concat( ancestors, [ title ] ).join( ' > ' );
}

function describeOf( spec ) {
	return spec.slice( 0, spec.lastIndexOf( ' > ' ) );
}

function firstLine( message ) {
	var line = String( message || '' ).split( '\n' )[ 0 ];
	return line.length > 300 ? line.slice( 0, 300 ) + '...' : line;
}

/**
 * Why a spec failed: 'assertion' (an expect failed), 'wait' (a waitsFor timed
 * out) or 'crash' (anything thrown by the code under test, or a test timeout).
 */
function classify( suite, message ) {
	if( /waitsFor timed out/.test( message ) ) {
		return 'wait';
	}
	if( suite === 'vitest' ) {
		return /^AssertionError/.test( message ) ? 'assertion' : 'crash';
	}
	// Jasmine expectation failures read "Expected ..."; errors read "TypeError: ...".
	return /^Expected /.test( message ) ? 'assertion' : 'crash';
}

var runCount = 0;

/**
 * Runs the Vitest suite in the repo. Returns { results: { spec: { status,
 * kind, message } }, errors: [...] } in the suite's file order.
 */
function runVitest() {
	var out = path.join( tmpRoot, 'vitest-' + ( runCount++ ) + '.json' );
	return run( process.execPath, [ path.join( repo, 'node_modules/vitest/vitest.mjs' ), 'run', '--reporter=json', '--outputFile=' + out ], { cwd: repo } ).then( function( r ) {
		var results = {}, errors = [];
		var json;
		if( r.timedOut ) {
			errors.push( 'timed out' );
		}
		try {
			json = JSON.parse( fs.readFileSync( out, 'utf8' ) );
		} catch( e ) {
			return { results: results, errors: errors.concat( [ 'no JSON output: ' + r.output.slice( -2000 ) ] ) };
		}
		json.testResults.slice().sort( function( a, b ) {
			return path.basename( a.name ) < path.basename( b.name ) ? -1 : 1;
		} ).forEach( function( file ) {
			if( file.message ) {
				errors.push( path.basename( file.name ) + ': ' + firstLine( file.message ) );
			}
			file.assertionResults.forEach( function( a ) {
				var result = { status: a.status === 'pending' ? 'skipped' : a.status };
				if( result.status === 'failed' ) {
					result.message = firstLine( ( a.failureMessages || [] )[ 0 ] );
					result.kind = classify( 'vitest', result.message );
				}
				results[ key( file.name, a.ancestorTitles, a.title ) ] = result;
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
		if( r.timedOut ) {
			errors.push( 'timed out' );
		}
		try {
			json = JSON.parse( fs.readFileSync( out, 'utf8' ) );
		} catch( e ) {
			return { results: results, errors: errors.concat( [ 'no JSON output: ' + r.output.slice( -2000 ) ] ) };
		}
		errors = errors.concat( json.errors.map( firstLine ) );
		var next = 0;
		json.specs.forEach( function( spec ) {
			var suffix = spec.suite.concat( [ spec.description ] ).join( ' > ' );
			for( var i = next; i < order.length; i++ ) {
				if( order[ i ].slice( order[ i ].indexOf( ' > ' ) + 3 ) === suffix ) {
					var result = { status: spec.skipped ? 'skipped' : ( spec.success ? 'passed' : 'failed' ) };
					if( result.status === 'failed' ) {
						result.message = firstLine( spec.log[ 0 ] );
						result.kind = classify( 'karma', result.message );
					}
					results[ order[ i ] ] = result;
					next = i + 1;
					return;
				}
			}
			errors.push( 'unmatched Karma spec: ' + suffix );
		} );
		return { results: results, errors: errors };
	} );
}

function status( run, spec ) {
	return run.results[ spec ] ? run.results[ spec ].status : 'missing';
}

// Specs that didn't pass (failed or missing), ignoring skipped ones.
function failing( run, order ) {
	return order.filter( function( s ) {
		var st = status( run, s );
		return st === 'failed' || st === 'missing';
	} );
}

/**
 * Checks one run against the baseline spec list. Returns problems, or [] if
 * the run can be used as evidence.
 */
function runProblems( run, order, m ) {
	var problems = [];
	if( run.errors.length && !( m && m.expectLoadFailure ) ) {
		problems = problems.concat( run.errors.map( function( e ) { return 'file-level error: ' + e; } ) );
	}
	if( !( m && m.expectLoadFailure ) ) {
		order.forEach( function( s ) {
			if( !run.results[ s ] ) problems.push( 'no result for: ' + s );
		} );
	}
	return problems;
}

/**
 * Whether `run` proves that `spec` is killed (see the header comment).
 * Returns { killed, reason }.
 */
function judge( run, spec, order ) {
	var result = run.results[ spec ];
	if( !result ) {
		return { killed: false, reason: 'did not run' };
	}
	if( result.status !== 'failed' ) {
		return { killed: false, reason: result.status };
	}
	var vacuous = mutations.vacuous.indexOf( spec ) !== -1 || spec in mutations.crashOnly;
	if( result.kind === 'crash' && !vacuous ) {
		return { killed: false, reason: 'crashed rather than failing an assertion: ' + result.message };
	}
	var describe = describeOf( spec );
	var independent = mutations.independentDescribes.indexOf( describe ) !== -1;
	var setupSpecs = mutations.readOnlyAfterSetup[ describe ];
	if( !independent ) {
		var position = 0;
		for( var i = 0; order[ i ] !== spec; i++ ) {
			if( describeOf( order[ i ] ) !== describe ) continue;
			// In a read-only-after-setup describe, only the setup specs matter.
			if( setupSpecs !== undefined && position++ >= setupSpecs ) continue;
			if( status( run, order[ i ] ) === 'failed' ) {
				return { killed: false, reason: 'an earlier spec in its describe failed first: ' + order[ i ] };
			}
		}
	}
	return { killed: true, reason: result.kind + ': ' + result.message };
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

function times( n, fn ) {
	var all = [];
	var chain = Promise.resolve();
	for( var i = 0; i < n; i++ ) {
		chain = chain.then( fn ).then( function( r ) { all.push( r ); } );
	}
	return chain.then( function() { return all; } );
}

function checkBaseline( vitestRuns, karmaRuns ) {
	var order = Object.keys( vitestRuns[ 0 ].results );
	var problems = [];
	var reference = {};
	order.forEach( function( s ) { reference[ s ] = status( vitestRuns[ 0 ], s ); } );
	vitestRuns.concat( karmaRuns ).forEach( function( r, i ) {
		var name = i < vitestRuns.length ? 'Vitest baseline run ' + ( i + 1 ) : 'Karma baseline run ' + ( i - vitestRuns.length + 1 );
		runProblems( r, order, null ).forEach( function( p ) { problems.push( name + ': ' + p ); } );
		order.forEach( function( s ) {
			var st = status( r, s );
			if( st === 'failed' ) problems.push( name + ': fails ' + s + ' (' + r.results[ s ].message + ')' );
			else if( st !== reference[ s ] ) problems.push( name + ': ' + st + ' instead of ' + reference[ s ] + ': ' + s );
		} );
		if( Object.keys( r.results ).length !== order.length ) {
			problems.push( name + ': reported ' + Object.keys( r.results ).length + ' specs, expected ' + order.length );
		}
	} );
	mutations.list.forEach( function( m ) {
		m.specs.concat( Object.keys( m.karmaNotRequired || {} ) ).forEach( function( spec ) {
			if( !( spec in reference ) ) problems.push( m.id + ' names an unknown spec: ' + spec );
		} );
	} );
	Object.keys( mutations.crashOnly ).concat( mutations.vacuous ).forEach( function( spec ) {
		if( !( spec in reference ) ) problems.push( 'vacuous/crashOnly lists name an unknown spec: ' + spec );
	} );
	Object.keys( mutations.readOnlyAfterSetup ).forEach( function( d ) {
		if( !order.some( function( s ) { return describeOf( s ) === d; } ) ) problems.push( 'readOnlyAfterSetup names an unknown describe: ' + d );
	} );
	mutations.independentDescribes.forEach( function( d ) {
		if( !order.some( function( s ) { return describeOf( s ) === d; } ) ) problems.push( 'independentDescribes names an unknown describe: ' + d );
	} );
	Object.keys( mutations.allowedDifferences ).forEach( function( id ) {
		if( !mutations.list.some( function( m ) { return m.id === id; } ) ) problems.push( 'allowedDifferences names an unknown mutation: ' + id );
	} );
	if( problems.length ) {
		throw new Error( 'Baseline check failed:\n' + problems.join( '\n' ) );
	}
	return order;
}

function evaluate( m, vitestRuns, karmaRuns, order ) {
	var entry = {
		id: m.id,
		file: m.file,
		from: m.from,
		to: m.to,
		problems: [],
		specs: [],
		vitestFailed: failing( vitestRuns[ 0 ], order ),
		karmaFailed: karmaRuns.length ? failing( karmaRuns[ 0 ], order ) : null
	};
	vitestRuns.forEach( function( r, i ) {
		runProblems( r, order, m ).forEach( function( p ) { entry.problems.push( 'Vitest run ' + ( i + 1 ) + ': ' + p ); } );
	} );
	karmaRuns.forEach( function( r, i ) {
		runProblems( r, order, m ).forEach( function( p ) { entry.problems.push( 'Karma run ' + ( i + 1 ) + ': ' + p ); } );
	} );
	m.specs.forEach( function( spec ) {
		var karmaNotRequired = ( m.karmaNotRequired || {} )[ spec ] || null;
		var s = {
			spec: spec,
			vitest: vitestRuns.map( function( r ) { return judge( r, spec, order ); } ),
			karma: karmaRuns.map( function( r ) { return judge( r, spec, order ); } ),
			karmaNotRequired: karmaNotRequired
		};
		s.killed = s.vitest.every( function( j ) { return j.killed; } ) &&
			( karmaNotRequired !== null || s.karma.every( function( j ) { return j.killed; } ) );
		if( !s.killed ) {
			entry.problems.push( 'not killed: ' + spec );
		}
		entry.specs.push( s );
	} );
	// Every repeat of a suite must fail the same specs.
	vitestRuns.slice( 1 ).forEach( function( r, i ) {
		if( JSON.stringify( failing( r, order ) ) !== JSON.stringify( entry.vitestFailed ) ) {
			entry.problems.push( 'Vitest run ' + ( i + 2 ) + ' failed different specs from run 1' );
		}
	} );
	karmaRuns.slice( 1 ).forEach( function( r, i ) {
		if( JSON.stringify( failing( r, order ) ) !== JSON.stringify( entry.karmaFailed ) ) {
			entry.problems.push( 'Karma run ' + ( i + 2 ) + ' failed different specs from run 1' );
		}
	} );
	if( karmaRuns.length ) {
		entry.sameFailures = JSON.stringify( entry.vitestFailed ) === JSON.stringify( entry.karmaFailed );
		if( !entry.sameFailures ) {
			entry.karmaOnly = entry.karmaFailed.filter( function( s ) { return entry.vitestFailed.indexOf( s ) === -1; } );
			entry.vitestOnly = entry.vitestFailed.filter( function( s ) { return entry.karmaFailed.indexOf( s ) === -1; } );
			if( !mutations.allowedDifferences[ m.id ] ) {
				entry.problems.push( 'Karma and Vitest fail different specs (Karma only: ' + entry.karmaOnly.length +
					', Vitest only: ' + entry.vitestOnly.length + ') and the mutation is not in allowedDifferences' );
			}
		}
	}
	entry.ok = entry.problems.length === 0;
	return entry;
}

function main() {
	var args = parseArgs( process.argv.slice( 2 ) );
	var selected = mutations.list.filter( function( m ) {
		return args.ids.length === 0 || args.ids.indexOf( m.id ) !== -1;
	} );
	args.ids.forEach( function( id ) {
		if( !mutations.list.some( function( m ) { return m.id === id; } ) ) throw new Error( 'Unknown mutation: ' + id );
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

	tmpRoot = fs.mkdtempSync( path.join( os.tmpdir(), 'gl-mutations-' ) );
	var karmaDir = args.karmaDir ? copyKarmaDir( args.karmaDir, path.join( tmpRoot, 'karma' ) ) : null;
	var report = { args: args, baseline: {}, mutations: [] };

	console.log( 'Baseline (unmodified source), ' + args.baselineRuns + ' run(s) per suite...' );
	var order;
	return times( args.baselineRuns, runVitest ).then( function( vitestRuns ) {
		return ( karmaDir ? times( args.baselineRuns, function() { return runKarma( karmaDir, Object.keys( vitestRuns[ 0 ].results ) ); } ) : Promise.resolve( [] ) ).then( function( karmaRuns ) {
			report.baseline = { vitest: vitestRuns, karma: karmaRuns };
			order = checkBaseline( vitestRuns, karmaRuns );
			console.log( 'Baseline OK: ' + order.length + ' specs, all pass or are skipped in every run.' );
		} );
	} ).then( function() {
		// Strictly one browser at a time: each mutation runs Vitest, then Karma.
		return selected.reduce( function( chain, m ) {
			var vitestRuns, karmaRuns = [];
			return chain.then( function() {
				return withMutation( repo, m, function() { return times( args.repeat, runVitest ); } );
			} ).then( function( r ) {
				vitestRuns = r;
				if( karmaDir ) {
					return withMutation( karmaDir, m, function() {
						return times( args.karmaRepeat, function() { return runKarma( karmaDir, order ); } );
					} ).then( function( r ) { karmaRuns = r; } );
				}
			} ).then( function() {
				var entry = evaluate( m, vitestRuns, karmaRuns, order );
				report.mutations.push( entry );
				console.log( ( entry.ok ? 'OK    ' : 'FAILED' ) + ' ' + m.id + ' (Vitest fails ' + entry.vitestFailed.length +
					( karmaRuns.length ? ', Karma fails ' + entry.karmaFailed.length + ( entry.sameFailures ? ', same specs' : ', different specs' +
						( mutations.allowedDifferences[ m.id ] ? ' (allowed)' : '' ) ) : '' ) + ')' );
				entry.specs.forEach( function( s ) {
					console.log( '    ' + ( s.killed ? 'killed ' : 'ALIVE  ' ) + s.spec );
					s.vitest.concat( s.karma ).forEach( function( j, i ) {
						var which = i < s.vitest.length ? 'vitest' : 'karma';
						if( !j.killed || i === 0 || i === s.vitest.length ) {
							console.log( '        ' + which + ': ' + ( j.killed ? '' : 'NOT KILLED, ' ) + j.reason +
								( which === 'karma' && s.karmaNotRequired ? ' [not required under Karma: ' + s.karmaNotRequired + ']' : '' ) );
						}
					} );
				} );
				entry.problems.filter( function( p ) { return !/^not killed/.test( p ); } ).forEach( function( p ) {
					console.log( '    problem: ' + p );
				} );
			} );
		}, Promise.resolve() );
	} ).then( function() {
		summarise( report, args, order );
	} );
}

function summarise( report, args, order ) {
	var killedBy = {};
	report.mutations.forEach( function( m ) {
		m.specs.forEach( function( s ) {
			if( m.ok && s.killed ) {
				( killedBy[ s.spec ] = killedBy[ s.spec ] || [] ).push( m.id );
			}
		} );
	} );
	report.killedBy = killedBy;
	var active = order.filter( function( s ) { return status( report.baseline.vitest[ 0 ], s ) === 'passed'; } );
	var unproven = active.filter( function( s ) { return !killedBy[ s ]; } );
	var failedMutations = report.mutations.filter( function( m ) { return !m.ok; } );

	console.log( '' );
	console.log( 'Mutations: ' + report.mutations.length + ', passing the check: ' + ( report.mutations.length - failedMutations.length ) );
	console.log( 'Active specs: ' + active.length + ', killed: ' + Object.keys( killedBy ).length +
		' (vacuous: ' + mutations.vacuous.length + ', crash-only: ' + Object.keys( mutations.crashOnly ).length + ')' );
	if( failedMutations.length ) {
		console.log( 'Mutations failing the check: ' + failedMutations.map( function( m ) { return m.id; } ).join( ', ' ) );
	}
	if( args.ids.length === 0 && unproven.length ) {
		console.log( 'Specs no mutation kills:' );
		unproven.forEach( function( s ) { console.log( '    ' + s ); } );
	}
	if( args.out ) {
		fs.writeFileSync( args.out, JSON.stringify( report, null, 1 ) );
		console.log( 'Full results written to ' + args.out );
	}
	if( failedMutations.length || ( args.ids.length === 0 && unproven.length ) ) {
		process.exitCode = 1;
	}
}

try {
	main().catch( function( e ) {
		console.error( e.stack || e );
		process.exitCode = 2;
	} ).then( cleanup );
} catch( e ) {
	cleanup();
	console.error( e.stack || e );
	process.exitCode = 2;
}

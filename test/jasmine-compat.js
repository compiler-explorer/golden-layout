/**
 * Compatibility shim for the legacy Jasmine 1.x API used by the specs, which
 * was removed in Jasmine 2+ (bundled with the old karma-jasmine ~0.1.5).
 *
 * Two things are restored:
 *
 *   1. The asynchronous runs() / waits() / waitsFor() control flow. Specs that
 *      use it are wrapped so they become modern done()-based async specs: the
 *      spec body runs synchronously to collect its queued blocks, which are
 *      then executed in order, with waitsFor() polling until its predicate is
 *      satisfied (some GoldenLayout events propagate via requestAnimationFrame
 *      and therefore arrive asynchronously).
 *
 *   2. The legacy spy accessors spy.calls.length and spy.mostRecentCall.
 *
 * This file MUST be loaded before the spec files so that `it` is wrapped before
 * the describe() blocks register their specs (see karma.conf.js).
 */
(function( global ) {

	// While a wrapped spec body runs, legacy calls are pushed here instead of
	// executing immediately. null means "no legacy spec in progress".
	var collecting = null;

	function makeAsyncRunner( body ) {
		return function( done ) {
			var ctx = this;
			var previous = collecting;
			collecting = [];
			try {
				body.call( ctx );
			} catch ( e ) {
				collecting = previous;
				throw e;
			}
			var queue = collecting;
			collecting = previous;

			if ( !queue.length ) {
				// Spec didn't use the legacy async API - it was synchronous.
				done();
				return;
			}

			runQueue( queue, ctx, done );
		};
	}

	function runQueue( queue, ctx, done ) {
		var index = 0;

		function next() {
			if ( index >= queue.length ) {
				done();
				return;
			}

			var step = queue[ index++ ];

			if ( step.type === 'runs' ) {
				step.fn.call( ctx );
				next();
			} else if ( step.type === 'waits' ) {
				setTimeout( next, step.ms || 0 );
			} else { // waitsFor
				var start = new Date().getTime();
				( function poll() {
					var satisfied = false;
					try {
						satisfied = step.predicate.call( ctx );
					} catch ( e ) {
						satisfied = false;
					}
					if ( satisfied ) {
						next();
					} else if ( new Date().getTime() - start >= step.timeout ) {
						done.fail( new Error( 'waitsFor timed out: ' +
							( step.message || step.predicate.toString() ) ) );
					} else {
						setTimeout( poll, 10 );
					}
				} )();
			}
		}

		next();
	}

	global.runs = function( fn ) {
		if ( collecting ) {
			collecting.push( { type: 'runs', fn: fn } );
		} else {
			fn.call( this );
		}
	};

	global.waits = function( ms ) {
		if ( collecting ) {
			collecting.push( { type: 'waits', ms: ms } );
		}
	};

	global.waitsFor = function( predicate, message, timeout ) {
		if ( collecting ) {
			collecting.push( {
				type: 'waitsFor',
				predicate: predicate,
				message: message,
				timeout: timeout || 5000
			} );
		} else if ( !predicate.call( this ) ) {
			throw new Error( 'waitsFor condition not met: ' +
				( message || predicate.toString() ) );
		}
	};

	// Wrap it / fit so legacy async specs become done()-based specs.
	var wrapSpec = function( original ) {
		if ( typeof original !== 'function' ) {
			return original;
		}
		return function( description, body, timeout ) {
			if ( typeof body !== 'function' ) {
				return original.call( this, description, body, timeout );
			}
			return original.call( this, description, makeAsyncRunner( body ), timeout );
		};
	};
	global.it = wrapSpec( global.it );
	global.fit = wrapSpec( global.fit );

	/**
	 * Legacy Jasmine 1.x spy API used by the specs:
	 *   spy.calls.length   -> spy.calls.count()
	 *   spy.mostRecentCall -> spy.calls.mostRecent()
	 */
	if ( global.jasmine && typeof global.jasmine.createSpy === 'function' ) {

		var probe = global.jasmine.createSpy( 'compat-probe' );
		var callTrackerProto = Object.getPrototypeOf( probe.calls );
		if ( callTrackerProto && !Object.getOwnPropertyDescriptor( callTrackerProto, 'length' ) ) {
			Object.defineProperty( callTrackerProto, 'length', {
				configurable: true,
				get: function() { return this.count(); }
			} );
		}

		var addLegacySpyMembers = function( spy ) {
			if ( spy && spy.calls && !Object.getOwnPropertyDescriptor( spy, 'mostRecentCall' ) ) {
				Object.defineProperty( spy, 'mostRecentCall', {
					configurable: true,
					get: function() { return this.calls.mostRecent(); }
				} );
			}
			return spy;
		};

		var origCreateSpy = global.jasmine.createSpy;
		global.jasmine.createSpy = function() {
			return addLegacySpyMembers( origCreateSpy.apply( this, arguments ) );
		};

		var origCreateSpyObj = global.jasmine.createSpyObj;
		global.jasmine.createSpyObj = function() {
			var obj = origCreateSpyObj.apply( this, arguments );
			for ( var key in obj ) {
				addLegacySpyMembers( obj[ key ] );
			}
			return obj;
		};
	}

})( window );

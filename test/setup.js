/**
 * Loads jQuery and the concatenated GoldenLayout build into the test page as
 * classic (non-module, non-strict) scripts, as Karma used to.
 */
import { afterEach } from 'vitest';
import jquerySource from '../lib/jquery.js?raw';
import goldenLayoutSource from 'virtual:goldenlayout';

function addScript( source, name ) {
	var script = document.createElement( 'script' );
	script.textContent = source + '\n//# sourceURL=' + name;
	document.head.appendChild( script );
}

addScript( jquerySource, 'jquery.js' );
addScript( goldenLayoutSource, 'goldenlayout.js' );

// Karma loaded the sources unwrapped, so their `lm` namespace was a global.
// The concatenated build wraps it in an IIFE; expose it for the specs that
// use it directly.
window.lm = window.GoldenLayout.__lm;

// Karma/Jasmine let the browser run a frame between specs, so work that
// GoldenLayout defers to requestAnimationFrame (e.g. the throttled
// stateChanged event from init) settled before the next spec. Vitest starts
// the next spec straight away, so wait for a frame here too; otherwise such
// an event can leak into the next spec's listeners.
afterEach( function() {
	return new Promise( function( resolve ) {
		requestAnimationFrame( function() {
			resolve();
		} );
	} );
} );

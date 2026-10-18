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
// use it directly. (If GoldenLayout is missing, leave the specs to say so.)
window.lm = window.GoldenLayout ? window.GoldenLayout.__lm : undefined;

// Vitest starts the next spec straight away. GoldenLayout defers some work
// to requestAnimationFrame (e.g. the throttled stateChanged event from
// creating a layout), and without a frame in between, such an event can
// reach the next spec's listeners. Draining a frame after each spec stops
// that leak.
afterEach( function() {
	return new Promise( function( resolve ) {
		requestAnimationFrame( function() {
			resolve();
		} );
	} );
} );

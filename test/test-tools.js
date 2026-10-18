import { onTestFinished, vi } from 'vitest';

export var testTools = {};

/**
 * Polls until predicate() is truthy, failing after `timeout` ms. This is the
 * Jasmine 1.x waitsFor(): a throwing predicate counts as "not yet", and a
 * timeout always fails with "waitsFor timed out".
 */
testTools.waitsFor = function( predicate, message, timeout ) {
	return vi.waitFor( function() {
		if ( !predicate() ) {
			throw new Error( 'not yet' );
		}
	}, { timeout: timeout || 5000, interval: 10 } ).catch( function() {
		throw new Error( 'waitsFor timed out: ' + ( message || predicate.toString() ) );
	} );
};

testTools.createLayout = function( config ) {
	var myLayout = new window.GoldenLayout( config );

	myLayout.registerComponent( 'testComponent', testTools.TestComponent );

	myLayout.init();

	// Under Jasmine 1.x this was a waitsFor() queued after the rest of the
	// calling spec's body; onTestFinished runs it at the same point.
	onTestFinished( function() {
		return testTools.waitsFor( function() {
			return myLayout.isInitialised;
		} );
	} );

	return myLayout;
};

testTools.TestComponent = function( container, state ){
	if ( state === undefined ) {
		container.getElement().html( 'that worked' );
	} else {
		container.getElement().html( state.html );
	}
	this.isTestComponentInstance = true;
};

/**
 * Takes a path of type.index.type.index, e.g.
 *
 * 'row.0.stack.1.component'
 *
 * and resolves it to an element
 *
 * @param   {String} path
 * @param   {GoldenLayout} layout
 * @param	{Function} expect Vitest expect function
 *
 * @returns {AbstractContentItem}
 */
testTools.verifyPath = function( path, layout, expect ) {
	expect( layout.root ).toBeDefined();
	expect( layout.root.contentItems.length ).toBe( 1 );

	var pathSegments = path.split( '.' ),
		node = layout.root.contentItems[ 0 ],
		i;

	for( i = 0; i < pathSegments.length; i++ ) {
		
		if( isNaN( pathSegments[ i ] ) ) {
			expect( node.type ).toBe( pathSegments[ i ] );
		} else {
			node = node.contentItems[ parseInt( pathSegments[ i ], 10 ) ];

			expect( node ).toBeDefined();
			
			if( node === undefined ) {
				return null;
			}
		}
	}

	return node;
};

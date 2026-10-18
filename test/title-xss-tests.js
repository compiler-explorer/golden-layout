import { describe, it, expect } from 'vitest';
import { testTools } from './test-tools.js';

describe( 'titles are shown as text, not HTML', function() {

	var payload = '<img src=x onerror="window.titleXss = true">a&b',
		layout, tab;

	it( 'creates a layout with markup in a title', function() {
		layout = testTools.createLayout( {
			content: [ {
				type: 'stack',
				content: [ {
					type: 'component',
					componentName: 'testComponent',
					title: payload
				}, {
					type: 'component',
					componentName: 'testComponent',
					title: 'other'
				} ]
			} ]
		} );
		expect( layout.isInitialised ).toBe( true );
	} );

	it( 'shows the title on its tab as text', function() {
		tab = layout.root.contentItems[ 0 ].header.tabs[ 0 ];
		expect( tab.titleElement.text() ).toBe( payload );
		expect( tab.element.attr( 'title' ) ).toBe( payload );
		expect( layout.container.find( 'img' ).length ).toBe( 0 );
	} );

	it( 'shows the title on the drag proxy as text', function() {
		// Starting the drag removes the tab, along with its reference to the
		// drag listener that the proxy needs to finish the drag.
		var dragListener = tab._dragListener;
		tab._onDragStart( 0, 0 );
		var proxy = $( '.lm_dragProxy' );
		expect( proxy.length ).toBe( 1 );
		expect( proxy.find( '.lm_title' ).text() ).toBe( payload );
		expect( proxy.find( '.lm_tab' ).attr( 'title' ) ).toBe( payload );
		expect( proxy.find( 'img' ).length ).toBe( 0 );
		dragListener.emit( 'dragStop' );
	} );

	it( 'never ran the markup', async function() {
		// Give an injected image's error handler time to run, had there been one.
		await new Promise( function( resolve ) { setTimeout( resolve, 100 ); } );
		expect( window.titleXss ).toBeUndefined();
	} );

	it( 'destroys the layout', function() {
		layout.destroy();
	} );
} );

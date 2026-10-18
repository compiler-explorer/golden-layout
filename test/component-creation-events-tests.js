import { describe, it, expect, vi } from 'vitest';

describe( 'emits events when components are created', function() {

	var layout, eventListener = {
		show: vi.fn(),
		shown: vi.fn()
	};

	it( 'creates a layout', function() {
		layout = new window.GoldenLayout( {
			content: [ {
				type: 'stack',
				content: [ {
					type: 'column',
					content: [ {
						type: 'component',
						componentName: 'testComponent'
					} ]
				} ]
			} ]
		} );

		function Recorder( container ) {
			container.getElement().html( 'that worked' );
			container.on( 'show', eventListener.show );
			container.on( 'shown', eventListener.shown );
		}

		layout.registerComponent( 'testComponent', Recorder );
	} );

	it( 'registers listeners', function() {
		expect( eventListener.show ).not.toHaveBeenCalled();
		expect( eventListener.shown ).not.toHaveBeenCalled();

		layout.init();
	} );

	it( 'has called listeners', function() {
		expect( eventListener.show.mock.calls.length ).toBe( 1 );
		expect( eventListener.shown.mock.calls.length ).toBe( 1 );
	} );

	it( 'destroys the layout', function() {
		layout.destroy();
	} );
} );
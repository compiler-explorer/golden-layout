import { describe, it, expect } from 'vitest';
import { testTools } from './test-tools.js';

describe( 'it can popout components into browserwindows', function(){

	var layout, browserPopout;

	it( 'creates a layout', function(){
		layout = testTools.createLayout({
			content: [{
				type: 'stack',
				content: [{
					type: 'component',
					componentName: 'testComponent',
					id: 'componentA'
				},
				{
					type: 'component',
					componentName: 'testComponent',
					id: 'componentB'
				}]
			}]
		});

		expect( layout.isInitialised ).toBe( true );
	});

	it( 'opens testComponent in a new window', function(){
		expect( layout.openPopouts.length ).toBe( 0 );
		var component = layout.root.getItemsById( 'componentA' )[ 0 ];
		browserPopout = component.popout();

		expect( browserPopout.getWindow().closed ).toBe( false );
		expect( layout.openPopouts.length ).toBe( 1 );
	});

	/**
	 * TODO These two don't run: the popout window loads the current page's
	 * URL with a gl-window parameter and expects that page to create a
	 * GoldenLayout from it. Under Vitest that page is the test runner's own,
	 * which never does, so the popout never initialises. Running them would
	 * need a dedicated page for popouts to load.
	 */
	it.skip( 'serialises the new window', async function(){
		expect( layout.openPopouts.length ).toBe( 1 );

		await testTools.waitsFor(function(){
			return layout.openPopouts[ 0 ].isInitialised;
		});

		var config = layout.toConfig();
		expect( config.openPopouts.length ).toBe( 1 );
		expect( typeof config.openPopouts[ 0 ].left ).toBe( 'number');
		expect( typeof config.openPopouts[ 0 ].top ).toBe( 'number');
		expect( config.openPopouts[ 0 ].width > 0 ).toBe( true );
		expect( config.openPopouts[ 0 ].height > 0 ).toBe( true );
		expect( config.openPopouts[ 0 ].config.content[ 0 ].type ).toBe( 'component' );
	});

	it.skip( 'closes the open window', async function(){
		browserPopout.close();

		await testTools.waitsFor(function(){
			return browserPopout.getWindow().closed && 
				layout.openPopouts.length === 0;
		});
	});

	it( 'destroys the layout', function(){
		layout.destroy();
	});
});
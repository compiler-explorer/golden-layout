import { describe, it, expect, vi } from 'vitest';
import { testTools } from './test-tools.js';

describe( 'emits events when items are created', function(){

	var layout, eventListener = {
		onItemCreated: vi.fn(),
		onStackCreated: vi.fn(),
		onComponentCreated: vi.fn(),
		onRowCreated: vi.fn(),
		onColumnCreated: vi.fn()
	};

	it( 'creates a layout', function(){
		layout = new window.GoldenLayout({
			content: [{
				type: 'stack',
				content: [{
					type: 'column',
					content:[{
						type: 'component',
						componentName: 'testComponent'
					}]
				},{
					type: 'row'
				}]
			}]
		});

		layout.registerComponent( 'testComponent', testTools.TestComponent );
	});

	it( 'registeres listeners', function(){
		expect( eventListener.onItemCreated ).not.toHaveBeenCalled();
		expect( eventListener.onStackCreated ).not.toHaveBeenCalled();
		expect( eventListener.onRowCreated ).not.toHaveBeenCalled();
		expect( eventListener.onColumnCreated ).not.toHaveBeenCalled();
		expect( eventListener.onComponentCreated ).not.toHaveBeenCalled();

		layout.on( 'itemCreated', eventListener.onItemCreated );
		layout.on( 'stackCreated', eventListener.onStackCreated );
		layout.on( 'rowCreated', eventListener.onRowCreated );
		layout.on( 'columnCreated', eventListener.onColumnCreated );
		layout.on( 'componentCreated', eventListener.onComponentCreated );

		layout.init();
	});

	it( 'has called listeners', function(){
		expect( eventListener.onItemCreated.mock.calls.length ).toBe( 6 );
		expect( eventListener.onStackCreated.mock.calls.length ).toBe( 2 );
		expect( eventListener.onRowCreated.mock.calls.length ).toBe( 1 );
		expect( eventListener.onColumnCreated.mock.calls.length ).toBe( 1 );
		expect( eventListener.onComponentCreated.mock.calls.length ).toBe( 1 );
	});

	it( 'provided the right arguments', function(){
		expect( eventListener.onComponentCreated.mock.lastCall[0].type ).toEqual( 'component' );
		expect( eventListener.onStackCreated.mock.lastCall[0].type ).toEqual( 'stack' );
		expect( eventListener.onColumnCreated.mock.lastCall[0].type ).toEqual( 'column' );
		expect( eventListener.onRowCreated.mock.lastCall[0].type ).toEqual( 'row' );
	});

	it( 'destroys the layout', function(){
		layout.destroy();
	});
});
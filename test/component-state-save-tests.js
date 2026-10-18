import { describe, it, expect } from 'vitest';
import { testTools } from './test-tools.js';

describe( 'Sets and retrieves a component\'s state', function() {

	var myLayout, myComponent;

	it( 'Can create a most basic layout', async function() {
		myLayout = new window.GoldenLayout({
			content: [{
				type: 'component',
				componentName: 'testComponent',
				componentState: { testValue: 'initial' }
			}]
		});


		myLayout.registerComponent( 'testComponent', function( container, state ){
			this.container = container;
			this.state = state;
			myComponent = this;
		});

		myLayout.init();
		
		await testTools.waitsFor(function(){
			return myLayout.isInitialised;
		});

		expect( myComponent.state.testValue ).toBe( 'initial' );
	});

	it( 'returns the initial state', function(){
		var config = myLayout.toConfig();
		expect( config.content[ 0 ].content[ 0 ].componentState.testValue ).toBe( 'initial' );
	});

	it( 'emits stateChanged when a component updates its state', async function(){
		var stateChanges = 0;

		myLayout.on( 'stateChanged', function(){
			stateChanges++;
		});

		myComponent.container.setState({ testValue: 'updated' });

		await testTools.waitsFor(function(){
			return stateChanges !== 0;
		});

		expect( stateChanges ).toBe( 1 );
	});

	it( 'returns the updated state', function(){
		var config = myLayout.toConfig();
		expect( config.content[ 0 ].content[ 0 ].componentState.testValue ).toBe( 'updated' );
	});

	it( 'Destroys the layout', function(){
		myLayout.destroy();
		expect( myLayout.root.contentItems.length ).toBe( 0 );
	});
});
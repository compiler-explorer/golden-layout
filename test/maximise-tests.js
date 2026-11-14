import { describe, it, expect } from 'vitest';
import { testTools } from './test-tools.js';

function component() {
	return { type: 'component', componentName: 'testComponent' };
}

function rowOfStacks( count ) {
	var content = [], i;
	for( i = 0; i < count; i++ ) {
		content.push( { type: 'stack', content: [ component() ] } );
	}
	return testTools.createLayout( { content: [ { type: 'row', content: content } ] } );
}

function expectNothingMaximised( layout ) {
	expect( layout._maximisedItem ).toBe( null );
	expect( layout.root.getItemsByFilter( function( item ) { return item.isMaximised; } ).length ).toBe( 0 );
	expect( $( '.lm_maximised' ).length ).toBe( 0 );
	expect( $( '.lm_maximise_place' ).length ).toBe( 0 );
}

/**
 * Each child's element, and a splitter between each pair, in order, is what
 * the row or column's element holds once nothing in it is maximised.
 */
function expectChildrenInPlace( rowOrColumn ) {
	var elements = rowOrColumn.childElementContainer.children(), i;

	expect( elements.length ).toBe( rowOrColumn.contentItems.length * 2 - 1 );
	for( i = 0; i < rowOrColumn.contentItems.length; i++ ) {
		expect( elements[ i * 2 ] ).toBe( rowOrColumn.contentItems[ i ].element[ 0 ] );
		if( i > 0 ) {
			expect( $( elements[ i * 2 - 1 ] ).hasClass( 'lm_splitter' ) ).toBe( true );
		}
	}
}

describe( 'Adding a child to a row while one of its children is maximised', function() {

	var myLayout, row;

	it( 'creates a row of two stacks', function() {
		myLayout = rowOfStacks( 2 );
		row = myLayout.root.contentItems[ 0 ];
	} );

	it( 'restores the maximised last child and places the new child after it', function() {
		var maximised = row.contentItems[ 1 ];
		maximised.toggleMaximise();
		expect( maximised.isMaximised ).toBe( true );

		row.addChild( component() );

		expect( row.contentItems.length ).toBe( 3 );
		expectNothingMaximised( myLayout );
		expectChildrenInPlace( row );
	} );

	it( 'restores the maximised first child, so it gets its share of the row like the others', function() {
		var maximised = row.contentItems[ 0 ], i;
		maximised.toggleMaximise();

		row.addChild( component(), 1 );

		expect( row.contentItems.length ).toBe( 4 );
		expectNothingMaximised( myLayout );
		expectChildrenInPlace( row );
		for( i = 1; i < row.contentItems.length; i++ ) {
			expect( row.contentItems[ i ].element.height() ).toBe( row.element.height() );
			expect( Math.abs( row.contentItems[ i ].element.width() - maximised.element.width() ) ).toBeLessThanOrEqual( 1 );
		}
	} );

	it( 'destroys the layout', function() {
		myLayout.destroy();
	} );
} );

describe( 'Adding a child to a row or column while an item elsewhere is maximised', function() {

	var myLayout, row, column;

	it( 'creates a row holding a stack and a column of two stacks', function() {
		myLayout = testTools.createLayout( {
			content: [ {
				type: 'row',
				content: [
					{ type: 'stack', content: [ component() ] },
					{
						type: 'column',
						content: [
							{ type: 'stack', content: [ component() ] },
							{ type: 'stack', content: [ component() ] }
						]
					}
				]
			} ]
		} );
		row = myLayout.root.contentItems[ 0 ];
		column = row.contentItems[ 1 ];
	} );

	it( 'leaves a maximised item outside the column alone', function() {
		var maximised = row.contentItems[ 0 ];
		maximised.toggleMaximise();

		column.addChild( component() );

		expect( column.contentItems.length ).toBe( 3 );
		expect( maximised.isMaximised ).toBe( true );
		expect( myLayout._maximisedItem ).toBe( maximised );
		expectChildrenInPlace( column );

		maximised.toggleMaximise();
		expectNothingMaximised( myLayout );
		expectChildrenInPlace( row );
	} );

	it( 'restores a maximised item nested deeper in the row', function() {
		var maximised = column.contentItems[ 0 ];
		maximised.toggleMaximise();

		row.addChild( component() );

		expect( row.contentItems.length ).toBe( 3 );
		expectNothingMaximised( myLayout );
		expectChildrenInPlace( row );
		expectChildrenInPlace( column );
	} );

	it( 'destroys the layout', function() {
		myLayout.destroy();
	} );
} );

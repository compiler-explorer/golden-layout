import { describe, it, expect } from 'vitest';
import { testTools } from './test-tools.js';

function component() {
	return { type: 'component', componentName: 'testComponent' };
}

function stack( componentCount ) {
	var content = [], i;
	for( i = 0; i < ( componentCount || 1 ); i++ ) {
		content.push( component() );
	}
	return { type: 'stack', content: content };
}

function layoutOf( item ) {
	return testTools.createLayout( { content: [ item ] } );
}

function rowOfStacks( count ) {
	var content = [], i;
	for( i = 0; i < count; i++ ) {
		content.push( stack() );
	}
	return layoutOf( { type: 'row', content: content } );
}

function expectNothingMaximised( layout ) {
	expect( layout._maximisedItem ).toBe( null );
	expect( layout.root.getItemsByFilter( function( item ) { return item.isMaximised; } ).length ).toBe( 0 );
	expect( $( '.lm_maximised' ).length ).toBe( 0 );
	expect( $( '.lm_maximise_place' ).length ).toBe( 0 );
}

function expectMaximised( layout, item ) {
	expect( layout._maximisedItem ).toBe( item );
	expect( layout.root.getItemsByFilter( function( item ) { return item.isMaximised; } ) ).toEqual( [ item ] );
	expect( item.element.width() ).toBe( layout.container.width() );
	expect( item.element.height() ).toBe( layout.container.height() );
}

/**
 * Nothing is maximised, nothing is saved as maximised, and every row and
 * column holds its children's elements in order.
 */
function expectRestored( layout ) {
	expectNothingMaximised( layout );
	expect( layout.toConfig().maximisedItemId ).toBe( null );
	layout.root.getItemsByFilter( function( item ) {
		return item.isRow || item.isColumn;
	} ).forEach( expectChildrenInPlace );
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

describe( 'Removing an item while another item is maximised', function() {

	it( 'restores the maximised item when a sibling is removed', function() {
		var layout = rowOfStacks( 3 ),
			row = layout.root.contentItems[ 0 ];
		row.contentItems[ 1 ].toggleMaximise();

		row.removeChild( row.contentItems[ 0 ] );

		expect( row.contentItems.length ).toBe( 2 );
		expectRestored( layout );
		layout.destroy();
	} );

	it( 'restores the maximised item when removing its only sibling collapses their row', function() {
		var layout = layoutOf( {
				type: 'column',
				content: [ { type: 'row', content: [ stack(), stack() ] }, stack() ]
			} ),
			column = layout.root.contentItems[ 0 ],
			row = column.contentItems[ 0 ],
			maximised = row.contentItems[ 1 ];
		maximised.toggleMaximise();

		row.removeChild( row.contentItems[ 0 ] );

		expect( column.contentItems[ 0 ] ).toBe( maximised );
		expectRestored( layout );
		layout.destroy();
	} );

	it( 'restores the maximised item when an item elsewhere in the row is removed', function() {
		var layout = layoutOf( {
				type: 'row',
				content: [ stack(), { type: 'column', content: [ stack(), stack() ] }, stack() ]
			} ),
			row = layout.root.contentItems[ 0 ];
		row.contentItems[ 1 ].contentItems[ 1 ].toggleMaximise();

		row.removeChild( row.contentItems[ 2 ] );

		expectRestored( layout );
		layout.destroy();
	} );

	it( 'keeps a stack maximised when one of its tabs is closed', function() {
		var layout = layoutOf( { type: 'row', content: [ stack(), stack( 2 ) ] } ),
			maximised = layout.root.contentItems[ 0 ].contentItems[ 1 ];
		maximised.toggleMaximise();

		maximised.removeChild( maximised.contentItems[ 0 ] );

		expectMaximised( layout, maximised );
		layout.destroy();
	} );
} );

describe( 'Closing a maximised item', function() {

	it( 'leaves nothing maximised', function() {
		var layout = rowOfStacks( 3 ),
			row = layout.root.contentItems[ 0 ],
			maximised = row.contentItems[ 1 ];
		maximised.toggleMaximise();

		maximised.removeChild( maximised.contentItems[ 0 ] );

		expect( row.contentItems.length ).toBe( 2 );
		expectRestored( layout );
		layout.destroy();
	} );

	it( 'leaves nothing maximised when it was the only item', function() {
		var layout = layoutOf( stack() ),
			maximised = layout.root.contentItems[ 0 ];
		maximised.toggleMaximise();

		maximised.removeChild( maximised.contentItems[ 0 ] );

		expect( layout.root.contentItems.length ).toBe( 0 );
		expectRestored( layout );
		layout.destroy();
	} );
} );

describe( 'Dropping an item while another item is maximised', function() {

	it( 'restores the maximised stack when an item is dropped on its edge', function() {
		var layout = rowOfStacks( 2 ),
			row = layout.root.contentItems[ 0 ],
			maximised = row.contentItems[ 1 ];
		maximised.toggleMaximise();

		maximised._dropSegment = 'bottom';
		maximised._$onDrop( layout._$normalizeContentItem( component() ) );

		expect( row.contentItems[ 1 ].isColumn ).toBe( true );
		expectRestored( layout );
		layout.destroy();
	} );

	it( 'restores the maximised stack when an item is dropped on the edge of its sibling', function() {
		var layout = rowOfStacks( 2 ),
			row = layout.root.contentItems[ 0 ];
		row.contentItems[ 0 ].toggleMaximise();

		row.contentItems[ 1 ]._dropSegment = 'bottom';
		row.contentItems[ 1 ]._$onDrop( layout._$normalizeContentItem( component() ) );

		expect( row.contentItems[ 1 ].isColumn ).toBe( true );
		expectRestored( layout );
		layout.destroy();
	} );

	it( 'restores the maximised stack when an item is dropped on the edge of the layout', function() {
		var layout = rowOfStacks( 2 );
		layout.root.contentItems[ 0 ].contentItems[ 0 ].toggleMaximise();

		layout.root._$onDrop( layout._$normalizeContentItem( component() ), { side: 'y2' } );

		expect( layout.root.contentItems[ 0 ].isColumn ).toBe( true );
		expectRestored( layout );
		layout.destroy();
	} );

	it( 'restores the maximised stack before an item is dragged from a drag source', function() {
		var layout = layoutOf( {
				type: 'row',
				content: [ {
					type: 'stack',
					content: [ {
						type: 'component',
						componentName: 'testComponent',
						componentState: { html: '<div class="drag-source"></div>' }
					} ]
				}, stack() ]
			} ),
			maximised = layout.root.contentItems[ 0 ].contentItems[ 0 ],
			dragSource = maximised.element.find( '.drag-source' ),
			maximisedWhileDragging,
			mouse;
		layout.createDragSource( dragSource, {
			type: 'component',
			componentName: 'testComponent',
			componentState: { html: '<div class="dragged"></div>' }
		} );
		maximised.toggleMaximise();

		mouse = $.Event( 'mousedown' );
		mouse.pageX = dragSource.position().left;
		mouse.pageY = dragSource.position().top;
		mouse.button = 0;
		dragSource.trigger( mouse );

		mouse = $.Event( 'mousemove' );
		mouse.pageX = dragSource.position().left + 50;
		mouse.pageY = dragSource.position().top + 50;
		dragSource.trigger( mouse );
		maximisedWhileDragging = layout._maximisedItem;

		dragSource.trigger( 'mouseup' );

		expect( maximisedWhileDragging ).toBe( null );
		expect( $( '.dragged' ).length ).toBe( 1 );
		expectRestored( layout );
		layout.destroy();
	} );
} );

describe( 'Maximising an item while another item is maximised', function() {

	it( 'minimises the other item', function() {
		var layout = rowOfStacks( 2 ),
			row = layout.root.contentItems[ 0 ],
			first = row.contentItems[ 0 ],
			second = row.contentItems[ 1 ];
		first.toggleMaximise();

		second.toggleMaximise();

		expect( first.isMaximised ).toBe( false );
		expectMaximised( layout, second );

		second.toggleMaximise();
		expectRestored( layout );
		layout.destroy();
	} );
} );

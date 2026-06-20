describe( 'the pop-in button does not allow HTML injection via its label', function(){
	var lm = window.GoldenLayout.__lm;

	/**
	 * _adjustToWindowMode() is a private method that rebuilds document.body, so we
	 * call it against a stub `this` and snapshot/restore the document around it
	 * rather than spinning up a real sub-window (which Karma cannot host - see
	 * popout-tests.js).
	 */
	var runAdjustToWindowMode = function( popinLabel ) {
		var stub = {
				config: {
					labels: { popin: popinLabel },
					content: [ { title: 'a title' } ]
				},
				emit: function(){}
			},
			savedBody = $( 'body' ).children().detach(),
			savedTitle = document.title;

		try {
			lm.LayoutManager.prototype._adjustToWindowMode.call( stub );
			return stub.container.find( '.lm_popin' );
		} finally {
			$( 'body' ).html( '' ).append( savedBody );
			document.title = savedTitle;
			delete window.__glInstance;
		}
	};

	it( 'stores a malicious label as a literal title attribute without injecting markup', function(){
		var payload = '"><img src=x onerror=alert(1)>',
			popInButton = runAdjustToWindowMode( payload );

		expect( popInButton.length ).toBe( 1 );
		expect( popInButton.attr( 'title' ) ).toBe( payload );
		expect( popInButton.find( 'img' ).length ).toBe( 0 );
	});

	it( 'applies a normal label correctly', function(){
		var popInButton = runAdjustToWindowMode( 'pop in' );

		expect( popInButton.attr( 'title' ) ).toBe( 'pop in' );
	});
} );

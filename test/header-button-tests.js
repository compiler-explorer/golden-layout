describe( 'HeaderButton does not allow HTML injection via its label or cssClass', function(){
	var lm = window.GoldenLayout.__lm;

	var makeFakeHeader = function() {
		return {
			controlsContainer: $( '<ul></ul>' ),
			on: function(){}
		};
	};

	it( 'stores a malicious label as a literal title attribute without injecting markup', function(){
		var header = makeFakeHeader(),
			payload = '"><img src=x onerror=alert(1)>',
			button = new lm.controls.HeaderButton( header, payload, 'lm_close', function(){} );

		// The payload is stored verbatim in the title attribute...
		expect( button.element.attr( 'title' ) ).toBe( payload );
		// ...and crucially no extra (e.g. injected <img>) elements were created.
		expect( header.controlsContainer.find( 'img' ).length ).toBe( 0 );
		expect( header.controlsContainer.children().length ).toBe( 1 );
	});

	it( 'stores a malicious cssClass as a literal class attribute without injecting markup', function(){
		var header = makeFakeHeader(),
			payload = '"><img src=x onerror=alert(1)>',
			button = new lm.controls.HeaderButton( header, 'a label', payload, function(){} );

		expect( button.element.attr( 'class' ) ).toBe( payload );
		expect( header.controlsContainer.find( 'img' ).length ).toBe( 0 );
		expect( header.controlsContainer.children().length ).toBe( 1 );
	});

	it( 'applies a normal label and cssClass correctly', function(){
		var header = makeFakeHeader(),
			button = new lm.controls.HeaderButton( header, 'Close', 'lm_close', function(){} );

		expect( button.element.attr( 'title' ) ).toBe( 'Close' );
		expect( button.element.attr( 'class' ) ).toBe( 'lm_close' );
	});
} );

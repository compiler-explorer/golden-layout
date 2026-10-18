/* eslint-env node */
/**
 * Source mutations used to show that each spec tests something, in both the
 * old Karma/Jasmine suite and the Vitest port. Each mutation replaces one
 * exact (unique) snippet of a source file, and lists the specs it must make
 * fail. Specs are named "file > describe > it". See run.js.
 */
'use strict';

var C = 'component-creation-events-tests.js > emits events when components are created > ';
var S = 'component-state-save-tests.js > Sets and retrieves a component\'s state > ';
var CC = 'create-config.tests.js > It creates and extends config segments correctly > ';
var CF = 'create-from-config-tests.js > Creates the right structure based on the provided config > ';
var DD = 'deferred-create-drag-tests.js > supports drag creation with deferred content > ';
var BUBBLE = ' > content items are abled to to emit events that bubble up the tree > ';
var DS = 'disabled-selection-tests.js' + BUBBLE;
var D = 'drag-tests.js > supports drag creation > ';
var E = 'empty-item-tests.js > The layout can handle empty stacks > ';
var ES = 'enabled-selection-tests.js' + BUBBLE;
var EB = 'event-bubble-tests.js' + BUBBLE;
var EE = 'event-emitter-tests.js > the EventEmitter works > ';
var HB = 'header-button-tests.js > HeaderButton does not allow HTML injection via its label or cssClass > ';
var ID = 'id-tests.js > Dynamic ids work properly > ';
var IN = 'initialisation-tests.js > Can initialise the layoutmanager > ';
var IC = 'item-creation-events-tests.js > emits events when items are created > ';
var MN = 'minifier-tests.js > Can minify and unminify configuration objects > ';
var PI = 'popin-button-tests.js > the pop-in button does not allow HTML injection via its label > ';
var PO = 'popout-tests.js > it can popout components into browserwindows > ';
var SE = 'selector-tests.js > it is possible to select elements from the tree using selectors > ';
var TB = 'tab-tests.js > tabs apply their configuration > ';
var TI = 'title-tests.js' + BUBBLE;
var TM = 'tree-manipulation-tests.js > The layout can be manipulated at runtime > ';
var X = 'xss_tests.js > Basic XSS filtering is applied > ';

var LM = 'src/js/LayoutManager.js';
var ACI = 'src/js/items/AbstractContentItem.js';
var EMITTER = 'src/js/utils/EventEmitter.js';
var MINIFIER = 'src/js/utils/ConfigMinifier.js';

exports.list = [
	/*
	 * LayoutManager
	 */
	{
		id: 'export-global',
		file: LM,
		from: 'window.GoldenLayout = lm.LayoutManager;',
		to: 'window.GoldenLayou = lm.LayoutManager;',
		// These spec files read GoldenLayout while being collected, so they
		// fail to load. initialisation-tests.js still loads, and its spec
		// fails on its own assertion.
		expectLoadFailure: [ 'header-button-tests.js', 'popin-button-tests.js', 'xss_tests.js' ],
		specs: [ IN + 'Finds the layoutmanager on the global namespace' ],
		// Under Karma every file shares one page, and header-button-tests.js
		// throwing while loading stops the later files' specs from running.
		karmaNotRequired: {
			[ IN + 'Finds the layoutmanager on the global namespace' ]: 'an earlier file fails to load and the spec never runs'
		}
	},
	{
		id: 'register-component-check',
		file: LM,
		from: 'if( typeof constructor !== \'function\' ) {',
		to: 'if( typeof constructor !== \'object\' ) {',
		specs: [ C + 'creates a layout', IC + 'creates a layout' ]
	},
	{
		id: 'init-create',
		file: LM,
		from: 'this._create( this.config );',
		to: 'this._create( this.settings );',
		specs: [
			C + 'registers listeners',
			IC + 'registeres listeners',
			E + 'Creates an initial layout',
			ID + 'creates a layout',
			TM + 'Creates an initial layout'
		]
	},
	{
		id: 'init-flag',
		file: LM,
		from: 'this.isInitialised = true;\n\t\tthis._adjustColumnsResponsive();',
		to: 'this.isInitialised = 1;\n\t\tthis._adjustColumnsResponsive();',
		specs: [
			DD + 'creates a layout',
			DS + 'creates a layout',
			D + 'creates a layout',
			ES + 'creates a layout',
			PO + 'creates a layout',
			TB + 'creates a layout',
			TI + 'creates a layout'
		]
	},
	{
		// Without the flag, createLayout's wait for initialisation (a waitsFor
		// queued after the spec body) times out.
		id: 'init-flag-missing',
		file: LM,
		from: 'this.isInitialised = true;\n\t\tthis._adjustColumnsResponsive();',
		to: 'this._adjustColumnsResponsive();',
		specs: [ E + 'Creates an initial layout', ID + 'creates a layout', TM + 'Creates an initial layout' ]
	},
	{
		id: 'destroy-items',
		file: LM,
		from: 'this.root.callDownwards( \'_$destroy\', [], true );',
		to: 'this.root.callDownwards( \'_$destroyed\', [], true );',
		specs: [
			C + 'destroys the layout',
			DD + 'destroys the layout',
			DS + 'destroys the layout',
			E + 'destroys the layout',
			ES + 'destroys the layout',
			EB + 'destroys the layout',
			ID + 'destroys the layout',
			IC + 'destroys the layout',
			PO + 'destroys the layout',
			TB + 'destroys the layout',
			TI + 'destroys the layout'
		]
	},
	{
		// Breaks destroy only for layouts with drag sources, after their items
		// are gone. destroy-items would also do for drag-tests.js under Vitest,
		// but under Karma the layouts it leaves behind in the shared page break
		// that file's drag spec first.
		id: 'destroy-drag-sources',
		file: LM,
		from: 'dragSource._dragListener.destroy();',
		to: 'dragSource._dragListener.destroyed();',
		specs: [ D + 'destroys the layout', DD + 'destroys the layout' ]
	},
	{
		id: 'destroy-clear-root',
		file: LM,
		from: 'this.root.contentItems = [];',
		to: '',
		specs: [ S + 'Destroys the layout', IN + 'Destroys the layout' ]
	},
	{
		id: 'create-config-copies',
		file: LM,
		from: 'config = $.extend( true, {}, lm.config.defaultConfig, config );',
		to: 'config = $.extend( true, lm.config.defaultConfig, config );',
		specs: [ CC + 'doesn\'t change the default config when calling extend' ]
	},
	{
		id: 'wrap-component-with-parent',
		file: LM,
		from: '!!parent &&',
		to: '!parent &&',
		specs: [
			CF + 'creates the right primitive types: component only',
			CF + 'creates the right primitive types: row and two component',
			CF + 'creates the right primitive types: stack -> column -> component',
			EB + 'creates a layout',
			SE + 'creates a layout with elements that have ids',
			TM + 'has the right initial structure'
		]
	},
	{
		id: 'stack-flag',
		file: 'src/js/items/Stack.js',
		from: 'this.isStack = true;',
		to: 'this.isStack = false;',
		specs: [ CF + 'creates the right primitive types: stack and component', E + 'can add children to the empty stack' ]
	},
	{
		id: 'select-item-programmatic',
		file: LM,
		from: 'if( item && _$silent !== true ) {\n\t\t\titem.select();',
		to: 'if( item && _$silent !== true ) {\n\t\t\titem.deselect();',
		specs: [ ES + 'changes selection programatically' ]
	},
	{
		id: 'layout-event-origin',
		file: ACI,
		from: 'this.layoutManager.emit( name, event.origin );',
		to: 'this.layoutManager.emit( name, event );',
		specs: [ IC + 'provided the right arguments' ]
	},
	{
		id: 'layout-event-propagation',
		file: ACI,
		from: 'if( lm.utils.indexOf( name, this._throttledEvents ) === -1 ) {\n\t\t\tthis.layoutManager.emit( name, event.origin );',
		to: 'if( lm.utils.indexOf( name, this._throttledEvents ) === -1 ) {\n\t\t\tthis.layoutManager.emit( name + \'!\', event.origin );',
		specs: [ EB + 'emits bubbling events' ]
	},
	{
		id: 'layout-throttled-event',
		file: ACI,
		from: 'this._pendingEventPropagations[ name ] = false;\n\t\tthis.layoutManager.emit( name, event );',
		to: 'this._pendingEventPropagations[ name ] = false;',
		specs: [ S + 'emits stateChanged when a component updates its state' ]
	},
	{
		id: 'popout-tracked',
		file: LM,
		from: 'this.openPopouts.push( browserPopout );',
		to: '',
		specs: [ PO + 'opens testComponent in a new window' ]
	},
	{
		id: 'popin-label-injection',
		file: LM,
		from: 'var popInButton = $( \'<div class="lm_popin">\' +\n' +
			'\t\t\t\'<div class="lm_icon"></div>\' +\n' +
			'\t\t\t\'<div class="lm_bg"></div>\' +\n' +
			'\t\t\t\'</div>\' );\n' +
			'\t\tpopInButton.attr( \'title\', this.config.labels.popin );',
		to: 'var popInButton = $( \'<div class="lm_popin" title="\' + this.config.labels.popin + \'">\' +\n' +
			'\t\t\t\'<div class="lm_icon"></div>\' +\n' +
			'\t\t\t\'<div class="lm_bg"></div>\' +\n' +
			'\t\t\t\'</div>\' );',
		specs: [ PI + 'stores a malicious label as a literal title attribute without injecting markup' ]
	},
	{
		id: 'popin-label',
		file: LM,
		from: 'popInButton.attr( \'title\', this.config.labels.popin );',
		to: 'popInButton.attr( \'title\', this.config.labels.popout );',
		specs: [ PI + 'applies a normal label correctly' ]
	},

	/*
	 * Content items
	 */
	{
		id: 'component-state',
		file: 'src/js/items/Component.js',
		from: 'componentConfig = $.extend( true, {}, this.config.componentState || {} );',
		to: 'componentConfig = $.extend( true, {}, {} );',
		specs: [ S + 'Can create a most basic layout', DD + 'creates a drag source', D + 'creates a drag source' ]
	},
	{
		id: 'component-flag',
		file: 'src/js/items/Component.js',
		from: 'this.isComponent = true;',
		to: 'this.isComponent = false;',
		specs: [ ID + 'finds the item' ]
	},
	{
		id: 'component-state-reset',
		file: 'src/js/items/Component.js',
		from: 'this.isComponent = true;',
		to: 'this.isComponent = true;\n\tthis.config.componentState = {};',
		specs: [ S + 'returns the initial state' ]
	},
	{
		id: 'component-default-title',
		file: 'src/js/items/Component.js',
		from: 'this.config.title = this.config.componentName;',
		to: 'this.config.title = this.config.type;',
		specs: [ TI + 'applies titles from configuration' ]
	},
	{
		id: 'container-show-event',
		file: 'src/js/container/ItemContainer.js',
		from: 'this.emit( \'show\' );',
		to: 'this.emit( \'hide\' );',
		specs: [ C + 'has called listeners' ]
	},
	{
		// Under Karma this spec only sometimes caught this: the throttled
		// stateChanged left over from creating the layout could reach the
		// spec's listener instead. test/setup.js waits a frame between specs,
		// so under Vitest it is caught every time.
		id: 'container-state-event',
		file: 'src/js/container/ItemContainer.js',
		from: 'this._config.componentState = state;\n\t\tthis.parent.emitBubblingEvent( \'stateChanged\' );',
		to: 'this._config.componentState = state;',
		specs: [ S + 'emits stateChanged when a component updates its state' ],
		karmaNotRequired: {
			[ S + 'emits stateChanged when a component updates its state' ]: 'timing-dependent under Karma'
		}
	},
	{
		id: 'container-state-stored',
		file: 'src/js/container/ItemContainer.js',
		from: 'this._config.componentState = state;',
		to: 'this._config.componentStat = state;',
		specs: [ S + 'returns the updated state' ]
	},
	{
		id: 'container-set-title',
		file: 'src/js/container/ItemContainer.js',
		from: 'this.parent.setTitle( title );',
		to: 'this.parent.setTitle( this.title );',
		specs: [ TI + 'updates the title when calling setTitle from the container' ]
	},
	{
		id: 'item-set-title-stored',
		file: ACI,
		from: 'this.config.title = title;',
		to: '',
		specs: [ TI + 'Persists the title' ]
	},
	{
		id: 'item-created-event',
		file: ACI,
		from: 'this.emitBubblingEvent( \'itemCreated\' );',
		to: '',
		specs: [ IC + 'has called listeners' ]
	},
	{
		id: 'root-class',
		file: 'src/js/items/Root.js',
		from: '<div class="lm_goldenlayout lm_item lm_root"></div>',
		to: '<div class="lm_item lm_root"></div>',
		specs: [ IN + 'Can create a most basic layout' ]
	},
	{
		id: 'stop-propagation',
		file: 'src/js/utils/BubblingEvent.js',
		from: 'this.isPropagationStopped = true;',
		to: 'this.isPropagationStopped = false;',
		specs: [ EB + 'stops propagation' ]
	},
	{
		id: 'select-guard',
		file: ACI,
		from: 'if( this.layoutManager.selectedItem !== this ) {',
		to: 'if( this.layoutManager.selectedItem === this ) {',
		specs: [ ES + 'clicks a header and it selects a stack' ]
	},
	{
		id: 'deselect-class',
		file: ACI,
		from: 'this.element.removeClass( \'lm_selected\' );',
		to: 'this.element.addClass( \'lm_selected\' );',
		specs: [ ES + 'clicks changes selection' ]
	},
	{
		id: 'has-id-default',
		file: ACI,
		from: 'if( !this.config.id ) {\n\t\t\treturn false;',
		to: 'if( !this.config.id ) {\n\t\t\treturn true;',
		specs: [ ID + 'has no id initially' ]
	},
	{
		id: 'add-id-string',
		file: ACI,
		from: 'this.config.id = id;',
		to: 'this.config.id = [ id ];',
		specs: [ ID + 'adds the first id as a string' ]
	},
	{
		id: 'add-id-array',
		file: ACI,
		from: 'this.config.id = [ this.config.id, id ];',
		to: 'this.config.id = [ id ];',
		specs: [ ID + 'adds the second id to an array' ]
	},
	{
		id: 'add-id-duplicate',
		file: ACI,
		from: 'if( this.hasId( id ) ) {\n\t\t\treturn;',
		to: 'if( false ) {\n\t\t\treturn;',
		specs: [ ID + 'doesn\t add duplicated ids' ]
	},
	{
		id: 'remove-id',
		file: ACI,
		from: 'this.config.id.splice( index, 1 );',
		to: 'this.config.id.splice( index, 0 );',
		specs: [ ID + 'removes ids' ]
	},
	{
		id: 'remove-id-missing',
		file: ACI,
		from: 'throw new Error( \'Id not found\' );',
		to: 'return;',
		specs: [ ID + 'throws error when trying to remove a non-existant id' ]
	},
	{
		id: 'items-by-string-id',
		file: ACI,
		from: 'return item.config.id === id;',
		to: 'return item.config.id !== id;',
		specs: [
			DS + 'attaches event listeners and retrieves stacks',
			ES + 'attaches event listeners and retrieves stacks',
			SE + 'finds an item by string id',
			SE + 'returns an empty array if no item was found for id'
		]
	},
	{
		id: 'items-by-array-id',
		file: ACI,
		from: 'return lm.utils.indexOf( id, item.config.id ) !== -1;\n\t\t\t} else {',
		to: 'return lm.utils.indexOf( id, item.config.id ) === -1;\n\t\t\t} else {',
		specs: [ SE + 'finds items by an id from an array' ]
	},
	{
		id: 'items-by-type',
		file: ACI,
		from: 'return this._$getItemsByProperty( \'type\', type );',
		to: 'return this._$getItemsByProperty( \'componentName\', type );',
		specs: [ SE + 'finds items by type' ]
	},
	{
		id: 'items-by-property',
		file: ACI,
		from: 'return item[ key ] === value;',
		to: 'return item[ key ] !== value;',
		specs: [ SE + 'returns an empty array if no item was found for type' ]
	},
	{
		id: 'components-by-name-instance',
		file: ACI,
		from: 'instances.push( components[ i ].instance );',
		to: 'instances.push( components[ i ] );',
		specs: [ SE + 'finds the component instance by name' ]
	},
	{
		id: 'items-by-filter-scope',
		file: ACI,
		from: 'next( this );\n\t\treturn result;',
		to: 'next( this.layoutManager.root );\n\t\treturn result;',
		specs: [ SE + 'allows for chaining' ]
	},
	{
		id: 'replace-child-slot',
		file: ACI,
		from: 'this.contentItems[ index ] = newChild;',
		to: '',
		specs: [ TM + 'replaces a component with a row of components' ]
	},
	{
		id: 'replace-child-parent',
		file: ACI,
		from: 'newChild.parent = this;',
		to: 'newChild.parent = this.parent;',
		specs: [ TM + 'Has setup parents correctly' ]
	},
	{
		id: 'remove-child',
		file: ACI,
		from: 'this.contentItems.splice( index, 1 );',
		to: 'this.contentItems.splice( index, 0 );',
		specs: [ TM + 'Destroys a component and its parent' ]
	},
	{
		id: 'stack-add-child-parent',
		file: 'src/js/items/Stack.js',
		from: 'contentItem = this.layoutManager._$normalizeContentItem( contentItem, this );\n\t\tlm.items.AbstractContentItem.prototype.addChild',
		to: 'contentItem = this.layoutManager._$normalizeContentItem( contentItem, this.parent );\n\t\tlm.items.AbstractContentItem.prototype.addChild',
		specs: [ TM + 'adds a child to the stack' ]
	},
	{
		id: 'stack-empty-init',
		file: 'src/js/items/Stack.js',
		from: 'if( this.contentItems.length > 0 ) {\n\t\t\tinitialItem',
		to: 'if( this.contentItems.length >= 0 ) {\n\t\t\tinitialItem',
		specs: [ E + 'Creates an initial layout' ]
	},
	{
		id: 'row-flag',
		file: 'src/js/items/RowOrColumn.js',
		from: 'this.isRow = !isColumn;',
		to: 'this.isRow = isColumn;',
		specs: [ E + 'can manipulate the layout tree with an empty item present' ]
	},
	{
		id: 'stack-drop-direction',
		file: 'src/js/items/Stack.js',
		from: 'type = isVertical ? \'column\' : \'row\';\n\t\t\trowOrColumn',
		to: 'type = isVertical ? \'row\' : \'column\';\n\t\t\trowOrColumn',
		specs: [ D + 'creates a new components if dragged', DD + 'creates a new components if dragged' ]
	},

	/*
	 * Controls
	 */
	{
		id: 'header-selectable',
		file: 'src/js/controls/Header.js',
		from: 'if( this.layoutManager.config.settings.selectionEnabled === true ) {',
		to: 'if( this.layoutManager.config.settings.selectionEnabled !== true ) {',
		specs: [ DS + 'clicks a header, but nothing happens since enableSelection == false' ]
	},
	{
		id: 'header-button-label-injection',
		file: 'src/js/controls/HeaderButton.js',
		from: 'this.element = $( \'<li></li>\' ).attr( { \'class\': cssClass, title: label } );',
		to: 'this.element = $( \'<li title="\' + label + \'"></li>\' ).attr( { \'class\': cssClass } );',
		specs: [ HB + 'stores a malicious label as a literal title attribute without injecting markup' ]
	},
	{
		id: 'header-button-class-injection',
		file: 'src/js/controls/HeaderButton.js',
		from: 'this.element = $( \'<li></li>\' ).attr( { \'class\': cssClass, title: label } );',
		to: 'this.element = $( \'<li class="\' + cssClass + \'"></li>\' ).attr( { title: label } );',
		specs: [ HB + 'stores a malicious cssClass as a literal class attribute without injecting markup' ]
	},
	{
		id: 'header-button-attrs',
		file: 'src/js/controls/HeaderButton.js',
		from: '{ \'class\': cssClass, title: label }',
		to: '{ \'class\': label, title: cssClass }',
		specs: [ HB + 'applies a normal label and cssClass correctly' ]
	},
	{
		id: 'tab-reorder-check',
		file: 'src/js/controls/Tab.js',
		from: 'contentItem.config.reorderEnabled === true',
		to: 'contentItem.config.reorderEnabled !== undefined',
		specs: [ TB + 'attached a drag listener to the first tab' ]
	},
	{
		id: 'tab-initial-title',
		file: 'src/js/controls/Tab.js',
		from: 'this.setTitle( contentItem.config.title );',
		to: '',
		specs: [ TI + 'displays the title on the tab' ]
	},
	{
		id: 'tab-title-listener',
		file: 'src/js/controls/Tab.js',
		from: 'this.contentItem.on( \'titleChanged\', this.setTitle, this );',
		to: 'this.contentItem.on( \'titleChange\', this.setTitle, this );',
		specs: [ TI + 'updates the title when calling setTitle on the item' ]
	},
	{
		id: 'tab-title-strip-tags',
		file: 'src/js/controls/Tab.js',
		from: 'this.element.attr( \'title\', lm.utils.stripTags( title ) );',
		to: 'this.element.attr( \'title\', title );',
		specs: [ TI + 'supports html in title' ]
	},

	/*
	 * EventEmitter
	 */
	{
		id: 'emitter-trigger-alias',
		file: EMITTER,
		from: 'this.trigger = this.emit;',
		to: 'this.triggr = this.emit;',
		specs: [ EE + 'is possible to inherit from EventEmitter' ]
	},
	{
		id: 'emitter-args',
		file: EMITTER,
		from: 'subs[ i ].fn.apply( ctx, args );',
		to: 'subs[ i ].fn.apply( ctx, [] );',
		specs: [ EE + 'notifies callbacks' ]
	},
	{
		id: 'emitter-all-event-name',
		file: EMITTER,
		from: 'args.unshift( sEvent );',
		to: '',
		specs: [ EE + 'triggers an \'all\' event' ]
	},
	{
		id: 'emitter-context',
		file: EMITTER,
		from: 'ctx = subs[ i ].ctx || {};',
		to: 'ctx = {};',
		specs: [ EE + 'triggers sets the right context' ]
	},
	{
		id: 'emitter-unbind-noop',
		file: EMITTER,
		from: 'this._mSubscriptions[ sEvent ].splice( i, 1 );',
		to: 'this._mSubscriptions[ sEvent ].splice( i, 0 );',
		specs: [ EE + 'unbinds events', EE + 'unbinds all events if no context is provided' ]
	},
	{
		id: 'emitter-unbind-one',
		file: EMITTER,
		from: 'this._mSubscriptions[ sEvent ].splice( i, 1 );',
		to: 'this._mSubscriptions[ sEvent ].splice( i, 2 );',
		specs: [ EE + 'unbinds events for a specific context only' ]
	},
	{
		id: 'emitter-unbind-nothing',
		file: EMITTER,
		from: 'if( bUnbound === false ) {',
		to: 'if( bUnbound === null ) {',
		specs: [ EE + 'throws an exception when trying to unsubscribe for a non existing method' ]
	},
	{
		id: 'emitter-on-callback-check',
		file: EMITTER,
		from: 'if( !lm.utils.isFunction( fCallback ) ) {',
		to: 'if( fCallback === null ) {',
		specs: [ EE + 'throws an exception when attempting to bind a non-function' ]
	},

	/*
	 * ConfigMinifier
	 */
	{
		id: 'minify-static',
		file: LM,
		from: 'lm.LayoutManager.minifyConfig = function( config ) {',
		to: 'lm.LayoutManager.minifyConfg = function( config ) {',
		specs: [ MN + 'has minification methods' ]
	},
	{
		id: 'minify-copies',
		file: MINIFIER,
		from: 'return min;',
		to: 'return config;',
		specs: [ MN + 'doesn\'t manipulate the original config' ]
	},
	{
		id: 'unminify-key-radix',
		file: MINIFIER,
		from: 'return dictionary[ parseInt( value, 36 ) ];',
		to: 'return dictionary[ parseInt( value, 10 ) ];',
		specs: [ MN + 'minifies and unminifies the config directly' ]
	},
	{
		id: 'minify-single-char',
		file: MINIFIER,
		from: 'return \'___\' + value;',
		to: 'return value;',
		specs: [ MN + 'doesn\'t change single character keys and values' ]
	},
	{
		id: 'minify-key-table',
		file: MINIFIER,
		from: '\'labels\',\n\t\t\'close\',',
		to: '\'labels\',\n\t\t\'closed\',',
		specs: [ MN + 'works with existing minified configurations' ]
	},

	/*
	 * filterXss
	 */
	{
		id: 'xss-tags',
		file: 'src/js/utils/utils.js',
		from: '.replace( />/g, \'&gt;\' )',
		to: '.replace( />/, \'&gt;\' )',
		specs: [ X + 'escapes tags' ]
	},
	{
		id: 'xss-javascript',
		file: 'src/js/utils/utils.js',
		from: '.replace( /javascript/gi, ',
		to: '.replace( /javascrypt/gi, ',
		specs: [ X + 'escapes javascript urls' ]
	},
	{
		id: 'xss-expression',
		file: 'src/js/utils/utils.js',
		from: '.replace( /expression/gi, ',
		to: '.replace( /expresion/gi, ',
		specs: [ X + 'escapes expression statements' ]
	},
	{
		id: 'xss-onload-case',
		file: 'src/js/utils/utils.js',
		from: '.replace( /onload/gi, ',
		to: '.replace( /onload/g, ',
		specs: [ X + 'escapes onload statements' ]
	},
	{
		id: 'xss-onerror-case',
		file: 'src/js/utils/utils.js',
		from: '.replace( /onerror/gi, ',
		to: '.replace( /onerror/g, ',
		specs: [ X + 'escapes onerror statements' ]
	}
];

/*
 * Vacuous specs: they have no assertion that any mutation can make fail. Most
 * have no assertions at all and only check that a step doesn't throw; the two
 * "registers listeners" specs assert that listeners haven't been called before
 * attaching them, which nothing can break. They are ported as-is and listed in
 * the PR for discussion. For these specs alone, a thrown error counts as a kill.
 * (Specs that only create a layout with testTools.createLayout aren't here:
 * its queued wait for the layout to initialise is a check that can fail.)
 */
exports.vacuous = [
	C + 'creates a layout',
	C + 'registers listeners',
	C + 'destroys the layout',
	DD + 'destroys the layout',
	DS + 'destroys the layout',
	D + 'destroys the layout',
	E + 'destroys the layout',
	ES + 'destroys the layout',
	EB + 'destroys the layout',
	ID + 'destroys the layout',
	IC + 'creates a layout',
	IC + 'registeres listeners',
	IC + 'destroys the layout',
	PO + 'destroys the layout',
	TB + 'destroys the layout',
	TI + 'destroys the layout'
];

/*
 * Describes whose specs don't share state: each creates what it tests. In
 * every other describe, a credited spec must be the first to fail, so that
 * its failure isn't left over from an earlier spec.
 */
exports.independentDescribes = [
	'create-config.tests.js > It creates and extends config segments correctly',
	'create-from-config-tests.js > Creates the right structure based on the provided config',
	'event-emitter-tests.js > the EventEmitter works',
	'header-button-tests.js > HeaderButton does not allow HTML injection via its label or cssClass',
	'minifier-tests.js > Can minify and unminify configuration objects',
	'popin-button-tests.js > the pop-in button does not allow HTML injection via its label',
	'xss_tests.js > Basic XSS filtering is applied'
];

/*
 * Describes where the first N specs set up a layout and the rest only query
 * it. A credited query spec needs the setup specs to pass, but an earlier
 * query failing can't affect it.
 */
exports.readOnlyAfterSetup = {
	'selector-tests.js > it is possible to select elements from the tree using selectors': 1
};

/*
 * Mutations for which Karma and Vitest may fail different sets of specs.
 * Everywhere else they must fail exactly the same specs.
 */
exports.allowedDifferences = {
	// Karma ran every file in one page, with lm as a global, so the
	// EventEmitter specs still pass there. Vitest loads each file in its own
	// page, and without GoldenLayout every spec that uses it fails.
	'export-global': 'lm was a global under Karma',
	// Under Karma, layouts that a failed spec left behind stay in the shared
	// page, so later files that count .lm_goldenlayout elements (initialisation
	// tests) or drag onto the page also fail. Vitest isolates each file.
	'destroy-items': 'leftover layouts leak across files under Karma',
	'items-by-property': 'leftover layouts leak across files under Karma',
	'stack-empty-init': 'leftover layouts leak across files under Karma',
	// destroy() does nothing for a layout that never initialised.
	'init-flag-missing': 'leftover layouts leak across files under Karma',
	// This mutates the shared default config. Under Karma that leaks into every
	// later file in the page; Vitest isolates each file.
	'create-config-copies': 'mutated default config leaks across files under Karma',
	// Karma only sometimes catches this one (see the mutation).
	'container-state-event': 'timing-dependent under Karma'
};

/* eslint-env node */
/**
 * Builds the distributable files:
 *
 * 1. build/ns.js, the `lm` namespace object, from the directories under
 *    src/js, and index.html (the manual dev harness) from index.hbs.
 * 2. src/css/*.css (with source maps) from src/less/*.less.
 * 3. dist/goldenlayout.js: build/ns.js and the src/js files, joined in order
 *    and wrapped in `(function($){...})(window.$);`.
 * 4. dist/goldenlayout.min.js, minified with UglifyJS.
 *
 * Run with `npm run build`. vitest.config.mjs uses `concatenated()` to build
 * the library in memory for the tests.
 */
'use strict';

var fs = require( 'fs' );
var path = require( 'path' );

var root = path.resolve( __dirname, '..' );
var jsPath = path.join( root, 'src/js' );

// These are referenced by other files at load time, so they come first.
var firstSources = [ 'utils/utils.js', 'utils/EventEmitter.js', 'utils/DragListener.js' ];

function read( file ) {
	// Strip any byte order mark.
	return fs.readFileSync( file, 'utf8' ).replace( /^﻿/, '' );
}

// Every file and directory under `dir`, relative to it, using '/'.
function walk( dir, prefix ) {
	var result = { files: [], directories: [] };
	fs.readdirSync( dir, { withFileTypes: true } ).forEach( function( entry ) {
		var relative = prefix + '/' + entry.name;
		if( entry.isDirectory() ) {
			result.directories.push( relative );
			var inner = walk( path.join( dir, entry.name ), relative );
			result.files = result.files.concat( inner.files );
			result.directories = result.directories.concat( inner.directories );
		} else {
			result.files.push( relative );
		}
	} );
	return result;
}

function compare( a, b ) {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The library's source files, in concatenation order, relative to the repo
 * root: build/ns.js, then firstSources, then the rest of src/js in path
 * order, ignoring case.
 */
function sources() {
	var rest = walk( jsPath, '' ).files
		.filter( function( file ) { return /\.js$/.test( file ); } )
		.map( function( file ) { return file.slice( 1 ); } )
		.filter( function( file ) { return firstSources.indexOf( file ) === -1; } )
		.sort( function( a, b ) { return a.localeCompare( b, 'en' ); } );
	return [ 'build/ns.js' ].concat( firstSources.concat( rest ).map( function( file ) {
		return 'src/js/' + file;
	} ) );
}

/** dist/goldenlayout.js, built from the files on disk. */
function concatenated() {
	return '(function($){' + sources().map( function( file ) {
		return read( path.join( root, file ) );
	} ).join( '\n' ) + '})(window.$);';
}

function buildNamespaceAndIndex() {
	var handlebars = require( 'handlebars' );
	handlebars.registerHelper( 'toJSON', function( input ) {
		return new handlebars.SafeString( JSON.stringify( input ) );
	} );

	// The dev harness loads these two before the rest.
	var earlyFiles = [ '/utils/utils.js', '/items/AbstractContentItem.js' ];
	var tree = walk( jsPath, '' );
	var files = earlyFiles.concat( tree.files.filter( function( file ) {
		return earlyFiles.indexOf( file ) === -1;
	} ).sort( compare ) );
	var directories = {};
	tree.directories.sort( compare ).forEach( function( dir ) {
		var node = directories;
		dir.split( '/' ).forEach( function( segment ) {
			if( segment.length === 0 ) return;
			node = node[ segment ] = node[ segment ] || {};
		} );
	} );

	fs.writeFileSync( path.join( root, 'build/ns.js' ), 'var lm=' + JSON.stringify( directories ) + ';' );
	// index.hbs starts with a byte order mark, which index.html keeps.
	var template = handlebars.compile( fs.readFileSync( path.join( root, 'index.hbs' ), 'utf8' ) );
	fs.writeFileSync( path.join( root, 'index.html' ), template( { files: files, directories: directories } ) );
}

function buildCss() {
	var less = require( 'less' );
	// Paths are relative to the repo root, as they appear in the source maps.
	var lessFiles = fs.readdirSync( path.join( root, 'src/less' ) ).filter( function( file ) {
		return /\.less$/.test( file );
	} ).sort( compare );
	return lessFiles.reduce( function( previous, file ) {
		return previous.then( function() {
			var src = 'src/less/' + file;
			var dest = 'src/css/' + file.replace( /\.less$/, '.css' );
			return less.render( read( path.join( root, src ) ), {
				filename: src,
				paths: [ path.dirname( src ) ],
				compress: true,
				optimization: 2,
				sourceMap: { sourceMapFilename: dest + '.map' }
			} ).then( function( output ) {
				fs.writeFileSync( path.join( root, dest + '.map' ), output.map );
				fs.writeFileSync( path.join( root, dest ), output.css );
			} );
		} );
	}, Promise.resolve() );
}

function buildDist() {
	var UglifyJS = require( 'uglify-js' );
	var code = concatenated();
	var result = UglifyJS.minify( { 'goldenlayout.js': code }, { compress: {}, mangle: { reserved: [] } } );
	if( result.error ) {
		throw result.error;
	}
	fs.mkdirSync( path.join( root, 'dist' ), { recursive: true } );
	fs.writeFileSync( path.join( root, 'dist/goldenlayout.js' ), code );
	fs.writeFileSync( path.join( root, 'dist/goldenlayout.min.js' ), result.code );
}

exports.sources = sources;
exports.concatenated = concatenated;

if( require.main === module ) {
	// less resolves relative paths against the working directory.
	process.chdir( root );
	buildNamespaceAndIndex();
	buildCss().then( buildDist ).catch( function( error ) {
		console.error( error );
		process.exitCode = 1;
	} );
}

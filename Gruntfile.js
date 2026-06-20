/* global require */
module.exports = function( grunt ) {
	grunt.registerTask( 'build', require( './build/task' ) );

	var sources = [
		'./build/ns.js',
		'./src/js/utils/utils.js',
		'./src/js/utils/EventEmitter.js',
		'./src/js/utils/DragListener.js',
		'./src/js/**/*.js'
	];

	// Project configuration.
	grunt.initConfig( {
			pkg: grunt.file.readJSON( 'package.json' ),

			/***********************
			 * WATCH
			 ***********************/
			watch: {
				tasks: [ 'dist', 'test' ],
				files: [ './src/**', './test/**' ],
				options: { livereload: 5051 },
			},

			/***********************
			 * RELEASE
			 ***********************/
			release: {
				options: {
					additionalFiles: [ 'bower.json' ],
					beforeRelease: [ 'less', 'concat', 'uglify' ],
					tagName: 'v<%= version %>',
					github: {
						repo: 'deepstreamIO/golden-layout',
						accessTokenVar: 'GITHUB_ACCESS_TOKEN'
					}
				}
			},
			/***********************
			 * CONCAT
			 ***********************/
			concat: {
				dist: {
					options: {
						banner: '(function($){',
						footer: '})(window.$);'
					},
					src: sources,
					dest: 'dist/goldenlayout.js'
				}
			},

			/***********************
			 * UGLIFY
			 ***********************/
			uglify: {
				dist: {
					src: 'dist/goldenlayout.js',
					dest: 'dist/goldenlayout.min.js'
				}
			},

			/***********************
			 * KARMA
			 ***********************/
			karma: {
				unit: {
					configFile: 'karma.conf.js',
					background: true,
					singleRun: false
				}
				,
				travis: {
					configFile: 'karma.conf.js',
					singleRun: true,
					browsers: [ 'ChromeHeadlessNoSandbox' ]
				}
			},

			less: {
				development: {
					options: {
						compress: true,
						optimization: 2,
						sourceMap: true
					},
					files: [ {
						expand: true,
						flatten: true,
						src: "src/less/*.less",
						ext: ".css",
						dest: "src/css/"
					} ]
				}
			}
		}
	);

	grunt.loadNpmTasks( 'grunt-contrib-concat' );
	grunt.loadNpmTasks( 'grunt-contrib-less' );
	grunt.loadNpmTasks( 'grunt-contrib-uglify' );
	grunt.loadNpmTasks( 'grunt-contrib-watch' );
	grunt.loadNpmTasks( 'grunt-release' );
	grunt.loadNpmTasks( 'grunt-karma' );

	// Default task(s).
	grunt.registerTask( 'default', [ 'watch' ] );

	// travis support
	grunt.registerTask( 'test', [ 'karma:travis' ] );

	// distribution support
	grunt.registerTask( 'dist', [ 'build', 'less', 'concat', 'uglify' ] );
};

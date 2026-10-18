/**
 * Vitest reporter used by test/mutations/run.js. Vitest's JSON report leaves
 * out unhandled errors (e.g. thrown from an animation-frame callback) and
 * errors in describe-level hooks (beforeAll/afterAll), so this one writes
 * both to $GL_UNHANDLED_ERRORS_OUT as a JSON array of { file, message }
 * (file is the test file's name for errors in a file or its describes, and
 * null for unhandled errors).
 */
import fs from 'node:fs';
import path from 'node:path';

function describe( e ) {
	return String( e && ( e.stack || e.message ) || e );
}

export default class UnhandledErrorsReporter {
	onTestRunEnd( testModules, unhandledErrors ) {
		const out = process.env.GL_UNHANDLED_ERRORS_OUT;
		if( !out ) {
			return;
		}
		const errors = unhandledErrors.map( e => ( { file: null, message: 'unhandled error: ' + describe( e ) } ) );
		for( const testModule of testModules ) {
			const file = path.basename( testModule.moduleId );
			for( const suite of [ testModule, ...testModule.children.allSuites() ] ) {
				for( const e of suite.errors() ) {
					errors.push( { file, message: 'error in ' + ( suite.fullName || file ) + ': ' + describe( e ) } );
				}
			}
		}
		fs.writeFileSync( out, JSON.stringify( errors ) );
	}
}

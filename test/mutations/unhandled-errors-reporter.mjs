/**
 * Vitest reporter used by test/mutations/run.js. Vitest's JSON report leaves
 * out unhandled errors (e.g. thrown from an animation-frame callback), so
 * this one writes them to $GL_UNHANDLED_ERRORS_OUT as a JSON array.
 */
import fs from 'node:fs';

export default class UnhandledErrorsReporter {
	onTestRunEnd( testModules, unhandledErrors ) {
		const out = process.env.GL_UNHANDLED_ERRORS_OUT;
		if( out ) {
			fs.writeFileSync( out, JSON.stringify( unhandledErrors.map( e => ( {
				message: String( e && ( e.stack || e.message ) || e ),
				testPath: e && ( e.VITEST_TEST_PATH || e.testPath ) || null
			} ) ) ) );
		}
	}
}

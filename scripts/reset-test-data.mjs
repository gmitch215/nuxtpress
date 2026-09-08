import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// Guard, not decoration: this script deletes a directory, and the setup-flow lane needs a
// genuinely empty install on every run. Refusing anything that is not a *-test directory makes
// it structurally unable to touch the real .data dir.
const target = process.argv[2] || process.env.NUXTPRESS_DATA_DIR || '';

if (!target || !/-test$/.test(target) || target.includes('..')) {
	console.error(
		`refusing to reset "${target}": pass a project-relative directory ending in "-test"`
	);
	process.exit(1);
}

const path = resolve(process.cwd(), target);
await rm(path, { recursive: true, force: true });
console.log(`reset ${target}`);

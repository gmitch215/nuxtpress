import MCR from 'monocart-coverage-reports';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { CoverageReport } = MCR;

const root = process.cwd();
const dumpDir = path.join(root, '.v8-coverage');
const devDir = pathToFileURL(path.join(root, '.nuxt', 'dev') + path.sep).href;

if (!existsSync(dumpDir) || readdirSync(dumpDir).length === 0) {
	console.error('no V8 dumps in .v8-coverage; run `bun run test:coverage` first');
	process.exit(2);
}

const report = new CoverageReport({
	name: 'NuxtPress Server Coverage',
	outputDir: './coverage/server',
	reports: [['lcovonly', { file: 'lcov.info' }], 'console-summary'],
	sourceFilter: (source) => source.startsWith('src/'),
	sourcePath: (source) => source.replace(/^(\.\.\/)+/, '')
});

// the dev bundle ships an external sourcemap without sources, so each one is read from disk
function withSources(entry) {
	const file = fileURLToPath(entry.url);
	entry.source = readFileSync(file, 'utf8');
	const mapFile = `${file}.map`;
	if (existsSync(mapFile)) {
		const map = JSON.parse(readFileSync(mapFile, 'utf8'));
		map.sourcesContent = map.sources.map((source) => {
			const absolute = path.resolve(path.dirname(file), source);
			return existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
		});
		entry.sourceMap = map;
	}
	return entry;
}

for (const name of readdirSync(dumpDir)) {
	if (!name.endsWith('.json')) continue;
	const dump = JSON.parse(readFileSync(path.join(dumpDir, name), 'utf8'));
	const entries = dump.result.filter((entry) => entry.url.startsWith(devDir)).map(withSources);
	if (entries.length > 0) await report.add(entries);
}

await report.generate();

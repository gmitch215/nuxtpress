import { glob, readFile } from 'node:fs/promises';

// Guards against local-development config reaching the deployed Worker. nuxthub defu-merges the
// `hub.*` options into whichever storage driver it selects, so an option that only means something
// to a local fs driver can silently land in the Cloudflare binding config. A `base` on the KV
// binding prefixes every key, which reads as "all settings and analytics vanished" in production.
const CHECKS = [
	{
		name: 'KV binding has no key prefix',
		pattern: /driver:\s*"cloudflare-kv-binding"[^}]*\bbase:/,
		hint: 'hub.kv must not set `base` unless the local fs-lite driver is in use'
	},
	{
		name: 'no local data directory paths',
		pattern: /base:\s*"\.data/,
		hint: 'a `.data` path reached the bundle; check the hub.* options in nuxt.config.ts'
	}
];

const files = [];
for await (const file of glob('.output/server/**/*.mjs')) files.push(file);

if (files.length === 0) {
	console.error('no build output found under .output/server; run `bun run build` first');
	process.exit(2);
}

let failed = false;
for (const check of CHECKS) {
	const hits = [];
	for (const file of files) {
		const contents = await readFile(file, 'utf8');
		const match = contents.match(check.pattern);
		if (match) hits.push(`${file}: ${match[0].slice(0, 120)}`);
	}

	if (hits.length > 0) {
		failed = true;
		console.error(`FAIL  ${check.name}`);
		console.error(`      ${check.hint}`);
		for (const hit of hits) console.error(`      ${hit}`);
	} else {
		console.log(`ok    ${check.name}`);
	}
}

process.exit(failed ? 1 : 0);

import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { exportSubscriberPages } from '~/server/utils/subscribers';

// a leading = + - @ makes a spreadsheet read the cell as a formula
function csvCell(value: string): string {
	const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return `"${safe.replace(/"/g, '""')}"`;
}

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const encoder = new TextEncoder();
	const pages = exportSubscriberPages();
	let header = true;

	// one page at a time, so a large list never sits in memory as rows, lines and a joined string
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (header) {
				header = false;
				controller.enqueue(encoder.encode('email,status,subscribed_at,confirmed_at\n'));
				return;
			}
			const next = await pages.next();
			if (next.done) return controller.close();
			const lines = next.value.map((r) =>
				[csvCell(r.email), r.status, r.createdAt, r.confirmedAt ?? ''].join(',')
			);
			controller.enqueue(encoder.encode(`${lines.join('\n')}\n`));
		},
		cancel() {
			void pages.return(undefined);
		}
	});

	setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
	setHeader(event, 'Content-Disposition', 'attachment; filename="subscribers.csv"');
	return stream;
});

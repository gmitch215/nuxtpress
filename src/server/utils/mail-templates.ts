import type { MailMessage } from './mail';

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function singleLine(value: string): string {
	return value.replace(/[\r\n]+/g, ' ').trim();
}

function layout(siteName: string, body: string, footer: string): string {
	return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;padding:24px;">
<tr><td style="font-size:13px;color:#71717a;padding-bottom:12px;">${escapeHtml(siteName)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;">${body}</td></tr>
<tr><td style="font-size:12px;color:#71717a;padding-top:24px;border-top:1px solid #e4e4e7;">${footer}</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

function button(url: string, label: string): string {
	return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="background:#1e40af;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block;">${escapeHtml(label)}</a></p>`;
}

export function renderConfirmEmail(input: {
	siteName: string;
	confirmUrl: string;
}): Omit<MailMessage, 'to'> {
	const { siteName, confirmUrl } = input;
	return {
		subject: `Confirm your subscription to ${singleLine(siteName)}`,
		text: [
			`Confirm your subscription to ${siteName}:`,
			'',
			confirmUrl,
			'',
			'If you did not ask for this, ignore this email and you will not be subscribed.'
		].join('\n'),
		html: layout(
			siteName,
			`<p style="margin:0 0 12px;">Confirm your subscription to <strong>${escapeHtml(siteName)}</strong> to get an email when a new post is published.</p>${button(confirmUrl, 'Confirm Subscription')}`,
			'If you did not ask for this, ignore this email and you will not be subscribed.'
		)
	};
}

export function renderPostEmail(input: {
	siteName: string;
	title: string;
	excerpt: string;
	postUrl: string;
	thumbnailUrl?: string;
	unsubscribeUrl: string;
	label?: string;
}): Omit<MailMessage, 'to'> {
	const { siteName, title, excerpt, postUrl, thumbnailUrl, unsubscribeUrl } = input;
	const label = input.label ?? 'Read the Post';
	const image = thumbnailUrl
		? `<p style="margin:0 0 16px;"><img src="${escapeHtml(thumbnailUrl)}" alt="" style="max-width:100%;border-radius:6px;"></p>`
		: '';
	return {
		subject: `New post: ${singleLine(title)}`,
		text: [
			title,
			'',
			excerpt,
			'',
			`${label}: ${postUrl}`,
			'',
			`Unsubscribe: ${unsubscribeUrl}`
		].join('\n'),
		html: layout(
			siteName,
			`${image}<h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(title)}</h1><p style="margin:0;">${escapeHtml(excerpt)}</p>${button(postUrl, label)}`,
			`You get this because you subscribed to ${escapeHtml(siteName)}. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;">Unsubscribe</a>`
		)
	};
}

export function renderTestEmail(siteName: string): Omit<MailMessage, 'to'> {
	return {
		subject: `Test email from ${singleLine(siteName)}`,
		text: `This is a test email from ${siteName}. Your mail settings work.`,
		html: layout(
			siteName,
			'<p style="margin:0;">This is a test email. Your mail settings work.</p>',
			'Sent from the NuxtPress admin settings.'
		)
	};
}

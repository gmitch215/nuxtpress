<template>
	<div class="flex flex-col gap-4 rounded border border-default p-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Email Delivery</h2>
				<p class="text-sm text-muted">
					Subscribers get an email when you publish a post with Email Subscribers checked.
				</p>
			</div>
			<UBadge
				:color="data?.status.configured ? 'success' : 'neutral'"
				variant="subtle"
			>
				{{ data?.status.configured ? 'Ready' : 'Not Configured' }}
			</UBadge>
		</div>

		<UAlert
			v-if="data && !data.status.configured && data.status.reason"
			color="warning"
			variant="subtle"
			:description="data.status.reason"
		/>
		<UAlert
			v-if="data?.envOverride"
			color="info"
			variant="subtle"
			description="Delivery is configured by environment variables, so the transport fields below are ignored."
		/>
		<UAlert
			v-if="data && !data.secretsReadable"
			color="error"
			variant="subtle"
			description="Saved credentials cannot be read because the session secret changed. Enter them again."
		/>

		<form
			v-if="data"
			class="flex flex-col gap-4"
			@submit.prevent="save"
		>
			<UFormField label="Enable Subscriptions">
				<USwitch v-model="form.enabled" />
			</UFormField>

			<div class="grid gap-4 sm:grid-cols-2">
				<UFormField label="From Address">
					<UInput
						v-model="form.fromAddress"
						type="email"
						placeholder="blog@example.com"
						class="w-full"
					/>
				</UFormField>
				<UFormField label="From Name">
					<UInput
						v-model="form.fromName"
						placeholder="My Blog"
						class="w-full"
					/>
				</UFormField>
			</div>

			<UFormField label="Transport">
				<USelect
					v-model="form.transport"
					:items="transportOptions"
					class="w-full"
				/>
			</UFormField>

			<p
				v-if="form.transport === 'binding'"
				class="text-sm text-muted"
			>
				Uses the <code>EMAIL</code> send_email binding.
				{{
					data.bindingAvailable
						? 'The binding is available.'
						: 'The binding is not available in this runtime.'
				}}
			</p>

			<div
				v-if="form.transport === 'cloudflare'"
				class="grid gap-4 sm:grid-cols-2"
			>
				<UFormField label="Account ID">
					<UInput
						v-model="form.cloudflareAccountId"
						placeholder="32 character account ID"
						class="w-full"
					/>
				</UFormField>
				<UFormField
					label="API Token"
					:help="data.hasCloudflareApiToken ? 'A token is saved. Leave blank to keep it.' : ''"
				>
					<UInput
						v-model="form.cloudflareApiToken"
						type="password"
						autocomplete="new-password"
						class="w-full"
					/>
				</UFormField>
			</div>

			<div
				v-if="form.transport === 'smtp'"
				class="grid gap-4 sm:grid-cols-2"
			>
				<UFormField label="Host">
					<UInput
						v-model="form.smtpHost"
						placeholder="smtp.example.com"
						class="w-full"
					/>
				</UFormField>
				<UFormField label="Port">
					<UInput
						v-model.number="form.smtpPort"
						type="number"
						class="w-full"
					/>
				</UFormField>
				<UFormField label="Security">
					<USelect
						v-model="form.smtpTls"
						:items="tlsOptions"
						class="w-full"
					/>
				</UFormField>
				<UFormField label="Username">
					<UInput
						v-model="form.smtpUsername"
						autocomplete="off"
						class="w-full"
					/>
				</UFormField>
				<UFormField
					label="Password"
					:help="data.hasSmtpPassword ? 'A password is saved. Leave blank to keep it.' : ''"
				>
					<UInput
						v-model="form.smtpPassword"
						type="password"
						autocomplete="new-password"
						class="w-full"
					/>
				</UFormField>
			</div>

			<p
				v-if="error"
				class="text-sm text-red-500"
			>
				{{ error }}
			</p>

			<div class="flex flex-wrap items-end gap-2">
				<UButton
					type="submit"
					color="primary"
					:loading="saving"
				>
					Save
				</UButton>
				<UInput
					v-model="testTo"
					type="email"
					placeholder="test@example.com"
					class="w-56"
				/>
				<UButton
					color="neutral"
					variant="outline"
					:loading="testing"
					:disabled="!testTo"
					@click="sendTest"
				>
					Send Test
				</UButton>
				<UButton
					color="neutral"
					variant="outline"
					:loading="draining"
					:disabled="!data.outbox.pending"
					@click="drain"
				>
					Send Queue Now ({{ data.outbox.pending }})
				</UButton>
			</div>
			<p
				v-if="data.outbox.failed"
				class="text-sm text-red-500"
			>
				{{ data.outbox.failed }} email(s) failed after 3 attempts.
			</p>
		</form>
	</div>
</template>

<script setup lang="ts">
import type { MailSettings } from '~/shared/types';

const emit = defineEmits<{ saved: [] }>();

const toast = useToast();
const { data, refresh } = await useFetch<MailSettings>('/api/admin/mail', {
	credentials: 'include'
});

const transportOptions = [
	{ label: 'Cloudflare Email Binding', value: 'binding' },
	{ label: 'Cloudflare Email API', value: 'cloudflare' },
	{ label: 'Custom SMTP', value: 'smtp' }
];
const tlsOptions = [
	{ label: 'STARTTLS', value: 'starttls' },
	{ label: 'Implicit TLS', value: 'implicit' },
	{ label: 'None', value: 'off' }
];

const form = reactive({
	enabled: false,
	transport: 'binding' as MailSettings['transport'],
	fromAddress: '',
	fromName: '',
	cloudflareAccountId: '',
	cloudflareApiToken: '',
	smtpHost: '',
	smtpPort: 587,
	smtpTls: 'starttls' as MailSettings['smtpTls'],
	smtpUsername: '',
	smtpPassword: ''
});

function load(value: MailSettings | null | undefined) {
	if (!value) return;
	Object.assign(form, {
		enabled: value.enabled,
		transport: value.transport,
		fromAddress: value.fromAddress,
		fromName: value.fromName,
		cloudflareAccountId: value.cloudflareAccountId,
		cloudflareApiToken: '',
		smtpHost: value.smtpHost,
		smtpPort: value.smtpPort,
		smtpTls: value.smtpTls,
		smtpUsername: value.smtpUsername,
		smtpPassword: ''
	});
}
load(data.value);

const saving = ref(false);
const testing = ref(false);
const draining = ref(false);
const testTo = ref('');
const error = ref('');

function messageOf(err: any, fallback: string) {
	return err?.data?.statusMessage || err?.statusMessage || fallback;
}

async function save() {
	saving.value = true;
	error.value = '';
	try {
		await $fetch('/api/admin/mail', {
			method: 'POST',
			credentials: 'include',
			body: {
				...form,
				cloudflareApiToken: form.cloudflareApiToken || undefined,
				smtpPassword: form.smtpPassword || undefined,
				smtpPort: Number(form.smtpPort) || 587
			}
		});
		await refresh();
		load(data.value);
		toast.add({ title: 'Mail Settings Saved', color: 'success', icon: 'mdi:check' });
		emit('saved');
	} catch (err) {
		error.value = messageOf(err, 'Could not save mail settings');
	} finally {
		saving.value = false;
	}
}

async function sendTest() {
	testing.value = true;
	try {
		await $fetch('/api/admin/mail/test', {
			method: 'POST',
			credentials: 'include',
			body: { to: testTo.value }
		});
		toast.add({ title: 'Test Email Sent', color: 'success', icon: 'mdi:email-check' });
	} catch (err) {
		toast.add({
			title: 'Test Failed',
			description: messageOf(err, 'Could not send the test email'),
			color: 'error',
			icon: 'mdi:alert-circle'
		});
	} finally {
		testing.value = false;
	}
}

async function drain() {
	draining.value = true;
	try {
		const result = await $fetch<{ sent: number; failed: number; remaining: number }>(
			'/api/admin/mail/drain',
			{ method: 'POST', credentials: 'include' }
		);
		toast.add({
			title: `Sent ${result.sent}`,
			description: `${result.remaining} left in the queue`,
			color: 'success',
			icon: 'mdi:email-fast'
		});
		await refresh();
	} catch (err) {
		toast.add({
			title: 'Send Failed',
			description: messageOf(err, 'Could not send the queue'),
			color: 'error',
			icon: 'mdi:alert-circle'
		});
	} finally {
		draining.value = false;
	}
}
</script>

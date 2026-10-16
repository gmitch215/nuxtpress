<template>
	<form
		class="flex w-full max-w-sm flex-col gap-2"
		@submit.prevent="submit"
	>
		<label
			:for="inputId"
			class="text-xs text-gray-400 sm:text-sm"
		>
			Get New Posts by Email
		</label>
		<div class="flex gap-2">
			<UInput
				:id="inputId"
				v-model="email"
				type="email"
				name="email"
				placeholder="you@example.com"
				autocomplete="email"
				required
				:disabled="loading || done"
				size="sm"
				class="flex-1"
			/>
			<input
				v-model="website"
				type="text"
				name="website"
				tabindex="-1"
				autocomplete="off"
				aria-hidden="true"
				class="hidden"
			/>
			<UButton
				type="submit"
				size="sm"
				color="primary"
				:loading="loading"
				:disabled="done"
			>
				Subscribe
			</UButton>
		</div>
		<p
			aria-live="polite"
			class="min-h-4 text-xs"
			:class="error ? 'text-red-400' : 'text-gray-400'"
		>
			{{ error || (done ? 'Check your email to confirm your subscription.' : '') }}
		</p>
	</form>
</template>

<script setup lang="ts">
const inputId = useId();
const email = ref('');
const website = ref('');
const loading = ref(false);
const done = ref(false);
const error = ref('');

async function submit() {
	loading.value = true;
	error.value = '';
	try {
		await $fetch('/api/subscribers/subscribe', {
			method: 'POST',
			body: { email: email.value, website: website.value }
		});
		done.value = true;
	} catch (err: any) {
		error.value =
			err?.data?.statusMessage || err?.statusMessage || 'Could not subscribe, try again';
	} finally {
		loading.value = false;
	}
}
</script>

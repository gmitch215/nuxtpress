<template>
	<div class="w-full max-w-md mx-auto p-6 rounded-lg shadow-md">
		<div
			v-if="success"
			class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
		>
			Successfully logged in!
		</div>

		<div
			v-if="error"
			class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded"
		>
			{{ error }}
		</div>

		<div class="space-y-4">
			<div>
				<UInput
					id="password"
					v-model="password"
					type="password"
					placeholder="Enter admin password"
					class="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					:disabled="loading || success"
					@keypress="handleKeyPress"
				/>
			</div>

			<UButton
				icon="mdi:account-lock-open"
				class="w-full py-2 px-4 font-semibold rounded-md transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
				:disabled="loading || success"
				@click="handleLogin"
			>
				<span v-if="loading">Logging in...</span>
				<span v-else-if="success">Logged In</span>
				<span v-else>Login</span>
			</UButton>
		</div>
	</div>
</template>

<script setup lang="ts">
const { login } = useLogin();

const password = ref('');
const loading = ref(false);
const error = ref('');
const success = ref(false);

const emit = defineEmits<{
	success: [];
}>();

const handleLogin = async () => {
	if (!password.value) {
		error.value = 'Password is required';
		return;
	}

	loading.value = true;
	error.value = '';

	try {
		const result = await login(password.value);

		if (result.ok) {
			success.value = true;
			error.value = '';
			emit('success');
		} else {
			error.value = 'Invalid password';
		}
	} catch (err: any) {
		if (err.statusCode === 401) {
			error.value = 'Invalid password';
		} else {
			error.value = 'An error occurred. Please try again.';
		}
	} finally {
		loading.value = false;
	}
};

const handleKeyPress = (e: KeyboardEvent) => {
	if (e.key === 'Enter') {
		handleLogin();
	}
};
</script>

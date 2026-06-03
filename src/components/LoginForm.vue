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
					id="username"
					v-model="username"
					type="text"
					autocomplete="username"
					placeholder="Username"
					class="w-full"
					:disabled="loading || success"
					@keypress="handleKeyPress"
				/>
			</div>
			<div>
				<UInput
					id="password"
					v-model="password"
					type="password"
					autocomplete="current-password"
					placeholder="Password"
					class="w-full"
					:disabled="loading || success"
					@keypress="handleKeyPress"
				/>
			</div>

			<UButton
				icon="mdi:account-lock-open"
				class="w-full py-2 px-4 font-semibold"
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

const username = ref('admin');
const password = ref('');
const loading = ref(false);
const error = ref('');
const success = ref(false);

const emit = defineEmits<{ success: [] }>();

const handleLogin = async () => {
	if (!username.value || !password.value) {
		error.value = 'Username and password are required';
		return;
	}

	loading.value = true;
	error.value = '';

	try {
		const result = await login({ username: username.value.trim(), password: password.value });
		if (result.ok) {
			success.value = true;
			emit('success');
		} else {
			error.value = 'Invalid credentials';
		}
	} catch (err: any) {
		const status = err?.statusCode;
		if (status === 401) {
			error.value = 'Invalid credentials';
		} else if (status === 400) {
			error.value = err?.data?.statusMessage || err?.statusMessage || 'Missing credentials';
		} else {
			error.value =
				err?.data?.statusMessage || err?.statusMessage || 'An error occurred. Please try again.';
		}
	} finally {
		loading.value = false;
	}
};

const handleKeyPress = (e: KeyboardEvent) => {
	if (e.key === 'Enter') handleLogin();
};
</script>

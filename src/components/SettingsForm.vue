<template>
	<div
		v-if="initialLoading"
		class="flex items-center justify-center p-8"
	>
		<div class="flex flex-col items-center gap-2">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			<p class="text-sm text-gray-600">Loading settings...</p>
		</div>
	</div>
	<UForm
		v-else
		:schema="settingsSchema"
		:state="state"
		class="space-y-4"
		@submit="handleSubmit"
	>
		<div
			v-if="error"
			class="p-4 bg-red-100 border border-red-400 text-red-700 rounded"
		>
			{{ error }}
		</div>

		<UFormField
			label="Site Name"
			name="name"
			class="min-w-60 w-3/5"
		>
			<UInput
				v-model="state.name"
				placeholder="Enter site name"
				class="w-full"
				:disabled="loading"
			/>
		</UFormField>

		<UFormField
			label="Description"
			name="description"
			class="w-4/5"
			help="Maximum 160 characters, shown in the navigation bar"
		>
			<UTextarea
				v-model="state.description"
				placeholder="Enter site description"
				class="w-full"
				:rows="3"
				:disabled="loading"
			/>
		</UFormField>

		<UFormField
			label="Bio"
			name="bio"
			class="w-4/5"
			help="A short bio about yourself (maximum 500 characters) shown on the about page"
		>
			<UTextarea
				v-model="state.bio"
				placeholder="This is my NuxtPress blog where I share my thoughts..."
				class="w-full"
				:rows="4"
				:disabled="loading"
			/>
		</UFormField>

		<UFormField
			label="Author"
			name="author"
			help="Name of the blog author"
			class="min-w-60 w-3/5"
		>
			<UInput
				v-model="state.author"
				placeholder="Enter your name (the author)"
				class="w-full"
				:disabled="loading"
			/>
		</UFormField>

		<UFormField
			label="Theme Color"
			name="themeColor"
			help="Hex color code (e.g., #3B82F6)"
		>
			<div class="flex gap-2 items-center">
				<UInput
					v-model="state.themeColor"
					placeholder="#3B82F6"
					class="w-40"
					:disabled="loading"
				/>
				<input
					type="color"
					v-model="state.themeColor"
					class="h-10 w-20 rounded border cursor-pointer"
					:disabled="loading"
				/>
			</div>
		</UFormField>

		<UFormField
			label="Favicon (ICO)"
			name="favicon"
			help="Upload an ICO file, paste a URL, or enter a relative path (e.g., /favicon.ico)"
		>
			<div class="space-y-2">
				<UInput
					v-model="state.favicon"
					placeholder="https://example.com/favicon.ico or /favicon.ico"
					class="w-full"
					:disabled="loading || !!faviconFile"
				/>

				<UFileUpload
					v-model="faviconFile"
					accept=".ico,image/x-icon"
					label="Upload ICO Favicon"
					class="min-w-100"
					:disabled="loading"
				/>

				<div
					v-if="faviconPreview || (state.favicon && !faviconFile)"
					class="flex items-center gap-2"
				>
					<img
						:src="faviconPreview || state.favicon"
						alt="Favicon preview"
						class="w-8 h-8 rounded border"
					/>
					<UButton
						icon="mdi:close"
						color="error"
						size="xs"
						@click="clearFavicon"
					>
						Remove
					</UButton>
				</div>
			</div>
		</UFormField>

		<UFormField
			label="Favicon PNG"
			name="faviconPng"
			help="Upload a PNG image, paste a URL, or enter a relative path (e.g., /favicon.png)"
		>
			<div class="space-y-2">
				<UInput
					v-model="state.faviconPng"
					placeholder="https://example.com/favicon.png or /favicon.png"
					:disabled="loading || !!faviconPngFile"
					class="min-w-100"
				/>

				<UFileUpload
					v-model="faviconPngFile"
					accept="image/png"
					label="Upload PNG Favicon"
					class="min-w-100"
					:disabled="loading"
				/>

				<div
					v-if="faviconPngPreview || (state.faviconPng && !faviconPngFile)"
					class="flex items-center gap-2"
				>
					<img
						:src="faviconPngPreview || state.faviconPng"
						alt="Favicon PNG preview"
						class="w-16 h-16 rounded border"
					/>
					<UButton
						icon="mdi:close"
						color="error"
						size="xs"
						@click="clearFaviconPng"
					>
						Remove
					</UButton>
				</div>
			</div>
		</UFormField>

		<div class="border-t pt-4">
			<h3 class="text-lg font-semibold mb-4">Social Media</h3>

			<div class="space-y-4">
				<UFormField
					label="GitHub"
					name="github"
				>
					<UInput
						v-model="state.github"
						placeholder="username or https://github.com/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:github"
					/>

					<template #help>
						<span>
							Username or full URL
							<template v-if="githubUrl">
								•
								<NuxtLink
									:to="githubUrl"
									target="_blank"
									class="text-blue-600 hover:underline"
								>
									{{ githubUrl }}
								</NuxtLink>
							</template>
						</span>
					</template>
				</UFormField>

				<UFormField
					label="Twitter/X"
					name="twitter"
				>
					<UInput
						v-model="state.twitter"
						placeholder="username or https://x.com/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:twitter"
					/>

					<template #help>
						<span>
							Username or full URL
							<template v-if="twitterUrl">
								•
								<NuxtLink
									:to="twitterUrl"
									target="_blank"
									class="text-blue-600 hover:underline"
								>
									{{ twitterUrl }}
								</NuxtLink>
							</template>
						</span>
					</template>
				</UFormField>

				<UFormField
					label="Instagram"
					name="instagram"
				>
					<UInput
						v-model="state.instagram"
						placeholder="username or https://instagram.com/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:instagram"
					/>

					<template #help>
						<span>
							Username or full URL
							<template v-if="instagramUrl">
								•
								<NuxtLink
									:to="instagramUrl"
									target="_blank"
									class="text-blue-600 hover:underline"
								>
									{{ instagramUrl }}
								</NuxtLink>
							</template>
						</span>
					</template>
				</UFormField>

				<UFormField
					label="Patreon"
					name="patreon"
				>
					<UInput
						v-model="state.patreon"
						placeholder="username or https://patreon.com/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:patreon"
					/>

					<template #help>
						<span>
							Username or full URL
							<template v-if="patreonUrl">
								•
								<NuxtLink
									:to="patreonUrl"
									target="_blank"
									class="text-blue-600 hover:underline"
								>
									{{ patreonUrl }}
								</NuxtLink>
							</template>
						</span>
					</template>
				</UFormField>

				<UFormField
					label="LinkedIn"
					name="linkedin"
				>
					<UInput
						v-model="state.linkedin"
						placeholder="username or https://linkedin.com/in/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:linkedin"
					/>
					<template #help>
						<span>
							Username or full URL
							<template v-if="linkedinUrl">
								•
								<NuxtLink
									:to="linkedinUrl"
									target="_blank"
									class="text-blue-600 hover:underline"
								>
									{{ linkedinUrl }}
								</NuxtLink>
							</template>
						</span>
					</template>
				</UFormField>

				<UFormField
					label="Discord"
					name="discord"
				>
					<UInput
						v-model="state.discord"
						placeholder="discord.gg/abc123 or discord.com/invite/abc123 or discord.com/users/1234567890"
						class="w-full"
						:disabled="loading"
						icon="mdi:discord"
					/>
					<template #help>
						<span>
							Discord invite link (discord.gg/ or discord.com/invite/) or user profile
							(discord.com/users/)
							<template v-if="discordUrl">
								•
								<NuxtLink
									:to="discordUrl"
									target="_blank"
									class="text-blue-600 hover:underline"
								>
									{{ discordUrl }}
								</NuxtLink>
							</template>
						</span>
					</template>
				</UFormField>

				<UFormField
					label="Support Email"
					name="supportEmail"
				>
					<UInput
						v-model="state.supportEmail"
						placeholder="support@example.com"
						class="w-full"
						:disabled="loading"
						icon="mdi:email-outline"
					/>
					<template #help>
						<span>
							Email address for support inquiries
							<template v-if="supportEmailUrl">
								•
								<NuxtLink
									:to="supportEmailUrl"
									target="_blank"
									class="text-blue-600 hover:underline"
								>
									{{ supportEmailUrl }}
								</NuxtLink>
							</template>
						</span>
					</template>
				</UFormField>
			</div>
		</div>

		<div class="flex gap-2 justify-end border-t pt-4">
			<UButton
				color="neutral"
				variant="outline"
				:disabled="loading"
				@click="handleCancel"
			>
				Cancel
			</UButton>
			<UButton
				type="submit"
				icon="mdi:content-save"
				:loading="loading"
				:disabled="loading"
			>
				Save Settings
			</UButton>
		</div>
	</UForm>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '#ui/types';
import { settingsSchema, type SettingsInput } from '~/shared/schemas';

const toast = useToast();
const emit = defineEmits<{
	submit: [];
	cancel: [];
}>();

const state = reactive<SettingsInput>({
	name: '',
	description: '',
	bio: '',
	author: '',
	themeColor: '',
	favicon: '',
	faviconPng: '',
	github: '',
	twitter: '',
	instagram: '',
	patreon: '',
	linkedin: '',
	discord: '',
	supportEmail: ''
});

const loading = ref(false);
const initialLoading = ref(true);
const error = ref('');
const faviconFile = ref<File | null>(null);
const faviconPreview = ref<string | null>(null);
const faviconPngFile = ref<File | null>(null);
const faviconPngPreview = ref<string | null>(null);

const isValidUrl = (value: string, allowedHosts: string[]): boolean => {
	try {
		const url = new URL(value);
		return (
			(url.protocol === 'http:' || url.protocol === 'https:') &&
			allowedHosts.some((host) => url.hostname === host || url.hostname === `www.${host}`)
		);
	} catch {
		return false;
	}
};

// Computed properties for social media URLs
const githubUrl = computed(() => {
	if (!state.github) return '';
	const allowedHosts = ['github.com'];
	if (isValidUrl(state.github, allowedHosts)) {
		return state.github;
	}
	return `https://github.com/${state.github}`;
});

const twitterUrl = computed(() => {
	if (!state.twitter) return '';
	const allowedHosts = ['x.com', 'twitter.com'];
	if (isValidUrl(state.twitter, allowedHosts)) {
		return state.twitter;
	}
	return `https://x.com/${state.twitter}`;
});

const instagramUrl = computed(() => {
	if (!state.instagram) return '';
	const allowedHosts = ['instagram.com'];
	if (isValidUrl(state.instagram, allowedHosts)) {
		return state.instagram;
	}
	return `https://instagram.com/${state.instagram}`;
});

const patreonUrl = computed(() => {
	if (!state.patreon) return '';
	const allowedHosts = ['patreon.com'];
	if (isValidUrl(state.patreon, allowedHosts)) {
		return state.patreon;
	}
	return `https://patreon.com/${state.patreon}`;
});

const linkedinUrl = computed(() => {
	if (!state.linkedin) return '';
	const allowedHosts = ['linkedin.com'];
	if (isValidUrl(state.linkedin, allowedHosts)) {
		return state.linkedin;
	}
	return `https://linkedin.com/in/${state.linkedin}`;
});

// either full link to user profile or full discord invite link
const discordUrl = computed(() => {
	if (!state.discord) return '';
	const allowedPatterns = [
		/^(https?:\/\/)?(discord\.gg\/[a-zA-Z0-9]+)$/,
		/^(https?:\/\/)?(discord\.com\/invite\/[a-zA-Z0-9]+)$/,
		/^(https?:\/\/)?(discord\.com\/users\/\d+)$/
	];

	const hasValidPattern = allowedPatterns.some((pattern) => pattern.test(state.discord ?? ''));
	if (hasValidPattern) {
		return state.discord.startsWith('http') ? state.discord : `https://${state.discord}`;
	}
	return '';
});

const supportEmailUrl = computed(() => {
	if (!state.supportEmail) return '';
	return `mailto:${state.supportEmail}`;
});

// Load current settings on mount
onMounted(async () => {
	initialLoading.value = true;
	try {
		const response = await $fetch('/api/settings');
		Object.assign(state, response);
	} catch (err: any) {
		error.value = 'Failed to load settings';
	} finally {
		initialLoading.value = false;
	}
});

// Watch for favicon ICO file changes
watch(faviconFile, async (file) => {
	if (file) {
		const reader = new FileReader();

		reader.onload = (e) => {
			const result = e.target?.result as string;
			faviconPreview.value = result;
			state.favicon = result;
		};

		reader.readAsDataURL(file);
	} else {
		faviconPreview.value = null;
	}
});

// Watch for favicon PNG file changes
watch(faviconPngFile, async (file) => {
	if (file) {
		const reader = new FileReader();

		reader.onload = (e) => {
			const result = e.target?.result as string;
			faviconPngPreview.value = result;
			state.faviconPng = result;
		};

		reader.readAsDataURL(file);
	} else {
		faviconPngPreview.value = null;
	}
});

const clearFavicon = () => {
	faviconFile.value = null;
	faviconPreview.value = null;
	state.favicon = '';
};

const clearFaviconPng = () => {
	faviconPngFile.value = null;
	faviconPngPreview.value = null;
	state.faviconPng = '';
};

const handleSubmit = async (event: FormSubmitEvent<SettingsInput>) => {
	loading.value = true;
	error.value = '';

	try {
		await $fetch('/api/settings', {
			method: 'POST',
			body: event.data
		});

		toast.add({
			title: 'Settings Updated',
			description: 'Your settings have been saved successfully.',
			icon: 'material-symbols:settings',
			color: 'info'
		});

		emit('submit');
	} catch (err: any) {
		error.value = err.message || 'An error occurred while saving settings';

		toast.add({
			title: 'Error',
			description: error.value,
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	} finally {
		loading.value = false;
	}
};

const handleCancel = () => {
	emit('cancel');
};
</script>

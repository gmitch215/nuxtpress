<template>
	<UForm
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
			help="Maximum 160 characters"
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
			label="Author"
			name="author"
			class="min-w-60 w-3/5"
		>
			<UInput
				v-model="state.author"
				placeholder="Enter author name"
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
					help="Username or full URL"
				>
					<UInput
						v-model="state.github"
						placeholder="username or https://github.com/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:github"
					/>
				</UFormField>

				<UFormField
					label="Twitter/X"
					name="twitter"
					help="Username or full URL"
				>
					<UInput
						v-model="state.twitter"
						placeholder="username or https://x.com/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:twitter"
					/>
				</UFormField>

				<UFormField
					label="Instagram"
					name="instagram"
					help="Username or full URL"
				>
					<UInput
						v-model="state.instagram"
						placeholder="username or https://instagram.com/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:instagram"
					/>
				</UFormField>

				<UFormField
					label="Patreon"
					name="patreon"
					help="Username or full URL"
				>
					<UInput
						v-model="state.patreon"
						placeholder="username or https://patreon.com/username"
						class="w-full"
						:disabled="loading"
						icon="mdi:patreon"
					/>
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
	author: '',
	themeColor: '',
	favicon: '',
	faviconPng: '',
	github: '',
	twitter: '',
	instagram: '',
	patreon: ''
});

const loading = ref(false);
const error = ref('');
const faviconFile = ref<File | null>(null);
const faviconPreview = ref<string | null>(null);
const faviconPngFile = ref<File | null>(null);
const faviconPngPreview = ref<string | null>(null);

// Load current settings on mount
onMounted(async () => {
	try {
		const response = await $fetch('/api/settings');
		Object.assign(state, response);
	} catch (err: any) {
		error.value = 'Failed to load settings';
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

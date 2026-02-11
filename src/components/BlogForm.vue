<template>
	<UForm
		:schema="blogPostSchema"
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
			label="Title"
			name="title"
			class="min-w-60 w-3/5"
			required
		>
			<UInput
				v-model="state.title"
				placeholder="Enter post title"
				class="w-full"
				:disabled="loading"
			/>
		</UFormField>

		<UFormField
			label="Slug"
			name="slug"
			class="min-w-60 w-3/5"
			required
			help="Auto-generated from title, but you can customize it"
		>
			<UInput
				v-model="state.slug"
				placeholder="post-slug"
				class="w-full"
				:disabled="loading"
			/>
		</UFormField>

		<UFormField
			label="Content"
			name="content"
			class="w-full"
			required
		>
			<BlogFormContent v-model="state.content" />
		</UFormField>
		<UFormField
			label="Thumbnail"
			name="thumbnail_url"
			help="Upload an image or paste a URL"
		>
			<div class="space-y-2">
				<UInput
					v-model="state.thumbnail_url"
					placeholder="https://example.com/image.jpg or upload below"
					:disabled="loading || !!thumbnailFile"
					class="min-w-100"
				/>

				<UFileUpload
					v-model="thumbnailFile"
					accept="image/*"
					label="Upload Thumbnail"
					class="min-w-100 min-h-50"
					:disabled="loading"
				/>

				<div
					v-if="thumbnailPreview || (state.thumbnail_url && !thumbnailFile)"
					class="relative inline-block"
				>
					<img
						:src="thumbnailPreview || state.thumbnail_url"
						alt="Thumbnail preview"
						class="max-w-xs max-h-48 rounded border"
					/>
					<UButton
						icon="mdi:close"
						color="error"
						size="xs"
						class="absolute top-2 right-2"
						@click="clearThumbnail"
					>
						Remove
					</UButton>
				</div>
			</div>
		</UFormField>

		<UFormField
			label="Tags"
			name="tags"
		>
			<div class="space-y-2">
				<div class="flex gap-2">
					<UInput
						v-model="tagInput"
						placeholder="Add a tag"
						:disabled="loading"
						@keypress.enter.prevent="addTag"
					/>
					<UButton
						icon="mdi:plus"
						color="primary"
						variant="outline"
						:disabled="loading || !tagInput.trim()"
						@click="addTag"
					>
						Add
					</UButton>
				</div>
				<div
					v-if="state.tags.length > 0"
					class="flex flex-wrap gap-2"
				>
					<UBadge
						v-for="(tag, index) in state.tags"
						:key="index"
						color="primary"
						variant="subtle"
						class="cursor-pointer"
						@click="removeTag(index)"
					>
						{{ tag }}
						<UIcon
							name="mdi:close"
							class="ml-1"
						/>
					</UBadge>
				</div>
			</div>
		</UFormField>

		<div class="flex gap-2 justify-end">
			<UButton
				color="neutral"
				variant="outline"
				:disabled="loading"
				@click="handleCancel"
			>
				Cancel
			</UButton>
			<UPopover
				v-model:open="popoverOpen"
				dismissible
			>
				<UButton
					icon="mdi:content-save-cog"
					color="neutral"
					:disabled="loading"
					:loading="loadingDraft"
					@click="handleDrafts"
				>
					Load Draft
				</UButton>

				<template #content="{ close }">
					<div class="p-4 max-h-96 overflow-y-auto min-w-64">
						<h3 class="text-lg font-semibold mb-2">Available Drafts</h3>
						<div
							v-if="!drafts || drafts.length === 0"
							class="text-gray-500 text-center py-4"
						>
							No drafts found
						</div>
						<div
							v-else
							class="space-y-2"
						>
							<div
								v-for="draft in drafts"
								:key="draft.slug"
								class="p-2 border rounded hover:opacity-70 cursor-pointer transition-opacity"
								@mouseenter="previewDraft(draft)"
								@click="
									() => {
										loadDraft(draft);
										close();
									}
								"
							>
								<div class="font-medium">
									{{ draft.title || draft.slug }}
								</div>
								<div
									v-if="draft.title && draft.slug"
									class="text-sm text-gray-500"
								>
									{{ draft.slug }}
								</div>
							</div>
						</div>
					</div>
				</template>
			</UPopover>
			<UButton
				icon="mdi:content-save-edit"
				color="secondary"
				:disabled="loading || !state.slug"
				:loading="savingDraft"
				@click="handleSave"
			>
				Save Draft
			</UButton>
			<UButton
				type="submit"
				icon="mdi:content-save"
				:loading="loading"
				:disabled="loading || !state.slug || state.content.length < 50"
			>
				{{ mode === 'edit' ? 'Update Post' : 'Create Post' }}
			</UButton>
		</div>
	</UForm>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '#ui/types';
import { blogPostSchema, type BlogPostInput } from '~/shared/schemas';

const props = defineProps<{
	initialData?: BlogPostInput & { id?: string };
	mode?: 'create' | 'edit';
}>();

const toast = useToast();
const emit = defineEmits<{
	submit: [post: BlogPostInput & { id?: string }];
	cancel: [];
}>();

const { addPost, updatePost } = useBlogPosts();
const { drafts, fetchDrafts, saveDraft } = useDrafts();

const state = reactive<BlogPostInput>({
	title: props.initialData?.title || '',
	slug: props.initialData?.slug || '',
	content: props.initialData?.content || '',
	thumbnail_url: props.initialData?.thumbnail_url || '',
	tags: props.initialData?.tags || []
});

const previousState = ref<BlogPostInput | null>(null);

const tagInput = ref('');
const loading = ref(false);
const error = ref('');
const thumbnailFile = ref<File | null>(null);
const thumbnailPreview = ref<string | null>(null);
const slugManuallyEdited = ref(false);

const generateSlug = (title: string): string => {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_]+/g, '-')
		.replace(/^-+|-+$/g, '');
};

// Track manual slug edits
watch(
	() => state.slug,
	(newSlug, oldSlug) => {
		// If the slug was changed and it's not from auto-generation
		if (oldSlug !== undefined && newSlug !== generateSlug(state.title)) {
			slugManuallyEdited.value = true;
		}
	}
);

watch(
	() => state.title,
	(newTitle) => {
		if (!slugManuallyEdited.value && props.mode !== 'edit') {
			state.slug = generateSlug(newTitle);
		}
	}
);

watch(thumbnailFile, async (file) => {
	if (file) {
		const reader = new FileReader();

		reader.onload = (e) => {
			const result = e.target?.result as string;
			thumbnailPreview.value = result;
			state.thumbnail_url = result;
		};

		reader.readAsDataURL(file);
	} else {
		thumbnailPreview.value = null;
	}
});

const addTag = () => {
	const tag = tagInput.value.trim();
	if (tag && !state.tags.includes(tag)) {
		state.tags.push(tag);
		tagInput.value = '';
	}
};

const removeTag = (index: number) => {
	state.tags.splice(index, 1);
};

const clearThumbnail = () => {
	thumbnailFile.value = null;
	thumbnailPreview.value = null;
	state.thumbnail_url = '';
};

const handleSubmit = async (event: FormSubmitEvent<BlogPostInput>) => {
	loading.value = true;
	error.value = '';

	try {
		if (props.mode === 'edit' && props.initialData?.id) {
			await updatePost({ ...event.data, id: props.initialData.id });

			toast.add({
				title: 'Post Updated',
				description: 'The blog post has been updated successfully.',
				icon: 'mdi:pencil',
				color: 'info'
			});
		} else {
			await addPost(event.data);

			toast.add({
				title: 'Post Created',
				description: 'The blog post has been created successfully.',
				icon: 'mdi:pencil-plus',
				color: 'success'
			});
		}

		emit('submit', { ...event.data, id: props.initialData?.id });
	} catch (err: any) {
		error.value = err.message || 'An error occurred while saving the post';
	} finally {
		loading.value = false;
	}
};

const handleCancel = () => {
	emit('cancel');
};

const loadingDraft = ref(false);
const draftSelected = ref(false);
const popoverOpen = ref(false);

watch(popoverOpen, (isOpen) => {
	if (!isOpen) {
		if (!draftSelected.value) {
			clearPreview();
		}
		draftSelected.value = false;
	}
});

const previewDraft = (draft: Partial<BlogPostInput>) => {
	if (!previousState.value) {
		previousState.value = { ...state };
	}

	Object.assign(state, {
		title: draft.title || '',
		slug: draft.slug || '',
		content: draft.content || '',
		thumbnail_url: draft.thumbnail_url || '',
		tags: draft.tags || []
	});
};

const clearPreview = () => {
	if (previousState.value) {
		Object.assign(state, previousState.value);
		previousState.value = null;
	}
};

const loadDraft = (draft: Partial<BlogPostInput>) => {
	const hasExistingData =
		previousState.value &&
		(previousState.value.title ||
			previousState.value.slug ||
			previousState.value.content ||
			previousState.value.thumbnail_url ||
			previousState.value.tags.length > 0);

	if (hasExistingData) {
		const confirmed = confirm('Loading this draft will replace your current form data. Continue?');
		if (!confirmed) {
			clearPreview();
			draftSelected.value = false;
			return;
		}
	}

	Object.assign(state, {
		title: draft.title || '',
		slug: draft.slug || '',
		content: draft.content || '',
		thumbnail_url: draft.thumbnail_url || '',
		tags: draft.tags || []
	});

	previousState.value = null;
	draftSelected.value = true;

	toast.add({
		title: 'Draft Loaded',
		description: 'The draft has been loaded into the form.',
		icon: 'mdi:content-save-cog',
		color: 'info'
	});
};

const handleDrafts = async () => {
	loadingDraft.value = true;
	try {
		await fetchDrafts();
	} catch (err: any) {
		toast.add({
			title: 'Error',
			description: err.message || 'Failed to load drafts',
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	} finally {
		loadingDraft.value = false;
	}
};

const savingDraft = ref(false);

const handleSave = async () => {
	savingDraft.value = true;
	try {
		await saveDraft({ ...state, slug: state.slug });

		toast.add({
			title: 'Draft Saved',
			description: 'Your draft has been saved successfully.',
			icon: 'mdi:content-save-edit',
			color: 'success'
		});
	} catch (err: any) {
		toast.add({
			title: 'Error',
			description: err.message || 'Failed to save draft',
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	} finally {
		savingDraft.value = false;
	}
};
</script>

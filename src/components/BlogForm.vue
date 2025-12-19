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
			<UButton
				type="submit"
				icon="mdi:content-save"
				:loading="loading"
				:disabled="loading || state.content.length < 50"
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

const state = reactive<BlogPostInput>({
	title: props.initialData?.title || '',
	slug: props.initialData?.slug || '',
	content: props.initialData?.content || '',
	thumbnail_url: props.initialData?.thumbnail_url || '',
	tags: props.initialData?.tags || []
});

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
</script>

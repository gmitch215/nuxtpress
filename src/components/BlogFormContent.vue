<template>
	<div class="blog-form-content w-full">
		<UEditor
			v-slot="{ editor }"
			v-model="localContent"
			:extensions="[
				Emoji.configure({ enableEmoticons: true }),
				TextAlign.configure({ types: ['heading', 'paragraph'] }),
				useKeyboardNavigation(),
				Youtube.configure({
					controls: true,
					nocookie: true,
					modestBranding: true
				}),
				Audio
			]"
			:handlers="customHandlers"
			:editor-props="editorProps"
			content-type="markdown"
			placeholder="Write your content here... (Markdown supported)"
			class="w-full min-h-50 border border-gray-300 dark:border-gray-700 rounded-lg p-4"
		>
			<UEditorToolbar
				:editor="editor"
				:items="toolbar"
				layout="fixed"
				class="sm:px-8 mb-2 overflow-x-auto"
			/>
			<UEditorDragHandle :editor="editor" />
			<UEditorEmojiMenu
				:editor="editor"
				:items="gitHubEmojis.filter((emoji) => !emoji.name.startsWith('regional_indicator_'))"
			/>
		</UEditor>
	</div>
</template>

<script setup lang="ts">
import type { EditorCustomHandlers, EditorToolbarItem } from '@nuxt/ui';
import type { Editor } from '@tiptap/core';
import Audio from '@tiptap/extension-audio';
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji';
import { TextAlign } from '@tiptap/extension-text-align';
import Youtube from '@tiptap/extension-youtube';
import type { EditorView } from '@tiptap/pm/view';
import { INLINE_IMAGE_TYPES } from '~/shared/images';

const props = defineProps<{
	modelValue: string;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: string];
}>();

const localContent = ref(props.modelValue || 'Welcome to your blog post! Start writing here...');

watch(
	() => props.modelValue,
	(newValue) => {
		if (newValue !== localContent.value) {
			localContent.value = newValue;
		}
	}
);

watch(localContent, (newValue) => {
	emit('update:modelValue', newValue);
});

const toast = useToast();

async function insertImage(view: EditorView, file: File) {
	try {
		const src = await fileToInlineImage(file);
		const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]()]/g, '');
		const node = view.state.schema.nodes.image?.create({ src, alt });
		if (node) view.dispatch(view.state.tr.replaceSelectionWith(node));
	} catch (err: any) {
		toast.add({
			title: 'Image Not Added',
			description: err?.message || 'Could not add the image',
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	}
}

function imageFrom(files?: FileList | null): File | undefined {
	return Array.from(files ?? []).find((file) => file.type.startsWith('image/'));
}

function pickImage(view: EditorView) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = INLINE_IMAGE_TYPES.join(',');
	input.onchange = () => {
		const file = input.files?.[0];
		if (file) insertImage(view, file);
	};
	input.click();
}

const editorProps = {
	handlePaste: (view: EditorView, event: ClipboardEvent) => {
		const file = imageFrom(event.clipboardData?.files);
		if (!file) return false;
		event.preventDefault();
		insertImage(view, file);
		return true;
	},
	handleDrop: (view: EditorView, event: DragEvent) => {
		const file = imageFrom(event.dataTransfer?.files);
		if (!file) return false;
		event.preventDefault();
		insertImage(view, file);
		return true;
	}
};

// Custom handlers for YouTube and Audio
const customHandlers = {
	imageUpload: {
		canExecute: () => true,
		execute: (editor: Editor) => {
			pickImage(editor.view);
			return editor.chain();
		},
		isActive: () => false,
		isDisabled: () => false
	},
	youtube: {
		canExecute: (editor: Editor) => editor.can().insertContent({ type: 'youtube' }),
		execute: (editor: Editor) => {
			const url = prompt('Enter YouTube URL');
			if (url) {
				return editor.chain().focus().setYoutubeVideo({ src: url });
			}
			return editor.chain();
		},
		isActive: (editor: Editor) => editor.isActive('youtube'),
		isDisabled: () => false
	},
	audio: {
		canExecute: (editor: Editor) => editor.can().insertContent({ type: 'audio' }),
		execute: (editor: Editor) => {
			const url = prompt('Enter audio URL');
			if (url) {
				return editor.chain().focus().setAudio({ src: url });
			}
			return editor.chain();
		},
		isActive: (editor: Editor) => editor.isActive('audio'),
		isDisabled: () => false
	}
} satisfies EditorCustomHandlers;

// editor
const toolbar: EditorToolbarItem<typeof customHandlers>[][] = [
	[
		{
			kind: 'undo',
			icon: 'lucide:undo',
			tooltip: { text: 'Undo' }
		},
		{
			kind: 'redo',
			icon: 'lucide:redo',
			tooltip: { text: 'Redo' }
		},
		{
			kind: 'clearFormatting',
			icon: 'lucide:eraser',
			tooltip: { text: 'Clear Formatting' }
		}
	],
	[
		{
			icon: 'lucide:heading',
			tooltip: { text: 'Headings' },
			content: {
				align: 'start'
			},
			items: [
				{
					kind: 'heading',
					level: 1,
					icon: 'lucide:heading-1',
					label: 'Heading 1'
				},
				{
					kind: 'heading',
					level: 2,
					icon: 'lucide:heading-2',
					label: 'Heading 2'
				},
				{
					kind: 'heading',
					level: 3,
					icon: 'lucide:heading-3',
					label: 'Heading 3'
				},
				{
					kind: 'heading',
					level: 4,
					icon: 'lucide:heading-4',
					label: 'Heading 4'
				},
				{
					kind: 'heading',
					level: 5,
					icon: 'lucide:heading-5',
					label: 'Heading 5'
				},
				{
					kind: 'heading',
					level: 6,
					icon: 'lucide:heading-6',
					label: 'Heading 6'
				}
			]
		},
		{
			icon: 'lucide:list',
			tooltip: { text: 'Lists' },
			content: {
				align: 'start'
			},
			items: [
				{
					kind: 'bulletList',
					icon: 'lucide:list',
					label: 'Bullet List'
				},
				{
					kind: 'orderedList',
					icon: 'lucide:list-ordered',
					label: 'Ordered List'
				}
			]
		},
		{
			kind: 'blockquote',
			icon: 'lucide:text-quote',
			tooltip: { text: 'Blockquote' }
		},
		{
			kind: 'codeBlock',
			icon: 'lucide:square-code',
			tooltip: { text: 'Code Block' }
		},
		{
			kind: 'horizontalRule',
			icon: 'lucide:separator-horizontal',
			tooltip: { text: 'Horizontal Rule' }
		}
	],
	// Text formatting
	[
		{
			kind: 'mark',
			mark: 'bold',
			icon: 'lucide:bold',
			tooltip: { text: 'Bold' }
		},
		{
			kind: 'mark',
			mark: 'italic',
			icon: 'lucide:italic',
			tooltip: { text: 'Italic' }
		},
		{
			kind: 'mark',
			mark: 'underline',
			icon: 'lucide:underline',
			tooltip: { text: 'Underline' }
		},
		{
			kind: 'mark',
			mark: 'strike',
			icon: 'lucide:strikethrough',
			tooltip: { text: 'Strikethrough' }
		},
		{
			kind: 'mark',
			mark: 'code',
			icon: 'lucide:code',
			tooltip: { text: 'Code' }
		}
	],
	[
		{
			kind: 'link',
			icon: 'lucide:link',
			tooltip: { text: 'Link' }
		},
		{
			kind: 'image',
			icon: 'lucide:image',
			tooltip: { text: 'Image from URL' }
		},
		{
			kind: 'imageUpload',
			icon: 'lucide:image-up',
			tooltip: { text: 'Upload Image' }
		}
	],
	[
		{
			icon: 'lucide:align-justify',
			tooltip: { text: 'Text Align' },
			content: {
				align: 'end'
			},
			items: [
				{
					kind: 'textAlign',
					align: 'left',
					icon: 'lucide:align-left',
					label: 'Align Left'
				},
				{
					kind: 'textAlign',
					align: 'center',
					icon: 'lucide:align-center',
					label: 'Align Center'
				},
				{
					kind: 'textAlign',
					align: 'right',
					icon: 'lucide:align-right',
					label: 'Align Right'
				},
				{
					kind: 'textAlign',
					align: 'justify',
					icon: 'lucide:align-justify',
					label: 'Align Justify'
				}
			]
		}
	],
	[
		{
			kind: 'emoji',
			icon: 'lucide:smile',
			tooltip: { text: 'Insert Emoji' }
		},
		{
			kind: 'youtube',
			icon: 'lucide:youtube',
			tooltip: { text: 'Insert YouTube Video' }
		},
		{
			kind: 'audio',
			icon: 'lucide:music',
			tooltip: { text: 'Insert Audio' }
		}
	]
];
</script>

<style scoped>
.blog-form-content {
	position: relative;
}
</style>

<template>
	<div class="blog-form-content w-full">
		<UEditor
			v-slot="{ editor }"
			v-model="localContent"
			:extensions="[
				Emoji.configure({ enableEmoticons: true }),
				TextAlign.configure({ types: ['heading', 'paragraph'] })
			]"
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
import type { EditorToolbarItem } from '@nuxt/ui';
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji';
import { TextAlign } from '@tiptap/extension-text-align';

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

// editor
const toolbar: EditorToolbarItem[][] = [
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
			tooltip: { text: 'Image' }
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
	]
];
</script>

<style scoped>
.blog-form-content {
	position: relative;
}
</style>

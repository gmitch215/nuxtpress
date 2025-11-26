<template>
	<div class="blog-form-content w-full min-w-[800px]">
		<UTabs
			v-model="activeTab"
			:items="tabs"
			class="w-full"
		>
			<template #content>
				<div class="space-y-3">
					<div class="flex flex-wrap gap-2 p-2 border rounded bg-gray-50 dark:bg-gray-800">
						<UButton
							icon="mdi:format-bold"
							size="md"
							color="neutral"
							variant="ghost"
							title="Bold"
							@click="insertMarkdown('**', '**')"
						/>
						<UButton
							icon="mdi:format-italic"
							size="md"
							color="neutral"
							variant="ghost"
							title="Italic"
							@click="insertMarkdown('*', '*')"
						/>
						<UButton
							icon="mdi:format-underline"
							size="md"
							color="neutral"
							variant="ghost"
							title="Underline"
							@click="insertMarkdown('<u>', '</u>')"
						/>
						<UButton
							icon="mdi:format-strikethrough"
							size="md"
							color="neutral"
							variant="ghost"
							title="Strikethrough"
							@click="insertMarkdown('~~', '~~')"
						/>

						<div class="w-px h-8 bg-gray-300 dark:bg-gray-600" />

						<UButton
							icon="mdi:format-header-1"
							size="md"
							color="neutral"
							variant="ghost"
							title="Heading 1"
							@click="insertHeading(1)"
						/>
						<UButton
							icon="mdi:format-header-2"
							size="md"
							color="neutral"
							variant="ghost"
							title="Heading 2"
							@click="insertHeading(2)"
						/>
						<UButton
							icon="mdi:format-header-3"
							size="md"
							color="neutral"
							variant="ghost"
							title="Heading 3"
							@click="insertHeading(3)"
						/>
						<UButton
							icon="mdi:format-header-4"
							size="md"
							color="neutral"
							variant="ghost"
							title="Heading 4"
							@click="insertHeading(4)"
						/>
						<UButton
							icon="mdi:format-header-5"
							size="md"
							color="neutral"
							variant="ghost"
							title="Heading 5"
							@click="insertHeading(5)"
						/>
						<UButton
							icon="mdi:format-header-6"
							size="md"
							color="neutral"
							variant="ghost"
							title="Heading 6"
							@click="insertHeading(6)"
						/>

						<div class="w-px h-8 bg-gray-300 dark:bg-gray-600" />

						<UButton
							icon="mdi:format-list-bulleted"
							size="md"
							color="neutral"
							variant="ghost"
							title="Unordered List"
							@click="insertList('ul')"
						/>
						<UButton
							icon="mdi:format-list-numbered"
							size="md"
							color="neutral"
							variant="ghost"
							title="Ordered List"
							@click="insertList('ol')"
						/>
						<UButton
							icon="mdi:checkbox-marked-outline"
							size="md"
							color="neutral"
							variant="ghost"
							title="Checklist"
							@click="insertList('checklist')"
						/>

						<div class="w-px h-8 bg-gray-300 dark:bg-gray-600" />

						<UButton
							icon="mdi:table"
							size="md"
							color="neutral"
							variant="ghost"
							title="Insert Table"
							@click="insertTable"
						/>
						<UButton
							icon="mdi:link"
							size="md"
							color="neutral"
							variant="ghost"
							title="Insert Link"
							@click="insertLink"
						/>
						<UButton
							icon="mdi:image"
							size="md"
							color="neutral"
							variant="ghost"
							title="Insert Image"
							@click="insertImage"
						/>
						<UButton
							icon="mdi:code-tags"
							size="md"
							color="neutral"
							variant="ghost"
							title="Code Block"
							@click="insertMarkdown('```\n', '\n```')"
						/>
						<UButton
							icon="mdi:format-quote-close"
							size="md"
							color="neutral"
							variant="ghost"
							title="Blockquote"
							@click="insertBlockquote"
						/>
					</div>

					<div class="relative editor-container">
						<UTextarea
							ref="textareaRef"
							v-model="localContent"
							class="w-full min-h-[400px] font-mono text-sm leading-6"
							placeholder="Write your content here... (Markdown supported)"
							:rows="20"
							autoresize
							@input="handleInput"
							@select="updateSelection"
							@keydown="handleKeydown"
							@mouseup="updateSelection"
						/>
						<div
							class="inline-preview-overlay"
							v-html="inlinePreviewHtml"
						/>
					</div>
				</div>
			</template>

			<template #preview>
				<div
					class="prose prose-lg dark:prose-invert max-w-none p-6 border rounded min-h-[400px] bg-white dark:bg-gray-900"
					v-html="renderedHtml"
				/>
			</template>
		</UTabs>
	</div>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify';

const props = defineProps<{
	modelValue: string;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: string];
}>();

const localContent = ref(props.modelValue);
const textareaRef = ref<any>(null);
const activeTab = ref('content');
const selectionStart = ref(0);
const selectionEnd = ref(0);

const tabs = [
	{ label: 'Content', icon: 'mdi:pencil', value: 'content', slot: 'content' },
	{ label: 'Preview', icon: 'mdi:eye', value: 'preview', slot: 'preview' }
];

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

const renderedHtml = ref('');

watch(
	localContent,
	(newValue) => {
		try {
			const { renderMarkdown } = useMarkdown();
			const html = renderMarkdown(newValue || '');
			renderedHtml.value = DOMPurify.sanitize(html);
		} catch (e) {
			console.error('Markdown rendering error:', e);
			renderedHtml.value = '<p class="text-red-500">Error rendering markdown</p>';
		}
	},
	{ immediate: true }
);

const inlinePreviewHtml = computed(() => {
	let html = localContent.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	const codeBlockRanges: Array<{ start: number; end: number }> = [];
	const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g;
	let match;
	while ((match = codeBlockRegex.exec(html)) !== null) {
		codeBlockRanges.push({ start: match.index, end: match.index + match[0].length });
	}

	const isInCodeBlock = (index: number) => {
		return codeBlockRanges.some((range) => index >= range.start && index < range.end);
	};

	// apply formatting only outside code blocks
	html = html.replace(/\*\*(.+?)\*\*/g, (match, content, offset) => {
		if (isInCodeBlock(offset)) return match;
		if (/```|`/.test(match)) return match;
		return `<strong>**${content}**</strong>`;
	});

	html = html.replace(/^(#{1,6})(\s+)(.+?)$/gm, (match, hashes, space, text) => {
		if (text.trim()) {
			return `<strong>${hashes}${space}${text}</strong>`;
		}

		return match;
	});

	html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (match, content, offset) => {
		if (isInCodeBlock(offset)) return match;
		// don't format if it contains code block syntax
		if (/```|`/.test(match)) return match;

		return `<em>*${content}*</em>`;
	});

	html = html.replace(/_(.+?)_/g, (match, content, offset) => {
		if (isInCodeBlock(offset)) return match;
		if (/```|`/.test(match)) return match;
		return `<em>_${content}_</em>`;
	});

	html = html.replace(/~~(.+?)~~/g, (match, content, offset) => {
		if (isInCodeBlock(offset)) return match;
		if (/```|`/.test(match)) return match;
		return `<del>~~${content}~~</del>`;
	});

	html = html.replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, (match, content, offset) => {
		if (isInCodeBlock(offset)) return match;
		if (/```|`/.test(match)) return match;
		return `<u>&lt;u&gt;${content}&lt;/u&gt;</u>`;
	});

	return DOMPurify.sanitize(html);
});

const getTextarea = () => {
	if (!textareaRef.value) return null;
	return textareaRef.value.$el?.querySelector('textarea') || textareaRef.value;
};

const handleInput = () => {
	updateSelection();
};

const updateSelection = () => {
	const textarea = getTextarea();
	if (textarea?.selectionStart !== undefined) {
		selectionStart.value = textarea.selectionStart;
		selectionEnd.value = textarea.selectionEnd;
	}
};

const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === 'Enter') {
		const textarea = getTextarea();
		if (!textarea) return;

		const start = textarea.selectionStart;
		const beforeCursor = localContent.value.substring(0, start);
		const currentLineStart = beforeCursor.lastIndexOf('\n') + 1;
		const currentLine = beforeCursor.substring(currentLineStart);

		const checkboxMatch = currentLine.match(/^(\s*)-\s\[([ x])\]\s(.*)$/);
		if (checkboxMatch && checkboxMatch[3] !== undefined) {
			if (checkboxMatch[3].trim() === '') {
				event.preventDefault();
				const lineEnd = start;
				const newContent =
					localContent.value.substring(0, currentLineStart) + localContent.value.substring(lineEnd);
				localContent.value = newContent;
				nextTick(() => {
					textarea.focus();
					textarea.setSelectionRange(currentLineStart, currentLineStart);
				});
				return;
			}
			event.preventDefault();
			const indent = checkboxMatch[1];
			const newText = `\n${indent}- [ ] `;
			insertAtPosition(start, newText);
			return;
		}

		const ulMatch = currentLine.match(/^(\s*)-\s(.*)$/);
		if (ulMatch && ulMatch[2] !== undefined) {
			if (ulMatch[2].trim() === '') {
				event.preventDefault();
				const lineEnd = start;
				const newContent =
					localContent.value.substring(0, currentLineStart) + localContent.value.substring(lineEnd);
				localContent.value = newContent;
				nextTick(() => {
					textarea.focus();
					textarea.setSelectionRange(currentLineStart, currentLineStart);
				});
				return;
			}
			event.preventDefault();
			const indent = ulMatch[1];
			const newText = `\n${indent}- `;
			insertAtPosition(start, newText);
			return;
		}

		const olMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
		if (olMatch && olMatch[2] && olMatch[3] !== undefined) {
			if (olMatch[3].trim() === '') {
				event.preventDefault();
				const lineEnd = start;
				const newContent =
					localContent.value.substring(0, currentLineStart) + localContent.value.substring(lineEnd);
				localContent.value = newContent;
				nextTick(() => {
					textarea.focus();
					textarea.setSelectionRange(currentLineStart, currentLineStart);
				});
				return;
			}
			event.preventDefault();
			const indent = olMatch[1];
			const nextNum = parseInt(olMatch[2]) + 1;
			const newText = `\n${indent}${nextNum}. `;
			insertAtPosition(start, newText);
			return;
		}

		const tableMatch = currentLine.match(/^\|(.+)\|$/);
		if (tableMatch && tableMatch[1]) {
			const cells = tableMatch[1].split('|');
			const allEmpty = cells.every((cell) => cell.trim() === '');

			if (allEmpty) {
				event.preventDefault();
				const lineEnd = start;
				const newContent =
					localContent.value.substring(0, currentLineStart) +
					'\n' +
					localContent.value.substring(lineEnd);
				localContent.value = newContent;
				nextTick(() => {
					textarea.focus();
					textarea.setSelectionRange(currentLineStart + 1, currentLineStart + 1);
				});
				return;
			}

			event.preventDefault();
			const newRow = '|' + cells.map(() => '      ').join('|') + '|';
			const newText = `\n${newRow}`;
			insertAtPosition(start, newText);
			return;
		}
	}

	updateSelection();
};

const insertAtPosition = (position: number, text: string) => {
	const newContent =
		localContent.value.substring(0, position) + text + localContent.value.substring(position);

	localContent.value = newContent;

	nextTick(() => {
		const textarea = getTextarea();
		if (textarea) {
			textarea.focus();
			textarea.setSelectionRange(position + text.length, position + text.length);
		}
	});
};

const insertMarkdown = (before: string, after: string) => {
	const textarea = getTextarea();
	if (!textarea) return;

	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selectedText = localContent.value.substring(start, end);

	const newText = before + selectedText + after;
	const newContent =
		localContent.value.substring(0, start) + newText + localContent.value.substring(end);

	localContent.value = newContent;

	nextTick(() => {
		textarea.focus();
		if (selectedText) {
			textarea.setSelectionRange(start + before.length, end + before.length);
		} else {
			textarea.setSelectionRange(start + before.length, start + before.length);
		}
	});
};

const insertHeading = (level: number) => {
	const textarea = getTextarea();
	if (!textarea) return;

	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;

	const beforeCursor = localContent.value.substring(0, start);
	const lineStart = beforeCursor.lastIndexOf('\n') + 1;
	const currentLine = beforeCursor.substring(lineStart);

	const hashes = '#'.repeat(level);
	const heading = `${hashes} `;

	// if the current line is empty or only whitespace, insert at line start
	// otherwise insert at cursor position
	if (currentLine.trim() === '') {
		const newContent =
			localContent.value.substring(0, lineStart) +
			heading +
			localContent.value.substring(lineStart);

		localContent.value = newContent;

		nextTick(() => {
			textarea.focus();
			textarea.setSelectionRange(lineStart + heading.length, lineStart + heading.length);
		});
	} else {
		// insert at cursor position for non-empty lines
		const newContent =
			localContent.value.substring(0, start) + heading + localContent.value.substring(start);

		localContent.value = newContent;

		nextTick(() => {
			textarea.focus();
			textarea.setSelectionRange(start + heading.length, start + heading.length);
		});
	}
};

const insertList = (type: 'ul' | 'ol' | 'checklist') => {
	const textarea = getTextarea();
	if (!textarea) return;

	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selectedText = localContent.value.substring(start, end);

	let listText: string;
	if (selectedText) {
		const lines = selectedText.split('\n');
		const listItems = lines.map((line, index) => {
			let prefix: string;
			if (type === 'checklist') {
				prefix = '- [ ] ';
			} else if (type === 'ul') {
				prefix = '- ';
			} else {
				prefix = `${index + 1}. `;
			}
			return prefix + line;
		});
		listText = listItems.join('\n');
	} else {
		if (type === 'checklist') {
			listText = '- [ ] Item 1\n- [ ] Item 2\n- [ ] Item 3';
		} else if (type === 'ul') {
			listText = '- Item 1\n- Item 2\n- Item 3';
		} else {
			listText = '1. Item 1\n2. Item 2\n3. Item 3';
		}
	}

	const newContent =
		localContent.value.substring(0, start) + listText + localContent.value.substring(end);

	localContent.value = newContent;

	nextTick(() => {
		textarea.focus();
		textarea.setSelectionRange(start, start + listText.length);
	});
};

const insertTable = () => {
	const table = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;

	insertAtCursor(table);
};

const insertLink = () => {
	insertMarkdown('[', '](https://)');
};

const insertImage = () => {
	insertMarkdown('![', '](https://)');
};

const insertBlockquote = () => {
	const textarea = getTextarea();
	if (!textarea) return;

	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selectedText = localContent.value.substring(start, end);

	const quote = selectedText
		? selectedText
				.split('\n')
				.map((line) => `> ${line}`)
				.join('\n')
		: '> Quote text';

	const newContent =
		localContent.value.substring(0, start) + quote + localContent.value.substring(end);

	localContent.value = newContent;

	nextTick(() => {
		textarea.focus();
		textarea.setSelectionRange(start, start + quote.length);
	});
};

const insertAtCursor = (text: string) => {
	const textarea = getTextarea();
	if (!textarea) return;

	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;

	const newContent =
		localContent.value.substring(0, start) + text + localContent.value.substring(end);

	localContent.value = newContent;

	nextTick(() => {
		textarea.focus();
		textarea.setSelectionRange(start + text.length, start + text.length);
	});
};
</script>

<style scoped>
.blog-form-content {
	position: relative;
}

.editor-container {
	position: relative;
}

.blog-form-content :deep(textarea) {
	color: transparent;
	caret-color: black;
	background: transparent;
	position: relative;
	z-index: 2;
	line-height: 1.5rem;
}

.dark .blog-form-content :deep(textarea) {
	caret-color: white;
}

.blog-form-content :deep(textarea::selection) {
	background: rgba(59, 130, 246, 0.3);
}

.inline-preview-overlay {
	position: absolute;
	top: 0px;
	left: 1px;
	right: 1px;
	bottom: 1px;
	padding-top: 0.5rem;
	padding-bottom: 0.5rem;
	padding-left: 0.6rem;
	padding-right: 0.75rem;
	pointer-events: none;
	white-space: pre-wrap;
	word-wrap: break-word;
	overflow: hidden;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 0.875rem;
	line-height: 1.5rem;
	z-index: 1;
	color: rgb(31, 41, 55);
}

.dark .inline-preview-overlay {
	color: rgb(229, 231, 235);
}

.prose {
	color: rgb(31, 41, 55);
}

.dark .prose {
	color: rgb(229, 231, 235);
}
</style>

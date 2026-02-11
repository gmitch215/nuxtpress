import { Extension } from '@tiptap/core';

/**
 * Custom keyboard navigation extension for TipTap editor
 * Provides enhanced keyboard shortcuts for word and paragraph navigation
 */
export const useKeyboardNavigation = () => {
	return Extension.create({
		name: 'keyboardNavigation',

		addKeyboardShortcuts() {
			return {
				// Alt/Option + ArrowLeft: Move cursor to previous word
				'Alt-ArrowLeft': ({ editor }) => {
					const { selection } = editor.state;
					const { $from } = selection;
					let pos = $from.pos;

					// Find previous word boundary
					const text = $from.parent.textContent;
					const offset = $from.parentOffset;

					if (offset > 0) {
						const beforeText = text.slice(0, offset);
						const match = beforeText.match(/\S+\s*$/);
						if (match) {
							pos = pos - match[0].length;
						} else {
							pos = pos - offset;
						}
					}

					editor.commands.setTextSelection(pos);
					return true;
				},

				// Alt/Option + ArrowRight: Move cursor to next word
				'Alt-ArrowRight': ({ editor }) => {
					const { selection } = editor.state;
					const { $from } = selection;
					let pos = $from.pos;

					// Find next word boundary
					const text = $from.parent.textContent;
					const offset = $from.parentOffset;

					if (offset < text.length) {
						const afterText = text.slice(offset);
						const match = afterText.match(/^\s*\S+/);
						if (match) {
							pos = pos + match[0].length;
						} else {
							pos = pos + (text.length - offset);
						}
					}

					editor.commands.setTextSelection(pos);
					return true;
				},

				// Control + ArrowUp: Move cursor to previous paragraph
				'Ctrl-ArrowUp': ({ editor }) => {
					const { selection } = editor.state;
					const { $from } = selection;
					const resolvedPos = editor.state.doc.resolve(Math.max(0, $from.before() - 1));

					if (resolvedPos.depth > 0) {
						editor.commands.setTextSelection(resolvedPos.pos);
					}
					return true;
				},

				// Control + ArrowDown: Move cursor to next paragraph
				'Ctrl-ArrowDown': ({ editor }) => {
					const { selection } = editor.state;
					const { $from } = selection;
					const resolvedPos = editor.state.doc.resolve(
						Math.min(editor.state.doc.content.size, $from.after() + 1)
					);

					if (resolvedPos.pos <= editor.state.doc.content.size) {
						editor.commands.setTextSelection(resolvedPos.pos);
					}
					return true;
				}
			};
		}
	});
};

<template>
	<div class="space-y-3">
		<div
			class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default p-6 text-center"
			:class="dragging ? 'bg-elevated' : ''"
			@dragover.prevent="dragging = true"
			@dragleave="dragging = false"
			@drop.prevent="onDrop"
		>
			<UIcon
				name="mdi:image-multiple-outline"
				class="size-8 text-muted"
			/>
			<p class="text-sm text-muted">
				Drop images here or choose files. PNG, JPEG, WebP and GIF, up to {{ MAX_SLIDES }} slides.
			</p>
			<UButton
				color="neutral"
				variant="outline"
				icon="mdi:upload"
				:disabled="slides.length >= MAX_SLIDES"
				@click="input?.click()"
			>
				Add Images
			</UButton>
			<input
				ref="input"
				type="file"
				multiple
				:accept="SLIDE_MIMES.join(',')"
				class="hidden"
				data-testid="slide-input"
				@change="onPick"
			/>
		</div>

		<ol
			v-if="slides.length"
			class="grid gap-3 sm:grid-cols-2"
		>
			<li
				v-for="(slide, index) in slides"
				:key="slide.id"
				class="flex gap-3 rounded-lg border border-default p-2"
			>
				<div class="relative size-24 shrink-0 overflow-hidden rounded bg-elevated">
					<img
						:src="slide.preview"
						:alt="`Slide ${index + 1}`"
						class="size-full object-cover"
					/>
					<div
						v-if="slide.uploading"
						class="absolute inset-x-0 bottom-0 h-1 bg-black/40"
					>
						<div
							class="h-full bg-primary"
							:style="{ width: `${Math.round(slide.progress * 100)}%` }"
						/>
					</div>
				</div>
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<UInput
						v-model="slide.caption"
						placeholder="Caption (optional)"
						:maxlength="MAX_SLIDE_CAPTION"
						size="sm"
						class="w-full"
						:aria-label="`Caption for slide ${index + 1}`"
						@update:model-value="publish"
					/>
					<p
						v-if="slide.error"
						class="text-xs text-red-500"
					>
						{{ slide.error }}
					</p>
					<div class="mt-auto flex gap-1">
						<UButton
							icon="mdi:arrow-up"
							size="xs"
							color="neutral"
							variant="ghost"
							:disabled="index === 0"
							:aria-label="`Move slide ${index + 1} up`"
							@click="move(index, -1)"
						/>
						<UButton
							icon="mdi:arrow-down"
							size="xs"
							color="neutral"
							variant="ghost"
							:disabled="index === slides.length - 1"
							:aria-label="`Move slide ${index + 1} down`"
							@click="move(index, 1)"
						/>
						<UButton
							icon="mdi:delete"
							size="xs"
							color="error"
							variant="ghost"
							:aria-label="`Remove slide ${index + 1}`"
							@click="remove(index)"
						/>
					</div>
				</div>
			</li>
		</ol>
	</div>
</template>

<script setup lang="ts">
import {
	MAX_SLIDE_CAPTION,
	MAX_SLIDES,
	mediaUrl,
	SLIDE_MIMES,
	type MediaItem
} from '~/shared/media';

type Slide = {
	id: string;
	key: string;
	mime: string;
	size: number;
	width?: number;
	height?: number;
	caption: string;
	preview: string;
	uploading: boolean;
	progress: number;
	error: string;
};

const model = defineModel<MediaItem[]>({ default: () => [] });
const busy = defineModel<boolean>('busy', { default: false });

const input = ref<HTMLInputElement>();
const dragging = ref(false);
const slides = ref<Slide[]>(
	model.value.map((item) => ({
		id: item.key,
		key: item.key,
		mime: item.mime,
		size: item.size,
		width: item.width,
		height: item.height,
		caption: item.caption ?? '',
		preview: mediaUrl(item.key),
		uploading: false,
		progress: 1,
		error: ''
	}))
);

function publish() {
	model.value = slides.value
		.filter((slide) => slide.key && !slide.uploading && !slide.error)
		.map((slide) => ({
			key: slide.key,
			mime: slide.mime,
			size: slide.size,
			width: slide.width,
			height: slide.height,
			caption: slide.caption.trim() || undefined
		}));
	busy.value = slides.value.some((slide) => slide.uploading);
}

async function add(files: File[]) {
	const room = MAX_SLIDES - slides.value.length;
	const accepted = files.filter((file) => (SLIDE_MIMES as readonly string[]).includes(file.type));
	for (const file of accepted.slice(0, room)) {
		const slide = reactive<Slide>({
			id: crypto.randomUUID(),
			key: '',
			mime: file.type,
			size: file.size,
			caption: '',
			preview: URL.createObjectURL(file),
			uploading: true,
			progress: 0,
			error: ''
		});
		slides.value.push(slide);
		publish();
		try {
			const prepared = await prepareSlide(file);
			const uploaded = await uploadMedia(prepared.blob, prepared.mime, (p) => (slide.progress = p));
			Object.assign(slide, {
				key: uploaded.key,
				mime: uploaded.mime,
				size: uploaded.size,
				width: prepared.width,
				height: prepared.height
			});
		} catch (err: any) {
			slide.error = err?.message || 'Could not upload this image';
		} finally {
			slide.uploading = false;
			publish();
		}
	}
}

function onPick(event: Event) {
	const target = event.target as HTMLInputElement;
	add(Array.from(target.files ?? []));
	target.value = '';
}

function onDrop(event: DragEvent) {
	dragging.value = false;
	add(Array.from(event.dataTransfer?.files ?? []));
}

function move(index: number, by: number) {
	const next = index + by;
	if (next < 0 || next >= slides.value.length) return;
	const [item] = slides.value.splice(index, 1);
	slides.value.splice(next, 0, item!);
	publish();
}

function remove(index: number) {
	slides.value.splice(index, 1);
	publish();
}
</script>

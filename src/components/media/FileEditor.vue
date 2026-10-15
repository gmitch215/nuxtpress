<template>
	<div class="space-y-3">
		<div
			v-if="!file && !uploading"
			class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default p-6 text-center"
			:class="dragging ? 'bg-elevated' : ''"
			@dragover.prevent="dragging = true"
			@dragleave="dragging = false"
			@drop.prevent="onDrop"
		>
			<UIcon
				:name="kind === 'video' ? 'mdi:video-outline' : 'mdi:music-note-outline'"
				class="size-8 text-muted"
			/>
			<p class="text-sm text-muted">
				{{
					kind === 'video'
						? 'Drop a video here or choose a file. MP4 or WebM, up to 100 MB.'
						: 'Drop a music file here or choose one. MP3, M4A, OGG, WAV, WebM or FLAC, up to 100 MB.'
				}}
			</p>
			<UButton
				color="neutral"
				variant="outline"
				icon="mdi:upload"
				@click="input?.click()"
			>
				{{ kind === 'video' ? 'Choose Video' : 'Choose Music' }}
			</UButton>
			<input
				ref="input"
				type="file"
				:accept="mimes.join(',')"
				class="hidden"
				:data-testid="`${kind}-input`"
				@change="onPick"
			/>
		</div>

		<div
			v-if="uploading"
			class="space-y-1"
		>
			<p class="text-sm">Uploading {{ name }}...</p>
			<div class="h-2 overflow-hidden rounded bg-elevated">
				<div
					class="h-full bg-primary transition-all"
					:style="{ width: `${Math.round(progress * 100)}%` }"
				/>
			</div>
		</div>

		<p
			v-if="error"
			class="text-sm text-red-500"
		>
			{{ error }}
		</p>

		<div
			v-if="file && !uploading"
			class="space-y-2"
		>
			<MediaPlayer
				:kind="kind"
				:src="mediaUrl(file.key)"
				:mime="file.mime"
				:poster="kind === 'video' ? poster : undefined"
			/>
			<div class="flex items-center justify-between gap-2 text-sm text-muted">
				<span>{{ name }} ({{ sizeLabel }})</span>
				<UButton
					color="error"
					variant="ghost"
					icon="mdi:delete"
					size="xs"
					@click="clear"
				>
					Remove
				</UButton>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { MIMES_BY_TYPE, mediaUrl, type MediaItem } from '~/shared/media';

const props = defineProps<{ kind: 'video' | 'music'; poster?: string }>();
const emit = defineEmits<{ posterCaptured: [url: string | null] }>();

const model = defineModel<MediaItem | null>({ default: null });
const busy = defineModel<boolean>('busy', { default: false });

const mimes = computed(() => MIMES_BY_TYPE[props.kind]);
const input = ref<HTMLInputElement>();
const dragging = ref(false);
const uploading = ref(false);
const progress = ref(0);
const error = ref('');
const name = ref('');
const file = computed(() => model.value);

const sizeLabel = computed(() => {
	const size = file.value?.size ?? 0;
	return size >= 1024 * 1024
		? `${(size / 1024 / 1024).toFixed(1)} MB`
		: `${Math.ceil(size / 1024)} KB`;
});

async function take(picked: File | undefined) {
	if (!picked) return;
	error.value = '';
	if (!mimes.value.includes(picked.type)) {
		error.value = `That file type is not supported for ${props.kind}`;
		return;
	}
	if (picked.size > 100 * 1024 * 1024) {
		error.value = 'Files can be at most 100 MB';
		return;
	}

	name.value = picked.name;
	uploading.value = true;
	busy.value = true;
	progress.value = 0;
	try {
		const posterJob = props.kind === 'video' ? capturePoster(picked) : Promise.resolve(null);
		const uploaded = await uploadMedia(picked, picked.type, (p) => (progress.value = p));
		model.value = { key: uploaded.key, mime: uploaded.mime, size: uploaded.size };
		emit('posterCaptured', await posterJob);
	} catch (err: any) {
		error.value = err?.message || 'The upload failed';
	} finally {
		uploading.value = false;
		busy.value = false;
	}
}

async function capturePoster(picked: File): Promise<string | null> {
	const frame = await captureVideoPoster(picked);
	if (!frame) return null;
	try {
		return (await uploadMedia(frame, 'image/webp')).url;
	} catch {
		return null;
	}
}

function onPick(event: Event) {
	const target = event.target as HTMLInputElement;
	take(target.files?.[0]);
	target.value = '';
}

function onDrop(event: DragEvent) {
	dragging.value = false;
	take(event.dataTransfer?.files?.[0]);
}

function clear() {
	model.value = null;
	emit('posterCaptured', null);
}
</script>

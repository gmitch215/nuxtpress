<template>
	<div class="flex w-full justify-center">
		<div class="prose w-3/5 min-w-80">
			<h1>About {{ settings.name || $config.public.name }}</h1>
			<NuxtImg
				src="/favicon.png"
				alt="Author Avatar"
				class="rounded-full mb-4 size-16 sm:size-20 md:size-24 lg:size-32 mx-auto"
			/>
			<p class="text-md md:text-lg leading-relaxed">
				{{
					settings.bio ||
					`This is ${settings.author}'s NuxtPress site where they post about their life and what's happening in the world.`
				}}
			</p>

			<p class="text-md md:text-lg leading-relaxed text-gray-500">Powered by NuxtPress</p>
		</div>
	</div>
</template>

<script setup lang="ts">
const { settings } = useSettings();
</script>

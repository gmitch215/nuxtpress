<template>
	<div
		id="navbar"
		class="border-b-2 border-b-black p-4 flex items-center bg-accented/60"
	>
		<div class="flex items-center justify-center w-full px-2">
			<NuxtLink to="/">
				<NuxtImg
					src="/favicon.png"
					alt="Logo"
					class="min-w-8 w-8 h-auto xl:w-12 inline-block mr-2 hover:scale-105 transition-transform duration-300"
				/>
			</NuxtLink>
			<div
				class="flex items-center justify-center mr-12 space-x-2 md:space-x-4 lg:space-x-8 xl:space-x-16"
			>
				<NuxtLink
					to="/"
					class="ml-2 text-md sm:text-lg lg:text-xl font-semibold"
					>{{ settings.name || $config.public.name }}</NuxtLink
				>
				<span class="text-xs md:text-sm lg:text-lg whitespace-nowrap">{{
					settings.description || $config.public.description
				}}</span>
			</div>
			<div class="ml-auto">
				<div class="flex space-x-4">
					<NuxtLink
						v-if="settings.github || $config.public.github"
						:to="`https://github.com/${settings.github || $config.public.github}`"
						target="_blank"
					>
						<UIcon
							name="cib:github"
							class="size-4 sm:size-5 md:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.twitter || $config.public.twitter"
						:to="`https://x.com/${settings.twitter || $config.public.twitter}`"
						target="_blank"
					>
						<UIcon
							name="cib:twitter"
							class="size-4 sm:size-5 md:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.instagram || $config.public.instagram"
						:to="`https://instagram.com/${settings.instagram || $config.public.instagram}`"
						target="_blank"
					>
						<UIcon
							name="cib:instagram"
							class="size-4 sm:size-5 md:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.patreon || $config.public.patreon"
						:to="`https://patreon.com/${settings.patreon || $config.public.patreon}`"
						target="_blank"
					>
						<UIcon
							name="cib:patreon"
							class="size-4 sm:size-5 md:size-6"
						/>
					</NuxtLink>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
const { settings } = useSettings();
</script>

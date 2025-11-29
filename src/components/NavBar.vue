<template>
	<div
		id="navbar"
		class="border-b-2 border-b-black py-4 sm:px-4 flex items-center bg-accented/60 light:bg-accented"
	>
		<div class="flex items-center justify-center w-full sm:px-2">
			<div
				class="flex items-center justify-center sm:mr-12 space-x-2 md:space-x-4 lg:space-x-8 xl:space-x-16"
			>
				<div class="flex flex-col text-center sm:text-left sm:flex-row justify-center items-center">
					<NuxtLink to="/">
						<NuxtImg
							src="/favicon.png"
							alt="Logo"
							class="min-w-4 w-8 h-auto lg:w-10 xl:w-12 inline-block mr-2 hover:scale-105 transition-transform duration-300"
						/>
					</NuxtLink>
					<NuxtLink
						to="/"
						class="ml-2 mr-2 sm:mr-4 lg:mr-8 xl:mr-12 text-xs md:text-md lg:text-lg xl:text-xl font-semibold"
						>{{ settings.name || $config.public.name }}</NuxtLink
					>
					<span class="text-xs md:text-sm lg:text-lg whitespace-nowrap mr-2 sm:mr-6">{{
						settings.description || $config.public.description
					}}</span>
				</div>

				<div class="grid grid-cols-2 gap-1 sm:space-y-0 sm:flex sm:space-x-2 mr-2">
					<UButton
						icon="mdi:home"
						to="/"
						title="Home"
						variant="subtle"
						color="neutral"
					/>
					<SearchButton />
					<UButton
						icon="mdi:tag-search"
						to="/tags"
						title="Search by Tags"
						variant="subtle"
						color="neutral"
					/>
					<UButton
						icon="mdi:account-badge"
						to="/about"
						title="About Page"
						variant="subtle"
						color="neutral"
					/>
				</div>
			</div>
			<div class="ml-auto">
				<div
					class="grid grid-cols-4 sm:flex items-center space-x-2 sm:space-x-3 md:space-x-4 light:opacity-70"
					:style="`color: ${settings.themeColor || $config.public.themeColor || '#ffffff'}`"
				>
					<NuxtLink
						v-if="settings.website || $config.public.website"
						:to="`${settings.website || $config.public.website}`"
						target="_blank"
					>
						<UIcon
							name="mdi:web"
							class="size-5 sm:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.github || $config.public.github"
						:to="`https://github.com/${settings.github || $config.public.github}`"
						target="_blank"
					>
						<UIcon
							name="cib:github"
							class="size-5 sm:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.twitter || $config.public.twitter"
						:to="`https://x.com/${settings.twitter || $config.public.twitter}`"
						target="_blank"
					>
						<UIcon
							name="cib:twitter"
							class="size-5 sm:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.instagram || $config.public.instagram"
						:to="`https://instagram.com/${settings.instagram || $config.public.instagram}`"
						target="_blank"
					>
						<UIcon
							name="cib:instagram"
							class="size-5 sm:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.patreon || $config.public.patreon"
						:to="`https://patreon.com/${settings.patreon || $config.public.patreon}`"
						target="_blank"
					>
						<UIcon
							name="cib:patreon"
							class="size-5 sm:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.linkedin || $config.public.linkedin"
						:to="`https://linkedin.com/in/${settings.linkedin || $config.public.linkedin}`"
						target="_blank"
					>
						<UIcon
							name="cib:linkedin"
							class="size-5 sm:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.discord || $config.public.discord"
						:to="`${settings.discord || $config.public.discord}`"
						target="_blank"
					>
						<UIcon
							name="cib:discord"
							class="size-5 sm:size-6"
						/>
					</NuxtLink>
					<NuxtLink
						v-if="settings.supportEmail || $config.public.supportEmail"
						:to="`mailto:${settings.supportEmail || $config.public.supportEmail}`"
						target="_blank"
					>
						<UIcon
							name="mdi:email-outline"
							class="size-5 sm:size-6"
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

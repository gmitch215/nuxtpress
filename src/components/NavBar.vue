<template>
	<div
		id="navbar"
		class="border-b-2 border-b-black p-4 flex items-center"
	>
		<div class="flex items-center justify-center mr-16">
			<NuxtLink to="/">
				<NuxtImg
					src="/favicon.png"
					alt="Logo"
					class="min-w-8 w-8 h-auto xl:w-12 inline-block mr-2 hover:scale-105 transition-transform duration-300"
				/>
			</NuxtLink>
			<div class="flex items-center justify-center min-w-30 mr-12 lg:space-x-4">
				<NuxtLink
					to="/"
					class="ml-2 text-xl font-semibold"
					>{{ $config.public.name }}</NuxtLink
				>
				<span class="text-sm whitespace-nowrap">{{ $config.public.description }}</span>
			</div>
			<div class="flex space-x-4">
				<NuxtLink
					v-if="$config.public.github"
					:to="$config.public.github"
					target="_blank"
				>
					<UIcon name="cib:github" />
				</NuxtLink>
				<NuxtLink
					v-if="$config.public.twitter"
					:to="$config.public.twitter"
					target="_blank"
				>
					<UIcon name="cib:twitter" />
				</NuxtLink>
				<NuxtLink
					v-if="$config.public.instagram"
					:to="$config.public.instagram"
					target="_blank"
				>
					<UIcon name="cib:instagram" />
				</NuxtLink>
				<NuxtLink
					v-if="$config.public.patreon"
					:to="$config.public.patreon"
					target="_blank"
				>
					<UIcon name="cib:patreon" />
				</NuxtLink>
			</div>
		</div>
	</div>
</template>

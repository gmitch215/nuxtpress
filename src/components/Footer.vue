<template>
	<div
		class="flex items-center justify-between w-full mt-8 min-h-32 bg-gray-950 border-t-2 border-gray-800 text-gray-700 text-left px-4 sm:px-8 md:px-12 text-xs sm:text-sm md:text-md"
	>
		<div class="flex flex-col items-start">
			<span class="text-[10px] sm:text-xs">Copyright © 2025 NuxtPress. All Rights Reserved.</span>
			<div class="flex space-x-3 mt-2 *:hover:opacity-70 *:transition-opacity *:duration-200">
				<NuxtLink
					to="https://github.com/gmitch215/nuxtpress"
					target="_blank"
				>
					<UIcon
						name="cib:github"
						size="1.5rem"
					/>
				</NuxtLink>
				<NuxtLink
					to="https://patreon.com/gmitch215"
					target="_blank"
				>
					<UIcon
						name="cib:patreon"
						size="1.5rem"
					/>
				</NuxtLink>
			</div>
		</div>
	</div>
</template>

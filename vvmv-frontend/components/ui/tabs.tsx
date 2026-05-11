import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Tabs({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			className={cn("flex flex-col gap-2", className)}
			{...props}
		/>
	);
}

function TabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn(
				"bg-muted text-muted-foreground flex items-center justify-start rounded-md p-1 gap-0.5 overflow-x-auto",
				className,
			)}
			{...props}
		/>
	);
}

function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={(state) =>
				cn(
					"inline-flex items-center justify-center gap-1 rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0",
					"text-muted-foreground hover:text-foreground",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					"disabled:pointer-events-none disabled:opacity-50",
					"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
					state.active && "bg-background text-foreground shadow-sm",
					className,
				)
			}
			{...props}
		/>
	);
}

function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			className={cn("flex-1 outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

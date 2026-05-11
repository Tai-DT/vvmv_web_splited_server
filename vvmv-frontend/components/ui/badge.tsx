import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
				secondary:
					"border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
				destructive:
					"border-transparent bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
				outline:
					"text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
				success:
					"border-transparent bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
				warning:
					"border-transparent bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
				info: "border-transparent bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
				purple:
					"border-transparent bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
				orange:
					"border-transparent bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
				cyan: "border-transparent bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
				indigo:
					"border-transparent bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
				emerald:
					"border-transparent bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
				lime: "border-transparent bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400",
				teal: "border-transparent bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
				sky: "border-transparent bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
				violet:
					"border-transparent bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
				fuchsia:
					"border-transparent bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
				rose: "border-transparent bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
				pink: "border-transparent bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant,
	render = <span />,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { render?: useRender.RenderProp }) {
	return useRender({
		render,
		props: {
			"data-slot": "badge",
			className: cn(badgeVariants({ variant }), className),
			...props,
		},
	});
}

export { Badge, badgeVariants };

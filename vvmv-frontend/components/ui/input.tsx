"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { CalendarIcon, ClockIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({
	className,
	type,
	...props
}: React.ComponentProps<typeof InputPrimitive>) {
	const inputRef = React.useRef<HTMLInputElement>(null);
	const isDateTimeInput =
		type === "date" || type === "time" || type === "datetime-local";

	const getIcon = () => {
		if (type === "date" || type === "datetime-local") {
			return <CalendarIcon className="size-4 text-muted-foreground" />;
		}
		if (type === "time") {
			return <ClockIcon className="size-4 text-muted-foreground" />;
		}
		return null;
	};

	if (isDateTimeInput) {
		return (
			<div className="relative">
				<InputPrimitive
					ref={inputRef}
					type={type}
					data-slot="input"
					className={cn(
						"file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
						"focus-visible:border-ring focus-visible:ring-ring/50",
						"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
						// Hide native webkit icons
						"[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
						"pr-10", // Add padding for custom icon
						className,
					)}
					{...props}
				/>
				<div
					className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center"
					aria-hidden="true"
				>
					{getIcon()}
				</div>
			</div>
		);
	}

	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				"file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-ring focus-visible:ring-ring/50",
				"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };

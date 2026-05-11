"use client";

export default function AppError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-background text-foreground">
			<h1 className="text-xl font-semibold">Something went wrong</h1>
			<p className="text-muted-foreground text-center max-w-md text-sm">
				{error.message ||
					"An unexpected error occurred while rendering this page."}
			</p>
			<button
				type="button"
				onClick={() => reset()}
				className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
			>
				Try again
			</button>
		</div>
	);
}

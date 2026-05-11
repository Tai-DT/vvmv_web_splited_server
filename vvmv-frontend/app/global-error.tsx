"use client";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
				<div
					style={{
						minHeight: "100vh",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: "1rem",
						padding: "2rem",
					}}
				>
					<h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
						Application error
					</h1>
					<p style={{ color: "#666", textAlign: "center", maxWidth: "28rem" }}>
						{error.message || "A critical error occurred."}
					</p>
					<button
						type="button"
						onClick={() => reset()}
						style={{
							padding: "0.5rem 1rem",
							borderRadius: "0.375rem",
							background: "#171717",
							color: "#fafafa",
							border: "none",
							cursor: "pointer",
						}}
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}

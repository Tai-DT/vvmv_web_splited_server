"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CopyButtonProps {
	value: string;
	label?: string;
	className?: string;
	iconSize?: string;
}

export function CopyButton({
	value,
	label = "Copied to clipboard",
	className = "",
	iconSize = "h-3 w-3",
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = (e: React.MouseEvent) => {
		e.stopPropagation();

		try {
			// Use execCommand for non-HTTPS environments
			const textArea = document.createElement("textarea");
			textArea.value = value;
			textArea.style.position = "fixed";
			textArea.style.left = "-9999px";
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand("copy");
			document.body.removeChild(textArea);

			// Modern clipboard API (requires HTTPS)
			// await navigator.clipboard.writeText(value);

			setCopied(true);
			toast.success(label, {
				description: value,
				duration: 2000,
			});
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
			toast.error("Failed to copy", {
				description: "Could not access clipboard",
				duration: 3000,
			});
		}
	};

	return (
		<button
			onClick={handleCopy}
			className={`p-1 hover:bg-muted rounded transition-all ${className}`}
			title="Copy to clipboard"
			type="button"
		>
			{copied ? (
				<Check className={`${iconSize} text-green-600`} />
			) : (
				<Copy className={iconSize} />
			)}
		</button>
	);
}

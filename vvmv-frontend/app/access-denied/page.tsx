"use client";

import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { AccessDeniedContent } from "../../components/ui/accessDeniedContent";

export default function AccessDeniedPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center w-full">
					<Spinner className="size-20 text-primary" />
				</div>
			}
		>
			<AccessDeniedContent />
		</Suspense>
	);
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthErrorPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to login with error parameter
		router.replace("/login?error=unauthorized");
	}, [router]);

	return (
		<div className="min-h-screen flex items-center justify-center">
			<p className="text-gray-600">Redirecting...</p>
		</div>
	);
}

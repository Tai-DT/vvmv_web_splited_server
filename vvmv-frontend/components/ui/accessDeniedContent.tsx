"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { signOut, useSession } from "@/lib/auth-client";
import { getRoleOrDefault } from "@/types/auth";
import { Button } from "./button";

// This component uses useSearchParams and should be wrapped in Suspense
export function AccessDeniedContent() {
	const { data: session, isPending } = useSession();
	const searchParams = useSearchParams();
	const router = useRouter();
	const reason = searchParams.get("reason");

	const userRole = session?.user?.role
		? getRoleOrDefault(session.user.role)
		: null;

	useEffect(() => {
		if (!isPending && !session) {
			router.push("/login");
		}
	}, [session, isPending, router]);

	const getReasonMessage = () => {
		if (reason === "not-verified") {
			return {
				title: "Email Verification Required",
				message:
					"Your email address has not been verified. VVMV staff (@vvmv.com.vn) are automatically verified upon sign-in. Other users must wait for admin approval before accessing the system.",
			};
		}
		if (reason === "external") {
			return {
				title: "External Access Required",
				message:
					"You need external access to view this page. Only CUSTOMER, MANAGER, ADMIN, and SUPERADMIN roles can access external routes.",
			};
		}
		if (reason === "internal") {
			return {
				title: "Internal Access Required",
				message:
					"You need internal access to view this page. Only STAFF, MANAGER, ADMIN, and SUPERADMIN roles can access internal routes.",
			};
		}
		return {
			title: "Access Denied",
			message: "You do not have permission to access this page.",
		};
	};

	const { title, message } = getReasonMessage();

	if (isPending) {
		return (
			<div className="min-h-screen flex items-center justify-center w-full">
				<Spinner className="size-20 text-primary" />
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 w-full">
			<div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
				<div className="text-center">
					<div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
						<svg
							className="h-8 w-8 text-red-600 dark:text-red-300"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>

					<h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
						{title}
					</h1>

					<p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>

					{userRole && (
						<div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-6">
							<p className="text-sm text-gray-600 dark:text-gray-400">
								Your current role:
							</p>
							<p className="text-lg font-semibold text-gray-900 dark:text-white">
								{userRole}
							</p>
						</div>
					)}

					<div className="space-y-3">
						<Button
							onClick={() => signOut()}
							className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-md transition-colors"
						>
							Sign Out
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

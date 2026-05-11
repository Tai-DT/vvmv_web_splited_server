"use client";

import { AppSidebar } from "@/components/AppSidebar";
import { InternalHeader } from "@/components/internal-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { QueryProvider } from "./query-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<QueryProvider>
			<SidebarProvider
				style={
					{
						"--sidebar-width": "280px",
						"--sidebar-width-icon": "80px",
					} as React.CSSProperties
				}
			>
				<div className="flex h-screen w-full overflow-auto bg-gray-50 dark:bg-gray-950">
					<AppSidebar />

					<SidebarInset className="flex flex-1 w-full min-w-0 flex-col overflow-hidden relative">
						<InternalHeader />
						<main className="flex-1 min-w-0 p-1 md:p-2 overflow-auto">
							{children}
						</main>
					</SidebarInset>
				</div>
			</SidebarProvider>
		</QueryProvider>
	);
}

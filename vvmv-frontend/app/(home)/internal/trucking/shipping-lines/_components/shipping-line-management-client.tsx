"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const ShippingLineEditor = dynamic(
	() => import("./shipping-line-editor").then((mod) => mod.ShippingLineEditor),
	{
		ssr: false,
		loading: () => (
			<div className="space-y-4">
				<div className="flex justify-between items-center gap-4">
					<Skeleton className="h-10 w-[300px] rounded-xl" />
					<div className="flex gap-2">
						<Skeleton className="h-10 w-32 rounded-xl" />
						<Skeleton className="h-10 w-32 rounded-xl" />
					</div>
				</div>
				<Skeleton className="h-[400px] w-full rounded-2xl" />
			</div>
		),
	},
);

export function ShippingLineManagementClient() {
	return <ShippingLineEditor />;
}

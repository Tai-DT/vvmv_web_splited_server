import { ClipboardList, ShieldCheck, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TruckingPage() {
	return (
		<div className="flex h-full w-full items-center justify-center p-6">
			<div className="text-center space-y-6 max-w-md">
				<div className="bg-primary/10 p-4 rounded-full w-fit mx-auto">
					<Truck className="size-12 text-primary" />
				</div>
				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">
						Trucking Management
					</h1>
					<p className="text-muted-foreground">
						Quản lý và theo dõi lộ trình vận chuyển hàng hóa.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 mt-8">
					<Button
						render={<Link href="/internal/trucking/tracking" />}
						size="lg"
						className="w-full"
					>
						<ClipboardList className="mr-2 size-5" />
						Quản lý Tracking
					</Button>

					<Button
						render={<Link href="/internal/trucking/vehicles" />}
						variant="outline"
						size="lg"
						className="w-full"
					>
						<Truck className="mr-2 size-5" />
						Quản lý Phương Tiện (Vehicles)
					</Button>

					<Button
						render={<Link href="/internal/trucking/shipping-lines" />}
						variant="outline"
						size="lg"
						className="w-full"
					>
						<Truck className="mr-2 size-5" />
						Quản lý Hãng Tàu (Shipping Lines)
					</Button>

					<Button
						render={<Link href="/internal/trucking/vendors" />}
						variant="outline"
						size="lg"
						className="w-full"
					>
						<Truck className="mr-2 size-5" />
						Quản lý Vendor
					</Button>

					<Button
						render={<Link href="/internal/trucking/ops" />}
						variant="outline"
						size="lg"
						className="w-full"
					>
						<Truck className="mr-2 size-5" />
						Quản lý Ops
					</Button>

					<Button
						render={<Link href="/internal/trucking/vendor-fee-types" />}
						variant="outline"
						size="lg"
						className="w-full"
					>
						<Truck className="mr-2 size-5" />
						Cấu hình phí Vendor
					</Button>

					<Button
						render={<Link href="/internal/trucking/warehouse" />}
						variant="outline"
						size="lg"
						className="w-full"
					>
						<Warehouse className="mr-2 size-5" />
						Quản lý Kho (Warehouse)
					</Button>

					<Button
						render={<Link href="/internal/trucking/customs-warehouses" />}
						variant="outline"
						size="lg"
						className="w-full"
					>
						<ShieldCheck className="mr-2 size-5" />
						Quản lý Kho Hải Quan (WH HQ)
					</Button>
				</div>
			</div>
		</div>
	);
}

import { getOrderTrackingDataFromDB } from "@/lib/tracking-db";
import { ExternalDashboardClient } from "./_components/external-dashboard-client";

interface PageProps {
	searchParams: Promise<{
		orderCode?: string;
	}>;
}

export default async function ExternalDashboardPage({
	searchParams,
}: PageProps) {
	// Get search params
	const params = await searchParams;
	const orderCode = params.orderCode;

	// Fetch order data from Database if order code is provided
	let orderData = null;
	let error: string | null = null;

	if (orderCode) {
		try {
			orderData = await getOrderTrackingDataFromDB(orderCode);
			if (!orderData) {
				error = "Không tìm thấy đơn hàng với mã vận đơn này.";
			}
		} catch (err) {
			console.error("Error fetching order data:", err);
			error =
				"Có lỗi xảy ra khi lấy dữ liệu từ hệ thống. Vui lòng thử lại sau.";
		}
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Page Title */}
			<div>
				<h1 className="text-2xl font-bold mb-1">THEO DÕI ĐƠN HÀNG</h1>
				<p className="text-sm text-muted-foreground">
					Trang chủ - Theo dõi đơn hàng
				</p>
			</div>

			<ExternalDashboardClient
				orderCode={orderCode}
				orderData={orderData}
				error={error}
			/>
		</div>
	);
}

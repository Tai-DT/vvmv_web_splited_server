"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HistoryTable } from "./history-table";
import { OrderCard } from "./order-card";
import { SearchForm } from "./search-form";

export function ExternalDashboardClient({
	orderCode,
	orderData,
	error,
}: {
	orderCode?: string;
	orderData?: any;
	error?: string | null;
}) {
	const [searching, setSearching] = useState(false);
	const _searchParams = useSearchParams();

	// Reset searching khi URL thay đổi
	useEffect(() => {
		setSearching(false);
	}, []);

	const handleSearchStart = () => {
		setSearching(true);
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Search Section - truyền searching xuống */}
			<SearchForm
				defaultValue={orderCode}
				onSearchStart={handleSearchStart}
				searching={searching} // 👈 Truyền trạng thái xuống
			/>

			{/* Error */}
			{error && (
				<div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<p className="text-red-600 dark:text-red-400">{error}</p>
				</div>
			)}

			{/* Loading state */}
			{searching ? (
				<div className="flex justify-center items-center py-8">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					<span className="ml-2 text-muted-foreground">Đang tìm kiếm...</span>
				</div>
			) : (
				// Hiển thị kết quả khi không searching
				orderData && (
					<>
						<OrderCard order={orderData.order} history={orderData.history} />
						{orderData.history.length > 0 && (
							<HistoryTable history={orderData.history} />
						)}
					</>
				)
			)}

			{/* Empty message */}
			{!orderCode && !error && !searching && (
				<div className="bg-blue-50 dark:bg-blue-950 border rounded-lg p-8 text-center">
					<p className="text-muted-foreground">
						Nhập mã vận đơn ở trên để theo dõi đơn hàng
					</p>
				</div>
			)}
		</div>
	);
}

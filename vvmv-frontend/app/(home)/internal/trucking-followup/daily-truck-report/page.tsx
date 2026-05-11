import type { Metadata } from "next";
import DailyTruckReportPage from "./_components/daily-truck-report-page";

export const metadata: Metadata = {
	title: "Báo cáo Chuyến Xe Hàng Ngày - VVMV Trucking",
	description: "Báo cáo chi tiết công việc của từng đầu xe theo ngày",
};

export default function Page() {
	return <DailyTruckReportPage />;
}

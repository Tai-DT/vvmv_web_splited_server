import ContainerReportPage from "./_components/container-report-page";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Báo cáo Container Trucking | VVMV",
	description: "Báo cáo tổng hợp container theo trucking follow up và FCR",
};

export default function ReportPage() {
	return <ContainerReportPage />;
}

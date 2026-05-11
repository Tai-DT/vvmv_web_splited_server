import type { FollowUpOperationType } from "@/lib/followup/operation-type";

type DirectionalLabels = {
	importLabel: string;
	exportLabel: string;
	fallbackLabel: string;
};

const DIRECTIONAL_LABELS: Record<string, DirectionalLabels> = {
	importerCode: {
		importLabel: "Mã người nhập khẩu (MA_DV)",
		exportLabel: "Mã người xuất khẩu (MA_DV)",
		fallbackLabel: "Mã đơn vị XNK (MA_DV)",
	},
	importExportUnitName: {
		importLabel: "Tên người nhập khẩu",
		exportLabel: "Tên người xuất khẩu",
		fallbackLabel: "Tên đơn vị XNK",
	},
	importerPostalCode: {
		importLabel: "Mã bưu chính người nhập khẩu",
		exportLabel: "Mã bưu chính người xuất khẩu",
		fallbackLabel: "Mã bưu chính đơn vị XNK",
	},
	importExportBusinessAddress: {
		importLabel: "Địa chỉ người nhập khẩu",
		exportLabel: "Địa chỉ người xuất khẩu",
		fallbackLabel: "Địa chỉ đơn vị XNK",
	},
	importerPhone: {
		importLabel: "Điện thoại người nhập khẩu (nếu có)",
		exportLabel: "Điện thoại người xuất khẩu (nếu có)",
		fallbackLabel: "Điện thoại đơn vị XNK (nếu có)",
	},
	entrustedImporterCode: {
		importLabel: "Mã người ủy thác nhập khẩu",
		exportLabel: "Mã người ủy thác xuất khẩu",
		fallbackLabel: "Mã người ủy thác XNK",
	},
	entrustedImporterName: {
		importLabel: "Tên người ủy thác nhập khẩu",
		exportLabel: "Tên người ủy thác xuất khẩu",
		fallbackLabel: "Tên người ủy thác XNK",
	},
	exporterCode: {
		importLabel: "Mã người xuất khẩu (MA_Nguoi_Giao_Hang)",
		exportLabel: "Mã người nhập khẩu (MA_Nguoi_Nhan_Hang)",
		fallbackLabel: "Mã đối tác VNACCS",
	},
	exporterPostalCode: {
		importLabel: "Mã bưu chính người xuất khẩu",
		exportLabel: "Mã bưu chính người nhập khẩu",
		fallbackLabel: "Mã bưu chính đối tác",
	},
	partnerName: {
		importLabel: "Tên người xuất khẩu / người giao hàng",
		exportLabel: "Tên người nhập khẩu / người nhận hàng",
		fallbackLabel: "Tên đối tác",
	},
	partnerAddress1: {
		importLabel: "Địa chỉ người xuất khẩu 1",
		exportLabel: "Địa chỉ người nhập khẩu 1",
		fallbackLabel: "Địa chỉ đối tác 1",
	},
	partnerAddress2: {
		importLabel: "Địa chỉ người xuất khẩu 2",
		exportLabel: "Địa chỉ người nhập khẩu 2",
		fallbackLabel: "Địa chỉ đối tác 2",
	},
	partnerAddress3: {
		importLabel: "Địa chỉ người xuất khẩu 3",
		exportLabel: "Địa chỉ người nhập khẩu 3",
		fallbackLabel: "Địa chỉ đối tác 3",
	},
	partnerAddress4: {
		importLabel: "Địa chỉ người xuất khẩu 4",
		exportLabel: "Địa chỉ người nhập khẩu 4",
		fallbackLabel: "Địa chỉ đối tác 4",
	},
	exportCountryCode: {
		importLabel: "Mã nước xuất khẩu (ô Mã Nước)",
		exportLabel: "Mã nước nhập khẩu (ô Mã Nước)",
		fallbackLabel: "Mã nước (ô Mã Nước)",
	},
};

export function getCdsVnaccsFieldLabel(
	fieldKey: string,
	operationType: FollowUpOperationType | null,
): string | null {
	const labels = DIRECTIONAL_LABELS[fieldKey];
	if (!labels) {
		return null;
	}

	if (operationType === "NHAP") {
		return labels.importLabel;
	}

	if (operationType === "XUAT") {
		return labels.exportLabel;
	}

	return labels.fallbackLabel;
}

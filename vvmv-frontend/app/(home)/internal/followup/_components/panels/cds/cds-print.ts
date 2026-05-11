// cds-print.ts – print utility functions extracted from cds-info-panel.tsx (Phase 2)

// Convert stored YYYY-MM-DD → display dd/mm/yyyy
export function toDisplayDate(iso: string | null | undefined): string {
	if (!iso) return "";
	const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
	return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function escapePrintHtml(value: string | null | undefined) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function buildCargoIdentificationPrintHtml(payload: {
	cargoIdentificationNumber: string;
	declarationNumber?: string | null;
	declarationDate?: string | null;
	taxCode?: string | null;
	companyName?: string | null;
	jobNumber?: string | null;
	sourceLabel?: string | null;
	printedAt: string;
}) {
	const rows = [
		["Số định danh hàng hóa", payload.cargoIdentificationNumber],
		["Số tờ khai", payload.declarationNumber || "—"],
		["Ngày khai", toDisplayDate(payload.declarationDate) || "—"],
		["MST", payload.taxCode || "—"],
		["Khách hàng", payload.companyName || "—"],
		["Job", payload.jobNumber || "—"],
		["Nguồn dữ liệu", payload.sourceLabel || "CDS Info"],
		["In lúc", payload.printedAt],
	]
		.map(
			([label, value]) => `
        <tr>
          <td class="label">${escapePrintHtml(label)}</td>
          <td class="value">${escapePrintHtml(value)}</td>
        </tr>
      `,
		)
		.join("");

	return `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>In số định danh hàng hóa</title>
    <style>
      @page {
        size: A4;
        margin: 12mm;
      }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        color: #0f172a;
      }
      .sheet {
        border: 1px solid #cbd5e1;
        padding: 18px;
      }
      .heading {
        margin-bottom: 14px;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 10px;
      }
      .title {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      .subtitle {
        margin-top: 4px;
        font-size: 12px;
        color: #475569;
      }
      .hero {
        margin: 18px 0;
        border: 2px solid #1d4ed8;
        background: #eff6ff;
        padding: 16px;
      }
      .hero-value {
        margin: 0;
        font-size: 32px;
        font-weight: 700;
        font-family: "Courier New", Courier, monospace;
        letter-spacing: 0.06em;
        color: #1e3a8a;
        word-break: break-all;
      }
      .details {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
        font-size: 13px;
      }
      .details td {
        padding: 6px 10px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }
      .details .label {
        width: 200px;
        font-weight: 600;
        color: #475569;
      }
      .details .value {
        color: #0f172a;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="heading">
        <h1 class="title">Thông tin Định danh Hàng hóa</h1>
        <p class="subtitle">Cargo Identification Summary</p>
      </div>
      <div class="hero">
        <p class="hero-value">${escapePrintHtml(payload.cargoIdentificationNumber)}</p>
      </div>
      <table class="details">
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
}

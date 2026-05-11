import re

with open("/Users/tai/Desktop/vvmv-web/app/(home)/internal/followup/_components/panels/cds/tabs/cds-export-general-tab.tsx", "r") as f:
    content = f.read()

# I will just write a new block for the top box.
new_top_box = """      <fieldset className="border border-[#a0a0a0] px-2 py-1.5 mb-1 mt-1 shrink-0 bg-[#efefef]">
        <div className="space-y-1 text-[12px]">
          {/* Nhóm loại hình */}
          <div className="flex items-center gap-3 text-[12px] mb-1.5">
            <span className="w-[140px] text-right text-[#1e395b] pr-2">Nhóm loại hình:</span>
            <div className="flex items-center gap-4">
              {ECUS_BUSINESS_GROUP_OPTIONS.map((option) => (
                <label key={option} className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="businessTypeGroup" checked={data.businessTypeGroup === option} onChange={() => handleFieldChange("businessTypeGroup", option)} className="h-3 w-3" />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Số tờ khai")}</div>
            <div className="w-[180px]">{renderClassicInput("declarationNumber", undefined, undefined, getExportFieldLockOptions("declarationNumber"))}</div>
            <div className="w-[260px] text-right pr-2">{renderClassicLabel("STT")}</div>
            <div className="w-[80px]">{renderClassicInput("declarationSequenceNumber", undefined, undefined, getExportFieldLockOptions("declarationSequenceNumber"))}</div>
          </div>

          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Số tờ khai đầu tiên")}</div>
            <div className="w-[120px]">{renderClassicInput("firstDeclarationNumber", undefined, undefined, getExportFieldLockOptions("firstDeclarationNumber"))}</div>
            <div className="w-[60px] text-right pr-1">{renderClassicLabel("Số nhánh")}</div>
            <div className="w-[30px]">{renderClassicInput("branchNumberPart1", undefined, undefined, getExportFieldLockOptions("branchNumberPart1"))}</div>
            <div className="w-[10px] text-center text-slate-800">/</div>
            <div className="w-[30px]">{renderClassicInput("branchNumberPart2", undefined, undefined, getExportFieldLockOptions("branchNumberPart2"))}</div>
            <div className="w-[230px] text-right pr-2">{renderClassicLabel("Số tờ khai tạm nhập tái xuất tương ứng")}</div>
            <div className="flex w-[140px] gap-0.5">
              <div className="flex-1">{renderClassicInput("correspondingDeclarationNumber")}</div>
              {renderLookupPickerButton("correspondingDeclarationNumber", { className: "w-[24px] h-[22px] p-0" })}
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Mã loại hình", true)}</div>
            <div className="w-[190px]">
              {renderLookupCodeAndName("operationCode", undefined, { codeWidthClassName: "w-[50px]", hideButton: false })}
            </div>
            <div className="w-[250px] text-right pr-2">{renderClassicLabel("Mã phân loại hàng hóa")}</div>
            <div className="w-[180px]">{renderClassicSelect("cargoClassificationCode", undefined, getExportFieldLockOptions("cargoClassificationCode"))}</div>
          </div>

          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Cơ quan Hải quan", true)}</div>
            <div className="w-[240px]">
              {renderLookupCodeAndName("customsCode", undefined, { codeWidthClassName: "w-[50px]", hideButton: false })}
            </div>
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Mã bộ phận xử lý tờ khai")}</div>
            <div className="w-[180px]">{renderClassicSelect("declarationProcessingDeptCode")}</div>
          </div>

          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Thời hạn tái nhập khẩu")}</div>
            <div className="w-[100px]">{renderClassicDateInput("reExportDeadline")}</div>
            <div className="w-[340px] text-right pr-2">{renderClassicLabel("Mã hiệu phương thức vận chuyển", true)}</div>
            <div className="w-[180px]">{renderClassicSelect("transportMethodCode")}</div>
          </div>

          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Ngày khai báo (dự kiến)")}</div>
            <div className="w-[100px]">{renderClassicDateInput("expectedDeclarationDate")}</div>
          </div>
        </div>
      </fieldset>"""

import_export_box = """      <GroupBox title="Đơn vị xuất nhập khẩu">
        <div className="space-y-1 text-[12px] pb-1">
          {/* Người xuất khẩu */}
          <div className="pl-[20px] font-bold text-slate-800 leading-5">Người xuất khẩu</div>
          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Mã")}</div>
            <div className="w-[160px]">{renderClassicInput("importerCode", undefined, undefined, getExportFieldLockOptions("importerCode"))}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Tên")}</div>
            <div className="flex-1 max-w-[620px]">{renderClassicInput("importExportUnitName")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Mã bưu chính")}</div>
            <div className="w-[160px]">{renderClassicInput("importerPostalCode")}</div>
          </div>
          <div className="flex mt-1">
            <div className="w-[140px] text-right pr-2 pt-0.5">{renderClassicLabel("Địa chỉ")}</div>
            <div className="flex-1 max-w-[620px]">
              <Textarea value={String(data.importExportBusinessAddress ?? "")} onChange={(e) => handleFieldChange("importExportBusinessAddress", e.target.value)} rows={2} className="w-full h-[36px] rounded-none border border-slate-500 bg-white px-1 py-0.5 text-[12px] text-slate-900 shadow-none outline-none focus-visible:ring-0 focus:border-sky-700 resize-none leading-relaxed" />
            </div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Điện thoại")}</div>
            <div className="w-[160px]">{renderClassicInput("importerPhone")}</div>
          </div>

          {/* Người ủy thác xuất khẩu */}
          <div className="pl-[20px] font-bold text-slate-800 leading-5 mt-1.5">Người ủy thác xuất khẩu</div>
          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Mã")}</div>
            <div className="w-[160px]">{renderClassicInput("entrustedImporterCode")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Tên")}</div>
            <div className="flex-1 max-w-[620px]">{renderClassicInput("entrustedImporterName")}</div>
          </div>

          {/* Người nhập khẩu */}
          <div className="pl-[20px] font-bold text-slate-800 leading-5 mt-1.5">Người nhập khẩu</div>
          <div className="flex items-center">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Mã")}</div>
            <div className="flex w-[160px] gap-0.5">
              <div className="flex-1">{renderClassicInput("exporterCode")}</div>
              {renderLookupPickerButton("exporterCode", { className: "w-[24px] h-[22px] p-0" })}
            </div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Tên", true)}</div>
            <div className="flex-1 max-w-[620px]">{renderClassicInput("partnerName")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Mã bưu chính")}</div>
            <div className="w-[160px]">{renderClassicInput("exporterPostalCode")}</div>
          </div>
          <div className="flex items-start mt-1">
            <div className="w-[140px] text-right pr-2 pt-0.5">{renderClassicLabel("Địa chỉ", true)}</div>
            <div className="flex-1 max-w-[620px] space-y-1">
              {renderClassicInput("partnerAddress1")}
              <div className="flex gap-1">
                <div className="flex-1">{renderClassicInput("partnerAddress2")}</div>
                <div className="flex-1">{renderClassicInput("partnerAddress3")}</div>
                <div className="flex-1">{renderClassicInput("partnerAddress4")}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Mã nước")}</div>
            <div className="w-[260px]">
              {renderClassicCodeLookupSelect("exportCountryCode", { codeWidthClassName: "w-[40px]", selectClassName: "w-[180px]" })}
            </div>
          </div>

          <div className="flex items-center mt-2 pl-2">
            <div className="w-[132px] text-[#1e395b] text-[12px]">Mã người khai Hải quan:</div>
            <div className="w-[160px]">{renderClassicInput("customsDeclarantCode")}</div>
          </div>
        </div>
      </GroupBox>"""

vandon_box = """      <GroupBox title="Vận đơn">
        <div className="space-y-1 text-[12px] pb-1">
          <div className="flex items-center">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Số vận đơn")}</div>
            <div className="w-[200px]">{renderClassicInput("billOfLading")}</div>
            <div className="ml-2 flex gap-1">
              {renderInfoButton("Số vận đơn hiện nhập trực tiếp hoặc lấy từ dữ liệu đã nạp.", { buttonLabel: "Chọn...", className: "px-2.5 h-[22px] min-w-[60px]" })}
              {renderInfoButton("Đăng ký vận đơn riêng trong web chưa bật cho màn này.", { buttonLabel: "Đăng ký...", className: "px-2.5 h-[22px] min-w-[70px]" })}
              {renderInfoButton("In định danh chưa được bật cho màn tờ khai xuất khẩu.", { buttonLabel: "In định danh", className: "px-2.5 h-[22px] min-w-[80px]" })}
            </div>
          </div>

          <div className="flex items-center mt-1">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Số lượng kiện", true)}</div>
            <div className="w-[80px] pr-1">{renderClassicInput("packageQuantity")}</div>
            <div className="w-[120px]">{renderClassicSelect("packageType")}</div>
            <div className="w-[190px] text-right pr-2">{renderClassicLabel("Tổng trọng lượng hàng (Gross)")}</div>
            <div className="w-[100px] pr-1">{renderClassicInput("grossWeightTotal")}</div>
            <div className="w-[80px]">{renderClassicSelect("weightUnit")}</div>
          </div>

          <div className="flex items-center mt-1">
            <div className="w-[160px] text-right pr-2 whitespace-nowrap overflow-hidden text-ellipsis leading-3 pt-0.5 h-[22px]">{renderClassicLabel("Mã địa điểm lưu kho hàng chờ thông quan dự kiến")}</div>
            <div className="w-[420px]">{renderClassicCodeLookupSelect("warehouseLocationCode", { codeWidthClassName: "w-[80px]" })}</div>
          </div>

          <div className="flex items-center mt-1">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Địa điểm nhận hàng cuối cùng", true)}</div>
            <div className="w-[420px]">{renderClassicCodeLookupSelect("taxDestinationLocation", { codeWidthClassName: "w-[80px]" })}</div>
          </div>

          <div className="flex items-center mt-1">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Địa điểm xếp hàng")}</div>
            <div className="w-[420px]">{renderClassicCodeLookupSelect("loadingLocationCode", { codeWidthClassName: "w-[80px]" })}</div>
          </div>

          <div className="flex items-center mt-1">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Phương tiện vận chuyển")}</div>
            <div className="flex w-[420px] gap-0.5">
              <div className="w-[80px]">{renderClassicInput("transportVehicleCode")}</div>
              <div className="flex-1">{renderClassicInput("transportVehicleName")}</div>
              {renderLookupPickerButton("transportVehicleCode", { className: "w-[24px] h-[22px] p-0" })}
            </div>
          </div>

          <div className="flex items-center mt-1">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Ngày hàng đi dự kiến", true)}</div>
            <div className="w-[120px]">{renderClassicDateInput("departureDate")}</div>
          </div>

          <div className="flex items-center mt-1">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Ký hiệu và số hiệu")}</div>
            <div className="w-[300px]">{renderClassicInput("packageMarks")}</div>
          </div>
        </div>
      </GroupBox>"""

thong_tin_hop_dong_box = """      <GroupBox title="Thông tin hợp đồng">
        <div className="space-y-1 text-[12px] pb-1">
          <div className="flex items-center">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Số hợp đồng")}</div>
            <div className="w-[160px]">{renderClassicInput("contractNumber")}</div>
            <div className="ml-4">
              <a href="#" className="text-blue-700 underline text-[11px] hover:text-blue-500">Khai báo thông tin HĐ theo yêu cầu của Hải quan</a>
            </div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[160px] text-right pr-2">{renderClassicLabel("Ngày hợp đồng")}</div>
            <div className="w-[100px]">{renderClassicDateInput("contractDate")}</div>
            <div className="w-[100px] text-right pr-2">{renderClassicLabel("Ngày hết hạn")}</div>
            <div className="w-[100px]">{renderClassicDateInput("contractGoodsDate")}</div>
          </div>
        </div>
      </GroupBox>"""

thong_tin_hoa_don_box = """      <GroupBox title="Thông tin hóa đơn">
        <div className="space-y-1 text-[12px] pb-1">
          <div className="flex items-center">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Phân loại hình thức hóa đơn")}</div>
            <div className="w-[160px]">{renderClassicSelect("invoiceFormClassificationCode")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Số tiếp nhận hóa đơn điện tử")}</div>
            <div className="w-[160px]">{renderClassicInput("electronicInvoiceReceiptNumber")}</div>
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Số hóa đơn")}</div>
            <div className="w-[260px]">{renderClassicInput("commercialInvoice")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Ngày phát hành")}</div>
            <div className="w-[100px]">{renderClassicDateInput("commercialInvoiceDate")}</div>
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Phương thức thanh toán")}</div>
            <div className="w-[260px]">{renderClassicSelect("paymentMethod")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Mã phân loại giá hóa đơn", true)}</div>
            <div className="w-[100px]">{renderClassicSelect("invoiceClassificationCode")}</div>
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Điều kiện giá hóa đơn", true)}</div>
            <div className="w-[260px]">{renderClassicSelect("invoicePriceCondition")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Tổng trị giá hóa đơn", true)}</div>
            <div className="w-[160px]">{renderClassicInput("totalInvoiceValue")}</div>
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Mã đồng tiền của hóa đơn", true)}</div>
            <div className="w-[260px]">{renderClassicSelect("invoiceCurrency")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Trị giá tính thuế")}</div>
            <div className="w-[160px]">{renderClassicInput("totalTaxableValue")}</div>
            <div className="w-[140px] text-right pr-2 whitespace-nowrap overflow-hidden text-ellipsis leading-3 pt-0.5 h-[22px]">{renderClassicLabel("Mã đồng tiền trị giá tính thuế")}</div>
            <div className="w-[260px]">{renderClassicSelect("taxableValueCurrencyCode")}</div>
          </div>
        </div>
      </GroupBox>"""

thue_va_bao_lanh_box = """      <GroupBox title="Thuế và bảo lãnh">
        <div className="space-y-1 text-[12px] pb-1">
          <div className="flex items-center">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Phân loại không cần quy đổi VNĐ")}</div>
            <div className="w-[100px]">{renderClassicInput("valuationDeclarationTypeCode")}</div>
            <div className="w-[240px] text-right pr-2">{renderClassicLabel("Tổng hệ số phân bổ trị giá tính thuế")}</div>
            <div className="w-[140px]">{renderClassicReadonlyInput(valuationAllocationRatioTotal)}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Người nộp thuế")}</div>
            <div className="w-[100px]">{renderClassicSelect("taxPayer")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Mã ngân hàng trả thuế thay")}</div>
            <div className="w-[420px]">{renderClassicCodeLookupSelect("taxSubstituteBankCode", { codeWidthClassName: "w-[80px]" })}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Năm phát hành hạn mức")}</div>
            <div className="w-[60px] pl-[1px]">{renderClassicInput("creditLimitIssueYear")}</div>
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Ký hiệu chứng từ hạn mức")}</div>
            <div className="w-[140px]">{renderClassicInput("creditLimitDocumentSymbol")}</div>
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Số chứng từ hạn mức")}</div>
            <div className="w-[140px]">{renderClassicInput("creditLimitDocumentNumber")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Mã xác định thời hạn nộp thuế")}</div>
            <div className="w-[160px]">{renderClassicInput("taxPaymentDeadlineCode")}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Mã ngân hàng bảo lãnh")}</div>
            <div className="w-[420px]">{renderClassicCodeLookupSelect("guaranteeBankCode", { codeWidthClassName: "w-[80px]" })}</div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Năm phát hành bảo lãnh")}</div>
            <div className="w-[60px] pl-[1px]">{renderClassicInput("guaranteeIssueYear")}</div>
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Ký hiệu chứng từ bảo lãnh")}</div>
            <div className="w-[140px]">{renderClassicInput("guaranteeDocumentSymbol")}</div>
            <div className="w-[140px] text-right pr-2">{renderClassicLabel("Số chứng từ bảo lãnh")}</div>
            <div className="w-[140px]">{renderClassicInput("guaranteeDocumentNumber")}</div>
          </div>
        </div>
      </GroupBox>"""

thong_tin_van_chuyen_box = """      <GroupBox title="Thông tin vận chuyển">
        <div className="space-y-1 text-[12px] pb-1">
          <div className="flex items-center mb-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Ngày khởi hành vận chuyển")}</div>
            <div className="w-[120px]">{renderClassicDateInput("transportDepartureDate")}</div>
          </div>
          <TransportSchedulesTable {...commonTableProps} />
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2 whitespace-nowrap">{renderClassicLabel("Địa điểm đích cho vận chuyển bảo thuế")}</div>
            <div className="w-[420px]">{renderClassicCodeLookupSelect("taxDestinationLocation", { codeWidthClassName: "w-[80px]" })}</div>
          </div>
        </div>
      </GroupBox>"""

thong_tin_khac_box = """      <GroupBox title="Thông tin khác">
        <div className="space-y-1 text-[12px] pb-1">
          <div className="flex items-start">
            <div className="w-[200px] text-right pr-2 pt-0.5">{renderClassicLabel("Phần ghi chú")}</div>
            <div className="w-[620px]">
              <Textarea value={typeof data.note === "string" ? data.note : ""} onChange={(e) => handleFieldChange("note", e.target.value)} rows={2} className="w-full h-[40px] rounded-none border border-slate-500 bg-white px-1 py-0.5 text-[12px] text-slate-900 shadow-none outline-none focus-visible:ring-0 focus:border-sky-700 resize-none leading-relaxed" />
            </div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-[200px] text-right pr-2">{renderClassicLabel("Số quản lý của nội bộ doanh nghiệp")}</div>
            <div className="w-[260px]">{renderClassicInput("internalBusinessManagementNumber")}</div>
          </div>
        </div>
      </GroupBox>"""

# Find starting and end indices
start_idx = content.find('{/* ════════════════════════════════════════════════════════')
if start_idx == -1:
    print("Could not find start idx")
    exit(1)

end_idx = content.find('</div>{/* end minWidth wrapper */}')
if end_idx == -1:
    print("Could not find end idx")
    exit(1)

new_content = content[:start_idx] + new_top_box + "\n\n" + import_export_box + "\n\n" + vandon_box + "\n\n" + thong_tin_hop_dong_box + "\n\n      <GroupBox title=\"Chứng từ giấy phép\">\n        <ExportLicenseDocumentTable {...commonTableProps} />\n      </GroupBox>\n\n" + thong_tin_hoa_don_box + "\n\n" + thue_va_bao_lanh_box + "\n\n      <GroupBox title=\"Thông tin đính kèm\">\n        <ElectronicAttachmentsTable {...commonTableProps} />\n      </GroupBox>\n\n" + thong_tin_van_chuyen_box + "\n\n" + thong_tin_khac_box + "\n      " + content[end_idx:]

with open("/Users/tai/Desktop/vvmv-web/app/(home)/internal/followup/_components/panels/cds/tabs/cds-export-general-tab.tsx", "w") as f:
    f.write(new_content)

print("Rewrite complete!")

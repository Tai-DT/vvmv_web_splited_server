import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryERPHAN } from "@/lib/db/erp-han";
import { queryERPHCM } from "@/lib/db/erp-hcm";

const AR_SQL = `
DECLARE @IDKeyShipment NVARCHAR(50), @IDKey NVARCHAR(50)
DECLARE @Cost_DescEn NVARCHAR(50), @NextRefNo INT, @Cost_DescLocal NVARCHAR(50)
DECLARE @SendTo NVARCHAR(20) = @SendToParam
DECLARE @Remarks NVARCHAR(255) = N''
DECLARE @PaymentMethod NVARCHAR(50) = 'CK'
DECLARE @PayeeCode NVARCHAR(20) = @PartnerID
DECLARE @DataInput  NVARCHAR(50)
DECLARE @WhoisMaking NVARCHAR(100) = @WhoisMakingParam

SELECT top 1 @DataInput = DataInput, @IDKeyShipment = IDKeyShipmentDT, @IDKey = IDKeyIndex, @Cost_DescEn  = Notes from ProfitShares 
WHERE HAWBNO = @HWBNO
AND FieldKey LIKE 'API(%)' AND CAST(TotalValue AS INT) = CAST(@Amount AS INT) and RequisitionID is null
AND DPT = 0 AND SortDes = @Cost_Code  and Docs = @DocNo 
order by TRY_CAST(DataInput AS INT) DESC

select @Cost_DescEn = FeeDescEn,@Cost_DescLocal = FeeDescLocal from NameFeeDescription where feeCode = @Cost_Code
 
-- Kiểm tra điều kiện trước khi insert
IF @IDKeyShipment IS NOT NULL
BEGIN
	BEGIN TRY
    	BEGIN TRANSACTION;

    	-- Bước 0: Tạo bảng tạm để lưu IDKeyIndex vừa insert
    	DECLARE @InsertedIDs TABLE (IDKeyIndex INT);
    	DECLARE @RefNo TABLE (RefNo nvarchar(50));
        DECLARE @CurrentYearMonth VARCHAR(5) = FORMAT(GETDATE(), 'yy-MM');

        SELECT @NextRefNo = ISNULL(MAX(CAST(RIGHT(RefNo, 4) AS INT)), 0) + 1
        FROM AdvanceRequest WITH (UPDLOCK, HOLDLOCK)
        WHERE RefNo LIKE 'AR-' + @CurrentYearMonth + '-%';
   	
     	-- Bước 1: Make AR
    	INSERT INTO AdvanceRequest (
        	RefNo, Created, Modified, JobNo, HBLNo, PayeeID, Description,
        	AvdAmount, Curr, ExchangeRate, Deadline, PaymentMethod,
        	RequesterID, RequesterName, UserName, ContactName, Locked,
        	Advanced, AdvanceNo, Remarks, SettleNo, VoucherID, VoucherIDSE,
        	DVHistory, FromShipment, MultiPartner, Decline,
        	DeclineDate, Cancelled, CancelledDate, AdvanceAR, DescriptionLC,
        	SourceTables,Attached
    	)
    	OUTPUT INSERTED.RefNo INTO @RefNo
    	VALUES (
        	CONCAT('AR-', @CurrentYearMonth, '-', FORMAT(@NextRefNo, '0000')),
        	CONVERT(DATETIME, CONVERT(VARCHAR(16), GETDATE(), 120)) ,CONVERT(DATETIME, CONVERT(VARCHAR(16), DATEADD(SECOND, 312, GETDATE()), 120)) , @TransId, @HWBNO, @PayeeCode,
        	@Cost_DescEn + ' (Job ID: ' + @TransId + ' H-B/L:' + @HWBNO + ')',
        	@Amount, 'VND', 1, NULL, @PaymentMethod, @SendTo,
        	((select top 1 ContactName from ContactsList where ContactID = @SendTo )), @WhoisMaking,
        	(select top 1 ContactName from ContactsList where Username = @WhoisMaking), 0, 0,
        	NULL, @Remarks, NULL, NULL, NULL, NULL, 1, 0, 0 ,NULL, 0, NULL, 0,
        	@Cost_DescLocal + ' (Job ID: ' + @TransId + ' H-B/L:' + @HWBNO + ')', 
         	NULL,(SELECT top 1 Attached from  AdvanceRequest where Attached is not NULL )    	);

    	-- Lấy AR vừa sinh
    	DECLARE @AR_NO nvarchar(50) = (SELECT TOP 1 RefNo FROM @RefNo);

    	-- Bước 2: Insert bản ghi đầu tiên và lấy ID tự sinh
    	Update ProfitShares set RequisitionID = @AR_NO 
        WHERE HAWBNO = @HWBNO
            AND DataInput = @DataInput  and IDKeyIndex = @IDKey
	
	    --INSERT INTO OPSManagement (
      --  	OPStaffID, Description, StartDate,
      --  	FinishDate, UserEdit, Modify,
      -- 	RefNo, RequestType
	    --) VALUES (
      --  	@SendTo,'Advance Request Ref No.: ' + @AR_NO + ' with amount: ' + FORMAT(@Amount, 'N0') + ' VND', DATEADD(SECOND, 312, GETDATE()), 
      --  	NULL, @WhoisMaking, DATEADD(SECOND, 312, GETDATE()),
     	--    @AR_NO , 'Advance Request'
	    --);

	    -- Hiển thị kết quả
	    SELECT @AR_NO AS 'AR_NO'

        COMMIT TRANSACTION;
	END TRY
	BEGIN CATCH
    	ROLLBACK TRANSACTION;
    	THROW;
	END CATCH
END
ELSE
BEGIN
 	RAISERROR('Không thể tìm phí trong lô hàng,  Vui lòng kiểm tra lại.', 16, 1);
END
`;

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { domain, hbl, job, docs, total, feeCode, partnerId } = body;

		if (
			!domain ||
			!hbl ||
			!job ||
			typeof total !== "number" ||
			!feeCode ||
			!partnerId
		) {
			return NextResponse.json(
				{
					message:
						"Missing required fields (domain, hbl, job, docs, total, feeCode, partnerId)",
				},
				{ status: 400 },
			);
		}

		const isHan = domain === "HAN" || domain === "DAD";

		const params = {
			HWBNO: hbl,
			TransId: job,
			DocNo: docs || "",
			Amount: Math.round(total),
			Cost_Code: feeCode,
			PartnerID: partnerId,
			WhoisMakingParam: isHan ? "acchan7@vvmv.com.vn" : session.user.email,
			SendToParam: isHan ? "CT1269" : "",
		};
		console.log("----------------------------params", params);
		let erpResult;
		try {
			erpResult = isHan
				? await queryERPHAN<{ AR_NO: string }>(AR_SQL, params)
				: await queryERPHCM<{ AR_NO: string }>(AR_SQL, params);
		} catch (dbErr: any) {
			console.error("[erp-create-ar] SQL Execution failed:", dbErr);
			return NextResponse.json(
				{ message: "Tạo AR thất bại trên ERP", details: dbErr.message },
				{ status: 422 },
			);
		}

		const arNo = erpResult.recordset?.[0]?.AR_NO ?? null;
		if (!arNo) {
			return NextResponse.json(
				{ message: "Không thể tạo AR (không nhận được AR_NO)" },
				{ status: 422 },
			);
		}

		return NextResponse.json({ success: true, arNo });
	} catch (error: any) {
		console.error("[erp-create-ar] Overall Error:", error);
		return NextResponse.json(
			{ message: "Lỗi nội bộ khi tạo AR", details: error?.message },
			{ status: 500 },
		);
	}
}

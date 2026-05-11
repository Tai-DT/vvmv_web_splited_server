import { queryERPHAN, queryERPHCM } from "@/lib/db";

/**
 * Recreates a transaction in ERP using an existing job number.
 */
export async function recreateTransaction(
	jobNumber: string,
	userAccount: string,
	followUp: any,
) {
	const erpSite = jobNumber.toUpperCase().startsWith("HCM") ? "HCM" : "HAN";

	// Map service type logic similar to create-transaction/route.ts
	const operationType = followUp.operationType;
	const serviceType = operationType === "XUAT" ? "LOGEX" : "LOGIM";

	const sqlQuery = `
    DECLARE
    @SITE         NVARCHAR(200)   = @pSITE
    , @WHOISMAKING      NVARCHAR(200)   = @pWHOISMAKING
    , @IN_TYPEOFSERVICE   NVARCHAR(200)   = @pIN_TYPEOFSERVICE
    , @CustomerCode     NVARCHAR(50)    = @pCustomerCode
    , @HWBNO          NVARCHAR(50)    = @pHWBNO
    , @IN_FREIGHT       NVARCHAR(20)    = 'F'
    , @JOBNUMBER      NVARCHAR(200)   = @pJobNumber
    , @CustomerName          NVARCHAR(255)
    , @CustomerShortName          NVARCHAR(255)
    , @OUT_TYPEOFSERVICE     NVARCHAR(200)
    , @OUT_FREIGHT           NVARCHAR(20)
    , @DATEFILENO            DATE            = CAST(GETDATE() AS DATE)
    , @NOWTIME               DATETIME        = GETDATE()
    , @TransID               NVARCHAR(50)
    , @MaxLotNo              INT
    , @NewLotNo              NVARCHAR(20)
    , @IN_USERNAME           NVARCHAR(100)
    , @CURRENT_ID            INT
    , @PCNAME_LOG            NVARCHAR(255)
    , @COMPUTER_NAME         NVARCHAR(255)  = 'VDI-HN'
;

------------------------------------------------------------
-- CHECK USERNAME
------------------------------------------------------------
SET @IN_USERNAME = @WHOISMAKING
IF NOT EXISTS (SELECT 1 FROM ContactsList WHERE UserName = @IN_USERNAME and disable = 0)
BEGIN
     RAISERROR('%s NOT EXISTS', 16, 1, @IN_USERNAME);
     RETURN;
END;

------------------------------------------------------------
-- MAP FREIGHT & SERVICE
------------------------------------------------------------
SET @OUT_FREIGHT = 'FREE-HAND';
SET @OUT_TYPEOFSERVICE = CASE RTRIM(@IN_TYPEOFSERVICE) WHEN 'LOGIM' THEN 'CustomsLogistics' WHEN 'LOGEX' THEN 'CustomsLogistics' ELSE 'CustomsLogistics' END;

------------------------------------------------------------
-- CHECK IF JOB ALREADY EXISTS (to be safe)
------------------------------------------------------------
IF EXISTS (SELECT 1 FROM Transactions WHERE TransID = @JOBNUMBER)
BEGIN
    -- Already exists, just return success metadata
    SELECT 
          TransID    AS NEW_FILE_NO
        , ''         AS HWBNO
        , ''         AS CUSTOMER_CODE
        , ''         AS CUSTOMER_NAME
    FROM Transactions WHERE TransID = @JOBNUMBER;
    RETURN;
END;

------------------------------------------------------------
-- GET CUSTOMER NAME
------------------------------------------------------------
SELECT TOP 1
    @CustomerName      = PartnerName2,
    @CustomerCode      = PARTNERID,
    @CustomerShortName = COALESCE(PartnerName, PartnerName2, PartnerName3)
FROM PARTNERS
WHERE (TAXCODE = @CustomerCode OR PARTNERID = @CustomerCode)
  AND Denied = 0;

IF @CustomerName IS NULL
BEGIN
    RAISERROR('@CustomerCode NOT FOUND', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRAN;

    --------------------------------------------------------
    -- INSERT INTO TRANSACTIONS
    --------------------------------------------------------
    INSERT INTO Transactions (
        TransID, TransDate, ModifyDate, LoadingDate, TpyeofService, WhoisMaking,
        Noofpieces, GrossWeight, ChargeableWeight, [Length], PSAC, SeaCBM, NoofPages, NoInvoice
    )
    VALUES (
        @JOBNUMBER, @DATEFILENO, @NOWTIME, @DATEFILENO, @OUT_TYPEOFSERVICE, @WHOISMAKING,
        '0','0','0','0','0','0','0','0'
    );

    --------------------------------------------------------
    -- HANDLE HWBNO (Default if empty)
    --------------------------------------------------------
    IF @HWBNO IS NULL OR LTRIM(RTRIM(@HWBNO)) = ''
    BEGIN
        SET @HWBNO = @JOBNUMBER + '/1';
    END;

    --------------------------------------------------------
    -- UPSERT HAWB
    --------------------------------------------------------
    IF EXISTS (SELECT 1 FROM HAWB WHERE HWBNO = @HWBNO)
    BEGIN
        UPDATE HAWB
        SET TRANSID     = @JOBNUMBER,
            ConsigneeID = @CustomerCode,
            Consignee   = @CustomerName,
            [Owner]     = @WHOISMAKING,
            ExecutedOn  = @DATEFILENO
        WHERE HWBNO = @HWBNO;
    END
    ELSE
    BEGIN
        INSERT INTO HAWB (
            TRANSID, HWBNO, ConsigneeID, Consignee, [Owner], ExecutedOn, [Description]
        )
        VALUES (
            @JOBNUMBER, @HWBNO, @CustomerCode, @CustomerName,
            @WHOISMAKING, @DATEFILENO, ''
        );
    END;

    --------------------------------------------------------
    -- INSERT TransactionDetails
    --------------------------------------------------------
    SET @NewLotNo = RIGHT('00000' + CAST(1 AS NVARCHAR(20)), 5);
    INSERT INTO TransactionDetails (
        TransID, lotNo, ShipperID, HWBNO, NominationParty, ShipmentType,
        RateConfirm, Notes, Deliveryat, SpecialRequest, BLType, PaymentMethod, DOStatus
    )
    VALUES (
        @JOBNUMBER, @NewLotNo, @CustomerCode, @HWBNO, '',
        'FREE-HAND', '', '', '', '', '', '', ''
    );

    ------------------------------------------------------------
    -- LOGGING (Partial)
    ------------------------------------------------------------
    SELECT TOP 1 @CURRENT_ID = ID FROM ActiveUsers WHERE [Username] = @IN_USERNAME ORDER BY OnlineDate DESC;
    IF @CURRENT_ID IS NULL SELECT @CURRENT_ID = MAX(ID) + 5 FROM ActiveUsers;
    SET @PCNAME_LOG = CONCAT(@COMPUTER_NAME, ', IDloged:', @CURRENT_ID);

    INSERT INTO TransactionsChange (DateInsert, TransID, HBLNO, OldValue, NewValue, ChangeMode, Notes, Received, UserChange, PCName)
    VALUES (GETDATE(), @JOBNUMBER, @HWBNO,'', @NewLotNo, 'Lot No initial','', '0', @IN_USERNAME, @PCNAME_LOG);

    COMMIT TRAN;

    SELECT
          @JOBNUMBER    AS NEW_FILE_NO
        , @HWBNO        AS HWBNO
        , @CustomerCode AS CUSTOMER_CODE
        , @CustomerShortName AS CUSTOMER_NAME;

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    THROW;
END CATCH;
  `;

	const params = {
		pSITE: erpSite,
		pWHOISMAKING: userAccount,
		pIN_TYPEOFSERVICE: serviceType,
		pCustomerCode: followUp.taxCode,
		pHWBNO: followUp.billOrBooking || "",
		pJobNumber: jobNumber,
	};

	if (erpSite === "HCM") {
		return await queryERPHCM(sqlQuery, params);
	} else {
		return await queryERPHAN(sqlQuery, params);
	}
}

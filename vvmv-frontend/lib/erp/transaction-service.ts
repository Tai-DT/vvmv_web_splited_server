import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

/**
 * Result interface for the SQL query
 */
export interface TransactionResult {
	NEW_FILE_NO: string;
	HWBNO: string;
	CUSTOMER_CODE: string;
	CUSTOMER_NAME: string;
}

/**
 * Input parameters for creating a transaction
 */
export interface CreateTransactionParams {
	operationType: string;
	taxCode: string;
	hwbno?: string;
	site: string; // SGN, HAN, DAD
	erpAccount: string;
}

/**
 * Shared service for creating ERP transactions
 */
export async function createErpTransaction(params: CreateTransactionParams) {
	const { operationType, taxCode, hwbno, site, erpAccount } = params;

	// 1. Determine service type and ERP database site code
	const serviceType =
		operationType === "TRUCK"
			? "TRUCK"
			: operationType === "XUAT"
				? "LOGEX"
				: "LOGIM";

	const siteMap: Record<string, string> = {
		SGN: "HCM",
		DAD: "HAN",
		HAN: "HAN",
	};
	const erpSite = siteMap[site] || "HCM";

	// 2. Determine base index from web database to prevent duplicates
	const now = new Date();
	const yyMM = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, "0")}`;

	let matchedServiceType = "";
	if (serviceType === "LOGEX") {
		matchedServiceType = erpSite === "HAN" ? "LOGE" : "LGE";
	} else if (serviceType === "LOGIM") {
		matchedServiceType = erpSite === "HAN" ? "LOGI" : "LGI";
	} else if (serviceType === "TRUCK") {
		matchedServiceType = "LOGT";
	}

	const prefix = `${erpSite}${matchedServiceType}${yyMM}`;

	// Find highest job number with this prefix in web database
	const followUps =
		serviceType === "TRUCK"
			? await prismaRPA.truckingFollowUp.findMany({
					where: {
						jobNumber: {
							startsWith: prefix,
						},
					},
					select: {
						jobNumber: true,
					},
				})
			: await prismaRPA.followUp.findMany({
					where: {
						jobNumber: {
							startsWith: prefix,
						},
					},
					select: {
						jobNumber: true,
					},
				});

	let webMaxIndex = 0;
	for (const fu of followUps) {
		if (fu.jobNumber) {
			const indexStr = fu.jobNumber.slice(prefix.length);
			const index = parseInt(indexStr, 10);
			if (!Number.isNaN(index) && index > webMaxIndex) {
				webMaxIndex = index;
			}
		}
	}

	console.log(
		`[TransactionService] Prefix: ${prefix}, Calculated webMaxIndex: ${webMaxIndex}, ServiceType: ${serviceType}`,
	);

	// 3. Prepare SQL query
	const sqlQuery = `
    DECLARE
    @SITE         NVARCHAR(200)   = @pSITE
    , @WHOISMAKING      NVARCHAR(200)   = @pWHOISMAKING
    , @IN_TYPEOFSERVICE   NVARCHAR(200)   = @pIN_TYPEOFSERVICE
    , @CustomerCode     NVARCHAR(50)    = @pCustomerCode
    , @HWBNO          NVARCHAR(50)    = @pHWBNO
    , @IN_FREIGHT       NVARCHAR(20)    = @pIN_FREIGHT
    , @CustomerName          NVARCHAR(255)
    , @CustomerShortName          NVARCHAR(255)
    , @OUT_TYPEOFSERVICE     NVARCHAR(200)
    , @OUT_FREIGHT           NVARCHAR(20)
    , @MATCHED_TYPEOFSERVICE NVARCHAR(200)
    , @NEWFILENO             NVARCHAR(200)
    , @DATEFILENO            DATE
    , @DATEFILENO_STR        NVARCHAR(8)
    , @LASTINDEX             INT
    , @LASTTRANSID           NVARCHAR(200)
    , @NOWTIME               DATETIME        = GETDATE()
    , @TransID               NVARCHAR(50)
    , @MaxLotNo              INT
    , @NewLotNo              NVARCHAR(20)
    , @ShipmentType          NVARCHAR(250)
    , @IN_USERNAME           NVARCHAR(100)
    , @IN_PASSWORD           NVARCHAR(100)
    , @CURRENT_ID            INT
    , @PCNAME_LOG            NVARCHAR(255)
    , @COMPUTER_NAME         NVARCHAR(255)  = 'VDI-HN'
    , @WEBMAXINDEX           INT             = @pWebMaxIndex;

    ------------------------------------------------------------
    -- CHECK USERNAME
    ------------------------------------------------------------
    SET @IN_USERNAME = @WHOISMAKING
    IF NOT EXISTS (SELECT 1 FROM ContactsList WHERE UserName = @IN_USERNAME and disable = 0)
    BEGIN
         RAISERROR('%s NOT EXISTS In ERP', 16, 1, @IN_USERNAME);
         RETURN;
    END;

    ------------------------------------------------------------
    -- DATE HANDLING
    ------------------------------------------------------------
    SET @DATEFILENO      = CAST(GETDATE() AS DATE);
    SET @DATEFILENO_STR  = FORMAT(@NOWTIME, 'yyMM');

    ------------------------------------------------------------
    -- MAP FREIGHT & SERVICE
    ------------------------------------------------------------
    SET @OUT_FREIGHT =
        CASE RTRIM(@IN_FREIGHT)
            WHEN 'F' THEN 'FREE-HAND'
            WHEN 'N' THEN 'NOMINATED'
        END;

    SET @OUT_TYPEOFSERVICE =
        CASE RTRIM(@IN_TYPEOFSERVICE)
            WHEN 'SEAIMCONSOL' THEN 'SeaImpTransactions_CSL'
            WHEN 'SEAIMFCL'    THEN 'SeaImpTransactions_FCL'
            WHEN 'SEAIMLCL'    THEN 'SeaImpTransactions_LCL'
            WHEN 'LOGIM'       THEN 'CustomsLogistics'
            WHEN 'LOGEX'       THEN 'CustomsLogistics'
            WHEN 'TRUCK'       THEN 'InlandTrucking'
        END;

    SET @MATCHED_TYPEOFSERVICE =
        CASE RTRIM(@IN_TYPEOFSERVICE)
            WHEN 'SEAIMCONSOL' THEN 'CSLI' + RTRIM(@IN_FREIGHT)
            WHEN 'SEAIMFCL'    THEN 'FCLI' + RTRIM(@IN_FREIGHT)
            WHEN 'SEAIMLCL'    THEN 'LCLI' + RTRIM(@IN_FREIGHT)
            WHEN 'LOGIM' THEN CASE WHEN @SITE = 'HAN' THEN 'LOGI' ELSE 'LGI' END
            WHEN 'LOGEX' THEN CASE WHEN @SITE = 'HAN' THEN 'LOGE' ELSE 'LGE' END
            WHEN 'TRUCK' THEN 'LOGT'
        END;

    ------------------------------------------------------------
    -- GET LAST TRANSID
    ------------------------------------------------------------
    BEGIN TRY
        BEGIN TRAN;
        
        SELECT TOP 1 @LASTTRANSID = TransID
        FROM Transactions WITH (UPDLOCK, HOLDLOCK)
        WHERE TransID LIKE (RTRIM(@SITE) + RTRIM(@MATCHED_TYPEOFSERVICE) + @DATEFILENO_STR ) + '%'
        ORDER BY TRY_CAST(SUBSTRING(TransID, LEN(RTRIM(@SITE) + RTRIM(@MATCHED_TYPEOFSERVICE)) + 1, 10) AS INT) DESC;

        DECLARE @SUFFIX VARCHAR(10) = '';
        IF @LASTTRANSID IS NULL
            SET @LASTINDEX = 0;
        ELSE
        BEGIN
            SET @SUFFIX = SUBSTRING(@LASTTRANSID, LEN(RTRIM(@SITE) + RTRIM(@MATCHED_TYPEOFSERVICE) + RTRIM(@DATEFILENO_STR)) + 1, 10);
            SET @LASTINDEX = TRY_CAST(@SUFFIX AS INT);
            IF @LASTINDEX IS NULL SET @LASTINDEX = 0;
        END;

        IF @WEBMAXINDEX > @LASTINDEX SET @LASTINDEX = @WEBMAXINDEX;
        SET @LASTINDEX += 1;

        IF LEN(@SUFFIX) = 4 AND @LASTINDEX > 9999
        BEGIN
            SET @LASTINDEX = 1;
            SET @NEWFILENO = RTRIM(@SITE) + RTRIM(@MATCHED_TYPEOFSERVICE) + RTRIM(@DATEFILENO_STR) + RIGHT('00000' + CAST(@LASTINDEX AS VARCHAR(5)), 5);
        END
        ELSE
        BEGIN
            IF LEN(@SUFFIX) = 4
                SET @NEWFILENO = RTRIM(@SITE) + RTRIM(@MATCHED_TYPEOFSERVICE) + RTRIM(@DATEFILENO_STR) + RIGHT('0000' + CAST(@LASTINDEX AS VARCHAR(4)), 4);
            ELSE
                SET @NEWFILENO = RTRIM(@SITE) + RTRIM(@MATCHED_TYPEOFSERVICE) + RTRIM(@DATEFILENO_STR) + RIGHT('00000' + CAST(@LASTINDEX AS VARCHAR(5)), 5);
        END;

        ------------------------------------------------------------
        -- CHECK DUPLICATE
        ------------------------------------------------------------
        IF EXISTS (SELECT 1 FROM Transactions WHERE TransID = @NEWFILENO)
        BEGIN
            RAISERROR('%s EXISTS', 16, 1, @NEWFILENO);
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
        WHERE (TAXCODE = @CustomerCode OR PARTNERID = @CustomerCode) AND Denied = 0;

        IF @CustomerName IS NULL OR LTRIM(RTRIM(@CustomerName)) = ''
        BEGIN
            RAISERROR('@CustomerCode NOT FOUND In ERP', 16, 1);
            RETURN;
        END;

        --------------------------------------------------------
        -- INSERT DATA
        --------------------------------------------------------
        INSERT INTO Transactions (TransID, TransDate, ModifyDate, LoadingDate, TpyeofService, WhoisMaking)
        VALUES (@NEWFILENO, @DATEFILENO, @NOWTIME, @DATEFILENO, @OUT_TYPEOFSERVICE, @WHOISMAKING);
        
        SET @TransID = @NEWFILENO;

    --------------------------------------------------------

    -- HANDLE HWBNO

    --------------------------------------------------------

    IF @HWBNO IS NULL OR LTRIM(RTRIM(@HWBNO)) = ''

    BEGIN

        IF @IN_TYPEOFSERVICE <> 'TRUCK'

            SET @HWBNO = @NEWFILENO + '/1';

        ELSE

        BEGIN

            DECLARE @LastHWBNO NVARCHAR(50);

            DECLARE @LastSeq INT;

            SELECT TOP 1 @LastHWBNO = HWBNO

            FROM HAWB

            WHERE HWBNO LIKE 'FCR' + RTRIM(@DATEFILENO_STR) + '%'

            ORDER BY HWBNO DESC;

            IF @LastHWBNO IS NULL

                SET @HWBNO = 'FCR' + RTRIM(@DATEFILENO_STR) + '0001';

            ELSE

            BEGIN

                SET @LastSeq = TRY_CAST(RIGHT(@LastHWBNO, 4) AS INT) + 1;

                SET @HWBNO =

                    'FCR' + RTRIM(@DATEFILENO_STR)

                    + RIGHT('0000' + CAST(@LastSeq AS NVARCHAR(4)), 4);

            END

        END

    END
    --------------------------------------------------------

    -- GET MAX LOT NO

    --------------------------------------------------------    
        SELECT @MaxLotNo = ISNULL(MAX(TRY_CAST(lotNo AS INT)), 0)
        FROM TransactionDetails WHERE transid = @NEWFILENO;

        IF EXISTS (SELECT 1 FROM HAWB WHERE HWBNO = @HWBNO)
        BEGIN
            UPDATE HAWB SET TRANSID = @NEWFILENO, ConsigneeID = @CustomerCode, Consignee = @CustomerName, [Owner] = @WHOISMAKING, ExecutedOn = @DATEFILENO, [Description] = ''
            WHERE HWBNO = @HWBNO;
        END
        ELSE
        BEGIN
            INSERT INTO HAWB (TRANSID, HWBNO, ConsigneeID, Consignee, [Owner], ExecutedOn, [Description])
            VALUES (@NEWFILENO, @HWBNO, @CustomerCode, @CustomerName, @WHOISMAKING, @DATEFILENO, '');
        END;

        SET @NewLotNo = RIGHT('00000' + CAST(@MaxLotNo + 1 AS NVARCHAR(20)), 5);
        INSERT INTO TransactionDetails (TransID, lotNo, ShipperID, HWBNO, NominationParty, ShipmentType)
        VALUES (@TransID, @NewLotNo, @CustomerCode, @HWBNO, '', @OUT_FREIGHT);

        ------------------------------------------------------------
        -- LOGGING
        ------------------------------------------------------------
        DECLARE @ACTIVE_USER BIT, @LATEST_USER_ID INT;
        SELECT TOP 1 @ACTIVE_USER = [ACTIVE], @LATEST_USER_ID = [ID]
        FROM ActiveUsers WHERE [Username] = @IN_USERNAME ORDER BY OnlineDate DESC;

        IF @ACTIVE_USER = 1 SET @CURRENT_ID = @LATEST_USER_ID;
        ELSE SELECT @CURRENT_ID = MAX(ID) + 5 FROM ActiveUsers;
        
        SET @PCNAME_LOG = CONCAT(@COMPUTER_NAME, ', IDloged:', @CURRENT_ID);

        INSERT INTO TransactionsChange (DateInsert, TransID, HBLNO, OldValue, NewValue, ChangeMode, Notes, Received, UserChange, PCName)
        VALUES (DATEADD(MILLISECOND,129,GETDATE()), @NEWFILENO, @HWBNO,'', @NewLotNo, 'Lot No initial','', '0', @IN_USERNAME, @PCNAME_LOG);

        COMMIT TRAN;

        SELECT @NEWFILENO AS NEW_FILE_NO, @HWBNO AS HWBNO, @CustomerCode AS CUSTOMER_CODE, @CustomerShortName AS CUSTOMER_NAME;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRAN;
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNo  INT = ERROR_NUMBER();
        RAISERROR ('%d - %s', 16, 1, @ErrNo, @ErrMsg);
    END CATCH;
  `;

	const sqlParams = {
		pSITE: erpSite,
		pWHOISMAKING: erpAccount,
		pIN_TYPEOFSERVICE: serviceType,
		pCustomerCode: taxCode,
		pHWBNO: hwbno || "",
		pIN_FREIGHT: "F",
		pWebMaxIndex: webMaxIndex,
	};

	// 4. Execute SQL query based on site
	let result: TransactionResult | null = null;
	const erpQuery = erpSite === "HCM" ? queryERPHCM : queryERPHAN;

	const erpResult = await erpQuery<TransactionResult>(sqlQuery, sqlParams);

	if (erpResult.recordset && erpResult.recordset.length > 0) {
		result = erpResult.recordset[0];
	}

	if (!result) {
		throw new Error("Failed to create transaction in ERP system");
	}

	return {
		...result,
		erpSite,
		serviceType,
	};
}

/**
 * Shared service for creating FCR in ERP for an existing job number
 */
export async function createErpFcr(params: {
	jobNumber: string;
	site: string; // SGN, HAN, DAD
}) {
	const { jobNumber, site } = params;

	const siteMap: Record<string, string> = {
		SGN: "HCM",
		DAD: "HAN",
		HAN: "HAN",
	};
	const erpSite = siteMap[site] || "HCM";

	const sqlQuery = `
    DECLARE
    @Jobnumber NVARCHAR(50) = @pJobNumber,
    @LastHWBNO NVARCHAR(50),
    @LastMWBNO NVARCHAR(50),
    @DATEFILENO_STR NVARCHAR(8) ,
    @LastSeq INT,
    @HWBNO NVARCHAR(50),
    @MaxLotNo INT,
    @NewLotNo INT,
    @OUT_FREIGHT NVARCHAR(20),
    @DATEFILENO DATE,
    @WHOISMAKING NVARCHAR(200),
    @customercode NVARCHAR(50) ,
    @CustomerName NVARCHAR(255),
    @CustomerShortName NVARCHAR(255),
    @CustomsID NVARCHAR(255),
    @Delivered INT

    SET @DATEFILENO = CAST(GETDATE() AS DATE);
    SET @DATEFILENO_STR = FORMAT(GETDATE(), 'yyMM');

    SELECT TOP 1 @LastHWBNO = HWBNO
    FROM HAWB
    WHERE HWBNO LIKE 'FCR' + RTRIM(@DATEFILENO_STR) + '%'
    ORDER BY HWBNO DESC;

    IF @LastHWBNO IS NULL
        SET @HWBNO = 'FCR' + RTRIM(@DATEFILENO_STR) + '0001';
    ELSE
    BEGIN
        SET @LastSeq = TRY_CAST(RIGHT(@LastHWBNO, 4) AS INT) + 1;
        SET @HWBNO =
            'FCR' + RTRIM(@DATEFILENO_STR)
            + RIGHT('0000' + CAST(@LastSeq AS NVARCHAR(4)), 4);
    END

    SELECT @MaxLotNo = ISNULL(MAX(TRY_CAST(lotNo AS INT)), 0)
    FROM TransactionDetails WHERE transid = @Jobnumber;

    SELECT TOP 1 @LastMWBNO = MAWB,  @CustomsID = CustomsID
    FROM TransactionDetails
    WHERE transid = @Jobnumber
    ORDER BY HWBNO DESC;

    SELECT @WHOISMAKING = WHOISMAKING, @Delivered = Delivered
    FROM Transactions
    WHERE transid = @Jobnumber;


    IF @Delivered = 1
    BEGIN
        RAISERROR('JOB HAS FINISHED', 16, 1);
        RETURN;
    END;

    SELECT TOP 1 @customercode = ShipperID
    FROM TransactionDetails
    WHERE transid = @Jobnumber;

    SELECT TOP 1
    @CustomerName = PartnerName2,
    @CustomerShortName = COALESCE(PartnerName, PartnerName2, PartnerName3)
    FROM PARTNERS
    WHERE (TAXCODE = @customercode OR PARTNERID = @customercode) AND Denied = 0;

    IF @CustomerName IS NULL OR LTRIM(RTRIM(@CustomerName)) = ''
    BEGIN
        RAISERROR('@customercode NOT FOUND In ERP', 16, 1);
        RETURN;
    END;

    IF EXISTS (SELECT 1 FROM HAWB WHERE HWBNO = @HWBNO)
    BEGIN
        RAISERROR('%s EXISTS', 16, 1, @HWBNO);
        RETURN;
    END;
    ELSE
    BEGIN
        INSERT INTO HAWB (TRANSID, HWBNO, ConsigneeID, Consignee, [Owner], ExecutedOn, [Description])
        VALUES (@Jobnumber, @HWBNO, @customercode, @CustomerName, @WHOISMAKING, @DATEFILENO, '');
    END;

    SET @NewLotNo = RIGHT('00000' + CAST(@MaxLotNo + 1 AS NVARCHAR(20)), 5);
    INSERT INTO TransactionDetails (TransID, lotNo, ShipperID, HWBNO, NominationParty, ShipmentType,MAWB,CustomsID)
    VALUES (@Jobnumber, @NewLotNo, @customercode, @HWBNO, '', 'FREE-HAND',@LastMWBNO,@CustomsID);

    SELECT @Jobnumber AS NEW_FILE_NO, @HWBNO AS HWBNO, @customercode AS CUSTOMER_CODE, @CustomerShortName AS CUSTOMER_NAME;
  `;

	const sqlParams = {
		pJobNumber: jobNumber,
	};

	const erpQuery = erpSite === "HCM" ? queryERPHCM : queryERPHAN;
	const erpResult = await erpQuery<TransactionResult>(sqlQuery, sqlParams);

	if (erpResult.recordset && erpResult.recordset.length > 0) {
		return erpResult.recordset[0];
	}

	throw new Error("Failed to create FCR in ERP system");
}

/**
 * Delete an FCR from ERP:
 * - Removes the row from TransactionDetails (HWBNO = fcrNumber)
 * - Removes the row from HAWB (HWBNO = fcrNumber)
 */
export async function deleteErpFcr(params: {
	jobNumber: string;
	fcrNumber: string;
	site: string; // SGN, HAN, DAD
}) {
	const { jobNumber, fcrNumber, site } = params;

	const siteMap: Record<string, string> = {
		SGN: "HCM",
		DAD: "HAN",
		HAN: "HAN",
	};
	const erpSite = siteMap[site] || "HCM";

	const sqlQuery = `
    DELETE FROM TransactionDetails
    WHERE transid = @pJobNumber AND HWBNO = @pFcrNumber;

    DELETE FROM HAWB
    WHERE HWBNO = @pFcrNumber;
  `;

	const sqlParams = {
		pJobNumber: jobNumber,
		pFcrNumber: fcrNumber,
	};

	const erpQuery = erpSite === "HCM" ? queryERPHCM : queryERPHAN;
	await erpQuery(sqlQuery, sqlParams);
}

/**
 * Check if a job is already delivered (finished) in ERP.
 * Returns true if Delivered = 1 in the Transactions table.
 */
export async function checkErpJobDelivered(params: {
	jobNumber: string;
	site: string; // SGN, HAN, DAD
}): Promise<boolean> {
	const { jobNumber, site } = params;

	const siteMap: Record<string, string> = {
		SGN: "HCM",
		DAD: "HAN",
		HAN: "HAN",
	};
	const erpSite = siteMap[site] || "HCM";

	const sqlQuery = `
    SELECT Delivered FROM Transactions WHERE transid = @pJobNumber;
  `;

	const erpQuery = erpSite === "HCM" ? queryERPHCM : queryERPHAN;
	const result = await erpQuery<{ Delivered: number }>(sqlQuery, {
		pJobNumber: jobNumber,
	});

	if (result.recordset && result.recordset.length > 0) {
		return result.recordset[0].Delivered === 1;
	}

	// If job not found in ERP, treat as not delivered (allow operation)
	return false;
}

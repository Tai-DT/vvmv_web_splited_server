export type EcusLocationOption = {
	value: string;
	name: string;
	label: string;
	normalized: string;
};

function normalizeEcusLocationText(value: string | null | undefined) {
	return (value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.trim()
		.toUpperCase();
}

const LOCATION_OPTIONS_SOURCE = [
	{
		value: "VNADTT",
		name: "CUA KHAU A DOT (THUA THIEN-HUE)",
		label: "VNADTT - CUA KHAU A DOT (THUA THIEN-HUE)",
	},
	{
		value: "VNAPIT",
		name: "LOI MO A PA CHAI",
		label: "VNAPIT - LOI MO A PA CHAI",
	},
	{
		value: "VNATH",
		name: "CANG AN THOI",
		label: "VNATH - CANG AN THOI",
	},
	{
		value: "VNBAAT",
		name: "CUA KHAU BAC HA (LAO CAI)",
		label: "VNBAAT - CUA KHAU BAC HA (LAO CAI)",
	},
	{
		value: "VNBACT",
		name: "CUA KHAU PHU BAN VUOC",
		label: "VNBACT - CUA KHAU PHU BAN VUOC",
	},
	{
		value: "VNBAI",
		name: "CK BAC DAI (ANGIANG)",
		label: "VNBAI - CK BAC DAI (ANGIANG)",
	},
	{
		value: "VNBAIT",
		name: "CUA KHAU BAC DAI (AN GIANG)",
		label: "VNBAIT - CUA KHAU BAC DAI (AN GIANG)",
	},
	{
		value: "VNBAN",
		name: "CANG BA NGOI (K.HOA)",
		label: "VNBAN - CANG BA NGOI (K.HOA)",
	},
	{
		value: "VNBATT",
		name: "CUA KHAU BAT SAT (LAO CAI)",
		label: "VNBATT - CUA KHAU BAT SAT (LAO CAI)",
	},
	{
		value: "VNBCLS",
		name: "CUA KHAU PHU BAN CHAT",
		label: "VNBCLS - CUA KHAU PHU BAN CHAT",
	},
	{
		value: "VNBDA",
		name: "DONG TAU BACH DANG",
		label: "VNBDA - DONG TAU BACH DANG",
	},
	{
		value: "VNBDC",
		name: "CANG BINH DUC (L.AN)",
		label: "VNBDC - CANG BINH DUC (L.AN)",
	},
	{
		value: "VNBDI",
		name: "CUA BIEN DE GI",
		label: "VNBDI - CUA BIEN DE GI",
	},
	{
		value: "VNBDM",
		name: "CANG BEN DAM (VT)",
		label: "VNBDM - CANG BEN DAM (VT)",
	},
	{
		value: "VNBDN",
		name: "KNQ TCT BUU DIEN VN",
		label: "VNBDN - KNQ TCT BUU DIEN VN",
	},
	{
		value: "VNBDU",
		name: "CANG T.HOP B.DUONG",
		label: "VNBDU - CANG T.HOP B.DUONG",
	},
	{
		value: "VNBECT",
		name: "HAI QUAN CUA KHAU BEN LUC",
		label: "VNBECT - HAI QUAN CUA KHAU BEN LUC",
	},
	{
		value: "VNBHA",
		name: "CANH IDC BIEN HOA",
		label: "VNBHA - CANH IDC BIEN HOA",
	},
	{
		value: "VNBIAT",
		name: "CUA KHAU BI HA (CAO BANG)",
		label: "VNBIAT - CUA KHAU BI HA (CAO BANG)",
	},
	{
		value: "VNBIIT",
		name: "CUA KHAU BINH NGHI (LANG SON)",
		label: "VNBIIT - CUA KHAU BINH NGHI (LANG SON)",
	},
	{
		value: "VNBIPT",
		name: "CUA KHAU BINH HIEP (LONG AN)",
		label: "VNBIPT - CUA KHAU BINH HIEP (LONG AN)",
	},
	{
		value: "VNBLG",
		name: "CANG BINH LONG",
		label: "VNBLG - CANG BINH LONG",
	},
	{
		value: "VNBMA",
		name: "CANG BAO MAI (DT)",
		label: "VNBMA - CANG BAO MAI (DT)",
	},
	{
		value: "VNBNCT",
		name: "CUA KHAU BA NAM CUM (LAI CHAU)",
		label: "VNBNCT - CUA KHAU BA NAM CUM (LAI CHAU)",
	},
	{
		value: "VNBNG",
		name: "CANG BEN NGHE (HCM)",
		label: "VNBNG - CANG BEN NGHE (HCM)",
	},
	{
		value: "VNBOYT",
		name: "CUA KHAU QUOC TE BO Y (KON TUM)",
		label: "VNBOYT - CUA KHAU QUOC TE BO Y (KON TUM)",
	},
	{
		value: "VNBPST",
		name: "CUA KHAU BAC PHONG SINH (QUANG NINH)",
		label: "VNBPST - CUA KHAU BAC PHONG SINH (QUANG NINH)",
	},
	{
		value: "VNBTI",
		name: "CANG BINH TRI (KG)",
		label: "VNBTI - CANG BINH TRI (KG)",
	},
	{
		value: "VNBUGT",
		name: "CUA KHAU BUPRANG (DAC LAC)",
		label: "VNBUGT - CUA KHAU BUPRANG (DAC LAC)",
	},
	{
		value: "VNBUPT",
		name: "CK PHU (LOI MO) 751 (DAK LAK)",
		label: "VNBUPT - CK PHU (LOI MO) 751 (DAK LAK)",
	},
	{
		value: "VNBUUT",
		name: "CUA KHAU PHU BUOC MU",
		label: "VNBUUT - CUA KHAU PHU BUOC MU",
	},
	{
		value: "VNCAGT",
		name: "CUA KHAU CA ROONG (QUANG BINH)",
		label: "VNCAGT - CUA KHAU CA ROONG (QUANG BINH)",
	},
	{
		value: "VNCAL",
		name: "CANG CAT LO (BRVT)",
		label: "VNCAL - CANG CAT LO (BRVT)",
	},
	{
		value: "VNCAM",
		name: "CUA CAM",
		label: "VNCAM - CUA CAM",
	},
	{
		value: "VNCAOT",
		name: "CUA KHAU CAU TREO (HA TINH)",
		label: "VNCAOT - CUA KHAU CAU TREO (HA TINH)",
	},
	{
		value: "VNCAUT",
		name: "CUA KHAU CAO VEU",
		label: "VNCAUT - CUA KHAU CAO VEU",
	},
	{
		value: "VNCAVT",
		name: "LOI MO CAO VEU",
		label: "VNCAVT - LOI MO CAO VEU",
	},
	{
		value: "VNCFA",
		name: "CANG AN LONG",
		label: "VNCFA - CANG AN LONG",
	},
	{
		value: "VNCFB",
		name: "CANG BUORBON",
		label: "VNCFB - CANG BUORBON",
	},
	{
		value: "VNCFC",
		name: "CANG CAM NGUYEN",
		label: "VNCFC - CANG CAM NGUYEN",
	},
	{
		value: "VNCFG",
		name: "CANG MT GAS",
		label: "VNCFG - CANG MT GAS",
	},
	{
		value: "VNCFH",
		name: "CANG HOANG TUAN",
		label: "VNCFH - CANG HOANG TUAN",
	},
	{
		value: "VNCFQ",
		name: "CANG PHUONG QUAN",
		label: "VNCFQ - CANG PHUONG QUAN",
	},
	{
		value: "VNCFT",
		name: "CANG THANH TAI",
		label: "VNCFT - CANG THANH TAI",
	},
	{
		value: "VNCHAT",
		name: "CUA KHAU CHI MA (LANG SON)",
		label: "VNCHAT - CUA KHAU CHI MA (LANG SON)",
	},
	{
		value: "VNCHCT",
		name: "CUA KHAU CHANG RIEC (TAY NINH)",
		label: "VNCHCT - CUA KHAU CHANG RIEC (TAY NINH)",
	},
	{
		value: "VNCHGT",
		name: "CUA KHAU CHIENG KHUONG (DIEN BIEN)",
		label: "VNCHGT - CUA KHAU CHIENG KHUONG (DIEN BIEN)",
	},
	{
		value: "VNCHOT",
		name: "CUA KHAU CHA LO (QUANG BINH)",
		label: "VNCHOT - CUA KHAU CHA LO (QUANG BINH)",
	},
	{
		value: "VNCKI",
		name: "CANG CTGK DKHI (VT)",
		label: "VNCKI - CANG CTGK DKHI (VT)",
	},
	{
		value: "VNCLA",
		name: "CANG QTE LONG AN S1",
		label: "VNCLA - CANG QTE LONG AN S1",
	},
	{
		value: "VNCLH",
		name: "CANG LACH HUYEN HP",
		label: "VNCLH - CANG LACH HUYEN HP",
	},
	{
		value: "VNCLI",
		name: "CANG CAT LAI (HCM)",
		label: "VNCLI - CANG CAT LAI (HCM)",
	},
	{
		value: "VNCLN",
		name: "CANG CAI LAN (QNINH)",
		label: "VNCLN - CANG CAI LAN (QNINH)",
	},
	{
		value: "VNCLO",
		name: "CANG CUA LO (NG.AN)",
		label: "VNCLO - CANG CUA LO (NG.AN)",
	},
	{
		value: "VNCLT",
		name: "CANG XD CU LAO TAO",
		label: "VNCLT - CANG XD CU LAO TAO",
	},
	{
		value: "VNCMT",
		name: "CANG QT CAI MEP",
		label: "VNCMT - CANG QT CAI MEP",
	},
	{
		value: "VNCMY",
		name: "CANG CHAN MAY (HUE)",
		label: "VNCMY - CANG CHAN MAY (HUE)",
	},
	{
		value: "VNCOMT",
		name: "CUA KHAU COC NAM (LANG SON)",
		label: "VNCOMT - CUA KHAU COC NAM (LANG SON)",
	},
	{
		value: "VNCOUT",
		name: "CUA KHAU CO SAU",
		label: "VNCOUT - CUA KHAU CO SAU",
	},
	{
		value: "VNCPA",
		name: "CANG CAM PHA (VT)",
		label: "VNCPA - CANG CAM PHA (VT)",
	},
	{
		value: "VNCPD",
		name: "CP DINH VU",
		label: "VNCPD - CP DINH VU",
	},
	{
		value: "VNCPH",
		name: "CANG CAM PHA (QN)",
		label: "VNCPH - CANG CAM PHA (QN)",
	},
	{
		value: "VNCPT",
		name: "CANG PETROX VT",
		label: "VNCPT - CANG PETROX VT",
	},
	{
		value: "VNCRB",
		name: "CANG CAM RANH(K.HOA)",
		label: "VNCRB - CANG CAM RANH(K.HOA)",
	},
	{
		value: "VNCTC",
		name: "CANG CAN TAN CANG NT",
		label: "VNCTC - CANG CAN TAN CANG NT",
	},
	{
		value: "VNCUV",
		name: "CANG CUA VIET(Q.TRI)",
		label: "VNCUV - CANG CUA VIET(Q.TRI)",
	},
	{
		value: "VNCVE",
		name: "CANG CHUA VE (HP)",
		label: "VNCVE - CANG CHUA VE (HP)",
	},
	{
		value: "VNCXP",
		name: "CANG XANH VIP",
		label: "VNCXP - CANG XANH VIP",
	},
	{
		value: "VNCXR",
		name: "SAN BAY QUOC TE CAM RANH",
		label: "VNCXR - SAN BAY QUOC TE CAM RANH",
	},
	{
		value: "VNDAD",
		name: "DA NANG",
		label: "VNDAD - DA NANG",
	},
	{
		value: "VNDAET",
		name: "CUA KHAU DAK RUE",
		label: "VNDAET - CUA KHAU DAK RUE",
	},
	{
		value: "VNDAH",
		name: "DAI HAI",
		label: "VNDAH - DAI HAI",
	},
	{
		value: "VNDAKT",
		name: "CUA KHAU DAK LONG (KONTUM)",
		label: "VNDAKT - CUA KHAU DAK LONG (KONTUM)",
	},
	{
		value: "VNDAN",
		name: "CANG DA NANG",
		label: "VNDAN - CANG DA NANG",
	},
	{
		value: "VNDAOT",
		name: "CUA KHAU DAKBLO (KONTUM)",
		label: "VNDAOT - CUA KHAU DAKBLO (KONTUM)",
	},
	{
		value: "VNDAP",
		name: "DAP",
		label: "VNDAP - DAP",
	},
	{
		value: "VNDART",
		name: "CUA KHAU DAK PEUR (DAC LAK)",
		label: "VNDART - CUA KHAU DAK PEUR (DAC LAK)",
	},
	{
		value: "VNDDG",
		name: "CANG D.DONG-PQUOC",
		label: "VNDDG - CANG D.DONG-PQUOC",
	},
	{
		value: "VNDDN",
		name: "CANG DIEM DIEN",
		label: "VNDDN - CANG DIEM DIEN",
	},
	{
		value: "VNDDQ",
		name: "CANG DOOSAN D.QUAT",
		label: "VNDDQ - CANG DOOSAN D.QUAT",
	},
	{
		value: "VNDGL",
		name: "DONG DANG (LANG SON)",
		label: "VNDGL - DONG DANG (LANG SON)",
	},
	{
		value: "VNDGLS",
		name: "DONG DANG (LANG SON)",
		label: "VNDGLS - DONG DANG (LANG SON)",
	},
	{
		value: "VNDHA",
		name: "DONG HAI",
		label: "VNDHA - DONG HAI",
	},
	{
		value: "VNDIAT",
		name: "CUA KHAU DINH BA (DONG THAP)",
		label: "VNDIAT - CUA KHAU DINH BA (DONG THAP)",
	},
	{
		value: "VNDKI",
		name: "CANG DK NG.KHOI (VT)",
		label: "VNDKI - CANG DK NG.KHOI (VT)",
	},
	{
		value: "VNDLI",
		name: "DA LAT",
		label: "VNDLI - DA LAT",
	},
	{
		value: "VNDNA",
		name: "CANG DONG NAI",
		label: "VNDNA - CANG DONG NAI",
	},
	{
		value: "VNDNH",
		name: "DINH VU NAM HAI",
		label: "VNDNH - DINH VU NAM HAI",
	},
	{
		value: "VNDOC",
		name: "CK DONG DUC (AG)",
		label: "VNDOC - CK DONG DUC (AG)",
	},
	{
		value: "VNDOCT",
		name: "CUA KHAU DONG DUC (AN GIANG)",
		label: "VNDOCT - CUA KHAU DONG DUC (AN GIANG)",
	},
	{
		value: "VNDPH",
		name: "CANG PHU DONG",
		label: "VNDPH - CANG PHU DONG",
	},
	{
		value: "VNDPK",
		name: "XANG DAU PHUOC KHANH",
		label: "VNDPK - XANG DAU PHUOC KHANH",
	},
	{
		value: "VNDQG",
		name: "CANG QT GERMADEPT",
		label: "VNDQG - CANG QT GERMADEPT",
	},
	{
		value: "VNDQT",
		name: "CANG D.QUAT - B.SO 1",
		label: "VNDQT - CANG D.QUAT - B.SO 1",
	},
	{
		value: "VNDTH",
		name: "CANG DONG THAP",
		label: "VNDTH - CANG DONG THAP",
	},
	{
		value: "VNDTS",
		name: "CANG TIEN SA(D.NANG)",
		label: "VNDTS - CANG TIEN SA(D.NANG)",
	},
	{
		value: "VNDTV",
		name: "DUYEN HAI TRA VINH",
		label: "VNDTV - DUYEN HAI TRA VINH",
	},
	{
		value: "VNDVN",
		name: "CANG NAM DINH VU",
		label: "VNDVN - CANG NAM DINH VU",
	},
	{
		value: "VNDVU",
		name: "CANG DINH VU - HP",
		label: "VNDVU - CANG DINH VU - HP",
	},
	{
		value: "VNDXA",
		name: "CANG DOAN XA - HP",
		label: "VNDXA - CANG DOAN XA - HP",
	},
	{
		value: "VNDXN",
		name: "CANG KXD DONG XUYEN",
		label: "VNDXN - CANG KXD DONG XUYEN",
	},
	{
		value: "VNELF",
		name: "CANG ELF GAZ DA NANG",
		label: "VNELF - CANG ELF GAZ DA NANG",
	},
	{
		value: "VNFAA",
		name: "NIPPON EXPRESS VN",
		label: "VNFAA - NIPPON EXPRESS VN",
	},
	{
		value: "VNFAAL",
		name: "NIPPON EXPRESS VN",
		label: "VNFAAL - NIPPON EXPRESS VN",
	},
	{
		value: "VNFAAN",
		name: "ABC",
		label: "VNFAAN - ABC",
	},
	{
		value: "VNFAB",
		name: "PT HANG HAI HN",
		label: "VNFAB - PT HANG HAI HN",
	},
	{
		value: "VNFABL",
		name: "PT HANG HAI HN",
		label: "VNFABL - PT HANG HAI HN",
	},
	{
		value: "VNFAC",
		name: "DLVT SAFI HA NOI",
		label: "VNFAC - DLVT SAFI HA NOI",
	},
	{
		value: "VNFACL",
		name: "DLVT SAFI HA NOI",
		label: "VNFACL - DLVT SAFI HA NOI",
	},
	{
		value: "VNFAD",
		name: "ICD TRANSIMEX SG",
		label: "VNFAD - ICD TRANSIMEX SG",
	},
	{
		value: "VNFADL",
		name: "ICD TRANSIMEX SG",
		label: "VNFADL - ICD TRANSIMEX SG",
	},
	{
		value: "VNFAE",
		name: "TNHH CANG PHUOC LONG",
		label: "VNFAE - TNHH CANG PHUOC LONG",
	},
	{
		value: "VNFAEL",
		name: "TNHH CANG PHUOC LONG",
		label: "VNFAEL - TNHH CANG PHUOC LONG",
	},
	{
		value: "VNFAF",
		name: "TNHH XNK TAY NAM",
		label: "VNFAF - TNHH XNK TAY NAM",
	},
	{
		value: "VNFAFL",
		name: "TNHH XNK TAY NAM",
		label: "VNFAFL - TNHH XNK TAY NAM",
	},
	{
		value: "VNFAG",
		name: "CP TM XNK DONG TAY",
		label: "VNFAG - CP TM XNK DONG TAY",
	},
	{
		value: "VNFAGL",
		name: "CP TM XNK DONG TAY",
		label: "VNFAGL - CP TM XNK DONG TAY",
	},
	{
		value: "VNFAH",
		name: "CFS SAFI HO CHI MINH",
		label: "VNFAH - CFS SAFI HO CHI MINH",
	},
	{
		value: "VNFAHL",
		name: "CFS SAFI HO CHI MINH",
		label: "VNFAHL - CFS SAFI HO CHI MINH",
	},
	{
		value: "VNFAI",
		name: "KHO VAN BINH MINH",
		label: "VNFAI - KHO VAN BINH MINH",
	},
	{
		value: "VNFAIL",
		name: "KHO VAN BINH MINH",
		label: "VNFAIL - KHO VAN BINH MINH",
	},
	{
		value: "VNFAJ",
		name: "SAGAWA EXPRESS VN",
		label: "VNFAJ - SAGAWA EXPRESS VN",
	},
	{
		value: "VNFAJL",
		name: "SAGAWA EXPRESS VN",
		label: "VNFAJL - SAGAWA EXPRESS VN",
	},
	{
		value: "VNFAK",
		name: "TIEP VAN SO 1",
		label: "VNFAK - TIEP VAN SO 1",
	},
	{
		value: "VNFAKL",
		name: "TIEP VAN SO 1",
		label: "VNFAKL - TIEP VAN SO 1",
	},
	{
		value: "VNFAL",
		name: "DICH VU HANG HAI SG",
		label: "VNFAL - DICH VU HANG HAI SG",
	},
	{
		value: "VNFALL",
		name: "DICH VU HANG HAI SG",
		label: "VNFALL - DICH VU HANG HAI SG",
	},
	{
		value: "VNFAM",
		name: "DV HH VINALINES HP",
		label: "VNFAM - DV HH VINALINES HP",
	},
	{
		value: "VNFAML",
		name: "DV HH VINALINES HP",
		label: "VNFAML - DV HH VINALINES HP",
	},
	{
		value: "VNFAN",
		name: "QUOC TE NHAT VIET",
		label: "VNFAN - QUOC TE NHAT VIET",
	},
	{
		value: "VNFANL",
		name: "QUOC TE NHAT VIET",
		label: "VNFANL - QUOC TE NHAT VIET",
	},
	{
		value: "VNFAO",
		name: "CONTAINER VIETNAM",
		label: "VNFAO - CONTAINER VIETNAM",
	},
	{
		value: "VNFAOL",
		name: "CONTAINER VIETNAM",
		label: "VNFAOL - CONTAINER VIETNAM",
	},
	{
		value: "VNFAP",
		name: "GEMADEPT HP",
		label: "VNFAP - GEMADEPT HP",
	},
	{
		value: "VNFAPL",
		name: "GEMADEPT HP",
		label: "VNFAPL - GEMADEPT HP",
	},
	{
		value: "VNFAQ",
		name: "LDKHAITHAC CONTAINER",
		label: "VNFAQ - LDKHAITHAC CONTAINER",
	},
	{
		value: "VNFAQL",
		name: "LDKHAITHAC CONTAINER",
		label: "VNFAQL - LDKHAITHAC CONTAINER",
	},
	{
		value: "VNFAR",
		name: "CONTAINER MINH THANH",
		label: "VNFAR - CONTAINER MINH THANH",
	},
	{
		value: "VNFARL",
		name: "CONTAINER MINH THANH",
		label: "VNFARL - CONTAINER MINH THANH",
	},
	{
		value: "VNFAS",
		name: "TIEP VAN NAM PHAT",
		label: "VNFAS - TIEP VAN NAM PHAT",
	},
	{
		value: "VNFASL",
		name: "TIEP VAN NAM PHAT",
		label: "VNFASL - TIEP VAN NAM PHAT",
	},
	{
		value: "VNFAT",
		name: "QUOC TE SAO DO",
		label: "VNFAT - QUOC TE SAO DO",
	},
	{
		value: "VNFATL",
		name: "QUOC TE SAO DO",
		label: "VNFATL - QUOC TE SAO DO",
	},
	{
		value: "VNFAU",
		name: "HANG HAI VN PHIA BAC",
		label: "VNFAU - HANG HAI VN PHIA BAC",
	},
	{
		value: "VNFAUL",
		name: "HANG HAI VN PHIA BAC",
		label: "VNFAUL - HANG HAI VN PHIA BAC",
	},
	{
		value: "VNFAV",
		name: "VAN TAI DUYEN HAI",
		label: "VNFAV - VAN TAI DUYEN HAI",
	},
	{
		value: "VNFAVL",
		name: "VAN TAI DUYEN HAI",
		label: "VNFAVL - VAN TAI DUYEN HAI",
	},
	{
		value: "VNFAW",
		name: "VAN TAI THUE TAU",
		label: "VNFAW - VAN TAI THUE TAU",
	},
	{
		value: "VNFAWL",
		name: "VAN TAI THUE TAU",
		label: "VNFAWL - VAN TAI THUE TAU",
	},
	{
		value: "VNFAX",
		name: "TAN TIEN PHONG",
		label: "VNFAX - TAN TIEN PHONG",
	},
	{
		value: "VNFAXL",
		name: "TAN TIEN PHONG",
		label: "VNFAXL - TAN TIEN PHONG",
	},
	{
		value: "VNFAY",
		name: "VANTAI CONG NGHE CAO",
		label: "VNFAY - VANTAI CONG NGHE CAO",
	},
	{
		value: "VNFAYL",
		name: "VANTAI CONG NGHE CAO",
		label: "VNFAYL - VANTAI CONG NGHE CAO",
	},
	{
		value: "VNFAZ",
		name: "LOGISTICS XANH",
		label: "VNFAZ - LOGISTICS XANH",
	},
	{
		value: "VNFAZL",
		name: "LOGISTICS XANH",
		label: "VNFAZL - LOGISTICS XANH",
	},
	{
		value: "VNFBA",
		name: "NAM LIEN",
		label: "VNFBA - NAM LIEN",
	},
	{
		value: "VNFBAL",
		name: "NAM LIEN",
		label: "VNFBAL - NAM LIEN",
	},
	{
		value: "VNFBB",
		name: "TM DL BINH DUONG",
		label: "VNFBB - TM DL BINH DUONG",
	},
	{
		value: "VNFBBL",
		name: "TM DL BINH DUONG",
		label: "VNFBBL - TM DL BINH DUONG",
	},
	{
		value: "VNFBC",
		name: "ICD TANCANG SONGTHAN",
		label: "VNFBC - ICD TANCANG SONGTHAN",
	},
	{
		value: "VNFBCL",
		name: "ICD TANCANG SONGTHAN",
		label: "VNFBCL - ICD TANCANG SONGTHAN",
	},
	{
		value: "VNFBD",
		name: "TAN HOAN CAU",
		label: "VNFBD - TAN HOAN CAU",
	},
	{
		value: "VNFBDL",
		name: "TAN HOAN CAU",
		label: "VNFBDL - TAN HOAN CAU",
	},
	{
		value: "VNFBE",
		name: "CANG LS",
		label: "VNFBE - CANG LS",
	},
	{
		value: "VNFBEL",
		name: "CANG LS",
		label: "VNFBEL - CANG LS",
	},
	{
		value: "VNFBF",
		name: "DAU TU BAC KY",
		label: "VNFBF - DAU TU BAC KY",
	},
	{
		value: "VNFBFL",
		name: "DAU TU BAC KY",
		label: "VNFBFL - DAU TU BAC KY",
	},
	{
		value: "VNFBG",
		name: "CTCPXD GIAO THONG",
		label: "VNFBG - CTCPXD GIAO THONG",
	},
	{
		value: "VNFBGL",
		name: "CTCPXD GIAO THONG",
		label: "VNFBGL - CTCPXD GIAO THONG",
	},
	{
		value: "VNFBH",
		name: "INLACO LOGISTIC",
		label: "VNFBH - INLACO LOGISTIC",
	},
	{
		value: "VNFBHL",
		name: "INLACO LOGISTIC",
		label: "VNFBHL - INLACO LOGISTIC",
	},
	{
		value: "VNFBI",
		name: "CFS CT LEN SAI GON",
		label: "VNFBI - CFS CT LEN SAI GON",
	},
	{
		value: "VNFBIL",
		name: "CFS CT LEN SAI GON",
		label: "VNFBIL - CFS CT LEN SAI GON",
	},
	{
		value: "VNFBJ",
		name: "CT ISHENG ELECTRIC",
		label: "VNFBJ - CT ISHENG ELECTRIC",
	},
	{
		value: "VNFBJL",
		name: "CT ISHENG ELECTRIC",
		label: "VNFBJL - CT ISHENG ELECTRIC",
	},
	{
		value: "VNFBK",
		name: "FUNING PRECISION",
		label: "VNFBK - FUNING PRECISION",
	},
	{
		value: "VNFBKL",
		name: "FUNING PRECISION",
		label: "VNFBKL - FUNING PRECISION",
	},
	{
		value: "VNFBL",
		name: "CT TENMA VIET NAM",
		label: "VNFBL - CT TENMA VIET NAM",
	},
	{
		value: "VNFBLL",
		name: "CT TENMA VIET NAM",
		label: "VNFBLL - CT TENMA VIET NAM",
	},
	{
		value: "VNFBM",
		name: "CT VS TECHNOLOGY",
		label: "VNFBM - CT VS TECHNOLOGY",
	},
	{
		value: "VNFBML",
		name: "CT VS TECHNOLOGY",
		label: "VNFBML - CT VS TECHNOLOGY",
	},
	{
		value: "VNFBN",
		name: "CT VS INDUSTRY VN",
		label: "VNFBN - CT VS INDUSTRY VN",
	},
	{
		value: "VNFBNL",
		name: "CT VS INDUSTRY VN",
		label: "VNFBNL - CT VS INDUSTRY VN",
	},
	{
		value: "VNFBO",
		name: "EUNSUNG ELECTRONICS",
		label: "VNFBO - EUNSUNG ELECTRONICS",
	},
	{
		value: "VNFBOL",
		name: "EUNSUNG ELECTRONICS",
		label: "VNFBOL - EUNSUNG ELECTRONICS",
	},
	{
		value: "VNFBP",
		name: "CT MITAC COMPUTER",
		label: "VNFBP - CT MITAC COMPUTER",
	},
	{
		value: "VNFBPL",
		name: "CT MITAC COMPUTER",
		label: "VNFBPL - CT MITAC COMPUTER",
	},
	{
		value: "VNFBQ",
		name: "CT MITAC PRECISION",
		label: "VNFBQ - CT MITAC PRECISION",
	},
	{
		value: "VNFBQL",
		name: "CT MITAC PRECISION",
		label: "VNFBQL - CT MITAC PRECISION",
	},
	{
		value: "VNFBR",
		name: "CT AMSTRONG WESTON",
		label: "VNFBR - CT AMSTRONG WESTON",
	},
	{
		value: "VNFBRL",
		name: "CT AMSTRONG WESTON",
		label: "VNFBRL - CT AMSTRONG WESTON",
	},
	{
		value: "VNFBS",
		name: "HAYAKAWA ELECTRONICS",
		label: "VNFBS - HAYAKAWA ELECTRONICS",
	},
	{
		value: "VNFBSL",
		name: "HAYAKAWA ELECTRONICS",
		label: "VNFBSL - HAYAKAWA ELECTRONICS",
	},
	{
		value: "VNFBT",
		name: "SAMSUNG ELECTRONICS",
		label: "VNFBT - SAMSUNG ELECTRONICS",
	},
	{
		value: "VNFBTL",
		name: "SAMSUNG ELECTRONICS",
		label: "VNFBTL - SAMSUNG ELECTRONICS",
	},
	{
		value: "VNFBU",
		name: "CT SHIHEN VIETNAM",
		label: "VNFBU - CT SHIHEN VIETNAM",
	},
	{
		value: "VNFBUL",
		name: "CT SHIHEN VIETNAM",
		label: "VNFBUL - CT SHIHEN VIETNAM",
	},
	{
		value: "VNFBV",
		name: "CT NHUA KINH QUANG",
		label: "VNFBV - CT NHUA KINH QUANG",
	},
	{
		value: "VNFBVL",
		name: "CT NHUA KINH QUANG",
		label: "VNFBVL - CT NHUA KINH QUANG",
	},
	{
		value: "VNFBW",
		name: "CT MINH TRI",
		label: "VNFBW - CT MINH TRI",
	},
	{
		value: "VNFBWL",
		name: "CT MINH TRI",
		label: "VNFBWL - CT MINH TRI",
	},
	{
		value: "VNFBY",
		name: "CT KINYOSHA VN",
		label: "VNFBY - CT KINYOSHA VN",
	},
	{
		value: "VNFBYL",
		name: "CT KINYOSHA VN",
		label: "VNFBYL - CT KINYOSHA VN",
	},
	{
		value: "VNFBZ",
		name: "CT WINTEK VIET NAM",
		label: "VNFBZ - CT WINTEK VIET NAM",
	},
	{
		value: "VNFBZL",
		name: "CT WINTEK VIET NAM",
		label: "VNFBZL - CT WINTEK VIET NAM",
	},
	{
		value: "VNFCA",
		name: "FUHONG PRECISION",
		label: "VNFCA - FUHONG PRECISION",
	},
	{
		value: "VNFCAL",
		name: "FUHONG PRECISION",
		label: "VNFCAL - FUHONG PRECISION",
	},
	{
		value: "VNFCB",
		name: "CT DOVAN",
		label: "VNFCB - CT DOVAN",
	},
	{
		value: "VNFCBL",
		name: "CT DOVAN",
		label: "VNFCBL - CT DOVAN",
	},
	{
		value: "VNFCC",
		name: "CT BAO BI HAO NHUE",
		label: "VNFCC - CT BAO BI HAO NHUE",
	},
	{
		value: "VNFCCL",
		name: "CT BAO BI HAO NHUE",
		label: "VNFCCL - CT BAO BI HAO NHUE",
	},
	{
		value: "VNFCD",
		name: "CT BIRZ VIET NAM",
		label: "VNFCD - CT BIRZ VIET NAM",
	},
	{
		value: "VNFCDL",
		name: "CT BIRZ VIET NAM",
		label: "VNFCDL - CT BIRZ VIET NAM",
	},
	{
		value: "VNFCE",
		name: "CT IN BAO BI SUNNY",
		label: "VNFCE - CT IN BAO BI SUNNY",
	},
	{
		value: "VNFCEL",
		name: "CT IN BAO BI SUNNY",
		label: "VNFCEL - CT IN BAO BI SUNNY",
	},
	{
		value: "VNFCF",
		name: "KORETSUNE SEIKO VN",
		label: "VNFCF - KORETSUNE SEIKO VN",
	},
	{
		value: "VNFCFL",
		name: "KORETSUNE SEIKO VN",
		label: "VNFCFL - KORETSUNE SEIKO VN",
	},
	{
		value: "VNFCG",
		name: "CT STRONICS VN",
		label: "VNFCG - CT STRONICS VN",
	},
	{
		value: "VNFCGL",
		name: "CT STRONICS VN",
		label: "VNFCGL - CT STRONICS VN",
	},
	{
		value: "VNFCH",
		name: "CT UMEC VN",
		label: "VNFCH - CT UMEC VN",
	},
	{
		value: "VNFCHL",
		name: "CT UMEC VN",
		label: "VNFCHL - CT UMEC VN",
	},
	{
		value: "VNFCI",
		name: "CT ASEAN LINK",
		label: "VNFCI - CT ASEAN LINK",
	},
	{
		value: "VNFCIL",
		name: "CT ASEAN LINK",
		label: "VNFCIL - CT ASEAN LINK",
	},
	{
		value: "VNFCJ",
		name: "CT DTU SUNG JIN VN",
		label: "VNFCJ - CT DTU SUNG JIN VN",
	},
	{
		value: "VNFCJL",
		name: "CT DTU SUNG JIN VN",
		label: "VNFCJL - CT DTU SUNG JIN VN",
	},
	{
		value: "VNFCK",
		name: "CT DAINICHI COLOR",
		label: "VNFCK - CT DAINICHI COLOR",
	},
	{
		value: "VNFCKL",
		name: "CT DAINICHI COLOR",
		label: "VNFCKL - CT DAINICHI COLOR",
	},
	{
		value: "VNFCL",
		name: "SUMITOMO ELECTRIC",
		label: "VNFCL - SUMITOMO ELECTRIC",
	},
	{
		value: "VNFCLL",
		name: "SUMITOMO ELECTRIC",
		label: "VNFCLL - SUMITOMO ELECTRIC",
	},
	{
		value: "VNFCM",
		name: "HAYAKAWA ELECTRONICS",
		label: "VNFCM - HAYAKAWA ELECTRONICS",
	},
	{
		value: "VNFCML",
		name: "HAYAKAWA ELECTRONICS",
		label: "VNFCML - HAYAKAWA ELECTRONICS",
	},
	{
		value: "VNFCN",
		name: "TABUCHI ELECTRONIC",
		label: "VNFCN - TABUCHI ELECTRONIC",
	},
	{
		value: "VNFCNL",
		name: "TABUCHI ELECTRONIC",
		label: "VNFCNL - TABUCHI ELECTRONIC",
	},
	{
		value: "VNFCO",
		name: "CT TOHO PRECISION",
		label: "VNFCO - CT TOHO PRECISION",
	},
	{
		value: "VNFCOL",
		name: "CT TOHO PRECISION",
		label: "VNFCOL - CT TOHO PRECISION",
	},
	{
		value: "VNFCP",
		name: "CTCP SX SONG HONG",
		label: "VNFCP - CTCP SX SONG HONG",
	},
	{
		value: "VNFCPL",
		name: "CTCP SX SONG HONG",
		label: "VNFCPL - CTCP SX SONG HONG",
	},
	{
		value: "VNFCQ",
		name: "CT JOYO MARK VN",
		label: "VNFCQ - CT JOYO MARK VN",
	},
	{
		value: "VNFCQL",
		name: "CT JOYO MARK VN",
		label: "VNFCQL - CT JOYO MARK VN",
	},
	{
		value: "VNFCR",
		name: "KURABE INDUSTRIAL BN",
		label: "VNFCR - KURABE INDUSTRIAL BN",
	},
	{
		value: "VNFCRL",
		name: "KURABE INDUSTRIAL BN",
		label: "VNFCRL - KURABE INDUSTRIAL BN",
	},
	{
		value: "VNFCS",
		name: "DAIICHI DENSO BUHIN",
		label: "VNFCS - DAIICHI DENSO BUHIN",
	},
	{
		value: "VNFCSL",
		name: "DAIICHI DENSO BUHIN",
		label: "VNFCSL - DAIICHI DENSO BUHIN",
	},
	{
		value: "VNFCT",
		name: "CONG NGHE MUTO HN",
		label: "VNFCT - CONG NGHE MUTO HN",
	},
	{
		value: "VNFCTL",
		name: "CONG NGHE MUTO HN",
		label: "VNFCTL - CONG NGHE MUTO HN",
	},
	{
		value: "VNFCU",
		name: "CT CANON VN",
		label: "VNFCU - CT CANON VN",
	},
	{
		value: "VNFCUL",
		name: "CT CANON VN",
		label: "VNFCUL - CT CANON VN",
	},
	{
		value: "VNFCV",
		name: "CT CANON VN QUE VO",
		label: "VNFCV - CT CANON VN QUE VO",
	},
	{
		value: "VNFCVL",
		name: "CT CANON VN QUE VO",
		label: "VNFCVL - CT CANON VN QUE VO",
	},
	{
		value: "VNFCW",
		name: "CT CANON VN TIEN SON",
		label: "VNFCW - CT CANON VN TIEN SON",
	},
	{
		value: "VNFCWL",
		name: "CT CANON VN TIEN SON",
		label: "VNFCWL - CT CANON VN TIEN SON",
	},
	{
		value: "VNFCY",
		name: "CFS ICD TAN CANG LB",
		label: "VNFCY - CFS ICD TAN CANG LB",
	},
	{
		value: "VNFCYL",
		name: "CFS ICD TAN CANG LB",
		label: "VNFCYL - CFS ICD TAN CANG LB",
	},
	{
		value: "VNFCZ",
		name: "CT HANG HAI VIMADECO",
		label: "VNFCZ - CT HANG HAI VIMADECO",
	},
	{
		value: "VNFCZL",
		name: "CT HANG HAI VIMADECO",
		label: "VNFCZL - CT HANG HAI VIMADECO",
	},
	{
		value: "VNFDA",
		name: "CT LOGISTICS CANG DN",
		label: "VNFDA - CT LOGISTICS CANG DN",
	},
	{
		value: "VNFDAL",
		name: "CT LOGISTICS CANG DN",
		label: "VNFDAL - CT LOGISTICS CANG DN",
	},
	{
		value: "VNFDB",
		name: "CFS MTV TAN CANG SG",
		label: "VNFDB - CFS MTV TAN CANG SG",
	},
	{
		value: "VNFDBL",
		name: "CFS MTV TAN CANG SG",
		label: "VNFDBL - CFS MTV TAN CANG SG",
	},
	{
		value: "VNFDC",
		name: "CFS INTERSERCO MD",
		label: "VNFDC - CFS INTERSERCO MD",
	},
	{
		value: "VNFDCL",
		name: "CFS INTERSERCO MD",
		label: "VNFDCL - CFS INTERSERCO MD",
	},
	{
		value: "VNFDD",
		name: "CSF YUSEN HAI PHONG",
		label: "VNFDD - CSF YUSEN HAI PHONG",
	},
	{
		value: "VNFDDL",
		name: "CSF YUSEN HAI PHONG",
		label: "VNFDDL - CSF YUSEN HAI PHONG",
	},
	{
		value: "VNFDE",
		name: "CFS GEMADEPT",
		label: "VNFDE - CFS GEMADEPT",
	},
	{
		value: "VNFDEL",
		name: "CFS GEMADEPT",
		label: "VNFDEL - CFS GEMADEPT",
	},
	{
		value: "VNFDH",
		name: "CFS TM DV VT ANH PHONG",
		label: "VNFDH - CFS TM DV VT ANH PHONG",
	},
	{
		value: "VNFDHL",
		name: "CFS TM DV VT ANH PHONG",
		label: "VNFDHL - CFS TM DV VT ANH PHONG",
	},
	{
		value: "VNFDI",
		name: "CFS INDO TRAN YVIEN",
		label: "VNFDI - CFS INDO TRAN YVIEN",
	},
	{
		value: "VNFDIL",
		name: "CFS INDO TRAN YVIEN",
		label: "VNFDIL - CFS INDO TRAN YVIEN",
	},
	{
		value: "VNFDK",
		name: "CFS SAGAWA DONG NAI",
		label: "VNFDK - CFS SAGAWA DONG NAI",
	},
	{
		value: "VNFDKL",
		name: "CFS SAGAWA DONG NAI",
		label: "VNFDKL - CFS SAGAWA DONG NAI",
	},
	{
		value: "VNFDL",
		name: "CFS CTY MACS HPHONG",
		label: "VNFDL - CFS CTY MACS HPHONG",
	},
	{
		value: "VNFDLL",
		name: "CFS CTY MACS HPHONG",
		label: "VNFDLL - CFS CTY MACS HPHONG",
	},
	{
		value: "VNFDM",
		name: "CTY TIEP VAN SITC DV",
		label: "VNFDM - CTY TIEP VAN SITC DV",
	},
	{
		value: "VNFDML",
		name: "CTY TIEP VAN SITC DV",
		label: "VNFDML - CTY TIEP VAN SITC DV",
	},
	{
		value: "VNFDW",
		name: "KHO CFS CAT LAI",
		label: "VNFDW - KHO CFS CAT LAI",
	},
	{
		value: "VNFEB",
		name: "ICD ITL BINH DUONG",
		label: "VNFEB - ICD ITL BINH DUONG",
	},
	{
		value: "VNFEBL",
		name: "ICD ITL BINH DUONG",
		label: "VNFEBL - ICD ITL BINH DUONG",
	},
	{
		value: "VNFED",
		name: "KHO CFS TAN CANG SAI GON",
		label: "VNFED - KHO CFS TAN CANG SAI GON",
	},
	{
		value: "VNFEDL",
		name: "KHO CFS TAN CANG SAI GON",
		label: "VNFEDL - KHO CFS TAN CANG SAI GON",
	},
	{
		value: "VNFEL",
		name: "CFS CTY CP CANG HP",
		label: "VNFEL - CFS CTY CP CANG HP",
	},
	{
		value: "VNFELL",
		name: "CFS CTY CP CANG HP",
		label: "VNFELL - CFS CTY CP CANG HP",
	},
	{
		value: "VNFEM",
		name: "CFS CTY CANG HAI AN",
		label: "VNFEM - CFS CTY CANG HAI AN",
	},
	{
		value: "VNFEML",
		name: "CFS CTY CANG HAI AN",
		label: "VNFEML - CFS CTY CANG HAI AN",
	},
	{
		value: "VNFEN",
		name: "CFS CT PTSC DINH VU",
		label: "VNFEN - CFS CT PTSC DINH VU",
	},
	{
		value: "VNFENL",
		name: "CFS CT PTSC DINH VU",
		label: "VNFENL - CFS CT PTSC DINH VU",
	},
	{
		value: "VNFEO",
		name: "CFS CTY TAN CANG 128",
		label: "VNFEO - CFS CTY TAN CANG 128",
	},
	{
		value: "VNFEOL",
		name: "CFS CTY TAN CANG 128",
		label: "VNFEOL - CFS CTY TAN CANG 128",
	},
	{
		value: "VNFEQL",
		name: "CFS CTY KV DV BFY",
		label: "VNFEQL - CFS CTY KV DV BFY",
	},
	{
		value: "VNFER",
		name: "CFS CANG QTE CHU LAI",
		label: "VNFER - CFS CANG QTE CHU LAI",
	},
	{
		value: "VNFERL",
		name: "CFS CANG QTE CHU LAI",
		label: "VNFERL - CFS CANG QTE CHU LAI",
	},
	{
		value: "VNFEU",
		name: "CFS CTY CANG DINH VU",
		label: "VNFEU - CFS CTY CANG DINH VU",
	},
	{
		value: "VNFEUL",
		name: "CFS CTY CANG DINH VU",
		label: "VNFEUL - CFS CTY CANG DINH VU",
	},
	{
		value: "VNFEZ",
		name: "CFS CT CP CANG MIPEC",
		label: "VNFEZ - CFS CT CP CANG MIPEC",
	},
	{
		value: "VNFEZL",
		name: "CFS CT CP CANG MIPEC",
		label: "VNFEZL - CFS CT CP CANG MIPEC",
	},
	{
		value: "VNGAI",
		name: "CANG GAS DAI HAI",
		label: "VNGAI - CANG GAS DAI HAI",
	},
	{
		value: "VNGAS",
		name: "TOTAL GAS",
		label: "VNGAS - TOTAL GAS",
	},
	{
		value: "VNGDA",
		name: "KHU TC GO DA (VT)",
		label: "VNGDA - KHU TC GO DA (VT)",
	},
	{
		value: "VNGDU",
		name: "CANG GO DAU (P.THAI)",
		label: "VNGDU - CANG GO DAU (P.THAI)",
	},
	{
		value: "VNGEE",
		name: "GREEN PORT (HP)",
		label: "VNGEE - GREEN PORT (HP)",
	},
	{
		value: "VNGHM",
		name: "LPG HONG MOC",
		label: "VNGHM - LPG HONG MOC",
	},
	{
		value: "VNGHP",
		name: "XANG DAU LPG HOA PHU",
		label: "VNGHP - XANG DAU LPG HOA PHU",
	},
	{
		value: "VNGIC",
		name: "CANG GREEN IN CORP",
		label: "VNGIC - CANG GREEN IN CORP",
	},
	{
		value: "VNGIHT",
		name: "CUA KHAU GIANG THANH (KIEN GIANG)",
		label: "VNGIHT - CUA KHAU GIANG THANH (KIEN GIANG)",
	},
	{
		value: "VNGIL",
		name: "KHO NGOAI QUAN CAT LAI",
		label: "VNGIL - KHO NGOAI QUAN CAT LAI",
	},
	{
		value: "VNGTL",
		name: "GEMALINK",
		label: "VNGTL - GEMALINK",
	},
	{
		value: "VNHAL",
		name: "CANG CA HA LONG",
		label: "VNHAL - CANG CA HA LONG",
	},
	{
		value: "VNHAN",
		name: "HA NOI",
		label: "VNHAN - HA NOI",
	},
	{
		value: "VNHCH",
		name: "CANG HON CHONG (KG)",
		label: "VNHCH - CANG HON CHONG (KG)",
	},
	{
		value: "VNHDA",
		name: "HAI DANG  (CELL GAS)",
		label: "VNHDA - HAI DANG  (CELL GAS)",
	},
	{
		value: "VNHDI",
		name: "HOANG DIEU (HP)",
		label: "VNHDI - HOANG DIEU (HP)",
	},
	{
		value: "VNHDN",
		name: "CANG HAI SON DNG",
		label: "VNHDN - CANG HAI SON DNG",
	},
	{
		value: "VNHDV",
		name: "CANG HUYNDAI VINASHI",
		label: "VNHDV - CANG HUYNDAI VINASHI",
	},
	{
		value: "VNHHH",
		name: "CANG HA HUNG HAI",
		label: "VNHHH - CANG HA HUNG HAI",
	},
	{
		value: "VNHHP",
		name: "HATECO HAIPHONG INTL CNTR TML",
		label: "VNHHP - HATECO HAIPHONG INTL CNTR TML",
	},
	{
		value: "VNHIA",
		name: "CANG HAI AN",
		label: "VNHIA - CANG HAI AN",
	},
	{
		value: "VNHLA",
		name: "CANG HON LA (Q.BINH)",
		label: "VNHLA - CANG HON LA (Q.BINH)",
	},
	{
		value: "VNHLC",
		name: "CANG HA LOC (V.TAU)",
		label: "VNHLC - CANG HA LOC (V.TAU)",
	},
	{
		value: "VNHLH",
		name: "C.CANG DK HAI LINH",
		label: "VNHLH - C.CANG DK HAI LINH",
	},
	{
		value: "VNHLM",
		name: "CANG HOLCIM (V.TAU)",
		label: "VNHLM - CANG HOLCIM (V.TAU)",
	},
	{
		value: "VNHNC",
		name: "CANG NAM HAI ICD",
		label: "VNHNC - CANG NAM HAI ICD",
	},
	{
		value: "VNHOAT",
		name: "CUA KHAU HOA LU (BINH PHUOC)",
		label: "VNHOAT - CUA KHAU HOA LU (BINH PHUOC)",
	},
	{
		value: "VNHOHT",
		name: "CUA KHAU HONG LINH (Hà TINH)",
		label: "VNHOHT - CUA KHAU HONG LINH (Hà TINH)",
	},
	{
		value: "VNHON",
		name: "CANG HON GAI (Q.N)",
		label: "VNHON - CANG HON GAI (Q.N)",
	},
	{
		value: "VNHOOT",
		name: "CUA KHAU HOANH MO (QUANG NINH)",
		label: "VNHOOT - CUA KHAU HOANH MO (QUANG NINH)",
	},
	{
		value: "VNHOUT",
		name: "CUA KHAU HOANG DIEU (BINH PHUOC)",
		label: "VNHOUT - CUA KHAU HOANG DIEU (BINH PHUOC)",
	},
	{
		value: "VNHOVT",
		name: "CUA KHAU HONG VAN (THUA THIEN-HUE)",
		label: "VNHOVT - CUA KHAU HONG VAN (THUA THIEN-HUE)",
	},
	{
		value: "VNHPH",
		name: "CANG HAI PHONG",
		label: "VNHPH - CANG HAI PHONG",
	},
	{
		value: "VNHPN",
		name: "CANG TAN VU - HP",
		label: "VNHPN - CANG TAN VU - HP",
	},
	{
		value: "VNHPT",
		name: "CANG TRANSVINA (HP)",
		label: "VNHPT - CANG TRANSVINA (HP)",
	},
	{
		value: "VNHPV",
		name: "CANG VIETFRACHT (HP)",
		label: "VNHPV - CANG VIETFRACHT (HP)",
	},
	{
		value: "VNHTC",
		name: "VN HI-TECH TRANS. CO",
		label: "VNHTC - VN HI-TECH TRANS. CO",
	},
	{
		value: "VNHTE",
		name: "KHU CT PD HA TIEN",
		label: "VNHTE - KHU CT PD HA TIEN",
	},
	{
		value: "VNHTH",
		name: "CANG HAI THINH (ND)",
		label: "VNHTH - CANG HAI THINH (ND)",
	},
	{
		value: "VNHTIT",
		name: "CUA KHAU HA TIEN (KIEN GIANG)",
		label: "VNHTIT - CUA KHAU HA TIEN (KIEN GIANG)",
	},
	{
		value: "VNHTM",
		name: "CANG HON THOM (KG)",
		label: "VNHTM - CANG HON THOM (KG)",
	},
	{
		value: "VNHUCT",
		name: "CUA KHAU HUOI PUOC (DIEN BIEN)",
		label: "VNHUCT - CUA KHAU HUOI PUOC (DIEN BIEN)",
	},
	{
		value: "VNHUGT",
		name: "CUA KHAU HUU NGHI (LANG SON)",
		label: "VNHUGT - CUA KHAU HUU NGHI (LANG SON)",
	},
	{
		value: "VNHUI",
		name: "HUE",
		label: "VNHUI - HUE",
	},
	{
		value: "VNHUN",
		name: "CK HUNG DIEN (LA)",
		label: "VNHUN - CK HUNG DIEN (LA)",
	},
	{
		value: "VNHUNT",
		name: "CUA KHAU HUNG DIEN (LONG AN)",
		label: "VNHUNT - CUA KHAU HUNG DIEN (LONG AN)",
	},
	{
		value: "VNIFR",
		name: "CANG INTERFLOUR (VT)",
		label: "VNIFR - CANG INTERFLOUR (VT)",
	},
	{
		value: "VNIHA",
		name: "ICD TANCANG DONG VAN",
		label: "VNIHA - ICD TANCANG DONG VAN",
	},
	{
		value: "VNITB",
		name: "ICD TANCANG LONGBINH",
		label: "VNITB - ICD TANCANG LONGBINH",
	},
	{
		value: "VNITC",
		name: "CANG CONT SPITC",
		label: "VNITC - CANG CONT SPITC",
	},
	{
		value: "VNITD",
		name: "CANG ICD THANH DAT",
		label: "VNITD - CANG ICD THANH DAT",
	},
	{
		value: "VNITDT",
		name: "ICD THANH DAT",
		label: "VNITDT - ICD THANH DAT",
	},
	{
		value: "VNITP",
		name: "ICD CONG TY THANH PHUOC",
		label: "VNITP - ICD CONG TY THANH PHUOC",
	},
	{
		value: "VNITS",
		name: "ICD TIEN SON BAC NINH",
		label: "VNITS - ICD TIEN SON BAC NINH",
	},
	{
		value: "VNITSL",
		name: "ICD TIEN SON BAC NINH",
		label: "VNITSL - ICD TIEN SON BAC NINH",
	},
	{
		value: "VNKAMT",
		name: "CUA KHAU KATUM (TAY NINH)",
		label: "VNKAMT - CUA KHAU KATUM (TAY NINH)",
	},
	{
		value: "VNKBH",
		name: "CK KHANH BINH (AG)",
		label: "VNKBH - CK KHANH BINH (AG)",
	},
	{
		value: "VNKCT",
		name: "KHU KTCK CAU TREO",
		label: "VNKCT - KHU KTCK CAU TREO",
	},
	{
		value: "VNKCTL",
		name: "KHU KTCK CAU TREO",
		label: "VNKCTL - KHU KTCK CAU TREO",
	},
	{
		value: "VNKHBT",
		name: "CUA KHAU KHANH BINH (AN GIANG)",
		label: "VNKHBT - CUA KHAU KHANH BINH (AN GIANG)",
	},
	{
		value: "VNKHI",
		name: "CANG KHANH HOI (HCM)",
		label: "VNKHI - CANG KHANH HOI (HCM)",
	},
	{
		value: "VNKLB",
		name: "KHU TM LAO BAO",
		label: "VNKLB - KHU TM LAO BAO",
	},
	{
		value: "VNKLBL",
		name: "KHU TM LAO BAO",
		label: "VNKLBL - KHU TM LAO BAO",
	},
	{
		value: "VNKNN",
		name: "K 99",
		label: "VNKNN - K 99",
	},
	{
		value: "VNKYH",
		name: "CANG KY HA (Q.NAM)",
		label: "VNKYH - CANG KY HA (Q.NAM)",
	},
	{
		value: "VNLAIT",
		name: "CUA KHAU LAO CAI (LAO CAI)",
		label: "VNLAIT - CUA KHAU LAO CAI (LAO CAI)",
	},
	{
		value: "VNLAOT",
		name: "CUA KHAU LAO BAO (QUANG TRI)",
		label: "VNLAOT - CUA KHAU LAO BAO (QUANG TRI)",
	},
	{
		value: "VNLAYT",
		name: "CUA KHAU LA LAY (QUANG TRI)",
		label: "VNLAYT - CUA KHAU LA LAY (QUANG TRI)",
	},
	{
		value: "VNLCHT",
		name: "LOI MO MOC 238 LAO CHAI",
		label: "VNLCHT - LOI MO MOC 238 LAO CHAI",
	},
	{
		value: "VNLCL",
		name: "LAO CAI",
		label: "VNLCL - LAO CAI",
	},
	{
		value: "VNLCLC",
		name: "LAO CAI",
		label: "VNLCLC - LAO CAI",
	},
	{
		value: "VNLEHT",
		name: "CUA KHAU LE THANH (GIA LAI)",
		label: "VNLEHT - CUA KHAU LE THANH (GIA LAI)",
	},
	{
		value: "VNLFA",
		name: "LAFARGE XI MANG",
		label: "VNLFA - LAFARGE XI MANG",
	},
	{
		value: "VNLHH",
		name: "CTY CANG HAI PHONG",
		label: "VNLHH - CTY CANG HAI PHONG",
	},
	{
		value: "VNLIL",
		name: "LILAMA",
		label: "VNLIL - LILAMA",
	},
	{
		value: "VNLIO",
		name: "CANG LISEMCO",
		label: "VNLIO - CANG LISEMCO",
	},
	{
		value: "VNLMN",
		name: "CANH LEE MAN",
		label: "VNLMN - CANH LEE MAN",
	},
	{
		value: "VNLOHT",
		name: "CUA KHAU CHINH LOC THINH",
		label: "VNLOHT - CUA KHAU CHINH LOC THINH",
	},
	{
		value: "VNLOPT",
		name: "CUA KHAU LONG SAP (DIEN BIEN)",
		label: "VNLOPT - CUA KHAU LONG SAP (DIEN BIEN)",
	},
	{
		value: "VNLOT",
		name: "CANG LOTUS (HCM)",
		label: "VNLOT - CANG LOTUS (HCM)",
	},
	{
		value: "VNLTA",
		name: "LOI MO LOC TAN (BINH PHUOC)",
		label: "VNLTA - LOI MO LOC TAN (BINH PHUOC)",
	},
	{
		value: "VNLTAT",
		name: "LOI MO LOC TAN (BINH PHUOC)",
		label: "VNLTAT - LOI MO LOC TAN (BINH PHUOC)",
	},
	{
		value: "VNLTH",
		name: "CANG LONG THANH MN",
		label: "VNLTH - CANG LONG THANH MN",
	},
	{
		value: "VNLVG",
		name: "CANG LIEN VIET LOG",
		label: "VNLVG - CANG LIEN VIET LOG",
	},
	{
		value: "VNLYNT",
		name: "CUA KHAU LY VAN (CAO BANG)",
		label: "VNLYNT - CUA KHAU LY VAN (CAO BANG)",
	},
	{
		value: "VNMAGT",
		name: "CUA KHAU MA LU THANG",
		label: "VNMAGT - CUA KHAU MA LU THANG",
	},
	{
		value: "VNMCL",
		name: "CATLAI OPENPORT(HCM)",
		label: "VNMCL - CATLAI OPENPORT(HCM)",
	},
	{
		value: "VNMLTT",
		name: "CUA KHAU MA LU THANG (DIEN BIEN)",
		label: "VNMLTT - CUA KHAU MA LU THANG (DIEN BIEN)",
	},
	{
		value: "VNMOAT",
		name: "CUA KHAU MOC HOA (LONG AN)",
		label: "VNMOAT - CUA KHAU MOC HOA (LONG AN)",
	},
	{
		value: "VNMOCT",
		name: "CUA KHAU MONG CAI (QUANG NINH)",
		label: "VNMOCT - CUA KHAU MONG CAI (QUANG NINH)",
	},
	{
		value: "VNMOIT",
		name: "CUA KHAU MOC BAI (TAY NINH)",
		label: "VNMOIT - CUA KHAU MOC BAI (TAY NINH)",
	},
	{
		value: "VNMPC",
		name: "CANG MIPEC",
		label: "VNMPC - CANG MIPEC",
	},
	{
		value: "VNMQTT",
		name: "CUA KHAU MY QUY TAY (LONG AN)",
		label: "VNMQTT - CUA KHAU MY QUY TAY (LONG AN)",
	},
	{
		value: "VNMTCT",
		name: "CUAKHAU 1088 1089 LS",
		label: "VNMTCT - CUAKHAU 1088 1089 LS",
	},
	{
		value: "VNMTH",
		name: "CANG MY THOI (AG)",
		label: "VNMTH - CANG MY THOI (AG)",
	},
	{
		value: "VNMUGT",
		name: "CUA KHAU MUONG KHUONG (LAO CAI)",
		label: "VNMUGT - CUA KHAU MUONG KHUONG (LAO CAI)",
	},
	{
		value: "VNMUT",
		name: "CANG MY THO (L.AN)",
		label: "VNMUT - CANG MY THO (L.AN)",
	},
	{
		value: "VNNAA",
		name: "GN KV NGOAI THUONG",
		label: "VNNAA - GN KV NGOAI THUONG",
	},
	{
		value: "VNNAAL",
		name: "GN KV NGOAI THUONG",
		label: "VNNAAL - GN KV NGOAI THUONG",
	},
	{
		value: "VNNAAT",
		name: "CUA KHAU NA NUA (LANG SON)",
		label: "VNNAAT - CUA KHAU NA NUA (LANG SON)",
	},
	{
		value: "VNNAB",
		name: "TM DV XNK HAI PHONG",
		label: "VNNAB - TM DV XNK HAI PHONG",
	},
	{
		value: "VNNABL",
		name: "TM DV XNK HAI PHONG",
		label: "VNNABL - TM DV XNK HAI PHONG",
	},
	{
		value: "VNNAC",
		name: "TM XD 5 HP",
		label: "VNNAC - TM XD 5 HP",
	},
	{
		value: "VNNACL",
		name: "TM XD 5 HP",
		label: "VNNACL - TM XD 5 HP",
	},
	{
		value: "VNNACT",
		name: "CUA KHAU NAM CAN (NGHE AN)",
		label: "VNNACT - CUA KHAU NAM CAN (NGHE AN)",
	},
	{
		value: "VNNAD",
		name: "TNHH THANH HUYEN",
		label: "VNNAD - TNHH THANH HUYEN",
	},
	{
		value: "VNNADL",
		name: "TNHH THANH HUYEN",
		label: "VNNADL - TNHH THANH HUYEN",
	},
	{
		value: "VNNAE",
		name: "TM HOANG CAU",
		label: "VNNAE - TM HOANG CAU",
	},
	{
		value: "VNNAEL",
		name: "TM HOANG CAU",
		label: "VNNAEL - TM HOANG CAU",
	},
	{
		value: "VNNAF",
		name: "VAT LIEU DIEN HP",
		label: "VNNAF - VAT LIEU DIEN HP",
	},
	{
		value: "VNNAFL",
		name: "VAT LIEU DIEN HP",
		label: "VNNAFL - VAT LIEU DIEN HP",
	},
	{
		value: "VNNAG",
		name: "CN LH VAN CHUYEN HP",
		label: "VNNAG - CN LH VAN CHUYEN HP",
	},
	{
		value: "VNNAGL",
		name: "CN LH VAN CHUYEN HP",
		label: "VNNAGL - CN LH VAN CHUYEN HP",
	},
	{
		value: "VNNAGT",
		name: "CUA KHAU NAM GIANG (QUANG NAM)",
		label: "VNNAGT - CUA KHAU NAM GIANG (QUANG NAM)",
	},
	{
		value: "VNNAH",
		name: "VIJACO",
		label: "VNNAH - VIJACO",
	},
	{
		value: "VNNAHL",
		name: "VIJACO",
		label: "VNNAHL - VIJACO",
	},
	{
		value: "VNNAHT",
		name: "CUA KHAU NA HINH (LANG SON)",
		label: "VNNAHT - CUA KHAU NA HINH (LANG SON)",
	},
	{
		value: "VNNAI",
		name: "XNK QUANG BINH",
		label: "VNNAI - XNK QUANG BINH",
	},
	{
		value: "VNNAIL",
		name: "XNK QUANG BINH",
		label: "VNNAIL - XNK QUANG BINH",
	},
	{
		value: "VNNAIT",
		name: "CUA KHAU PHU NA CAI",
		label: "VNNAIT - CUA KHAU PHU NA CAI",
	},
	{
		value: "VNNAJ",
		name: "BINH PHU",
		label: "VNNAJ - BINH PHU",
	},
	{
		value: "VNNAJL",
		name: "BINH PHU",
		label: "VNNAJL - BINH PHU",
	},
	{
		value: "VNNAK",
		name: "CAT VAN",
		label: "VNNAK - CAT VAN",
	},
	{
		value: "VNNAKL",
		name: "CAT VAN",
		label: "VNNAKL - CAT VAN",
	},
	{
		value: "VNNAL",
		name: "GIAONHAN NT HAIPHONG",
		label: "VNNAL - GIAONHAN NT HAIPHONG",
	},
	{
		value: "VNNALL",
		name: "GIAONHAN NT HAIPHONG",
		label: "VNNALL - GIAONHAN NT HAIPHONG",
	},
	{
		value: "VNNALT",
		name: "CUA KHAU NA LAN (CAO BANG)",
		label: "VNNALT - CUA KHAU NA LAN (CAO BANG)",
	},
	{
		value: "VNNAM",
		name: "KNQ LOGISTICS XANH",
		label: "VNNAM - KNQ LOGISTICS XANH",
	},
	{
		value: "VNNAML",
		name: "KNQ LOGISTICS XANH",
		label: "VNNAML - KNQ LOGISTICS XANH",
	},
	{
		value: "VNNAN",
		name: "VINALINE LOGISTIC VN",
		label: "VNNAN - VINALINE LOGISTIC VN",
	},
	{
		value: "VNNANL",
		name: "VINALINE LOGISTIC VN",
		label: "VNNANL - VINALINE LOGISTIC VN",
	},
	{
		value: "VNNAO",
		name: "CTY CP AB PLUS",
		label: "VNNAO - CTY CP AB PLUS",
	},
	{
		value: "VNNAOL",
		name: "CTY CP AB PLUS",
		label: "VNNAOL - CTY CP AB PLUS",
	},
	{
		value: "VNNAOT",
		name: "CUA KHAU NA MOO (THANH HOO)",
		label: "VNNAOT - CUA KHAU NA MOO (THANH HOO)",
	},
	{
		value: "VNNAP",
		name: "MASCOT VN",
		label: "VNNAP - MASCOT VN",
	},
	{
		value: "VNNAPL",
		name: "MASCOT VN",
		label: "VNNAPL - MASCOT VN",
	},
	{
		value: "VNNAQ",
		name: "VAN TAI VIET NHAT HD",
		label: "VNNAQ - VAN TAI VIET NHAT HD",
	},
	{
		value: "VNNAQL",
		name: "VAN TAI VIET NHAT HD",
		label: "VNNAQL - VAN TAI VIET NHAT HD",
	},
	{
		value: "VNNAR",
		name: "SANKYULOGISTICS HD",
		label: "VNNAR - SANKYULOGISTICS HD",
	},
	{
		value: "VNNARL",
		name: "SANKYULOGISTICS HD",
		label: "VNNARL - SANKYULOGISTICS HD",
	},
	{
		value: "VNNAS",
		name: "YUSEN HA NOI",
		label: "VNNAS - YUSEN HA NOI",
	},
	{
		value: "VNNASL",
		name: "YUSEN HA NOI",
		label: "VNNASL - YUSEN HA NOI",
	},
	{
		value: "VNNAT",
		name: "GN KHO VAN HAI DUONG",
		label: "VNNAT - GN KHO VAN HAI DUONG",
	},
	{
		value: "VNNATL",
		name: "GN KHO VAN HAI DUONG",
		label: "VNNATL - GN KHO VAN HAI DUONG",
	},
	{
		value: "VNNAU",
		name: "NM D.TAU NAM TRIEU",
		label: "VNNAU - NM D.TAU NAM TRIEU",
	},
	{
		value: "VNNAUL",
		name: "KERRY I LOGISTICS HY",
		label: "VNNAUL - KERRY I LOGISTICS HY",
	},
	{
		value: "VNNAV",
		name: "TIEP VAN THANG LONG",
		label: "VNNAV - TIEP VAN THANG LONG",
	},
	{
		value: "VNNAVL",
		name: "TIEP VAN THANG LONG",
		label: "VNNAVL - TIEP VAN THANG LONG",
	},
	{
		value: "VNNAW",
		name: "GEMADEPT SONGTHAN BD",
		label: "VNNAW - GEMADEPT SONGTHAN BD",
	},
	{
		value: "VNNAWL",
		name: "GEMADEPT SONGTHAN BD",
		label: "VNNAWL - GEMADEPT SONGTHAN BD",
	},
	{
		value: "VNNAX",
		name: "GEMADEPT AN THANH BD",
		label: "VNNAX - GEMADEPT AN THANH BD",
	},
	{
		value: "VNNAXL",
		name: "GEMADEPT AN THANH BD",
		label: "VNNAXL - GEMADEPT AN THANH BD",
	},
	{
		value: "VNNAY",
		name: "TANCANG SONGTHAN",
		label: "VNNAY - TANCANG SONGTHAN",
	},
	{
		value: "VNNAYL",
		name: "TANCANG SONGTHAN",
		label: "VNNAYL - TANCANG SONGTHAN",
	},
	{
		value: "VNNAZ",
		name: "SWIRE COLD STORAGE",
		label: "VNNAZ - SWIRE COLD STORAGE",
	},
	{
		value: "VNNAZL",
		name: "SWIRE COLD STORAGE",
		label: "VNNAZL - SWIRE COLD STORAGE",
	},
	{
		value: "VNNBA",
		name: "VAN TAI VIET NHAT",
		label: "VNNBA - VAN TAI VIET NHAT",
	},
	{
		value: "VNNBAL",
		name: "VAN TAI VIET NHAT",
		label: "VNNBAL - VAN TAI VIET NHAT",
	},
	{
		value: "VNNBB",
		name: "KERRY I LOGISTICS BD",
		label: "VNNBB - KERRY I LOGISTICS BD",
	},
	{
		value: "VNNBBL",
		name: "KERRY I LOGISTICS BD",
		label: "VNNBBL - KERRY I LOGISTICS BD",
	},
	{
		value: "VNNBC",
		name: "GN VAN TAI UI D5",
		label: "VNNBC - GN VAN TAI UI D5",
	},
	{
		value: "VNNBCL",
		name: "GN VAN TAI UI D5",
		label: "VNNBCL - GN VAN TAI UI D5",
	},
	{
		value: "VNNBD",
		name: "C STEINWEG BD",
		label: "VNNBD - C STEINWEG BD",
	},
	{
		value: "VNNBDL",
		name: "C STEINWEG BD",
		label: "VNNBDL - C STEINWEG BD",
	},
	{
		value: "VNNBE",
		name: "CANG NHA BE (HCM)",
		label: "VNNBE - CANG NHA BE (HCM)",
	},
	{
		value: "VNNBEL",
		name: "ANH HUY BD",
		label: "VNNBEL - ANH HUY BD",
	},
	{
		value: "VNNBF",
		name: "KHO VAN GIA DINH",
		label: "VNNBF - KHO VAN GIA DINH",
	},
	{
		value: "VNNBFL",
		name: "KHO VAN GIA DINH",
		label: "VNNBFL - KHO VAN GIA DINH",
	},
	{
		value: "VNNBG",
		name: "NIPPON EXPRESS",
		label: "VNNBG - NIPPON EXPRESS",
	},
	{
		value: "VNNBGL",
		name: "NIPPON EXPRESS",
		label: "VNNBGL - NIPPON EXPRESS",
	},
	{
		value: "VNNBH",
		name: "PETEC BD",
		label: "VNNBH - PETEC BD",
	},
	{
		value: "VNNBHL",
		name: "PETEC BD",
		label: "VNNBHL - PETEC BD",
	},
	{
		value: "VNNBI",
		name: "GN VAN TAI UI N2",
		label: "VNNBI - GN VAN TAI UI N2",
	},
	{
		value: "VNNBIL",
		name: "GN VAN TAI UI N2",
		label: "VNNBIL - GN VAN TAI UI N2",
	},
	{
		value: "VNNBJ",
		name: "LIEN ANH BD",
		label: "VNNBJ - LIEN ANH BD",
	},
	{
		value: "VNNBJL",
		name: "LIEN ANH BD",
		label: "VNNBJL - LIEN ANH BD",
	},
	{
		value: "VNNBK",
		name: "DIA OC ARECO BD",
		label: "VNNBK - DIA OC ARECO BD",
	},
	{
		value: "VNNBKL",
		name: "DIA OC ARECO BD",
		label: "VNNBKL - DIA OC ARECO BD",
	},
	{
		value: "VNNBL",
		name: "NIPPON EXP SONG THAN",
		label: "VNNBL - NIPPON EXP SONG THAN",
	},
	{
		value: "VNNBLL",
		name: "NIPPON EXP SONG THAN",
		label: "VNNBLL - NIPPON EXP SONG THAN",
	},
	{
		value: "VNNBM",
		name: "GN VAN TAI UI N13",
		label: "VNNBM - GN VAN TAI UI N13",
	},
	{
		value: "VNNBML",
		name: "GN VAN TAI UI N13",
		label: "VNNBML - GN VAN TAI UI N13",
	},
	{
		value: "VNNBN",
		name: "TRANSIMEX BD",
		label: "VNNBN - TRANSIMEX BD",
	},
	{
		value: "VNNBNL",
		name: "TRANSIMEX BD",
		label: "VNNBNL - TRANSIMEX BD",
	},
	{
		value: "VNNBO",
		name: "TMDV BINH DUONG",
		label: "VNNBO - TMDV BINH DUONG",
	},
	{
		value: "VNNBOL",
		name: "TMDV BINH DUONG",
		label: "VNNBOL - TMDV BINH DUONG",
	},
	{
		value: "VNNBP",
		name: "HOTRO TAINANG TRE VN",
		label: "VNNBP - HOTRO TAINANG TRE VN",
	},
	{
		value: "VNNBPL",
		name: "HOTRO TAINANG TRE VN",
		label: "VNNBPL - HOTRO TAINANG TRE VN",
	},
	{
		value: "VNNBQ",
		name: "TMDV XNK HAI PHONG",
		label: "VNNBQ - TMDV XNK HAI PHONG",
	},
	{
		value: "VNNBQL",
		name: "TMDV XNK HAI PHONG",
		label: "VNNBQL - TMDV XNK HAI PHONG",
	},
	{
		value: "VNNBR",
		name: "QUANG PHAT",
		label: "VNNBR - QUANG PHAT",
	},
	{
		value: "VNNBRL",
		name: "QUANG PHAT",
		label: "VNNBRL - QUANG PHAT",
	},
	{
		value: "VNNBS",
		name: "TAU BIEN QUANG NINH",
		label: "VNNBS - TAU BIEN QUANG NINH",
	},
	{
		value: "VNNBSL",
		name: "TAU BIEN QUANG NINH",
		label: "VNNBSL - TAU BIEN QUANG NINH",
	},
	{
		value: "VNNBT",
		name: "DTPT QUANG NINH",
		label: "VNNBT - DTPT QUANG NINH",
	},
	{
		value: "VNNBTL",
		name: "DTPT QUANG NINH",
		label: "VNNBTL - DTPT QUANG NINH",
	},
	{
		value: "VNNBU",
		name: "HANG HAI QUANG NINH",
		label: "VNNBU - HANG HAI QUANG NINH",
	},
	{
		value: "VNNBUL",
		name: "HANG HAI QUANG NINH",
		label: "VNNBUL - HANG HAI QUANG NINH",
	},
	{
		value: "VNNBV",
		name: "CONG TY CO INDECO",
		label: "VNNBV - CONG TY CO INDECO",
	},
	{
		value: "VNNBVL",
		name: "CONG TY CO INDECO",
		label: "VNNBVL - CONG TY CO INDECO",
	},
	{
		value: "VNNBW",
		name: "CT CPSXTM HOANG TIEN",
		label: "VNNBW - CT CPSXTM HOANG TIEN",
	},
	{
		value: "VNNBWL",
		name: "CT CPSXTM HOANG TIEN",
		label: "VNNBWL - CT CPSXTM HOANG TIEN",
	},
	{
		value: "VNNBX",
		name: "C.TY TNHH SON TUNG",
		label: "VNNBX - C.TY TNHH SON TUNG",
	},
	{
		value: "VNNBXL",
		name: "C.TY TNHH SON TUNG",
		label: "VNNBXL - C.TY TNHH SON TUNG",
	},
	{
		value: "VNNBY",
		name: "CT TNHH TRUONG GIANG",
		label: "VNNBY - CT TNHH TRUONG GIANG",
	},
	{
		value: "VNNBYL",
		name: "CT TNHH TRUONG GIANG",
		label: "VNNBYL - CT TNHH TRUONG GIANG",
	},
	{
		value: "VNNBZ",
		name: "CT TNHH Q.TE SAO BAC",
		label: "VNNBZ - CT TNHH Q.TE SAO BAC",
	},
	{
		value: "VNNBZL",
		name: "CT TNHH Q.TE SAO BAC",
		label: "VNNBZL - CT TNHH Q.TE SAO BAC",
	},
	{
		value: "VNNCA",
		name: "D.LY HH QUANG NINH",
		label: "VNNCA - D.LY HH QUANG NINH",
	},
	{
		value: "VNNCAL",
		name: "D.LY HH QUANG NINH",
		label: "VNNCAL - D.LY HH QUANG NINH",
	},
	{
		value: "VNNCB",
		name: "CTCP T.BIEN Q.NINH",
		label: "VNNCB - CTCP T.BIEN Q.NINH",
	},
	{
		value: "VNNCBL",
		name: "CTCP T.BIEN Q.NINH",
		label: "VNNCBL - CTCP T.BIEN Q.NINH",
	},
	{
		value: "VNNCC",
		name: "CTCP DT VA XNK QNINH",
		label: "VNNCC - CTCP DT VA XNK QNINH",
	},
	{
		value: "VNNCCL",
		name: "CTCP DT VA XNK QNINH",
		label: "VNNCCL - CTCP DT VA XNK QNINH",
	},
	{
		value: "VNNCD",
		name: "CTY CP TAXI MONG CAI",
		label: "VNNCD - CTY CP TAXI MONG CAI",
	},
	{
		value: "VNNCDL",
		name: "CTY CP TAXI MONG CAI",
		label: "VNNCDL - CTY CP TAXI MONG CAI",
	},
	{
		value: "VNNCE",
		name: "CONG TY TNHH VU HAI",
		label: "VNNCE - CONG TY TNHH VU HAI",
	},
	{
		value: "VNNCEL",
		name: "CONG TY TNHH VU HAI",
		label: "VNNCEL - CONG TY TNHH VU HAI",
	},
	{
		value: "VNNCF",
		name: "CT KIMTHANH PHAT DAT",
		label: "VNNCF - CT KIMTHANH PHAT DAT",
	},
	{
		value: "VNNCFL",
		name: "CT KIMTHANH PHAT DAT",
		label: "VNNCFL - CT KIMTHANH PHAT DAT",
	},
	{
		value: "VNNCG",
		name: "CT MTV CANG SAI GON",
		label: "VNNCG - CT MTV CANG SAI GON",
	},
	{
		value: "VNNCGL",
		name: "CT MTV CANG SAI GON",
		label: "VNNCGL - CT MTV CANG SAI GON",
	},
	{
		value: "VNNCH",
		name: "CT VBDQ SAI GON SJC",
		label: "VNNCH - CT VBDQ SAI GON SJC",
	},
	{
		value: "VNNCHL",
		name: "CT VBDQ SAI GON SJC",
		label: "VNNCHL - CT VBDQ SAI GON SJC",
	},
	{
		value: "VNNCI",
		name: "LDXDKD KCX TAN THUAN",
		label: "VNNCI - LDXDKD KCX TAN THUAN",
	},
	{
		value: "VNNCIL",
		name: "LDXDKD KCX TAN THUAN",
		label: "VNNCIL - LDXDKD KCX TAN THUAN",
	},
	{
		value: "VNNCJ",
		name: "CT GNKV NT SAI GON",
		label: "VNNCJ - CT GNKV NT SAI GON",
	},
	{
		value: "VNNCJL",
		name: "CT GNKV NT SAI GON",
		label: "VNNCJL - CT GNKV NT SAI GON",
	},
	{
		value: "VNNCK",
		name: "CTCP Y D VIMEDIMEX",
		label: "VNNCK - CTCP Y D VIMEDIMEX",
	},
	{
		value: "VNNCKL",
		name: "CTCP Y D VIMEDIMEX",
		label: "VNNCKL - CTCP Y D VIMEDIMEX",
	},
	{
		value: "VNNCL",
		name: "CTY SX XNK TAY NAM",
		label: "VNNCL - CTY SX XNK TAY NAM",
	},
	{
		value: "VNNCLL",
		name: "CTY SX XNK TAY NAM",
		label: "VNNCLL - CTY SX XNK TAY NAM",
	},
	{
		value: "VNNCM",
		name: "CT KV M.NAM SOTRANS",
		label: "VNNCM - CT KV M.NAM SOTRANS",
	},
	{
		value: "VNNCML",
		name: "CT KV M.NAM SOTRANS",
		label: "VNNCML - CT KV M.NAM SOTRANS",
	},
	{
		value: "VNNCN",
		name: "CANG NAM CAN",
		label: "VNNCN - CANG NAM CAN",
	},
	{
		value: "VNNCNL",
		name: "CANG NAM CAN",
		label: "VNNCNL - CANG NAM CAN",
	},
	{
		value: "VNNCO",
		name: "CTCP KTPT KV TAN TAO",
		label: "VNNCO - CTCP KTPT KV TAN TAO",
	},
	{
		value: "VNNCOL",
		name: "CTCP KTPT KV TAN TAO",
		label: "VNNCOL - CTCP KTPT KV TAN TAO",
	},
	{
		value: "VNNCP",
		name: "CTY SAGAWA EXPRESS",
		label: "VNNCP - CTY SAGAWA EXPRESS",
	},
	{
		value: "VNNCPL",
		name: "CTY SAGAWA EXPRESS",
		label: "VNNCPL - CTY SAGAWA EXPRESS",
	},
	{
		value: "VNNCQ",
		name: "CTCP VINALINK",
		label: "VNNCQ - CTCP VINALINK",
	},
	{
		value: "VNNCQL",
		name: "CTCP VINALINK",
		label: "VNNCQL - CTCP VINALINK",
	},
	{
		value: "VNNCR",
		name: "CTCP TMDV C SAI GON",
		label: "VNNCR - CTCP TMDV C SAI GON",
	},
	{
		value: "VNNCRL",
		name: "CTCP TMDV C SAI GON",
		label: "VNNCRL - CTCP TMDV C SAI GON",
	},
	{
		value: "VNNCS",
		name: "CTLD BONG SEN(LOTUS)",
		label: "VNNCS - CTLD BONG SEN(LOTUS)",
	},
	{
		value: "VNNCSL",
		name: "CTLD BONG SEN(LOTUS)",
		label: "VNNCSL - CTLD BONG SEN(LOTUS)",
	},
	{
		value: "VNNCT",
		name: "CANG SAI GON",
		label: "VNNCT - CANG SAI GON",
	},
	{
		value: "VNNCTL",
		name: "CANG SAI GON",
		label: "VNNCTL - CANG SAI GON",
	},
	{
		value: "VNNCU",
		name: "CT TMDV XNK DONG TAY",
		label: "VNNCU - CT TMDV XNK DONG TAY",
	},
	{
		value: "VNNCUL",
		name: "CT TMDV XNK DONG TAY",
		label: "VNNCUL - CT TMDV XNK DONG TAY",
	},
	{
		value: "VNNCV",
		name: "TNHH MTV C.SAI GON",
		label: "VNNCV - TNHH MTV C.SAI GON",
	},
	{
		value: "VNNCVL",
		name: "TNHH MTV C.SAI GON",
		label: "VNNCVL - TNHH MTV C.SAI GON",
	},
	{
		value: "VNNCW",
		name: "CTLD K.VAN BINH MINH",
		label: "VNNCW - CTLD K.VAN BINH MINH",
	},
	{
		value: "VNNCWL",
		name: "CTLD K.VAN BINH MINH",
		label: "VNNCWL - CTLD K.VAN BINH MINH",
	},
	{
		value: "VNNCX",
		name: "CTTNHH C.BEN NGHE",
		label: "VNNCX - CTTNHH C.BEN NGHE",
	},
	{
		value: "VNNCXL",
		name: "CTTNHH C.BEN NGHE",
		label: "VNNCXL - CTTNHH C.BEN NGHE",
	},
	{
		value: "VNNCY",
		name: "CTCP DVHH S.GON SCSC",
		label: "VNNCY - CTCP DVHH S.GON SCSC",
	},
	{
		value: "VNNCYL",
		name: "CTCP DVHH S.GON SCSC",
		label: "VNNCYL - CTCP DVHH S.GON SCSC",
	},
	{
		value: "VNNCZ",
		name: "CT DVHH TSN (TCS)",
		label: "VNNCZ - CT DVHH TSN (TCS)",
	},
	{
		value: "VNNCZL",
		name: "CT DVHH TSN (TCS)",
		label: "VNNCZL - CT DVHH TSN (TCS)",
	},
	{
		value: "VNNDA",
		name: "CTLD VT HH VIET NHAT",
		label: "VNNDA - CTLD VT HH VIET NHAT",
	},
	{
		value: "VNNDAL",
		name: "CTLD VT HH VIET NHAT",
		label: "VNNDAL - CTLD VT HH VIET NHAT",
	},
	{
		value: "VNNDB",
		name: "CT T.VAN THANG LONG",
		label: "VNNDB - CT T.VAN THANG LONG",
	},
	{
		value: "VNNDBL",
		name: "CT T.VAN THANG LONG",
		label: "VNNDBL - CT T.VAN THANG LONG",
	},
	{
		value: "VNNDBT",
		name: "CK MOC 49 DIEN BIEN",
		label: "VNNDBT - CK MOC 49 DIEN BIEN",
	},
	{
		value: "VNNDC",
		name: "CT N.LUC TMQT HA NOI",
		label: "VNNDC - CT N.LUC TMQT HA NOI",
	},
	{
		value: "VNNDCL",
		name: "CT N.LUC TMQT HA NOI",
		label: "VNNDCL - CT N.LUC TMQT HA NOI",
	},
	{
		value: "VNNDD",
		name: "NIPPONEXPRESS VN(HN)",
		label: "VNNDD - NIPPONEXPRESS VN(HN)",
	},
	{
		value: "VNNDDL",
		name: "NIPPONEXPRESS VN(HN)",
		label: "VNNDDL - NIPPONEXPRESS VN(HN)",
	},
	{
		value: "VNNDE",
		name: "CTTNHH Q.TE DUC YEN",
		label: "VNNDE - CTTNHH Q.TE DUC YEN",
	},
	{
		value: "VNNDEL",
		name: "CTTNHH Q.TE DUC YEN",
		label: "VNNDEL - CTTNHH Q.TE DUC YEN",
	},
	{
		value: "VNNDF",
		name: "CTCP TMXNK THANH LOI",
		label: "VNNDF - CTCP TMXNK THANH LOI",
	},
	{
		value: "VNNDFL",
		name: "CTCP TMXNK THANH LOI",
		label: "VNNDFL - CTCP TMXNK THANH LOI",
	},
	{
		value: "VNNDG",
		name: "CTY CP KHO VAN ALS",
		label: "VNNDG - CTY CP KHO VAN ALS",
	},
	{
		value: "VNNDGL",
		name: "CTY CP KHO VAN ALS",
		label: "VNNDGL - CTY CP KHO VAN ALS",
	},
	{
		value: "VNNDH",
		name: "CT NYK LOGISTICS VN",
		label: "VNNDH - CT NYK LOGISTICS VN",
	},
	{
		value: "VNNDHL",
		name: "CT NYK LOGISTICS VN",
		label: "VNNDHL - CT NYK LOGISTICS VN",
	},
	{
		value: "VNNDI",
		name: "CT PT D.THI KINH BAC",
		label: "VNNDI - CT PT D.THI KINH BAC",
	},
	{
		value: "VNNDIL",
		name: "CT PT D.THI KINH BAC",
		label: "VNNDIL - CT PT D.THI KINH BAC",
	},
	{
		value: "VNNDJ",
		name: "SAGAWA EXPRESS (HN)",
		label: "VNNDJ - SAGAWA EXPRESS (HN)",
	},
	{
		value: "VNNDJL",
		name: "SAGAWA EXPRESS (HN)",
		label: "VNNDJL - SAGAWA EXPRESS (HN)",
	},
	{
		value: "VNNDK",
		name: "CTY CP DAU TU BAC KY",
		label: "VNNDK - CTY CP DAU TU BAC KY",
	},
	{
		value: "VNNDKL",
		name: "CTY CP DAU TU BAC KY",
		label: "VNNDKL - CTY CP DAU TU BAC KY",
	},
	{
		value: "VNNDL",
		name: "CTYTNHH ALS BAC NINH",
		label: "VNNDL - CTYTNHH ALS BAC NINH",
	},
	{
		value: "VNNDLL",
		name: "CTYTNHH ALS BAC NINH",
		label: "VNNDLL - CTYTNHH ALS BAC NINH",
	},
	{
		value: "VNNDM",
		name: "CT GNVC INDO-TRAN",
		label: "VNNDM - CT GNVC INDO-TRAN",
	},
	{
		value: "VNNDML",
		name: "CT GNVC INDO-TRAN",
		label: "VNNDML - CT GNVC INDO-TRAN",
	},
	{
		value: "VNNDN",
		name: "SAGAWA EXPRESS (HN)",
		label: "VNNDN - SAGAWA EXPRESS (HN)",
	},
	{
		value: "VNNDNL",
		name: "SAGAWA EXPRESS (HN)",
		label: "VNNDNL - SAGAWA EXPRESS (HN)",
	},
	{
		value: "VNNDO",
		name: "CTLOGISTIC TIN NGHIA",
		label: "VNNDO - CTLOGISTIC TIN NGHIA",
	},
	{
		value: "VNNDOL",
		name: "CTLOGISTIC TIN NGHIA",
		label: "VNNDOL - CTLOGISTIC TIN NGHIA",
	},
	{
		value: "VNNDP",
		name: "CTTNHH TV THANG LONG",
		label: "VNNDP - CTTNHH TV THANG LONG",
	},
	{
		value: "VNNDPL",
		name: "CTTNHH TV THANG LONG",
		label: "VNNDPL - CTTNHH TV THANG LONG",
	},
	{
		value: "VNNDQ",
		name: "ICD T.CANG LONG BINH",
		label: "VNNDQ - ICD T.CANG LONG BINH",
	},
	{
		value: "VNNDQL",
		name: "ICD T.CANG LONG BINH",
		label: "VNNDQL - ICD T.CANG LONG BINH",
	},
	{
		value: "VNNDR",
		name: "CONG TY TNHH VOPAK",
		label: "VNNDR - CONG TY TNHH VOPAK",
	},
	{
		value: "VNNDRL",
		name: "CONG TY TNHH VOPAK",
		label: "VNNDRL - CONG TY TNHH VOPAK",
	},
	{
		value: "VNNDS",
		name: "CT TNHH CP HOA VIET",
		label: "VNNDS - CT TNHH CP HOA VIET",
	},
	{
		value: "VNNDSL",
		name: "CT TNHH CP HOA VIET",
		label: "VNNDSL - CT TNHH CP HOA VIET",
	},
	{
		value: "VNNDT",
		name: "CT TNHH XUAN CUONG",
		label: "VNNDT - CT TNHH XUAN CUONG",
	},
	{
		value: "VNNDTL",
		name: "CT TNHH XUAN CUONG",
		label: "VNNDTL - CT TNHH XUAN CUONG",
	},
	{
		value: "VNNDU",
		name: "CTCP TV THANH LONG",
		label: "VNNDU - CTCP TV THANH LONG",
	},
	{
		value: "VNNDUL",
		name: "CTCP TV THANH LONG",
		label: "VNNDUL - CTCP TV THANH LONG",
	},
	{
		value: "VNNDV",
		name: "CTTNHH KCTC VINA",
		label: "VNNDV - CTTNHH KCTC VINA",
	},
	{
		value: "VNNDVL",
		name: "CTTNHH KCTC VINA",
		label: "VNNDVL - CTTNHH KCTC VINA",
	},
	{
		value: "VNNDW",
		name: "CTY TNHH VINH CUONG.",
		label: "VNNDW - CTY TNHH VINH CUONG.",
	},
	{
		value: "VNNDWL",
		name: "CTY TNHH VINH CUONG.",
		label: "VNNDWL - CTY TNHH VINH CUONG.",
	},
	{
		value: "VNNDX",
		name: "XNK NLSAN PB BA RIA",
		label: "VNNDX - XNK NLSAN PB BA RIA",
	},
	{
		value: "VNNDXL",
		name: "XNK NLSAN PB BA RIA",
		label: "VNNDXL - XNK NLSAN PB BA RIA",
	},
	{
		value: "VNNDY",
		name: "CTCP THUONG CANG VT",
		label: "VNNDY - CTCP THUONG CANG VT",
	},
	{
		value: "VNNDYL",
		name: "CTCP THUONG CANG VT",
		label: "VNNDYL - CTCP THUONG CANG VT",
	},
	{
		value: "VNNDZ",
		name: "CONG TY CP THANH CHI",
		label: "VNNDZ - CONG TY CP THANH CHI",
	},
	{
		value: "VNNDZL",
		name: "CONG TY CP THANH CHI",
		label: "VNNDZL - CONG TY CP THANH CHI",
	},
	{
		value: "VNNEA",
		name: "CTCP HOA DAU VAN AN",
		label: "VNNEA - CTCP HOA DAU VAN AN",
	},
	{
		value: "VNNEAL",
		name: "CTCP HOA DAU VAN AN",
		label: "VNNEAL - CTCP HOA DAU VAN AN",
	},
	{
		value: "VNNEB",
		name: "CT C DVDK TH PHU MY",
		label: "VNNEB - CT C DVDK TH PHU MY",
	},
	{
		value: "VNNEBL",
		name: "CT C DVDK TH PHU MY",
		label: "VNNEBL - CT C DVDK TH PHU MY",
	},
	{
		value: "VNNEC",
		name: "THORESEN  VINAMA",
		label: "VNNEC - THORESEN  VINAMA",
	},
	{
		value: "VNNECL",
		name: "THORESEN  VINAMA",
		label: "VNNECL - THORESEN  VINAMA",
	},
	{
		value: "VNNED",
		name: "CT VTAI BIEN V.NAM",
		label: "VNNED - CT VTAI BIEN V.NAM",
	},
	{
		value: "VNNEDL",
		name: "CT VTAI BIEN V.NAM",
		label: "VNNEDL - CT VTAI BIEN V.NAM",
	},
	{
		value: "VNNEE",
		name: "CTLD KXD NQ V.PHONG",
		label: "VNNEE - CTLD KXD NQ V.PHONG",
	},
	{
		value: "VNNEEL",
		name: "CTLD KXD NQ V.PHONG",
		label: "VNNEEL - CTLD KXD NQ V.PHONG",
	},
	{
		value: "VNNEF",
		name: "CT L.THUC SONG HAU",
		label: "VNNEF - CT L.THUC SONG HAU",
	},
	{
		value: "VNNEFL",
		name: "CT L.THUC SONG HAU",
		label: "VNNEFL - CT L.THUC SONG HAU",
	},
	{
		value: "VNNEG",
		name: "CT CO QTE NAM SAO",
		label: "VNNEG - CT CO QTE NAM SAO",
	},
	{
		value: "VNNEGL",
		name: "CT CO QTE NAM SAO",
		label: "VNNEGL - CT CO QTE NAM SAO",
	},
	{
		value: "VNNEH",
		name: "CTY TMDV PHAN DUY",
		label: "VNNEH - CTY TMDV PHAN DUY",
	},
	{
		value: "VNNEHL",
		name: "CTY TMDV PHAN DUY",
		label: "VNNEHL - CTY TMDV PHAN DUY",
	},
	{
		value: "VNNEI",
		name: "CTCP CNP HANG HAI",
		label: "VNNEI - CTCP CNP HANG HAI",
	},
	{
		value: "VNNEIL",
		name: "CTCP CNP HANG HAI",
		label: "VNNEIL - CTCP CNP HANG HAI",
	},
	{
		value: "VNNEJ",
		name: "CTCP XNK BINH DINH",
		label: "VNNEJ - CTCP XNK BINH DINH",
	},
	{
		value: "VNNEJL",
		name: "CTCP XNK BINH DINH",
		label: "VNNEJL - CTCP XNK BINH DINH",
	},
	{
		value: "VNNEK",
		name: "CTCPCN OTO T.CONG",
		label: "VNNEK - CTCPCN OTO T.CONG",
	},
	{
		value: "VNNEKL",
		name: "CTCPCN OTO T.CONG",
		label: "VNNEKL - CTCPCN OTO T.CONG",
	},
	{
		value: "VNNEL",
		name: "CONG TY CP PHUC LOC",
		label: "VNNEL - CONG TY CP PHUC LOC",
	},
	{
		value: "VNNELL",
		name: "CONG TY CP PHUC LOC",
		label: "VNNELL - CONG TY CP PHUC LOC",
	},
	{
		value: "VNNEM",
		name: "CTTNHH C LS NAM DINH",
		label: "VNNEM - CTTNHH C LS NAM DINH",
	},
	{
		value: "VNNEML",
		name: "CTTNHH C LS NAM DINH",
		label: "VNNEML - CTTNHH C LS NAM DINH",
	},
	{
		value: "VNNEN",
		name: "CTTNHH DV HTANG KCN",
		label: "VNNEN - CTTNHH DV HTANG KCN",
	},
	{
		value: "VNNENL",
		name: "CTTNHH DV HTANG KCN",
		label: "VNNENL - CTTNHH DV HTANG KCN",
	},
	{
		value: "VNNEO",
		name: "VINALINESLOGISTIC VN",
		label: "VNNEO - VINALINESLOGISTIC VN",
	},
	{
		value: "VNNEOL",
		name: "VINALINESLOGISTIC VN",
		label: "VNNEOL - VINALINESLOGISTIC VN",
	},
	{
		value: "VNNEP",
		name: "CT C C.LAI TR.HAI",
		label: "VNNEP - CT C C.LAI TR.HAI",
	},
	{
		value: "VNNEPL",
		name: "CT C C.LAI TR.HAI",
		label: "VNNEPL - CT C C.LAI TR.HAI",
	},
	{
		value: "VNNEQ",
		name: "CONG TY TNHH MTV CT",
		label: "VNNEQ - CONG TY TNHH MTV CT",
	},
	{
		value: "VNNEQL",
		name: "CONG TY TNHH MTV CT",
		label: "VNNEQL - CONG TY TNHH MTV CT",
	},
	{
		value: "VNNER",
		name: "CTY CP XNK DAT PHAT",
		label: "VNNER - CTY CP XNK DAT PHAT",
	},
	{
		value: "VNNERL",
		name: "CTY CP XNK DAT PHAT",
		label: "VNNERL - CTY CP XNK DAT PHAT",
	},
	{
		value: "VNNES",
		name: "KERRY I LOGISTICS HY",
		label: "VNNES - KERRY I LOGISTICS HY",
	},
	{
		value: "VNNESL",
		name: "KERRY I LOGISTICS HY",
		label: "VNNESL - KERRY I LOGISTICS HY",
	},
	{
		value: "VNNET",
		name: "ANH HUY BD",
		label: "VNNET - ANH HUY BD",
	},
	{
		value: "VNNETL",
		name: "ANH HUY BD",
		label: "VNNETL - ANH HUY BD",
	},
	{
		value: "VNNEU",
		name: "CONG TY CP PHUC LONG",
		label: "VNNEU - CONG TY CP PHUC LONG",
	},
	{
		value: "VNNEUL",
		name: "CONG TY CP PHUC LONG",
		label: "VNNEUL - CONG TY CP PHUC LONG",
	},
	{
		value: "VNNEV",
		name: "VINA COMMONDITIES",
		label: "VNNEV - VINA COMMONDITIES",
	},
	{
		value: "VNNEVL",
		name: "VINA COMMONDITIES",
		label: "VNNEVL - VINA COMMONDITIES",
	},
	{
		value: "VNNEW",
		name: "KNQ BARIA SERECE",
		label: "VNNEW - KNQ BARIA SERECE",
	},
	{
		value: "VNNEWL",
		name: "KNQ BARIA SERECE",
		label: "VNNEWL - KNQ BARIA SERECE",
	},
	{
		value: "VNNEX",
		name: "KNQ PTSC",
		label: "VNNEX - KNQ PTSC",
	},
	{
		value: "VNNEXL",
		name: "KNQ PTSC",
		label: "VNNEXL - KNQ PTSC",
	},
	{
		value: "VNNEY",
		name: "KNQ CANG VAN AN",
		label: "VNNEY - KNQ CANG VAN AN",
	},
	{
		value: "VNNEYL",
		name: "KNQ CANG VAN AN",
		label: "VNNEYL - KNQ CANG VAN AN",
	},
	{
		value: "VNNEZ",
		name: "KNQ CAN THO",
		label: "VNNEZ - KNQ CAN THO",
	},
	{
		value: "VNNEZL",
		name: "KNQ CAN THO",
		label: "VNNEZL - KNQ CAN THO",
	},
	{
		value: "VNNFA",
		name: "CTCP CANG DONG NAI",
		label: "VNNFA - CTCP CANG DONG NAI",
	},
	{
		value: "VNNFAL",
		name: "CTCP CANG DONG NAI",
		label: "VNNFAL - CTCP CANG DONG NAI",
	},
	{
		value: "VNNFB",
		name: "CT VINH CUONG",
		label: "VNNFB - CT VINH CUONG",
	},
	{
		value: "VNNFBL",
		name: "CT VINH CUONG",
		label: "VNNFBL - CT VINH CUONG",
	},
	{
		value: "VNNFC",
		name: "CT DTU TM DV QTE",
		label: "VNNFC - CT DTU TM DV QTE",
	},
	{
		value: "VNNFCL",
		name: "CT DTU TM DV QTE",
		label: "VNNFCL - CT DTU TM DV QTE",
	},
	{
		value: "VNNFD",
		name: "KNQ CT LEN SAI GON",
		label: "VNNFD - KNQ CT LEN SAI GON",
	},
	{
		value: "VNNFDL",
		name: "KNQ CT LEN SAI GON",
		label: "VNNFDL - KNQ CT LEN SAI GON",
	},
	{
		value: "VNNFE",
		name: "CT CCI VIET NAM",
		label: "VNNFE - CT CCI VIET NAM",
	},
	{
		value: "VNNFEL",
		name: "CT CCI VIET NAM",
		label: "VNNFEL - CT CCI VIET NAM",
	},
	{
		value: "VNNFF",
		name: "CT YUSEN LOGISTICS",
		label: "VNNFF - CT YUSEN LOGISTICS",
	},
	{
		value: "VNNFFL",
		name: "CT YUSEN LOGISTICS",
		label: "VNNFFL - CT YUSEN LOGISTICS",
	},
	{
		value: "VNNFG",
		name: "KHO NGOAI QUAN HUE",
		label: "VNNFG - KHO NGOAI QUAN HUE",
	},
	{
		value: "VNNFGL",
		name: "KHO NGOAI QUAN HUE",
		label: "VNNFGL - KHO NGOAI QUAN HUE",
	},
	{
		value: "VNNFH",
		name: "CTCP TMDV MONG CAI",
		label: "VNNFH - CTCP TMDV MONG CAI",
	},
	{
		value: "VNNFHL",
		name: "CTCP TMDV MONG CAI",
		label: "VNNFHL - CTCP TMDV MONG CAI",
	},
	{
		value: "VNNFI",
		name: "CT TM VA GN QTE DN",
		label: "VNNFI - CT TM VA GN QTE DN",
	},
	{
		value: "VNNFIL",
		name: "CT TM VA GN QTE DN",
		label: "VNNFIL - CT TM VA GN QTE DN",
	},
	{
		value: "VNNFJ",
		name: "CT LOGISTICS CANG DN",
		label: "VNNFJ - CT LOGISTICS CANG DN",
	},
	{
		value: "VNNFJL",
		name: "CT LOGISTICS CANG DN",
		label: "VNNFJL - CT LOGISTICS CANG DN",
	},
	{
		value: "VNNFK",
		name: "LOGISTIC TINNGHIA NT",
		label: "VNNFK - LOGISTIC TINNGHIA NT",
	},
	{
		value: "VNNFKL",
		name: "LOGISTIC TINNGHIA NT",
		label: "VNNFKL - LOGISTIC TINNGHIA NT",
	},
	{
		value: "VNNFL",
		name: "KNQ CHI MA BAC KINH",
		label: "VNNFL - KNQ CHI MA BAC KINH",
	},
	{
		value: "VNNFLL",
		name: "KNQ CHI MA BAC KINH",
		label: "VNNFLL - KNQ CHI MA BAC KINH",
	},
	{
		value: "VNNFM",
		name: "KNQ DV HH NOIBAI",
		label: "VNNFM - KNQ DV HH NOIBAI",
	},
	{
		value: "VNNFML",
		name: "KNQ DV HH NOIBAI",
		label: "VNNFML - KNQ DV HH NOIBAI",
	},
	{
		value: "VNNFN",
		name: "KNQ CT PHUC DONG",
		label: "VNNFN - KNQ CT PHUC DONG",
	},
	{
		value: "VNNFNL",
		name: "KNQ CT PHUC DONG",
		label: "VNNFNL - KNQ CT PHUC DONG",
	},
	{
		value: "VNNFO",
		name: "KNQ CT THANH TRUNG",
		label: "VNNFO - KNQ CT THANH TRUNG",
	},
	{
		value: "VNNFOL",
		name: "KNQ CT THANH TRUNG",
		label: "VNNFOL - KNQ CT THANH TRUNG",
	},
	{
		value: "VNNFP",
		name: "KNQ LF LOGISTICS VN",
		label: "VNNFP - KNQ LF LOGISTICS VN",
	},
	{
		value: "VNNFPL",
		name: "KNQ LF LOGISTICS VN",
		label: "VNNFPL - KNQ LF LOGISTICS VN",
	},
	{
		value: "VNNFQ",
		name: "KNQ LDC LOGISTICS VN",
		label: "VNNFQ - KNQ LDC LOGISTICS VN",
	},
	{
		value: "VNNFQL",
		name: "KNQ LDC LOGISTICS VN",
		label: "VNNFQL - KNQ LDC LOGISTICS VN",
	},
	{
		value: "VNNFR",
		name: "NIPPON EXP BACNINH",
		label: "VNNFR - NIPPON EXP BACNINH",
	},
	{
		value: "VNNFRL",
		name: "NIPPON EXP BACNINH",
		label: "VNNFRL - NIPPON EXP BACNINH",
	},
	{
		value: "VNNFS",
		name: "KNQ CT INDO-TRAN",
		label: "VNNFS - KNQ CT INDO-TRAN",
	},
	{
		value: "VNNFSL",
		name: "KNQ CT INDO-TRAN",
		label: "VNNFSL - KNQ CT INDO-TRAN",
	},
	{
		value: "VNNFT",
		name: "KNQ CT CP QUANG BINH",
		label: "VNNFT - KNQ CT CP QUANG BINH",
	},
	{
		value: "VNNFTL",
		name: "KNQ CT CP QUANG BINH",
		label: "VNNFTL - KNQ CT CP QUANG BINH",
	},
	{
		value: "VNNFU",
		name: "KNQ CT TM KHO DEVYT",
		label: "VNNFU - KNQ CT TM KHO DEVYT",
	},
	{
		value: "VNNFUL",
		name: "KNQ CT TM KHO DEVYT",
		label: "VNNFUL - KNQ CT TM KHO DEVYT",
	},
	{
		value: "VNNFV",
		name: "KNQ CT SANKYU DNAI",
		label: "VNNFV - KNQ CT SANKYU DNAI",
	},
	{
		value: "VNNFVL",
		name: "KNQ CT SANKYU DNAI",
		label: "VNNFVL - KNQ CT SANKYU DNAI",
	},
	{
		value: "VNNFW",
		name: "CT TNHH ALSC",
		label: "VNNFW - CT TNHH ALSC",
	},
	{
		value: "VNNFWL",
		name: "CT TNHH ALSC",
		label: "VNNFWL - CT TNHH ALSC",
	},
	{
		value: "VNNFX",
		name: "TCT TIN NGHIA TNHH",
		label: "VNNFX - TCT TIN NGHIA TNHH",
	},
	{
		value: "VNNFXL",
		name: "TCT TIN NGHIA TNHH",
		label: "VNNFXL - TCT TIN NGHIA TNHH",
	},
	{
		value: "VNNFY",
		name: "TNHH CP XD CT GT CG",
		label: "VNNFY - TNHH CP XD CT GT CG",
	},
	{
		value: "VNNFYL",
		name: "TNHH CP XD CT GT CG",
		label: "VNNFYL - TNHH CP XD CT GT CG",
	},
	{
		value: "VNNFZ",
		name: "BEN CANG XD TK 186",
		label: "VNNFZ - BEN CANG XD TK 186",
	},
	{
		value: "VNNFZL",
		name: "BEN CANG XD TK 186",
		label: "VNNFZL - BEN CANG XD TK 186",
	},
	{
		value: "VNNGA",
		name: "KNQ YUSEN HAI PHONG",
		label: "VNNGA - KNQ YUSEN HAI PHONG",
	},
	{
		value: "VNNGAL",
		name: "KNQ YUSEN HAI PHONG",
		label: "VNNGAL - KNQ YUSEN HAI PHONG",
	},
	{
		value: "VNNGB",
		name: "KNQ NIPPON EXP DNAI",
		label: "VNNGB - KNQ NIPPON EXP DNAI",
	},
	{
		value: "VNNGBL",
		name: "KNQ NIPPON EXP DNAI",
		label: "VNNGBL - KNQ NIPPON EXP DNAI",
	},
	{
		value: "VNNGC",
		name: "CT XEDAPDIEN LAMVIET",
		label: "VNNGC - CT XEDAPDIEN LAMVIET",
	},
	{
		value: "VNNGCL",
		name: "CT XEDAPDIEN LAMVIET",
		label: "VNNGCL - CT XEDAPDIEN LAMVIET",
	},
	{
		value: "VNNGE",
		name: "CTY TNHH NGHIA ANH",
		label: "VNNGE - CTY TNHH NGHIA ANH",
	},
	{
		value: "VNNGEL",
		name: "CTY TNHH NGHIA ANH",
		label: "VNNGEL - CTY TNHH NGHIA ANH",
	},
	{
		value: "VNNGF",
		name: "KNQ COCNAM TH TRUONG",
		label: "VNNGF - KNQ COCNAM TH TRUONG",
	},
	{
		value: "VNNGFL",
		name: "KNQ COCNAM TH TRUONG",
		label: "VNNGFL - KNQ COCNAM TH TRUONG",
	},
	{
		value: "VNNGG",
		name: "CTY DONG PHUOC TNINH",
		label: "VNNGG - CTY DONG PHUOC TNINH",
	},
	{
		value: "VNNGGL",
		name: "CTY DONG PHUOC TNINH",
		label: "VNNGGL - CTY DONG PHUOC TNINH",
	},
	{
		value: "VNNGH",
		name: "CANG NGHI SON(T.HOA)",
		label: "VNNGH - CANG NGHI SON(T.HOA)",
	},
	{
		value: "VNNGM",
		name: "KNQ CTY DV KV PTL",
		label: "VNNGM - KNQ CTY DV KV PTL",
	},
	{
		value: "VNNGML",
		name: "KNQ CTY DV KV PTL",
		label: "VNNGML - KNQ CTY DV KV PTL",
	},
	{
		value: "VNNGN",
		name: "CTY CP NGUYEN CUONG",
		label: "VNNGN - CTY CP NGUYEN CUONG",
	},
	{
		value: "VNNGNL",
		name: "CTY CP NGUYEN CUONG",
		label: "VNNGNL - CTY CP NGUYEN CUONG",
	},
	{
		value: "VNNGO",
		name: "ICD LONG BINH - HCM",
		label: "VNNGO - ICD LONG BINH - HCM",
	},
	{
		value: "VNNGOL",
		name: "ICD LONG BINH - HCM",
		label: "VNNGOL - ICD LONG BINH - HCM",
	},
	{
		value: "VNNGP",
		name: "KNQ DN XNK XUAN TINH",
		label: "VNNGP - KNQ DN XNK XUAN TINH",
	},
	{
		value: "VNNGPL",
		name: "KNQ DN XNK XUAN TINH",
		label: "VNNGPL - KNQ DN XNK XUAN TINH",
	},
	{
		value: "VNNGQ",
		name: "KNQ CTY TAN HOI DONG",
		label: "VNNGQ - KNQ CTY TAN HOI DONG",
	},
	{
		value: "VNNGQL",
		name: "KNQ CTY TAN HOI DONG",
		label: "VNNGQL - KNQ CTY TAN HOI DONG",
	},
	{
		value: "VNNGR",
		name: "KNQ CTY CP THIEN LOC",
		label: "VNNGR - KNQ CTY CP THIEN LOC",
	},
	{
		value: "VNNGRL",
		name: "KNQ CTY CP THIEN LOC",
		label: "VNNGRL - KNQ CTY CP THIEN LOC",
	},
	{
		value: "VNNGS",
		name: "CT TNHH TM DV UY VU",
		label: "VNNGS - CT TNHH TM DV UY VU",
	},
	{
		value: "VNNGSL",
		name: "CT TNHH TM DV UY VU",
		label: "VNNGSL - CT TNHH TM DV UY VU",
	},
	{
		value: "VNNGT",
		name: "KNQ CT NHA PHUONG",
		label: "VNNGT - KNQ CT NHA PHUONG",
	},
	{
		value: "VNNGTL",
		name: "KNQ CT NHA PHUONG",
		label: "VNNGTL - KNQ CT NHA PHUONG",
	},
	{
		value: "VNNGTT",
		name: "CUA KHAU NGHIA THUAN (Hà GIANG)",
		label: "VNNGTT - CUA KHAU NGHIA THUAN (Hà GIANG)",
	},
	{
		value: "VNNGU",
		name: "CTY DAU TU DONGDUONG",
		label: "VNNGU - CTY DAU TU DONGDUONG",
	},
	{
		value: "VNNGUL",
		name: "CTY DAU TU DONGDUONG",
		label: "VNNGUL - CTY DAU TU DONGDUONG",
	},
	{
		value: "VNNGV",
		name: "KNQ DOI GIAM SAT- CHI CUC HQ CUA KHAU CHI MA",
		label: "VNNGV - KNQ DOI GIAM SAT- CHI CUC HQ CUA KHAU CHI MA",
	},
	{
		value: "VNNGVL",
		name: "KNQ DOI GIAM SAT- CHI CUC HQ CUA KHAU CHI MA",
		label: "VNNGVL - KNQ DOI GIAM SAT- CHI CUC HQ CUA KHAU CHI MA",
	},
	{
		value: "VNNGW",
		name: "KNQ HI TECH PARK LOG",
		label: "VNNGW - KNQ HI TECH PARK LOG",
	},
	{
		value: "VNNGWL",
		name: "KNQ HI TECH PARK LOG",
		label: "VNNGWL - KNQ HI TECH PARK LOG",
	},
	{
		value: "VNNGX",
		name: "CTY TNHH QUOC DAT",
		label: "VNNGX - CTY TNHH QUOC DAT",
	},
	{
		value: "VNNGXL",
		name: "CTY TNHH QUOC DAT",
		label: "VNNGXL - CTY TNHH QUOC DAT",
	},
	{
		value: "VNNGY",
		name: "KNQ TIEPVAN LONGBINH",
		label: "VNNGY - KNQ TIEPVAN LONGBINH",
	},
	{
		value: "VNNGYL",
		name: "KNQ TIEPVAN LONGBINH",
		label: "VNNGYL - KNQ TIEPVAN LONGBINH",
	},
	{
		value: "VNNHA",
		name: "CANG NHA TRANG(KH)",
		label: "VNNHA - CANG NHA TRANG(KH)",
	},
	{
		value: "VNNHB",
		name: "CTY TAN CANG 128",
		label: "VNNHB - CTY TAN CANG 128",
	},
	{
		value: "VNNHBL",
		name: "CTY TAN CANG 128",
		label: "VNNHBL - CTY TAN CANG 128",
	},
	{
		value: "VNNHC",
		name: "NAM HAI",
		label: "VNNHC - NAM HAI",
	},
	{
		value: "VNNHCL",
		name: "NAM HAI",
		label: "VNNHCL - NAM HAI",
	},
	{
		value: "VNNHE",
		name: "KNQ CTY HOA PHONG",
		label: "VNNHE - KNQ CTY HOA PHONG",
	},
	{
		value: "VNNHEL",
		name: "KNQ CTY HOA PHONG",
		label: "VNNHEL - KNQ CTY HOA PHONG",
	},
	{
		value: "VNNHF",
		name: "KNQ CTY DAU KHI PTSC",
		label: "VNNHF - KNQ CTY DAU KHI PTSC",
	},
	{
		value: "VNNHFL",
		name: "KNQ CTY DAU KHI PTSC",
		label: "VNNHFL - KNQ CTY DAU KHI PTSC",
	},
	{
		value: "VNNHG",
		name: "KNQ TAN CANG CAI MEP",
		label: "VNNHG - KNQ TAN CANG CAI MEP",
	},
	{
		value: "VNNHGL",
		name: "KNQ TAN CANG CAI MEP",
		label: "VNNHGL - KNQ TAN CANG CAI MEP",
	},
	{
		value: "VNNHH",
		name: "VINALINES LOGISTICS",
		label: "VNNHH - VINALINES LOGISTICS",
	},
	{
		value: "VNNHHL",
		name: "VINALINES LOGISTICS",
		label: "VNNHHL - VINALINES LOGISTICS",
	},
	{
		value: "VNNHI",
		name: "KNQ NIPPON EXP DVHP",
		label: "VNNHI - KNQ NIPPON EXP DVHP",
	},
	{
		value: "VNNHIL",
		name: "KNQ NIPPON EXP DVHP",
		label: "VNNHIL - KNQ NIPPON EXP DVHP",
	},
	{
		value: "VNNHJ",
		name: "KNQ VT VIET NHAT",
		label: "VNNHJ - KNQ VT VIET NHAT",
	},
	{
		value: "VNNHJL",
		name: "KNQ VT VIET NHAT",
		label: "VNNHJL - KNQ VT VIET NHAT",
	},
	{
		value: "VNNHK",
		name: "CFS NIPPON EXP DVHP",
		label: "VNNHK - CFS NIPPON EXP DVHP",
	},
	{
		value: "VNNHKL",
		name: "CFS NIPPON EXP DVHP",
		label: "VNNHKL - CFS NIPPON EXP DVHP",
	},
	{
		value: "VNNHL",
		name: "KNQ CONTAI DONG NAI",
		label: "VNNHL - KNQ CONTAI DONG NAI",
	},
	{
		value: "VNNHLL",
		name: "KNQ CONTAI DONG NAI",
		label: "VNNHLL - KNQ CONTAI DONG NAI",
	},
	{
		value: "VNNHM",
		name: "CT TNHH CAFE VINH AN",
		label: "VNNHM - CT TNHH CAFE VINH AN",
	},
	{
		value: "VNNHML",
		name: "CT TNHH CAFE VINH AN",
		label: "VNNHML - CT TNHH CAFE VINH AN",
	},
	{
		value: "VNNHN",
		name: "KNQ LOG PAN PACIFIC",
		label: "VNNHN - KNQ LOG PAN PACIFIC",
	},
	{
		value: "VNNHNL",
		name: "KNQ LOG PAN PACIFIC",
		label: "VNNHNL - KNQ LOG PAN PACIFIC",
	},
	{
		value: "VNNHP",
		name: "KHO NQ CTY DEVYT",
		label: "VNNHP - KHO NQ CTY DEVYT",
	},
	{
		value: "VNNHPL",
		name: "KHO NQ CTY DEVYT",
		label: "VNNHPL - KHO NQ CTY DEVYT",
	},
	{
		value: "VNNHQ",
		name: "KNQ CTY RYOBI VN",
		label: "VNNHQ - KNQ CTY RYOBI VN",
	},
	{
		value: "VNNHQL",
		name: "KNQ CTY RYOBI VN",
		label: "VNNHQL - KNQ CTY RYOBI VN",
	},
	{
		value: "VNNHR",
		name: "KNQ THO VI LOGISTICS",
		label: "VNNHR - KNQ THO VI LOGISTICS",
	},
	{
		value: "VNNHRL",
		name: "KNQ THO VI LOGISTICS",
		label: "VNNHRL - KNQ THO VI LOGISTICS",
	},
	{
		value: "VNNHS",
		name: "KNQ CTY SEBANG VINA",
		label: "VNNHS - KNQ CTY SEBANG VINA",
	},
	{
		value: "VNNHSL",
		name: "KNQ CTY SEBANG VINA",
		label: "VNNHSL - KNQ CTY SEBANG VINA",
	},
	{
		value: "VNNHX",
		name: "CTY TM DV VT ANH PHONG",
		label: "VNNHX - CTY TM DV VT ANH PHONG",
	},
	{
		value: "VNNHXL",
		name: "CTY TM DV VT ANH PHONG",
		label: "VNNHXL - CTY TM DV VT ANH PHONG",
	},
	{
		value: "VNNHY",
		name: "SG SAGAWA DONG NAI",
		label: "VNNHY - SG SAGAWA DONG NAI",
	},
	{
		value: "VNNHYL",
		name: "SG SAGAWA DONG NAI",
		label: "VNNHYL - SG SAGAWA DONG NAI",
	},
	{
		value: "VNNHZ",
		name: "KNQ CTY TAY GIA LAI",
		label: "VNNHZ - KNQ CTY TAY GIA LAI",
	},
	{
		value: "VNNHZL",
		name: "KNQ CTY TAY GIA LAI",
		label: "VNNHZL - KNQ CTY TAY GIA LAI",
	},
	{
		value: "VNNKA",
		name: "TRANS PACIFIC PRT",
		label: "VNNKA - TRANS PACIFIC PRT",
	},
	{
		value: "VNNKAL",
		name: "TRANS PACIFIC PRT",
		label: "VNNKAL - TRANS PACIFIC PRT",
	},
	{
		value: "VNNKE",
		name: "KNQ CP DT LONG THUAN",
		label: "VNNKE - KNQ CP DT LONG THUAN",
	},
	{
		value: "VNNKEL",
		name: "KNQ CP DT LONG THUAN",
		label: "VNNKEL - KNQ CP DT LONG THUAN",
	},
	{
		value: "VNNKF",
		name: "KNQ CP DV THONG NHAT",
		label: "VNNKF - KNQ CP DV THONG NHAT",
	},
	{
		value: "VNNKFL",
		name: "KNQ CP DV THONG NHAT",
		label: "VNNKFL - KNQ CP DV THONG NHAT",
	},
	{
		value: "VNNKG",
		name: "KNQ CTY ASHTON F C",
		label: "VNNKG - KNQ CTY ASHTON F C",
	},
	{
		value: "VNNKGL",
		name: "KNQ CTY ASHTON F C",
		label: "VNNKGL - KNQ CTY ASHTON F C",
	},
	{
		value: "VNNKH",
		name: "KNQ CTY GEMADEPT",
		label: "VNNKH - KNQ CTY GEMADEPT",
	},
	{
		value: "VNNKHL",
		name: "KNQ CTY GEMADEPT",
		label: "VNNKHL - KNQ CTY GEMADEPT",
	},
	{
		value: "VNNKI",
		name: "KNQ CTY KHO LANH DKP",
		label: "VNNKI - KNQ CTY KHO LANH DKP",
	},
	{
		value: "VNNKIL",
		name: "KNQ CTY KHO LANH DKP",
		label: "VNNKIL - KNQ CTY KHO LANH DKP",
	},
	{
		value: "VNNKJ",
		name: "KNQ CTY PHUOC KHANH",
		label: "VNNKJ - KNQ CTY PHUOC KHANH",
	},
	{
		value: "VNNKJL",
		name: "KNQ CTY PHUOC KHANH",
		label: "VNNKJL - KNQ CTY PHUOC KHANH",
	},
	{
		value: "VNNKK",
		name: "KNQ CTY BINH LIEU",
		label: "VNNKK - KNQ CTY BINH LIEU",
	},
	{
		value: "VNNKKL",
		name: "KNQ CTY BINH LIEU",
		label: "VNNKKL - KNQ CTY BINH LIEU",
	},
	{
		value: "VNNKM",
		name: "CT SUATAN HK VIETNAM",
		label: "VNNKM - CT SUATAN HK VIETNAM",
	},
	{
		value: "VNNKML",
		name: "CT SUATAN HK VIETNAM",
		label: "VNNKML - CT SUATAN HK VIETNAM",
	},
	{
		value: "VNNKN",
		name: "CT SUATAN HK VIETNAM",
		label: "VNNKN - CT SUATAN HK VIETNAM",
	},
	{
		value: "VNNKNL",
		name: "CT SUATAN HK VIETNAM",
		label: "VNNKNL - CT SUATAN HK VIETNAM",
	},
	{
		value: "VNNKO",
		name: "KNQ CT CHO CK MOCBAI",
		label: "VNNKO - KNQ CT CHO CK MOCBAI",
	},
	{
		value: "VNNKOL",
		name: "KNQ CT CHO CK MOCBAI",
		label: "VNNKOL - KNQ CT CHO CK MOCBAI",
	},
	{
		value: "VNNKP",
		name: "KNQ CTY QUYNH PHAT",
		label: "VNNKP - KNQ CTY QUYNH PHAT",
	},
	{
		value: "VNNKPL",
		name: "KNQ CTY QUYNH PHAT",
		label: "VNNKPL - KNQ CTY QUYNH PHAT",
	},
	{
		value: "VNNKQ",
		name: "KNQ CTY XUAN PHAT",
		label: "VNNKQ - KNQ CTY XUAN PHAT",
	},
	{
		value: "VNNKQL",
		name: "KNQ CTY XUAN PHAT",
		label: "VNNKQL - KNQ CTY XUAN PHAT",
	},
	{
		value: "VNNKR",
		name: "KNQ CTY KS HOANG GIA",
		label: "VNNKR - KNQ CTY KS HOANG GIA",
	},
	{
		value: "VNNKRL",
		name: "KNQ CTY KS HOANG GIA",
		label: "VNNKRL - KNQ CTY KS HOANG GIA",
	},
	{
		value: "VNNKS",
		name: "VINALINES LOGISTICS",
		label: "VNNKS - VINALINES LOGISTICS",
	},
	{
		value: "VNNKSL",
		name: "VINALINES LOGISTICS",
		label: "VNNKSL - VINALINES LOGISTICS",
	},
	{
		value: "VNNKT",
		name: "KNQ XNK LAO CAI HG",
		label: "VNNKT - KNQ XNK LAO CAI HG",
	},
	{
		value: "VNNKTL",
		name: "KNQ XNK LAO CAI HG",
		label: "VNNKTL - KNQ XNK LAO CAI HG",
	},
	{
		value: "VNNKW",
		name: "KNQ CTY TV LH A CHAU",
		label: "VNNKW - KNQ CTY TV LH A CHAU",
	},
	{
		value: "VNNKWL",
		name: "KNQ CTY TV LH A CHAU",
		label: "VNNKWL - KNQ CTY TV LH A CHAU",
	},
	{
		value: "VNNKX",
		name: "KNQ CTY TNHH VU HAI",
		label: "VNNKX - KNQ CTY TNHH VU HAI",
	},
	{
		value: "VNNKXL",
		name: "KNQ CTY TNHH VU HAI",
		label: "VNNKXL - KNQ CTY TNHH VU HAI",
	},
	{
		value: "VNNKZ",
		name: "KNQ CT C STEINWEG HP",
		label: "VNNKZ - KNQ CT C STEINWEG HP",
	},
	{
		value: "VNNKZL",
		name: "KNQ CT C STEINWEG HP",
		label: "VNNKZL - KNQ CT C STEINWEG HP",
	},
	{
		value: "VNNLV",
		name: "KNQ CTY VIDIFI DHAI",
		label: "VNNLV - KNQ CTY VIDIFI DHAI",
	},
	{
		value: "VNNLY",
		name: "KNQ LOTTE LOGIST VN",
		label: "VNNLY - KNQ LOTTE LOGIST VN",
	},
	{
		value: "VNNLYL",
		name: "KNQ LOTTE LOGIST VN",
		label: "VNNLYL - KNQ LOTTE LOGIST VN",
	},
	{
		value: "VNNNI",
		name: "NAM NINH",
		label: "VNNNI - NAM NINH",
	},
	{
		value: "VNNPC",
		name: "CANG NINH PHUC(NB)",
		label: "VNNPC - CANG NINH PHUC(NB)",
	},
	{
		value: "VNNRA",
		name: "KNQ TCT BUU DIEN VN",
		label: "VNNRA - KNQ TCT BUU DIEN VN",
	},
	{
		value: "VNNRAL",
		name: "KNQ TCT BUU DIEN VN",
		label: "VNNRAL - KNQ TCT BUU DIEN VN",
	},
	{
		value: "VNNRG",
		name: "CANG NHA RONG (HCM)",
		label: "VNNRG - CANG NHA RONG (HCM)",
	},
	{
		value: "VNNRN",
		name: "KNQ TCT BUU DIEN VN",
		label: "VNNRN - KNQ TCT BUU DIEN VN",
	},
	{
		value: "VNNRNL",
		name: "KNQ TCT BUU DIEN VN",
		label: "VNNRNL - KNQ TCT BUU DIEN VN",
	},
	{
		value: "VNNRV",
		name: "KNQ CTY GEMADEPT BD",
		label: "VNNRV - KNQ CTY GEMADEPT BD",
	},
	{
		value: "VNNRVL",
		name: "KNQ CTY GEMADEPT BD",
		label: "VNNRVL - KNQ CTY GEMADEPT BD",
	},
	{
		value: "VNNRY",
		name: "KNQ ICD TAN LONG",
		label: "VNNRY - KNQ ICD TAN LONG",
	},
	{
		value: "VNNRYL",
		name: "KNQ ICD TAN LONG",
		label: "VNNRYL - KNQ ICD TAN LONG",
	},
	{
		value: "VNNSB",
		name: "KNQ T&Y SUPERPORT VP",
		label: "VNNSB - KNQ T&Y SUPERPORT VP",
	},
	{
		value: "VNNTNT",
		name: "CUA KHAU NINH THUAN (KHANH HUA)",
		label: "VNNTNT - CUA KHAU NINH THUAN (KHANH HUA)",
	},
	{
		value: "VNNTP",
		name: "KNQ CT DVTM ANH MINH",
		label: "VNNTP - KNQ CT DVTM ANH MINH",
	},
	{
		value: "VNNVA",
		name: "CANG NDIEN VINHTAN 2",
		label: "VNNVA - CANG NDIEN VINHTAN 2",
	},
	{
		value: "VNNVB",
		name: "CANG NDIEN VINHTAN 4",
		label: "VNNVB - CANG NDIEN VINHTAN 4",
	},
	{
		value: "VNNVC",
		name: "CANG PHU QUY DNAI",
		label: "VNNVC - CANG PHU QUY DNAI",
	},
	{
		value: "VNONN",
		name: "CANG 19-9",
		label: "VNONN - CANG 19-9",
	},
	{
		value: "VNOSP",
		name: "CANG SAI GON KV III",
		label: "VNOSP - CANG SAI GON KV III",
	},
	{
		value: "VNPAMT",
		name: "CUA KHAU PA THOM (LAI CHAU)",
		label: "VNPAMT - CUA KHAU PA THOM (LAI CHAU)",
	},
	{
		value: "VNPAP",
		name: "CANG PHUOC AN",
		label: "VNPAP - CANG PHUOC AN",
	},
	{
		value: "VNPBGT",
		name: "CUA KHAU PHO BANG (HA GIANG)",
		label: "VNPBGT - CUA KHAU PHO BANG (HA GIANG)",
	},
	{
		value: "VNPDQ",
		name: "CANG DQUAT-BEN PHAO",
		label: "VNPDQ - CANG DQUAT-BEN PHAO",
	},
	{
		value: "VNPHH",
		name: "CANG PHU HUU",
		label: "VNPHH - CANG PHU HUU",
	},
	{
		value: "VNPHTT",
		name: "CUA KHAU PHUOC TAN (TAY NINH)",
		label: "VNPHTT - CUA KHAU PHUOC TAN (TAY NINH)",
	},
	{
		value: "VNPHU",
		name: "CANG PHU MY (V.TAU)",
		label: "VNPHU - CANG PHU MY (V.TAU)",
	},
	{
		value: "VNPLF",
		name: "CANG ICD PHUOCLONG 1",
		label: "VNPLF - CANG ICD PHUOCLONG 1",
	},
	{
		value: "VNPLS",
		name: "CANG ICD PHUOCLONG 2",
		label: "VNPLS - CANG ICD PHUOCLONG 2",
	},
	{
		value: "VNPLT",
		name: "CANG ICD PHUOCLONG 3",
		label: "VNPLT - CANG ICD PHUOCLONG 3",
	},
	{
		value: "VNPMS",
		name: "CANG PVC-MS (V.TAU)",
		label: "VNPMS - CANG PVC-MS (V.TAU)",
	},
	{
		value: "VNPMY",
		name: "C PHU MY 2.1; 2.2-VT",
		label: "VNPMY - C PHU MY 2.1; 2.2-VT",
	},
	{
		value: "VNPNUT",
		name: "CUA KHAU PO NHUNG",
		label: "VNPNUT - CUA KHAU PO NHUNG",
	},
	{
		value: "VNPOOT",
		name: "CUA KHAU PO PEO (CAO BANG)",
		label: "VNPOOT - CUA KHAU PO PEO (CAO BANG)",
	},
	{
		value: "VNPOS",
		name: "CANG POSCO (VT)",
		label: "VNPOS - CANG POSCO (VT)",
	},
	{
		value: "VNPPT",
		name: "GAS PVC PHUOC THAI",
		label: "VNPPT - GAS PVC PHUOC THAI",
	},
	{
		value: "VNPQC",
		name: "PHU QUOC",
		label: "VNPQC - PHU QUOC",
	},
	{
		value: "VNPQY",
		name: "CANG PHU QUY (D.NAI)",
		label: "VNPQY - CANG PHU QUY (D.NAI)",
	},
	{
		value: "VNPRU",
		name: "DONG TAU PHA RUNG",
		label: "VNPRU - DONG TAU PHA RUNG",
	},
	{
		value: "VNPSV",
		name: "CANG POSCO SS VINA",
		label: "VNPSV - CANG POSCO SS VINA",
	},
	{
		value: "VNPTC",
		name: "CANG PETEC CAIMEP",
		label: "VNPTC - CANG PETEC CAIMEP",
	},
	{
		value: "VNPTE",
		name: "PETEC",
		label: "VNPTE - PETEC",
	},
	{
		value: "VNPTHT",
		name: "CUA KHAU PHU THONG THU",
		label: "VNPTHT - CUA KHAU PHU THONG THU",
	},
	{
		value: "VNPTNT",
		name: "CUA KHAU PHU TAN NAM",
		label: "VNPTNT - CUA KHAU PHU TAN NAM",
	},
	{
		value: "VNPTOT",
		name: "LOI MO PO TO (MA LU THANG)",
		label: "VNPTOT - LOI MO PO TO (MA LU THANG)",
	},
	{
		value: "VNPTS",
		name: "PTSC DINH VU",
		label: "VNPTS - PTSC DINH VU",
	},
	{
		value: "VNPVS",
		name: "CANG PV SHIPYARDS",
		label: "VNPVS - CANG PV SHIPYARDS",
	},
	{
		value: "VNQCC",
		name: "CANG CON CO",
		label: "VNQCC - CANG CON CO",
	},
	{
		value: "VNQCR",
		name: "CANG QUOC TE CAM RANH",
		label: "VNQCR - CANG QUOC TE CAM RANH",
	},
	{
		value: "VNQDO",
		name: "XD QUAN DOI (MIPEC)",
		label: "VNQDO - XD QUAN DOI (MIPEC)",
	},
	{
		value: "VNQPH",
		name: "CANG QT ITC PHU HUU",
		label: "VNQPH - CANG QT ITC PHU HUU",
	},
	{
		value: "VNRRV",
		name: "CANG QLRR VUNG TAU",
		label: "VNRRV - CANG QLRR VUNG TAU",
	},
	{
		value: "VNSAD",
		name: "CANG SA DEC (DT)",
		label: "VNSAD - CANG SA DEC (DT)",
	},
	{
		value: "VNSCT",
		name: "SCT GAS VIET NAM",
		label: "VNSCT - SCT GAS VIET NAM",
	},
	{
		value: "VNSDA",
		name: "SONG DA 12.4",
		label: "VNSDA - SONG DA 12.4",
	},
	{
		value: "VNSDG",
		name: "CANG SON DUONG",
		label: "VNSDG - CANG SON DUONG",
	},
	{
		value: "VNSGH",
		name: "CANG SONG GIANH",
		label: "VNSGH - CANG SONG GIANH",
	},
	{
		value: "VNSGN",
		name: "HO CHI MINH",
		label: "VNSGN - HO CHI MINH",
	},
	{
		value: "VNSGR",
		name: "CANG RAU QUA (HCM)",
		label: "VNSGR - CANG RAU QUA (HCM)",
	},
	{
		value: "VNSGZ",
		name: "CANG Z (HO CHI MINH)",
		label: "VNSGZ - CANG Z (HO CHI MINH)",
	},
	{
		value: "VNSIT",
		name: "CANG SITV (VUNG TAU)",
		label: "VNSIT - CANG SITV (VUNG TAU)",
	},
	{
		value: "VNSJH",
		name: "SANRIMJOHAP VINA",
		label: "VNSJH - SANRIMJOHAP VINA",
	},
	{
		value: "VNSKY",
		name: "CANG SA KY (B.DINH)",
		label: "VNSKY - CANG SA KY (B.DINH)",
	},
	{
		value: "VNSOCT",
		name: "CUA KHAU SONG DOC (MINH HAI)",
		label: "VNSOCT - CUA KHAU SONG DOC (MINH HAI)",
	},
	{
		value: "VNSOGT",
		name: "CUA KHAU SOC GIANG (CAO BANG)",
		label: "VNSOGT - CUA KHAU SOC GIANG (CAO BANG)",
	},
	{
		value: "VNSOTT",
		name: "CUA KHAU SO THUONG (DONG THAP)",
		label: "VNSOTT - CUA KHAU SO THUONG (DONG THAP)",
	},
	{
		value: "VNSPA",
		name: "CANG SP-PSA (V.TAU)",
		label: "VNSPA - CANG SP-PSA (V.TAU)",
	},
	{
		value: "VNSPC",
		name: "CANG HIEP PHUOC(HCM)",
		label: "VNSPC - CANG HIEP PHUOC(HCM)",
	},
	{
		value: "VNSPT",
		name: "CANG QT SP-SSA(SSIT)",
		label: "VNSPT - CANG QT SP-SSA(SSIT)",
	},
	{
		value: "VNSRA",
		name: "CANG SOAI RAP (DT)",
		label: "VNSRA - CANG SOAI RAP (DT)",
	},
	{
		value: "VNSSA",
		name: "CANG CONT QUOC TE SG",
		label: "VNSSA - CANG CONT QUOC TE SG",
	},
	{
		value: "VNSTX",
		name: "CANG STX VN OFFSHORE",
		label: "VNSTX - CANG STX VN OFFSHORE",
	},
	{
		value: "VNTAGT",
		name: "CUA KHAU TA LUNG (CAO BANG)",
		label: "VNTAGT - CUA KHAU TA LUNG (CAO BANG)",
	},
	{
		value: "VNTAHT",
		name: "CUA KHAU PHU TAM HOP",
		label: "VNTAHT - CUA KHAU PHU TAM HOP",
	},
	{
		value: "VNTANT",
		name: "CUA KHAU PHU TON TIEN",
		label: "VNTANT - CUA KHAU PHU TON TIEN",
	},
	{
		value: "VNTAOT",
		name: "LOI MO TA DO",
		label: "VNTAOT - LOI MO TA DO",
	},
	{
		value: "VNTAP",
		name: "CANG TAM HIEP",
		label: "VNTAP - CANG TAM HIEP",
	},
	{
		value: "VNTATT",
		name: "CUA KHAU TA VAT (BINH PHUOC)",
		label: "VNTATT - CUA KHAU TA VAT (BINH PHUOC)",
	},
	{
		value: "VNTAYT",
		name: "CUA KHAU TAY TRANG (DIEN BIEN)",
		label: "VNTAYT - CUA KHAU TAY TRANG (DIEN BIEN)",
	},
	{
		value: "VNTBS",
		name: "CANG DONG TAU BA SON",
		label: "VNTBS - CANG DONG TAU BA SON",
	},
	{
		value: "VNTCC",
		name: "C CAI MEP TCCT (VT)",
		label: "VNTCC - C CAI MEP TCCT (VT)",
	},
	{
		value: "VNTCE",
		name: "TAN CANG 128",
		label: "VNTCE - TAN CANG 128",
	},
	{
		value: "VNTCG",
		name: "CANG TAN CANG (HCM)",
		label: "VNTCG - CANG TAN CANG (HCM)",
	},
	{
		value: "VNTCH",
		name: "TAN CANG HIEP PHUOC",
		label: "VNTCH - TAN CANG HIEP PHUOC",
	},
	{
		value: "VNTCI",
		name: "C CAI MEP TCIT (VT)",
		label: "VNTCI - C CAI MEP TCIT (VT)",
	},
	{
		value: "VNTCM",
		name: "CANG T.CANG -CAI MEP",
		label: "VNTCM - CANG T.CANG -CAI MEP",
	},
	{
		value: "VNTCN",
		name: "TAN CANG (189)",
		label: "VNTCN - TAN CANG (189)",
	},
	{
		value: "VNTCQ",
		name: "CANG TAN CANG HIEP LUC",
		label: "VNTCQ - CANG TAN CANG HIEP LUC",
	},
	{
		value: "VNTGGT",
		name: "CUA KHAU TAY GIANG",
		label: "VNTGGT - CUA KHAU TAY GIANG",
	},
	{
		value: "VNTHC",
		name: "CK THUONG PHUOC (DT)",
		label: "VNTHC - CK THUONG PHUOC (DT)",
	},
	{
		value: "VNTHCT",
		name: "CUA KHAU THUONG PHUOC (DONG THAP)",
		label: "VNTHCT - CUA KHAU THUONG PHUOC (DONG THAP)",
	},
	{
		value: "VNTHHT",
		name: "CUA KHAU THONG BINH (DONG THAP)",
		label: "VNTHHT - CUA KHAU THONG BINH (DONG THAP)",
	},
	{
		value: "VNTHNT",
		name: "HAI QUAN THUY AN (HUE)",
		label: "VNTHNT - HAI QUAN THUY AN (HUE)",
	},
	{
		value: "VNTHO",
		name: "CANG THANH HOA",
		label: "VNTHO - CANG THANH HOA",
	},
	{
		value: "VNTHS",
		name: "CANG THANG LONG GAS",
		label: "VNTHS - CANG THANG LONG GAS",
	},
	{
		value: "VNTHTT",
		name: "CUA KHAU THONG THU",
		label: "VNTHTT - CUA KHAU THONG THU",
	},
	{
		value: "VNTHU",
		name: "CANG THUAN AN (HUE)",
		label: "VNTHU - CANG THUAN AN (HUE)",
	},
	{
		value: "VNTHYT",
		name: "CK QUOC GIA THANH THUY (NGHE AN)",
		label: "VNTHYT - CK QUOC GIA THANH THUY (NGHE AN)",
	},
	{
		value: "VNTINT",
		name: "CUA KHAU TINH BIEN (AN GIANG)",
		label: "VNTINT - CUA KHAU TINH BIEN (AN GIANG)",
	},
	{
		value: "VNTLCT",
		name: "CUA KHAU TONG LE CHAN",
		label: "VNTLCT - CUA KHAU TONG LE CHAN",
	},
	{
		value: "VNTLT",
		name: "CANG THIEN LOC THANH",
		label: "VNTLT - CANG THIEN LOC THANH",
	},
	{
		value: "VNTLY",
		name: "XANG DAU THUONG LY",
		label: "VNTLY - XANG DAU THUONG LY",
	},
	{
		value: "VNTMN",
		name: "CANG THEP MIEN NAM",
		label: "VNTMN - CANG THEP MIEN NAM",
	},
	{
		value: "VNTNN",
		name: "CANG TRUNG NAM CA NA",
		label: "VNTNN - CANG TRUNG NAM CA NA",
	},
	{
		value: "VNTRAT",
		name: "CUA KHAU TRA LINH (CAO BANG)",
		label: "VNTRAT - CUA KHAU TRA LINH (CAO BANG)",
	},
	{
		value: "VNTRG",
		name: "CANG TRUONG THANH",
		label: "VNTRG - CANG TRUONG THANH",
	},
	{
		value: "VNTRHT",
		name: "CUA KHAU TRUNG KHANH (CAO BANG)",
		label: "VNTRHT - CUA KHAU TRUNG KHANH (CAO BANG)",
	},
	{
		value: "VNTSN",
		name: "CANG THUY SAN II",
		label: "VNTSN - CANG THUY SAN II",
	},
	{
		value: "VNTTD",
		name: "CANG T.THUAN DONG",
		label: "VNTTD - CANG T.THUAN DONG",
	},
	{
		value: "VNTTHT",
		name: "CUA KHAU TAN THANH (LANG SON)",
		label: "VNTTHT - CUA KHAU TAN THANH (LANG SON)",
	},
	{
		value: "VNTTN",
		name: "CANG TAN THUAN 2",
		label: "VNTTN - CANG TAN THUAN 2",
	},
	{
		value: "VNTTS",
		name: "CANG TAN THUAN (HCM)",
		label: "VNTTS - CANG TAN THUAN (HCM)",
	},
	{
		value: "VNTTT",
		name: "TANCANG CAIMEP TVAI",
		label: "VNTTT - TANCANG CAIMEP TVAI",
	},
	{
		value: "VNTTYT",
		name: "CUA KHAU THANH THUY (HA GIANG)",
		label: "VNTTYT - CUA KHAU THANH THUY (HA GIANG)",
	},
	{
		value: "VNTVA",
		name: "BEN CANG TH THI VAI",
		label: "VNTVA - BEN CANG TH THI VAI",
	},
	{
		value: "VNUIH",
		name: "CANG QUI NHON(BDINH)",
		label: "VNUIH - CANG QUI NHON(BDINH)",
	},
	{
		value: "VNUMKT",
		name: "CKHAU U MA TU KHOONG",
		label: "VNUMKT - CKHAU U MA TU KHOONG",
	},
	{
		value: "VNVAAT",
		name: "CUA KHAU VAC SA",
		label: "VNVAAT - CUA KHAU VAC SA",
	},
	{
		value: "VNVAC",
		name: "CANG VAT CACH (HP)",
		label: "VNVAC - CANG VAT CACH (HP)",
	},
	{
		value: "VNVAG",
		name: "CANG VUNG ANG(HTINH)",
		label: "VNVAG - CANG VUNG ANG(HTINH)",
	},
	{
		value: "VNVAN",
		name: "CANG VAN AN (V.TAU)",
		label: "VNVAN - CANG VAN AN (V.TAU)",
	},
	{
		value: "VNVB1",
		name: "CTY GIAY CHANH DUONG",
		label: "VNVB1 - CTY GIAY CHANH DUONG",
	},
	{
		value: "VNVCA",
		name: "CAN THO",
		label: "VNVCA - CAN THO",
	},
	{
		value: "VNVCT",
		name: "CANG CAN THO",
		label: "VNVCT - CANG CAN THO",
	},
	{
		value: "VNVDN",
		name: "CANG VEDAN(DONG NAI)",
		label: "VNVDN - CANG VEDAN(DONG NAI)",
	},
	{
		value: "VNVDV",
		name: "CT CANG VIMC DINH VU",
		label: "VNVDV - CT CANG VIMC DINH VU",
	},
	{
		value: "VNVGA",
		name: "CANG VAN GIA (QN)",
		label: "VNVGA - CANG VAN GIA (QN)",
	},
	{
		value: "VNVHD",
		name: "CK VINH HOI DONG(AG)",
		label: "VNVHD - CK VINH HOI DONG(AG)",
	},
	{
		value: "VNVHDT",
		name: "CUA KHAU VINH HOI DONG (AN GIANG)",
		label: "VNVHDT - CUA KHAU VINH HOI DONG (AN GIANG)",
	},
	{
		value: "VNVIC",
		name: "CANG VICT",
		label: "VNVIC - CANG VICT",
	},
	{
		value: "VNVIGT",
		name: "CUA KHAU VINH XUONG (AN GIANG)",
		label: "VNVIGT - CUA KHAU VINH XUONG (AN GIANG)",
	},
	{
		value: "VNVII",
		name: "VINH",
		label: "VNVII - VINH",
	},
	{
		value: "VNVKG",
		name: "RACH GIA",
		label: "VNVKG - RACH GIA",
	},
	{
		value: "VNVNO",
		name: "CANG VINA OFFSHORE",
		label: "VNVNO - CANG VINA OFFSHORE",
	},
	{
		value: "VNVPH",
		name: "CANG VAN PHONG",
		label: "VNVPH - CANG VAN PHONG",
	},
	{
		value: "VNVPK",
		name: "CANG VOPAK",
		label: "VNVPK - CANG VOPAK",
	},
	{
		value: "VNVRO",
		name: "CANG VUNG RO (P.YEN)",
		label: "VNVRO - CANG VUNG RO (P.YEN)",
	},
	{
		value: "VNVSP",
		name: "CANG VIETSOV PETRO",
		label: "VNVSP - CANG VIETSOV PETRO",
	},
	{
		value: "VNVTB",
		name: "CANG VINH TAN TH",
		label: "VNVTB - CANG VINH TAN TH",
	},
	{
		value: "VNVTG",
		name: "CANG PV.GAS (V.TAU)",
		label: "VNVTG - CANG PV.GAS (V.TAU)",
	},
	{
		value: "VNVTH",
		name: "CANG HA LUU PTSC(VT)",
		label: "VNVTH - CANG HA LUU PTSC(VT)",
	},
	{
		value: "VNVTI",
		name: "CANG VINH THAI(CTHO)",
		label: "VNVTI - CANG VINH THAI(CTHO)",
	},
	{
		value: "VNVTL",
		name: "CANG BOT VINHTAN 1",
		label: "VNVTL - CANG BOT VINHTAN 1",
	},
	{
		value: "VNVTM",
		name: "CANG VINH TAN 4",
		label: "VNVTM - CANG VINH TAN 4",
	},
	{
		value: "VNVTN",
		name: "KHU NEO VUNG TAU",
		label: "VNVTN - KHU NEO VUNG TAU",
	},
	{
		value: "VNVTP",
		name: "CANG PTSC (VUNG TAU)",
		label: "VNVTP - CANG PTSC (VUNG TAU)",
	},
	{
		value: "VNVTT",
		name: "CANG T.LUU PTSC (VT)",
		label: "VNVTT - CANG T.LUU PTSC (VT)",
	},
	{
		value: "VNVUT",
		name: "CANG BA RIA VUNG TAU",
		label: "VNVUT - CANG BA RIA VUNG TAU",
	},
	{
		value: "VNVXG",
		name: "CK QT VINH XUONG(AG)",
		label: "VNVXG - CK QT VINH XUONG(AG)",
	},
	{
		value: "VNXAA",
		name: "CT BROTHER VIET NAM",
		label: "VNXAA - CT BROTHER VIET NAM",
	},
	{
		value: "VNXAAL",
		name: "CT BROTHER VIET NAM",
		label: "VNXAAL - CT BROTHER VIET NAM",
	},
	{
		value: "VNXAAT",
		name: "CUA KHAU XA XIA (KIEN GIANG)",
		label: "VNXAAT - CUA KHAU XA XIA (KIEN GIANG)",
	},
	{
		value: "VNXAB",
		name: "CT LEO VIET NAM",
		label: "VNXAB - CT LEO VIET NAM",
	},
	{
		value: "VNXABL",
		name: "CT LEO VIET NAM",
		label: "VNXABL - CT LEO VIET NAM",
	},
	{
		value: "VNXAC",
		name: "VINH HAN PRECISION",
		label: "VNXAC - VINH HAN PRECISION",
	},
	{
		value: "VNXACL",
		name: "VINH HAN PRECISION",
		label: "VNXACL - VINH HAN PRECISION",
	},
	{
		value: "VNXAD",
		name: "HITACHI CABLE VN",
		label: "VNXAD - HITACHI CABLE VN",
	},
	{
		value: "VNXADL",
		name: "HITACHI CABLE VN",
		label: "VNXADL - HITACHI CABLE VN",
	},
	{
		value: "VNXAE",
		name: "ADVANEX VIET NAM",
		label: "VNXAE - ADVANEX VIET NAM",
	},
	{
		value: "VNXAEL",
		name: "ADVANEX VIET NAM",
		label: "VNXAEL - ADVANEX VIET NAM",
	},
	{
		value: "VNXAF",
		name: "CT MATEX VIET NAM",
		label: "VNXAF - CT MATEX VIET NAM",
	},
	{
		value: "VNXAFL",
		name: "CT MATEX VIET NAM",
		label: "VNXAFL - CT MATEX VIET NAM",
	},
	{
		value: "VNXAG",
		name: "PRINCETON BIOMEDITEC",
		label: "VNXAG - PRINCETON BIOMEDITEC",
	},
	{
		value: "VNXAGL",
		name: "PRINCETON BIOMEDITEC",
		label: "VNXAGL - PRINCETON BIOMEDITEC",
	},
	{
		value: "VNXAH",
		name: "CT JAGUAR HA NOI",
		label: "VNXAH - CT JAGUAR HA NOI",
	},
	{
		value: "VNXAHL",
		name: "CT JAGUAR HA NOI",
		label: "VNXAHL - CT JAGUAR HA NOI",
	},
	{
		value: "VNXAI",
		name: "PEGASUS VIET NAM",
		label: "VNXAI - PEGASUS VIET NAM",
	},
	{
		value: "VNXAIL",
		name: "PEGASUS VIET NAM",
		label: "VNXAIL - PEGASUS VIET NAM",
	},
	{
		value: "VNXAJ",
		name: "CT VSM NHAT BAN",
		label: "VNXAJ - CT VSM NHAT BAN",
	},
	{
		value: "VNXAJL",
		name: "CT VSM NHAT BAN",
		label: "VNXAJL - CT VSM NHAT BAN",
	},
	{
		value: "VNXAK",
		name: "CT SEIKO VIET NAM",
		label: "VNXAK - CT SEIKO VIET NAM",
	},
	{
		value: "VNXAKL",
		name: "CT SEIKO VIET NAM",
		label: "VNXAKL - CT SEIKO VIET NAM",
	},
	{
		value: "VNXAL",
		name: "SUMIDENSO VIET NAM",
		label: "VNXAL - SUMIDENSO VIET NAM",
	},
	{
		value: "VNXALL",
		name: "SUMIDENSO VIET NAM",
		label: "VNXALL - SUMIDENSO VIET NAM",
	},
	{
		value: "VNXAM",
		name: "TOWADA VIET NAM",
		label: "VNXAM - TOWADA VIET NAM",
	},
	{
		value: "VNXAML",
		name: "TOWADA VIET NAM",
		label: "VNXAML - TOWADA VIET NAM",
	},
	{
		value: "VNXAMT",
		name: "CUA KHAU XA MAT (TAY NINH)",
		label: "VNXAMT - CUA KHAU XA MAT (TAY NINH)",
	},
	{
		value: "VNXAN",
		name: "CT AUREOLE BCD",
		label: "VNXAN - CT AUREOLE BCD",
	},
	{
		value: "VNXANL",
		name: "CT AUREOLE BCD",
		label: "VNXANL - CT AUREOLE BCD",
	},
	{
		value: "VNXAO",
		name: "VINA OKAMOTO",
		label: "VNXAO - VINA OKAMOTO",
	},
	{
		value: "VNXAOL",
		name: "VINA OKAMOTO",
		label: "VNXAOL - VINA OKAMOTO",
	},
	{
		value: "VNXAP",
		name: "LFV METAL VIET NAM",
		label: "VNXAP - LFV METAL VIET NAM",
	},
	{
		value: "VNXAPL",
		name: "LFV METAL VIET NAM",
		label: "VNXAPL - LFV METAL VIET NAM",
	},
	{
		value: "VNXAQ",
		name: "VALQUA VIET NAM",
		label: "VNXAQ - VALQUA VIET NAM",
	},
	{
		value: "VNXAQL",
		name: "VALQUA VIET NAM",
		label: "VNXAQL - VALQUA VIET NAM",
	},
	{
		value: "VNXAR",
		name: "DIEN TU IRISO VN",
		label: "VNXAR - DIEN TU IRISO VN",
	},
	{
		value: "VNXARL",
		name: "DIEN TU IRISO VN",
		label: "VNXARL - DIEN TU IRISO VN",
	},
	{
		value: "VNXAS",
		name: "CT UMC VIET NAM",
		label: "VNXAS - CT UMC VIET NAM",
	},
	{
		value: "VNXASL",
		name: "CT UMC VIET NAM",
		label: "VNXASL - CT UMC VIET NAM",
	},
	{
		value: "VNXAT",
		name: "DIEN TU TAISEI HANOI",
		label: "VNXAT - DIEN TU TAISEI HANOI",
	},
	{
		value: "VNXATL",
		name: "DIEN TU TAISEI HANOI",
		label: "VNXATL - DIEN TU TAISEI HANOI",
	},
	{
		value: "VNXAU",
		name: "AIDEN VIET NAM",
		label: "VNXAU - AIDEN VIET NAM",
	},
	{
		value: "VNXAUL",
		name: "AIDEN VIET NAM",
		label: "VNXAUL - AIDEN VIET NAM",
	},
	{
		value: "VNXAV",
		name: "ATARIH PRECISION VN",
		label: "VNXAV - ATARIH PRECISION VN",
	},
	{
		value: "VNXAVL",
		name: "ATARIH PRECISION VN",
		label: "VNXAVL - ATARIH PRECISION VN",
	},
	{
		value: "VNXAW",
		name: "IKKA VIET NAM",
		label: "VNXAW - IKKA VIET NAM",
	},
	{
		value: "VNXAWL",
		name: "IKKA VIET NAM",
		label: "VNXAWL - IKKA VIET NAM",
	},
	{
		value: "VNXAX",
		name: "NISSEI VIET NAM",
		label: "VNXAX - NISSEI VIET NAM",
	},
	{
		value: "VNXAXL",
		name: "NISSEI VIET NAM",
		label: "VNXAXL - NISSEI VIET NAM",
	},
	{
		value: "VNXAY",
		name: "SUMIDEN VIET NAM",
		label: "VNXAY - SUMIDEN VIET NAM",
	},
	{
		value: "VNXAYL",
		name: "SUMIDEN VIET NAM",
		label: "VNXAYL - SUMIDEN VIET NAM",
	},
	{
		value: "VNXAZ",
		name: "FUJI SEIKO VN",
		label: "VNXAZ - FUJI SEIKO VN",
	},
	{
		value: "VNXAZL",
		name: "FUJI SEIKO VN",
		label: "VNXAZL - FUJI SEIKO VN",
	},
	{
		value: "VNXBA",
		name: "CT GESHEN VN",
		label: "VNXBA - CT GESHEN VN",
	},
	{
		value: "VNXBAL",
		name: "CT GESHEN VN",
		label: "VNXBAL - CT GESHEN VN",
	},
	{
		value: "VNXBB",
		name: "HINSITSU SCREEN VN",
		label: "VNXBB - HINSITSU SCREEN VN",
	},
	{
		value: "VNXBBL",
		name: "HINSITSU SCREEN VN",
		label: "VNXBBL - HINSITSU SCREEN VN",
	},
	{
		value: "VNXBC",
		name: "KEFICO VIETNAM",
		label: "VNXBC - KEFICO VIETNAM",
	},
	{
		value: "VNXBCL",
		name: "KEFICO VIETNAM",
		label: "VNXBCL - KEFICO VIETNAM",
	},
	{
		value: "VNXBD",
		name: "CT KIM THUY PHUC",
		label: "VNXBD - CT KIM THUY PHUC",
	},
	{
		value: "VNXBDL",
		name: "CT KIM THUY PHUC",
		label: "VNXBDL - CT KIM THUY PHUC",
	},
	{
		value: "VNXBE",
		name: "KURODA KAGAKU VN",
		label: "VNXBE - KURODA KAGAKU VN",
	},
	{
		value: "VNXBEL",
		name: "KURODA KAGAKU VN",
		label: "VNXBEL - KURODA KAGAKU VN",
	},
	{
		value: "VNXBF",
		name: "MEIJTSU TONGDA VN",
		label: "VNXBF - MEIJTSU TONGDA VN",
	},
	{
		value: "VNXBFL",
		name: "MEIJTSU TONGDA VN",
		label: "VNXBFL - MEIJTSU TONGDA VN",
	},
	{
		value: "VNXBG",
		name: "MIZUHO PRECISION VN",
		label: "VNXBG - MIZUHO PRECISION VN",
	},
	{
		value: "VNXBGL",
		name: "MIZUHO PRECISION VN",
		label: "VNXBGL - MIZUHO PRECISION VN",
	},
	{
		value: "VNXBH",
		name: "NISHOKU TECHNOLOGY",
		label: "VNXBH - NISHOKU TECHNOLOGY",
	},
	{
		value: "VNXBHL",
		name: "NISHOKU TECHNOLOGY",
		label: "VNXBHL - NISHOKU TECHNOLOGY",
	},
	{
		value: "VNXBI",
		name: "CT SANSEI VN",
		label: "VNXBI - CT SANSEI VN",
	},
	{
		value: "VNXBIL",
		name: "CT SANSEI VN",
		label: "VNXBIL - CT SANSEI VN",
	},
	{
		value: "VNXBJ",
		name: "CT SSK VIET NAM",
		label: "VNXBJ - CT SSK VIET NAM",
	},
	{
		value: "VNXBJL",
		name: "CT SSK VIET NAM",
		label: "VNXBJL - CT SSK VIET NAM",
	},
	{
		value: "VNXBK",
		name: "TAISHODO VIETNAM",
		label: "VNXBK - TAISHODO VIETNAM",
	},
	{
		value: "VNXBKL",
		name: "TAISHODO VIETNAM",
		label: "VNXBKL - TAISHODO VIETNAM",
	},
	{
		value: "VNXBL",
		name: "CT LIEN DAI VN",
		label: "VNXBL - CT LIEN DAI VN",
	},
	{
		value: "VNXBLL",
		name: "CT LIEN DAI VN",
		label: "VNXBLL - CT LIEN DAI VN",
	},
	{
		value: "VNXBM",
		name: "CT UNIDEN VN",
		label: "VNXBM - CT UNIDEN VN",
	},
	{
		value: "VNXBML",
		name: "CT UNIDEN VN",
		label: "VNXBML - CT UNIDEN VN",
	},
	{
		value: "VNXBN",
		name: "SANYU SEIMITSU",
		label: "VNXBN - SANYU SEIMITSU",
	},
	{
		value: "VNXBNL",
		name: "SANYU SEIMITSU",
		label: "VNXBNL - SANYU SEIMITSU",
	},
	{
		value: "VNXBO",
		name: "CT FULUHASHI VN",
		label: "VNXBO - CT FULUHASHI VN",
	},
	{
		value: "VNXBOL",
		name: "CT FULUHASHI VN",
		label: "VNXBOL - CT FULUHASHI VN",
	},
	{
		value: "VNXBP",
		name: "YAZAKI HAI PHONG(TB)",
		label: "VNXBP - YAZAKI HAI PHONG(TB)",
	},
	{
		value: "VNXBPL",
		name: "YAZAKI HAI PHONG(TB)",
		label: "VNXBPL - YAZAKI HAI PHONG(TB)",
	},
	{
		value: "VNXBQ",
		name: "CT SHENGFANG",
		label: "VNXBQ - CT SHENGFANG",
	},
	{
		value: "VNXBQL",
		name: "CT SHENGFANG",
		label: "VNXBQL - CT SHENGFANG",
	},
	{
		value: "VNXBR",
		name: "CT TACTICIAN",
		label: "VNXBR - CT TACTICIAN",
	},
	{
		value: "VNXBRL",
		name: "CT TACTICIAN",
		label: "VNXBRL - CT TACTICIAN",
	},
	{
		value: "VNXBS",
		name: "CT QTE DINH LUC",
		label: "VNXBS - CT QTE DINH LUC",
	},
	{
		value: "VNXBSL",
		name: "CT QTE DINH LUC",
		label: "VNXBSL - CT QTE DINH LUC",
	},
	{
		value: "VNXBT",
		name: "MIZUNOPRECISION",
		label: "VNXBT - MIZUNOPRECISION",
	},
	{
		value: "VNXBTL",
		name: "MIZUNOPRECISION",
		label: "VNXBTL - MIZUNOPRECISION",
	},
	{
		value: "VNXBU",
		name: "AKIYAMA SC VN",
		label: "VNXBU - AKIYAMA SC VN",
	},
	{
		value: "VNXBUL",
		name: "AKIYAMA SC VN",
		label: "VNXBUL - AKIYAMA SC VN",
	},
	{
		value: "VNXBV",
		name: "CT SANWA VN",
		label: "VNXBV - CT SANWA VN",
	},
	{
		value: "VNXBVL",
		name: "CT SANWA VN",
		label: "VNXBVL - CT SANWA VN",
	},
	{
		value: "VNXBW",
		name: "CT CORONA VN",
		label: "VNXBW - CT CORONA VN",
	},
	{
		value: "VNXBWL",
		name: "CT CORONA VN",
		label: "VNXBWL - CT CORONA VN",
	},
	{
		value: "VNXBX",
		name: "CT DENYO VN",
		label: "VNXBX - CT DENYO VN",
	},
	{
		value: "VNXBXL",
		name: "CT DENYO VN",
		label: "VNXBXL - CT DENYO VN",
	},
	{
		value: "VNXBY",
		name: "CT CANON VN",
		label: "VNXBY - CT CANON VN",
	},
	{
		value: "VNXBYL",
		name: "CT CANON VN",
		label: "VNXBYL - CT CANON VN",
	},
	{
		value: "VNXBZ",
		name: "DROSSAPHARM VN",
		label: "VNXBZ - DROSSAPHARM VN",
	},
	{
		value: "VNXBZL",
		name: "DROSSAPHARM VN",
		label: "VNXBZL - DROSSAPHARM VN",
	},
	{
		value: "VNXCA",
		name: "FANCY CREATION VN",
		label: "VNXCA - FANCY CREATION VN",
	},
	{
		value: "VNXCAL",
		name: "FANCY CREATION VN",
		label: "VNXCAL - FANCY CREATION VN",
	},
	{
		value: "VNXCB",
		name: "CT HAMADEN VN",
		label: "VNXCB - CT HAMADEN VN",
	},
	{
		value: "VNXCBL",
		name: "CT HAMADEN VN",
		label: "VNXCBL - CT HAMADEN VN",
	},
	{
		value: "VNXCC",
		name: "HOYA GLASSDISK VN II",
		label: "VNXCC - HOYA GLASSDISK VN II",
	},
	{
		value: "VNXCCL",
		name: "HOYA GLASSDISK VN II",
		label: "VNXCCL - HOYA GLASSDISK VN II",
	},
	{
		value: "VNXCD",
		name: "CT ICAM VIET NAM",
		label: "VNXCD - CT ICAM VIET NAM",
	},
	{
		value: "VNXCDL",
		name: "CT ICAM VIET NAM",
		label: "VNXCDL - CT ICAM VIET NAM",
	},
	{
		value: "VNXCE",
		name: "CT KOSAKA VN",
		label: "VNXCE - CT KOSAKA VN",
	},
	{
		value: "VNXCEL",
		name: "CT KOSAKA VN",
		label: "VNXCEL - CT KOSAKA VN",
	},
	{
		value: "VNXCF",
		name: "CT KYOCERA VN",
		label: "VNXCF - CT KYOCERA VN",
	},
	{
		value: "VNXCFL",
		name: "CT KYOCERA VN",
		label: "VNXCFL - CT KYOCERA VN",
	},
	{
		value: "VNXCG",
		name: "KYOTO BIKEN HN",
		label: "VNXCG - KYOTO BIKEN HN",
	},
	{
		value: "VNXCGL",
		name: "KYOTO BIKEN HN",
		label: "VNXCGL - KYOTO BIKEN HN",
	},
	{
		value: "VNXCH",
		name: "MG PLASTIC VIET NAM",
		label: "VNXCH - MG PLASTIC VIET NAM",
	},
	{
		value: "VNXCHL",
		name: "MG PLASTIC VIET NAM",
		label: "VNXCHL - MG PLASTIC VIET NAM",
	},
	{
		value: "VNXCI",
		name: "MIKASA VIETNAM",
		label: "VNXCI - MIKASA VIETNAM",
	},
	{
		value: "VNXCIL",
		name: "MIKASA VIETNAM",
		label: "VNXCIL - MIKASA VIETNAM",
	},
	{
		value: "VNXCJ",
		name: "CT VIETNAM MIE",
		label: "VNXCJ - CT VIETNAM MIE",
	},
	{
		value: "VNXCJL",
		name: "CT VIETNAM MIE",
		label: "VNXCJL - CT VIETNAM MIE",
	},
	{
		value: "VNXCK",
		name: "CT NIKKISO VN",
		label: "VNXCK - CT NIKKISO VN",
	},
	{
		value: "VNXCKL",
		name: "CT NIKKISO VN",
		label: "VNXCKL - CT NIKKISO VN",
	},
	{
		value: "VNXCL",
		name: "CT OCHIAI VN",
		label: "VNXCL - CT OCHIAI VN",
	},
	{
		value: "VNXCLL",
		name: "CT OCHIAI VN",
		label: "VNXCLL - CT OCHIAI VN",
	},
	{
		value: "VNXCM",
		name: "SEW COMPONENTS VN",
		label: "VNXCM - SEW COMPONENTS VN",
	},
	{
		value: "VNXCML",
		name: "SEW COMPONENTS VN",
		label: "VNXCML - SEW COMPONENTS VN",
	},
	{
		value: "VNXCN",
		name: "SHINEI SEIKO VN",
		label: "VNXCN - SHINEI SEIKO VN",
	},
	{
		value: "VNXCNL",
		name: "SHINEI SEIKO VN",
		label: "VNXCNL - SHINEI SEIKO VN",
	},
	{
		value: "VNXCO",
		name: "SHINJO VIETNAM",
		label: "VNXCO - SHINJO VIETNAM",
	},
	{
		value: "VNXCOL",
		name: "SHINJO VIETNAM",
		label: "VNXCOL - SHINJO VIETNAM",
	},
	{
		value: "VNXCP",
		name: "SHOEI VIET NAM",
		label: "VNXCP - SHOEI VIET NAM",
	},
	{
		value: "VNXCPL",
		name: "SHOEI VIET NAM",
		label: "VNXCPL - SHOEI VIET NAM",
	},
	{
		value: "VNXCQ",
		name: "CT SOC VIET NAM",
		label: "VNXCQ - CT SOC VIET NAM",
	},
	{
		value: "VNXCQL",
		name: "CT SOC VIET NAM",
		label: "VNXCQL - CT SOC VIET NAM",
	},
	{
		value: "VNXCR",
		name: "CT TBI CN TOYOTA VN",
		label: "VNXCR - CT TBI CN TOYOTA VN",
	},
	{
		value: "VNXCRL",
		name: "CT TBI CN TOYOTA VN",
		label: "VNXCRL - CT TBI CN TOYOTA VN",
	},
	{
		value: "VNXCS",
		name: "CT VLDT SHIN ETSU VN",
		label: "VNXCS - CT VLDT SHIN ETSU VN",
	},
	{
		value: "VNXCSL",
		name: "CT VLDT SHIN ETSU VN",
		label: "VNXCSL - CT VLDT SHIN ETSU VN",
	},
	{
		value: "VNXCT",
		name: "CT VIETINAK",
		label: "VNXCT - CT VIETINAK",
	},
	{
		value: "VNXCTL",
		name: "CT VIETINAK",
		label: "VNXCTL - CT VIETINAK",
	},
	{
		value: "VNXCU",
		name: "CT CN SEICO",
		label: "VNXCU - CT CN SEICO",
	},
	{
		value: "VNXCUL",
		name: "CT CN SEICO",
		label: "VNXCUL - CT CN SEICO",
	},
	{
		value: "VNXCV",
		name: "CT FUJI BAKELITE VN",
		label: "VNXCV - CT FUJI BAKELITE VN",
	},
	{
		value: "VNXCVL",
		name: "CT FUJI BAKELITE VN",
		label: "VNXCVL - CT FUJI BAKELITE VN",
	},
	{
		value: "VNXCW",
		name: "CTCP NIHON LAMY VN",
		label: "VNXCW - CTCP NIHON LAMY VN",
	},
	{
		value: "VNXCWL",
		name: "CTCP NIHON LAMY VN",
		label: "VNXCWL - CTCP NIHON LAMY VN",
	},
	{
		value: "VNXCX",
		name: "CT BRIDGESTONE VN",
		label: "VNXCX - CT BRIDGESTONE VN",
	},
	{
		value: "VNXCXL",
		name: "CT BRIDGESTONE VN",
		label: "VNXCXL - CT BRIDGESTONE VN",
	},
	{
		value: "VNXCY",
		name: "CT BUCHEON VN",
		label: "VNXCY - CT BUCHEON VN",
	},
	{
		value: "VNXCYL",
		name: "CT BUCHEON VN",
		label: "VNXCYL - CT BUCHEON VN",
	},
	{
		value: "VNXCZ",
		name: "CTM CITIZEN VIET NAM",
		label: "VNXCZ - CTM CITIZEN VIET NAM",
	},
	{
		value: "VNXCZL",
		name: "CTM CITIZEN VIET NAM",
		label: "VNXCZL - CTM CITIZEN VIET NAM",
	},
	{
		value: "VNXDG",
		name: "CANG X.D.GA HOA LONG",
		label: "VNXDG - CANG X.D.GA HOA LONG",
	},
	{
		value: "VNXDT",
		name: "CANG XD DONG THAP",
		label: "VNXDT - CANG XD DONG THAP",
	},
	{
		value: "VNXDV",
		name: "XANG DAU DINH VU",
		label: "VNXDV - XANG DAU DINH VU",
	},
	{
		value: "VNXEA",
		name: "NICHIAS HAI PHONG",
		label: "VNXEA - NICHIAS HAI PHONG",
	},
	{
		value: "VNXEAL",
		name: "NICHIAS HAI PHONG",
		label: "VNXEAL - NICHIAS HAI PHONG",
	},
	{
		value: "VNXEB",
		name: "CT GE VIET NAM",
		label: "VNXEB - CT GE VIET NAM",
	},
	{
		value: "VNXEBL",
		name: "CT GE VIET NAM",
		label: "VNXEBL - CT GE VIET NAM",
	},
	{
		value: "VNXEC",
		name: "IIYAMA SEIKI VIETNAM",
		label: "VNXEC - IIYAMA SEIKI VIETNAM",
	},
	{
		value: "VNXECL",
		name: "IIYAMA SEIKI VIETNAM",
		label: "VNXECL - IIYAMA SEIKI VIETNAM",
	},
	{
		value: "VNXED",
		name: "CT GIAY KONYA VN",
		label: "VNXED - CT GIAY KONYA VN",
	},
	{
		value: "VNXEDL",
		name: "CT GIAY KONYA VN",
		label: "VNXEDL - CT GIAY KONYA VN",
	},
	{
		value: "VNXEE",
		name: "CT SIK VIET NAM",
		label: "VNXEE - CT SIK VIET NAM",
	},
	{
		value: "VNXEEL",
		name: "CT SIK VIET NAM",
		label: "VNXEEL - CT SIK VIET NAM",
	},
	{
		value: "VNXEF",
		name: "CT SOUGOU VN",
		label: "VNXEF - CT SOUGOU VN",
	},
	{
		value: "VNXEFL",
		name: "CT SOUGOU VN",
		label: "VNXEFL - CT SOUGOU VN",
	},
	{
		value: "VNXEG",
		name: "CT SUMIDA VN",
		label: "VNXEG - CT SUMIDA VN",
	},
	{
		value: "VNXEGL",
		name: "CT SUMIDA VN",
		label: "VNXEGL - CT SUMIDA VN",
	},
	{
		value: "VNXEH",
		name: "CT SYNZTEC VN",
		label: "VNXEH - CT SYNZTEC VN",
	},
	{
		value: "VNXEHL",
		name: "CT SYNZTEC VN",
		label: "VNXEHL - CT SYNZTEC VN",
	},
	{
		value: "VNXEI",
		name: "TOYODA GOSEI HP",
		label: "VNXEI - TOYODA GOSEI HP",
	},
	{
		value: "VNXEIL",
		name: "TOYODA GOSEI HP",
		label: "VNXEIL - TOYODA GOSEI HP",
	},
	{
		value: "VNXEJ",
		name: "ZHONGXIN YATAI VN",
		label: "VNXEJ - ZHONGXIN YATAI VN",
	},
	{
		value: "VNXEJL",
		name: "ZHONGXIN YATAI VN",
		label: "VNXEJL - ZHONGXIN YATAI VN",
	},
	{
		value: "VNXEK",
		name: "HUGE GAIN HOLDINGS",
		label: "VNXEK - HUGE GAIN HOLDINGS",
	},
	{
		value: "VNXEKL",
		name: "HUGE GAIN HOLDINGS",
		label: "VNXEKL - HUGE GAIN HOLDINGS",
	},
	{
		value: "VNXEL",
		name: "CT TIAN JIAO VN",
		label: "VNXEL - CT TIAN JIAO VN",
	},
	{
		value: "VNXELL",
		name: "CT TIAN JIAO VN",
		label: "VNXELL - CT TIAN JIAO VN",
	},
	{
		value: "VNXEM",
		name: "CT WANLI VN",
		label: "VNXEM - CT WANLI VN",
	},
	{
		value: "VNXEML",
		name: "CT WANLI VN",
		label: "VNXEML - CT WANLI VN",
	},
	{
		value: "VNXEN",
		name: "FUJI XEROX HAI PHONG",
		label: "VNXEN - FUJI XEROX HAI PHONG",
	},
	{
		value: "VNXENL",
		name: "FUJI XEROX HAI PHONG",
		label: "VNXENL - FUJI XEROX HAI PHONG",
	},
	{
		value: "VNXEO",
		name: "GERBERA PRECISION VN",
		label: "VNXEO - GERBERA PRECISION VN",
	},
	{
		value: "VNXEOL",
		name: "GERBERA PRECISION VN",
		label: "VNXEOL - GERBERA PRECISION VN",
	},
	{
		value: "VNXEP",
		name: "HUAFENG PLASTIC",
		label: "VNXEP - HUAFENG PLASTIC",
	},
	{
		value: "VNXEPL",
		name: "HUAFENG PLASTIC",
		label: "VNXEPL - HUAFENG PLASTIC",
	},
	{
		value: "VNXEQ",
		name: "IKO THOMPSON VN",
		label: "VNXEQ - IKO THOMPSON VN",
	},
	{
		value: "VNXEQL",
		name: "IKO THOMPSON VN",
		label: "VNXEQL - IKO THOMPSON VN",
	},
	{
		value: "VNXER",
		name: "CT INSTANA VN",
		label: "VNXER - CT INSTANA VN",
	},
	{
		value: "VNXERL",
		name: "CT INSTANA VN",
		label: "VNXERL - CT INSTANA VN",
	},
	{
		value: "VNXES",
		name: "CT KOKUYO VN",
		label: "VNXES - CT KOKUYO VN",
	},
	{
		value: "VNXESL",
		name: "CT KOKUYO VN",
		label: "VNXESL - CT KOKUYO VN",
	},
	{
		value: "VNXET",
		name: "NAKASHIMA VIET NAM",
		label: "VNXET - NAKASHIMA VIET NAM",
	},
	{
		value: "VNXETL",
		name: "NAKASHIMA VIET NAM",
		label: "VNXETL - NAKASHIMA VIET NAM",
	},
	{
		value: "VNXEU",
		name: "CT NISSEI ECO VN",
		label: "VNXEU - CT NISSEI ECO VN",
	},
	{
		value: "VNXEUL",
		name: "CT NISSEI ECO VN",
		label: "VNXEUL - CT NISSEI ECO VN",
	},
	{
		value: "VNXEV",
		name: "TOHOKU PIONEER VN",
		label: "VNXEV - TOHOKU PIONEER VN",
	},
	{
		value: "VNXEVL",
		name: "TOHOKU PIONEER VN",
		label: "VNXEVL - TOHOKU PIONEER VN",
	},
	{
		value: "VNXEW",
		name: "YANAGAWA SEIKO VN",
		label: "VNXEW - YANAGAWA SEIKO VN",
	},
	{
		value: "VNXEWL",
		name: "YANAGAWA SEIKO VN",
		label: "VNXEWL - YANAGAWA SEIKO VN",
	},
	{
		value: "VNXEX",
		name: "CT CHENG V",
		label: "VNXEX - CT CHENG V",
	},
	{
		value: "VNXEXL",
		name: "CT CHENG V",
		label: "VNXEXL - CT CHENG V",
	},
	{
		value: "VNXEY",
		name: "FUJI MOLD VIET NAM",
		label: "VNXEY - FUJI MOLD VIET NAM",
	},
	{
		value: "VNXEYL",
		name: "FUJI MOLD VIET NAM",
		label: "VNXEYL - FUJI MOLD VIET NAM",
	},
	{
		value: "VNXEZ",
		name: "TAKAHATA PRECISION",
		label: "VNXEZ - TAKAHATA PRECISION",
	},
	{
		value: "VNXEZL",
		name: "TAKAHATA PRECISION",
		label: "VNXEZL - TAKAHATA PRECISION",
	},
	{
		value: "VNXFA",
		name: "CT PV HAI PHONG",
		label: "VNXFA - CT PV HAI PHONG",
	},
	{
		value: "VNXFAL",
		name: "CT PV HAI PHONG",
		label: "VNXFAL - CT PV HAI PHONG",
	},
	{
		value: "VNXFB",
		name: "YAZAKI HAI PHONG VN",
		label: "VNXFB - YAZAKI HAI PHONG VN",
	},
	{
		value: "VNXFBL",
		name: "YAZAKI HAI PHONG VN",
		label: "VNXFBL - YAZAKI HAI PHONG VN",
	},
	{
		value: "VNXFC",
		name: "CT CN NISHIMA VN",
		label: "VNXFC - CT CN NISHIMA VN",
	},
	{
		value: "VNXFCL",
		name: "CT CN NISHIMA VN",
		label: "VNXFCL - CT CN NISHIMA VN",
	},
	{
		value: "VNXFD",
		name: "CT RAYHO VIETNAM",
		label: "VNXFD - CT RAYHO VIETNAM",
	},
	{
		value: "VNXFDL",
		name: "CT RAYHO VIETNAM",
		label: "VNXFDL - CT RAYHO VIETNAM",
	},
	{
		value: "VNXFE",
		name: "CT FONGHO",
		label: "VNXFE - CT FONGHO",
	},
	{
		value: "VNXFEL",
		name: "CT FONGHO",
		label: "VNXFEL - CT FONGHO",
	},
	{
		value: "VNXFF",
		name: "CHUNG YANG FOODS VN",
		label: "VNXFF - CHUNG YANG FOODS VN",
	},
	{
		value: "VNXFFL",
		name: "CHUNG YANG FOODS VN",
		label: "VNXFFL - CHUNG YANG FOODS VN",
	},
	{
		value: "VNXFG",
		name: "CT PTCN BECKEN VN",
		label: "VNXFG - CT PTCN BECKEN VN",
	},
	{
		value: "VNXFGL",
		name: "CT PTCN BECKEN VN",
		label: "VNXFGL - CT PTCN BECKEN VN",
	},
	{
		value: "VNXFH",
		name: "CT KYOCERA VIET NAM",
		label: "VNXFH - CT KYOCERA VIET NAM",
	},
	{
		value: "VNXFHL",
		name: "CT KYOCERA VIET NAM",
		label: "VNXFHL - CT KYOCERA VIET NAM",
	},
	{
		value: "VNXFI",
		name: "CT KYORITSU VN",
		label: "VNXFI - CT KYORITSU VN",
	},
	{
		value: "VNXFIL",
		name: "CT KYORITSU VN",
		label: "VNXFIL - CT KYORITSU VN",
	},
	{
		value: "VNXFJ",
		name: "CT DTU SONG HAO",
		label: "VNXFJ - CT DTU SONG HAO",
	},
	{
		value: "VNXFJL",
		name: "CT DTU SONG HAO",
		label: "VNXFJL - CT DTU SONG HAO",
	},
	{
		value: "VNXFK",
		name: "FUJIKURA COMPOSITES",
		label: "VNXFK - FUJIKURA COMPOSITES",
	},
	{
		value: "VNXFKL",
		name: "FUJIKURA COMPOSITES",
		label: "VNXFKL - FUJIKURA COMPOSITES",
	},
	{
		value: "VNXFL",
		name: "CT JKC VINA",
		label: "VNXFL - CT JKC VINA",
	},
	{
		value: "VNXFLL",
		name: "CT JKC VINA",
		label: "VNXFLL - CT JKC VINA",
	},
	{
		value: "VNXFM",
		name: "CT KORG VN",
		label: "VNXFM - CT KORG VN",
	},
	{
		value: "VNXFML",
		name: "CT KORG VN",
		label: "VNXFML - CT KORG VN",
	},
	{
		value: "VNXFN",
		name: "CT LIVAX VN",
		label: "VNXFN - CT LIVAX VN",
	},
	{
		value: "VNXFNL",
		name: "CT LIVAX VN",
		label: "VNXFNL - CT LIVAX VN",
	},
	{
		value: "VNXFO",
		name: "CT MAIKO HP",
		label: "VNXFO - CT MAIKO HP",
	},
	{
		value: "VNXFOL",
		name: "CT MAIKO HP",
		label: "VNXFOL - CT MAIKO HP",
	},
	{
		value: "VNXFP",
		name: "NIPPON KODO VN",
		label: "VNXFP - NIPPON KODO VN",
	},
	{
		value: "VNXFPL",
		name: "NIPPON KODO VN",
		label: "VNXFPL - NIPPON KODO VN",
	},
	{
		value: "VNXFQ",
		name: "CT VINA BINGO",
		label: "VNXFQ - CT VINA BINGO",
	},
	{
		value: "VNXFQL",
		name: "CT VINA BINGO",
		label: "VNXFQL - CT VINA BINGO",
	},
	{
		value: "VNXFR",
		name: "CT YONEDA VN",
		label: "VNXFR - CT YONEDA VN",
	},
	{
		value: "VNXFRL",
		name: "CT YONEDA VN",
		label: "VNXFRL - CT YONEDA VN",
	},
	{
		value: "VNXFS",
		name: "CT CO KHI RK",
		label: "VNXFS - CT CO KHI RK",
	},
	{
		value: "VNXFSL",
		name: "CT CO KHI RK",
		label: "VNXFSL - CT CO KHI RK",
	},
	{
		value: "VNXFT",
		name: "CT CHE TAO ZEON VN",
		label: "VNXFT - CT CHE TAO ZEON VN",
	},
	{
		value: "VNXFTL",
		name: "CT CHE TAO ZEON VN",
		label: "VNXFTL - CT CHE TAO ZEON VN",
	},
	{
		value: "VNXFU",
		name: "MEIHOTECH VIET NAM",
		label: "VNXFU - MEIHOTECH VIET NAM",
	},
	{
		value: "VNXFUL",
		name: "MEIHOTECH VIET NAM",
		label: "VNXFUL - MEIHOTECH VIET NAM",
	},
	{
		value: "VNXFV",
		name: "CT CHE TAO MAY EBA",
		label: "VNXFV - CT CHE TAO MAY EBA",
	},
	{
		value: "VNXFVL",
		name: "CT CHE TAO MAY EBA",
		label: "VNXFVL - CT CHE TAO MAY EBA",
	},
	{
		value: "VNXFW",
		name: "CT SHINYONG VN",
		label: "VNXFW - CT SHINYONG VN",
	},
	{
		value: "VNXFWL",
		name: "CT SHINYONG VN",
		label: "VNXFWL - CT SHINYONG VN",
	},
	{
		value: "VNXFX",
		name: "ADVANCED TECHNOLOGY",
		label: "VNXFX - ADVANCED TECHNOLOGY",
	},
	{
		value: "VNXFXL",
		name: "ADVANCED TECHNOLOGY",
		label: "VNXFXL - ADVANCED TECHNOLOGY",
	},
	{
		value: "VNXFY",
		name: "CT HOP THINH",
		label: "VNXFY - CT HOP THINH",
	},
	{
		value: "VNXFYL",
		name: "CT HOP THINH",
		label: "VNXFYL - CT HOP THINH",
	},
	{
		value: "VNXFZ",
		name: "HUADE HOLDINGS VN",
		label: "VNXFZ - HUADE HOLDINGS VN",
	},
	{
		value: "VNXFZL",
		name: "HUADE HOLDINGS VN",
		label: "VNXFZL - HUADE HOLDINGS VN",
	},
	{
		value: "VNXGA",
		name: "CT RORZE ROBOTECH",
		label: "VNXGA - CT RORZE ROBOTECH",
	},
	{
		value: "VNXGAL",
		name: "CT RORZE ROBOTECH",
		label: "VNXGAL - CT RORZE ROBOTECH",
	},
	{
		value: "VNXGB",
		name: "CT QTE THOI TRANG VN",
		label: "VNXGB - CT QTE THOI TRANG VN",
	},
	{
		value: "VNXGBL",
		name: "CT QTE THOI TRANG VN",
		label: "VNXGBL - CT QTE THOI TRANG VN",
	},
	{
		value: "VNXGC",
		name: "HONG YUAN HPHONG VN",
		label: "VNXGC - HONG YUAN HPHONG VN",
	},
	{
		value: "VNXGCL",
		name: "HONG YUAN HPHONG VN",
		label: "VNXGCL - HONG YUAN HPHONG VN",
	},
	{
		value: "VNXGD",
		name: "CT HANMIFLEX",
		label: "VNXGD - CT HANMIFLEX",
	},
	{
		value: "VNXGDL",
		name: "CT HANMIFLEX",
		label: "VNXGDL - CT HANMIFLEX",
	},
	{
		value: "VNXGE",
		name: "TH SOI HAILONG VN",
		label: "VNXGE - TH SOI HAILONG VN",
	},
	{
		value: "VNXGEL",
		name: "TH SOI HAILONG VN",
		label: "VNXGEL - TH SOI HAILONG VN",
	},
	{
		value: "VNXGF",
		name: "CT ASTY VIETNAM",
		label: "VNXGF - CT ASTY VIETNAM",
	},
	{
		value: "VNXGFL",
		name: "CT ASTY VIETNAM",
		label: "VNXGFL - CT ASTY VIETNAM",
	},
	{
		value: "VNXGG",
		name: "CT LIHITLAB VN",
		label: "VNXGG - CT LIHITLAB VN",
	},
	{
		value: "VNXGGL",
		name: "CT LIHITLAB VN",
		label: "VNXGGL - CT LIHITLAB VN",
	},
	{
		value: "VNXGI",
		name: "AKITA OIL SEAL VN",
		label: "VNXGI - AKITA OIL SEAL VN",
	},
	{
		value: "VNXGIL",
		name: "AKITA OIL SEAL VN",
		label: "VNXGIL - AKITA OIL SEAL VN",
	},
	{
		value: "VNXGJ",
		name: "CT GIAY NAN I VN",
		label: "VNXGJ - CT GIAY NAN I VN",
	},
	{
		value: "VNXGJL",
		name: "CT GIAY NAN I VN",
		label: "VNXGJL - CT GIAY NAN I VN",
	},
	{
		value: "VNXGL",
		name: "SHIN ETSU VIET NAM",
		label: "VNXGL - SHIN ETSU VIET NAM",
	},
	{
		value: "VNXGLL",
		name: "SHIN ETSU VIET NAM",
		label: "VNXGLL - SHIN ETSU VIET NAM",
	},
	{
		value: "VNXGM",
		name: "CT VINOMARINE",
		label: "VNXGM - CT VINOMARINE",
	},
	{
		value: "VNXGML",
		name: "CT VINOMARINE",
		label: "VNXGML - CT VINOMARINE",
	},
	{
		value: "VNXGN",
		name: "CT MOCHIZUKI VN",
		label: "VNXGN - CT MOCHIZUKI VN",
	},
	{
		value: "VNXGNL",
		name: "CT MOCHIZUKI VN",
		label: "VNXGNL - CT MOCHIZUKI VN",
	},
	{
		value: "VNXGO",
		name: "CT JOHOKU HPHONG",
		label: "VNXGO - CT JOHOKU HPHONG",
	},
	{
		value: "VNXGOL",
		name: "CT JOHOKU HPHONG",
		label: "VNXGOL - CT JOHOKU HPHONG",
	},
	{
		value: "VNXGP",
		name: "MEDIKIT VIET NAM",
		label: "VNXGP - MEDIKIT VIET NAM",
	},
	{
		value: "VNXGPL",
		name: "MEDIKIT VIET NAM",
		label: "VNXGPL - MEDIKIT VIET NAM",
	},
	{
		value: "VNXGQ",
		name: "CT AURORA ART",
		label: "VNXGQ - CT AURORA ART",
	},
	{
		value: "VNXGQL",
		name: "CT AURORA ART",
		label: "VNXGQL - CT AURORA ART",
	},
	{
		value: "VNXGR",
		name: "TOYOTA BOSHOKU HP",
		label: "VNXGR - TOYOTA BOSHOKU HP",
	},
	{
		value: "VNXGRL",
		name: "TOYOTA BOSHOKU HP",
		label: "VNXGRL - TOYOTA BOSHOKU HP",
	},
	{
		value: "VNXGS",
		name: "CT BORUN VIETNAM",
		label: "VNXGS - CT BORUN VIETNAM",
	},
	{
		value: "VNXGSL",
		name: "CT BORUN VIETNAM",
		label: "VNXGSL - CT BORUN VIETNAM",
	},
	{
		value: "VNXGT",
		name: "CT TRI WALL VINA",
		label: "VNXGT - CT TRI WALL VINA",
	},
	{
		value: "VNXGTL",
		name: "CT TRI WALL VINA",
		label: "VNXGTL - CT TRI WALL VINA",
	},
	{
		value: "VNXGU",
		name: "CT CAO SU YAMATO VN",
		label: "VNXGU - CT CAO SU YAMATO VN",
	},
	{
		value: "VNXGUL",
		name: "CT CAO SU YAMATO VN",
		label: "VNXGUL - CT CAO SU YAMATO VN",
	},
	{
		value: "VNXGV",
		name: "CT CN SEIKO VN",
		label: "VNXGV - CT CN SEIKO VN",
	},
	{
		value: "VNXGVL",
		name: "CT CN SEIKO VN",
		label: "VNXGVL - CT CN SEIKO VN",
	},
	{
		value: "VNXGW",
		name: "CT DTU KYOCERA VN",
		label: "VNXGW - CT DTU KYOCERA VN",
	},
	{
		value: "VNXGWL",
		name: "CT DTU KYOCERA VN",
		label: "VNXGWL - CT DTU KYOCERA VN",
	},
	{
		value: "VNXGX",
		name: "CT HIRAKAWA VN",
		label: "VNXGX - CT HIRAKAWA VN",
	},
	{
		value: "VNXGXL",
		name: "CT HIRAKAWA VN",
		label: "VNXGXL - CT HIRAKAWA VN",
	},
	{
		value: "VNXGY",
		name: "CT SHINEI CORONA VN",
		label: "VNXGY - CT SHINEI CORONA VN",
	},
	{
		value: "VNXGYL",
		name: "CT SHINEI CORONA VN",
		label: "VNXGYL - CT SHINEI CORONA VN",
	},
	{
		value: "VNXGZ",
		name: "CT SOLDER COAT VN",
		label: "VNXGZ - CT SOLDER COAT VN",
	},
	{
		value: "VNXGZL",
		name: "CT SOLDER COAT VN",
		label: "VNXGZL - CT SOLDER COAT VN",
	},
	{
		value: "VNXHA",
		name: "CT JOHOKU HP(TB)",
		label: "VNXHA - CT JOHOKU HP(TB)",
	},
	{
		value: "VNXHAL",
		name: "CT JOHOKU HP(TB)",
		label: "VNXHAL - CT JOHOKU HP(TB)",
	},
	{
		value: "VNXHB",
		name: "CHE BIEN TP THUY SAN",
		label: "VNXHB - CHE BIEN TP THUY SAN",
	},
	{
		value: "VNXHBL",
		name: "CHE BIEN TP THUY SAN",
		label: "VNXHBL - CHE BIEN TP THUY SAN",
	},
	{
		value: "VNXHC",
		name: "CT DO GO FUKUI VN",
		label: "VNXHC - CT DO GO FUKUI VN",
	},
	{
		value: "VNXHCL",
		name: "CT DO GO FUKUI VN",
		label: "VNXHCL - CT DO GO FUKUI VN",
	},
	{
		value: "VNXHD",
		name: "NISSEI ELECTRIC VN",
		label: "VNXHD - NISSEI ELECTRIC VN",
	},
	{
		value: "VNXHDL",
		name: "NISSEI ELECTRIC VN",
		label: "VNXHDL - NISSEI ELECTRIC VN",
	},
	{
		value: "VNXHE",
		name: "CT KOGANEI VN",
		label: "VNXHE - CT KOGANEI VN",
	},
	{
		value: "VNXHEL",
		name: "CT KOGANEI VN",
		label: "VNXHEL - CT KOGANEI VN",
	},
	{
		value: "VNXHF",
		name: "CT TAZMO VN",
		label: "VNXHF - CT TAZMO VN",
	},
	{
		value: "VNXHFL",
		name: "CT TAZMO VN",
		label: "VNXHFL - CT TAZMO VN",
	},
	{
		value: "VNXHG",
		name: "CT RIKA LONG HAU",
		label: "VNXHG - CT RIKA LONG HAU",
	},
	{
		value: "VNXHGL",
		name: "CT RIKA LONG HAU",
		label: "VNXHGL - CT RIKA LONG HAU",
	},
	{
		value: "VNXHH",
		name: "CT VIET FIBER",
		label: "VNXHH - CT VIET FIBER",
	},
	{
		value: "VNXHHL",
		name: "CT VIET FIBER",
		label: "VNXHHL - CT VIET FIBER",
	},
	{
		value: "VNXHI",
		name: "CANG XUAN HAI (HT)",
		label: "VNXHI - CANG XUAN HAI (HT)",
	},
	{
		value: "VNXHJ",
		name: "ALLIANCE ONE",
		label: "VNXHJ - ALLIANCE ONE",
	},
	{
		value: "VNXHJL",
		name: "ALLIANCE ONE",
		label: "VNXHJL - ALLIANCE ONE",
	},
	{
		value: "VNXHK",
		name: "NICDEC TOSOK PREC",
		label: "VNXHK - NICDEC TOSOK PREC",
	},
	{
		value: "VNXHKL",
		name: "NICDEC TOSOK PREC",
		label: "VNXHKL - NICDEC TOSOK PREC",
	},
	{
		value: "VNXHL",
		name: "HAILLIANG",
		label: "VNXHL - HAILLIANG",
	},
	{
		value: "VNXHLL",
		name: "HAILLIANG",
		label: "VNXHLL - HAILLIANG",
	},
	{
		value: "VNXHM",
		name: "FANG ZHENG",
		label: "VNXHM - FANG ZHENG",
	},
	{
		value: "VNXHML",
		name: "FANG ZHENG",
		label: "VNXHML - FANG ZHENG",
	},
	{
		value: "VNXHN",
		name: "NIESSEI ELECTRIC",
		label: "VNXHN - NIESSEI ELECTRIC",
	},
	{
		value: "VNXHNL",
		name: "NIESSEI ELECTRIC",
		label: "VNXHNL - NIESSEI ELECTRIC",
	},
	{
		value: "VNXHO",
		name: "EBISUYA",
		label: "VNXHO - EBISUYA",
	},
	{
		value: "VNXHOL",
		name: "EBISUYA",
		label: "VNXHOL - EBISUYA",
	},
	{
		value: "VNXHP",
		name: "VINMAY S.STELL",
		label: "VNXHP - VINMAY S.STELL",
	},
	{
		value: "VNXHPL",
		name: "VINMAY S.STELL",
		label: "VNXHPL - VINMAY S.STELL",
	},
	{
		value: "VNXHQ",
		name: "KING HAM",
		label: "VNXHQ - KING HAM",
	},
	{
		value: "VNXHQL",
		name: "KING HAM",
		label: "VNXHQL - KING HAM",
	},
	{
		value: "VNXHR",
		name: "ON ACCESSORIES",
		label: "VNXHR - ON ACCESSORIES",
	},
	{
		value: "VNXHRL",
		name: "ON ACCESSORIES",
		label: "VNXHRL - ON ACCESSORIES",
	},
	{
		value: "VNXHS",
		name: "TOYANAGE",
		label: "VNXHS - TOYANAGE",
	},
	{
		value: "VNXHSL",
		name: "TOYANAGE",
		label: "VNXHSL - TOYANAGE",
	},
	{
		value: "VNXHT",
		name: "BELLA",
		label: "VNXHT - BELLA",
	},
	{
		value: "VNXHTL",
		name: "BELLA",
		label: "VNXHTL - BELLA",
	},
	{
		value: "VNXHW",
		name: "MIDORI  FOOTWEAR",
		label: "VNXHW - MIDORI  FOOTWEAR",
	},
	{
		value: "VNXHWL",
		name: "MIDORI  FOOTWEAR",
		label: "VNXHWL - MIDORI  FOOTWEAR",
	},
	{
		value: "VNXHX",
		name: "INITATION VIET NAM",
		label: "VNXHX - INITATION VIET NAM",
	},
	{
		value: "VNXHXL",
		name: "INITATION VIET NAM",
		label: "VNXHXL - INITATION VIET NAM",
	},
	{
		value: "VNXHY",
		name: "CTCP VIETNAM MOC BAI",
		label: "VNXHY - CTCP VIETNAM MOC BAI",
	},
	{
		value: "VNXHYL",
		name: "CTCP VIETNAM MOC BAI",
		label: "VNXHYL - CTCP VIETNAM MOC BAI",
	},
	{
		value: "VNXHZ",
		name: "CT BAT LUA HUAXING",
		label: "VNXHZ - CT BAT LUA HUAXING",
	},
	{
		value: "VNXHZL",
		name: "CT BAT LUA HUAXING",
		label: "VNXHZL - CT BAT LUA HUAXING",
	},
	{
		value: "VNXIA",
		name: "CT VLMT PHUONG HOANG",
		label: "VNXIA - CT VLMT PHUONG HOANG",
	},
	{
		value: "VNXIAL",
		name: "CT VLMT PHUONG HOANG",
		label: "VNXIAL - CT VLMT PHUONG HOANG",
	},
	{
		value: "VNXIB",
		name: "CT SX BAO BI AMPAC",
		label: "VNXIB - CT SX BAO BI AMPAC",
	},
	{
		value: "VNXIBL",
		name: "CT SX BAO BI AMPAC",
		label: "VNXIBL - CT SX BAO BI AMPAC",
	},
	{
		value: "VNXIC",
		name: "CT MAY MAC JIAFA SOK",
		label: "VNXIC - CT MAY MAC JIAFA SOK",
	},
	{
		value: "VNXICL",
		name: "CT MAY MAC JIAFA SOK",
		label: "VNXICL - CT MAY MAC JIAFA SOK",
	},
	{
		value: "VNXID",
		name: "CT BAO BI NHUA HUADA",
		label: "VNXID - CT BAO BI NHUA HUADA",
	},
	{
		value: "VNXIDL",
		name: "CT BAO BI NHUA HUADA",
		label: "VNXIDL - CT BAO BI NHUA HUADA",
	},
	{
		value: "VNXIE",
		name: "CT NIFCO VIET NAM",
		label: "VNXIE - CT NIFCO VIET NAM",
	},
	{
		value: "VNXIEL",
		name: "CT NIFCO VIET NAM",
		label: "VNXIEL - CT NIFCO VIET NAM",
	},
	{
		value: "VNXIF",
		name: "CT KY THUAT DD",
		label: "VNXIF - CT KY THUAT DD",
	},
	{
		value: "VNXIFL",
		name: "CT KY THUAT DD",
		label: "VNXIFL - CT KY THUAT DD",
	},
	{
		value: "VNXIG",
		name: "CT ONG THEP SUJIA",
		label: "VNXIG - CT ONG THEP SUJIA",
	},
	{
		value: "VNXIGL",
		name: "CT ONG THEP SUJIA",
		label: "VNXIGL - CT ONG THEP SUJIA",
	},
	{
		value: "VNXIH",
		name: "CT PAYLOUD VN",
		label: "VNXIH - CT PAYLOUD VN",
	},
	{
		value: "VNXIHL",
		name: "CT PAYLOUD VN",
		label: "VNXIHL - CT PAYLOUD VN",
	},
	{
		value: "VNXII",
		name: "CT VLM A THAI LOI",
		label: "VNXII - CT VLM A THAI LOI",
	},
	{
		value: "VNXIIL",
		name: "CT VLM A THAI LOI",
		label: "VNXIIL - CT VLM A THAI LOI",
	},
	{
		value: "VNXIJ",
		name: "CT SUNRISE",
		label: "VNXIJ - CT SUNRISE",
	},
	{
		value: "VNXIJL",
		name: "CT SUNRISE",
		label: "VNXIJL - CT SUNRISE",
	},
	{
		value: "VNXIK",
		name: "CT NGU KIM HAILANG",
		label: "VNXIK - CT NGU KIM HAILANG",
	},
	{
		value: "VNXIKL",
		name: "CT NGU KIM HAILANG",
		label: "VNXIKL - CT NGU KIM HAILANG",
	},
	{
		value: "VNXIL",
		name: "CT NHUA XINSHENG",
		label: "VNXIL - CT NHUA XINSHENG",
	},
	{
		value: "VNXILL",
		name: "CT NHUA XINSHENG",
		label: "VNXILL - CT NHUA XINSHENG",
	},
	{
		value: "VNXIM",
		name: "CT QT CHAN GIA THANH",
		label: "VNXIM - CT QT CHAN GIA THANH",
	},
	{
		value: "VNXIML",
		name: "CT QT CHAN GIA THANH",
		label: "VNXIML - CT QT CHAN GIA THANH",
	},
	{
		value: "VNXIN",
		name: "CT CHERRY YEAR VN",
		label: "VNXIN - CT CHERRY YEAR VN",
	},
	{
		value: "VNXINL",
		name: "CT CHERRY YEAR VN",
		label: "VNXINL - CT CHERRY YEAR VN",
	},
	{
		value: "VNXINT",
		name: "LOI MO XIENG TREN ( MY LY )",
		label: "VNXINT - LOI MO XIENG TREN ( MY LY )",
	},
	{
		value: "VNXIO",
		name: "CT DA DUC TIN VN",
		label: "VNXIO - CT DA DUC TIN VN",
	},
	{
		value: "VNXIOL",
		name: "CT DA DUC TIN VN",
		label: "VNXIOL - CT DA DUC TIN VN",
	},
	{
		value: "VNXIP",
		name: "CT ICHIHIRO VIET NAM",
		label: "VNXIP - CT ICHIHIRO VIET NAM",
	},
	{
		value: "VNXIPL",
		name: "CT ICHIHIRO VIET NAM",
		label: "VNXIPL - CT ICHIHIRO VIET NAM",
	},
	{
		value: "VNXIQ",
		name: "CT KATAGIRY INDUSTRY",
		label: "VNXIQ - CT KATAGIRY INDUSTRY",
	},
	{
		value: "VNXIQL",
		name: "CT KATAGIRY INDUSTRY",
		label: "VNXIQL - CT KATAGIRY INDUSTRY",
	},
	{
		value: "VNXIR",
		name: "CT GIAY MAX FORTUNE",
		label: "VNXIR - CT GIAY MAX FORTUNE",
	},
	{
		value: "VNXIRL",
		name: "CT GIAY MAX FORTUNE",
		label: "VNXIRL - CT GIAY MAX FORTUNE",
	},
	{
		value: "VNXIS",
		name: "CT SAIGLASS HCM VN",
		label: "VNXIS - CT SAIGLASS HCM VN",
	},
	{
		value: "VNXISL",
		name: "CT SAIGLASS HCM VN",
		label: "VNXISL - CT SAIGLASS HCM VN",
	},
	{
		value: "VNXIT",
		name: "CT HAOJIAO VIET NAM",
		label: "VNXIT - CT HAOJIAO VIET NAM",
	},
	{
		value: "VNXITL",
		name: "CT HAOJIAO VIET NAM",
		label: "VNXITL - CT HAOJIAO VIET NAM",
	},
	{
		value: "VNXIU",
		name: "CT KODIM VIET",
		label: "VNXIU - CT KODIM VIET",
	},
	{
		value: "VNXIUL",
		name: "CT KODIM VIET",
		label: "VNXIUL - CT KODIM VIET",
	},
	{
		value: "VNXIV",
		name: "CT RANGER VIET NAM",
		label: "VNXIV - CT RANGER VIET NAM",
	},
	{
		value: "VNXIVL",
		name: "CT RANGER VIET NAM",
		label: "VNXIVL - CT RANGER VIET NAM",
	},
	{
		value: "VNXIW",
		name: "CT QTE VIEN DONG",
		label: "VNXIW - CT QTE VIEN DONG",
	},
	{
		value: "VNXIWL",
		name: "CT QTE VIEN DONG",
		label: "VNXIWL - CT QTE VIEN DONG",
	},
	{
		value: "VNXIX",
		name: "CT TOPTIPE HUABANG",
		label: "VNXIX - CT TOPTIPE HUABANG",
	},
	{
		value: "VNXIXL",
		name: "CT TOPTIPE HUABANG",
		label: "VNXIXL - CT TOPTIPE HUABANG",
	},
	{
		value: "VNXIY",
		name: "CT CAO SU YONGJIN",
		label: "VNXIY - CT CAO SU YONGJIN",
	},
	{
		value: "VNXIYL",
		name: "CT CAO SU YONGJIN",
		label: "VNXIYL - CT CAO SU YONGJIN",
	},
	{
		value: "VNXIZ",
		name: "CT BROTEX VIETNAM",
		label: "VNXIZ - CT BROTEX VIETNAM",
	},
	{
		value: "VNXIZL",
		name: "CT BROTEX VIETNAM",
		label: "VNXIZL - CT BROTEX VIETNAM",
	},
	{
		value: "VNXJA",
		name: "CT GAIN LUCKY",
		label: "VNXJA - CT GAIN LUCKY",
	},
	{
		value: "VNXJAL",
		name: "CT GAIN LUCKY",
		label: "VNXJAL - CT GAIN LUCKY",
	},
	{
		value: "VNXJB",
		name: "CT VINH DU",
		label: "VNXJB - CT VINH DU",
	},
	{
		value: "VNXJBL",
		name: "CT VINH DU",
		label: "VNXJBL - CT VINH DU",
	},
	{
		value: "VNXJC",
		name: "CT DAY DAN SUMI VN",
		label: "VNXJC - CT DAY DAN SUMI VN",
	},
	{
		value: "VNXJCL",
		name: "CT DAY DAN SUMI VN",
		label: "VNXJCL - CT DAY DAN SUMI VN",
	},
	{
		value: "VNXJD",
		name: "SHIKOKU CABLE VN",
		label: "VNXJD - SHIKOKU CABLE VN",
	},
	{
		value: "VNXJDL",
		name: "SHIKOKU CABLE VN",
		label: "VNXJDL - SHIKOKU CABLE VN",
	},
	{
		value: "VNXJE",
		name: "CT DTU TACHIBANA",
		label: "VNXJE - CT DTU TACHIBANA",
	},
	{
		value: "VNXJEL",
		name: "CT DTU TACHIBANA",
		label: "VNXJEL - CT DTU TACHIBANA",
	},
	{
		value: "VNXJF",
		name: "POME INTERNATIONAL",
		label: "VNXJF - POME INTERNATIONAL",
	},
	{
		value: "VNXJFL",
		name: "POME INTERNATIONAL",
		label: "VNXJFL - POME INTERNATIONAL",
	},
	{
		value: "VNXJG",
		name: "CT YOKOWO VIETNAM",
		label: "VNXJG - CT YOKOWO VIETNAM",
	},
	{
		value: "VNXJGL",
		name: "CT YOKOWO VIETNAM",
		label: "VNXJGL - CT YOKOWO VIETNAM",
	},
	{
		value: "VNXJH",
		name: "CT KALBAS VIET NAM",
		label: "VNXJH - CT KALBAS VIET NAM",
	},
	{
		value: "VNXJHL",
		name: "CT KALBAS VIET NAM",
		label: "VNXJHL - CT KALBAS VIET NAM",
	},
	{
		value: "VNXJI",
		name: "CT FINETEK VIET NAM",
		label: "VNXJI - CT FINETEK VIET NAM",
	},
	{
		value: "VNXJIL",
		name: "CT FINETEK VIET NAM",
		label: "VNXJIL - CT FINETEK VIET NAM",
	},
	{
		value: "VNXJJ",
		name: "CT EIDAI VIET NAM",
		label: "VNXJJ - CT EIDAI VIET NAM",
	},
	{
		value: "VNXJJL",
		name: "CT EIDAI VIET NAM",
		label: "VNXJJL - CT EIDAI VIET NAM",
	},
	{
		value: "VNXJK",
		name: "CT SHOWA DENKO",
		label: "VNXJK - CT SHOWA DENKO",
	},
	{
		value: "VNXJKL",
		name: "CT SHOWA DENKO",
		label: "VNXJKL - CT SHOWA DENKO",
	},
	{
		value: "VNXJL",
		name: "CT FUJIGEN VIET NAM",
		label: "VNXJL - CT FUJIGEN VIET NAM",
	},
	{
		value: "VNXJLL",
		name: "CT FUJIGEN VIET NAM",
		label: "VNXJLL - CT FUJIGEN VIET NAM",
	},
	{
		value: "VNXJM",
		name: "CT UEDA VIET NAM",
		label: "VNXJM - CT UEDA VIET NAM",
	},
	{
		value: "VNXJML",
		name: "CT UEDA VIET NAM",
		label: "VNXJML - CT UEDA VIET NAM",
	},
	{
		value: "VNXJN",
		name: "CT MARUKOH PAPER VN",
		label: "VNXJN - CT MARUKOH PAPER VN",
	},
	{
		value: "VNXJNL",
		name: "CT MARUKOH PAPER VN",
		label: "VNXJNL - CT MARUKOH PAPER VN",
	},
	{
		value: "VNXJO",
		name: "CT OSAWA VIET NAM",
		label: "VNXJO - CT OSAWA VIET NAM",
	},
	{
		value: "VNXJOL",
		name: "CT OSAWA VIET NAM",
		label: "VNXJOL - CT OSAWA VIET NAM",
	},
	{
		value: "VNXJP",
		name: "CT ANAM ELECTRONICS",
		label: "VNXJP - CT ANAM ELECTRONICS",
	},
	{
		value: "VNXJPL",
		name: "CT ANAM ELECTRONICS",
		label: "VNXJPL - CT ANAM ELECTRONICS",
	},
	{
		value: "VNXJQ",
		name: "CT KEYRIN TELECOM VN",
		label: "VNXJQ - CT KEYRIN TELECOM VN",
	},
	{
		value: "VNXJQL",
		name: "CT KEYRIN TELECOM VN",
		label: "VNXJQL - CT KEYRIN TELECOM VN",
	},
	{
		value: "VNXJV",
		name: "CT MCNEX VINA",
		label: "VNXJV - CT MCNEX VINA",
	},
	{
		value: "VNXJVL",
		name: "CT MCNEX VINA",
		label: "VNXJVL - CT MCNEX VINA",
	},
	{
		value: "VNXJW",
		name: "CT SAKURAI VIET NAM",
		label: "VNXJW - CT SAKURAI VIET NAM",
	},
	{
		value: "VNXJWL",
		name: "CT SAKURAI VIET NAM",
		label: "VNXJWL - CT SAKURAI VIET NAM",
	},
	{
		value: "VNXJX",
		name: "CT YOTSUBA DRESS VN",
		label: "VNXJX - CT YOTSUBA DRESS VN",
	},
	{
		value: "VNXJXL",
		name: "CT YOTSUBA DRESS VN",
		label: "VNXJXL - CT YOTSUBA DRESS VN",
	},
	{
		value: "VNXJY",
		name: "CHUANG SHENG OPTCIAL",
		label: "VNXJY - CHUANG SHENG OPTCIAL",
	},
	{
		value: "VNXJYL",
		name: "CHUANG SHENG OPTCIAL",
		label: "VNXJYL - CHUANG SHENG OPTCIAL",
	},
	{
		value: "VNXKA",
		name: "CT SETO VIET NAM",
		label: "VNXKA - CT SETO VIET NAM",
	},
	{
		value: "VNXKAL",
		name: "CT SETO VIET NAM",
		label: "VNXKAL - CT SETO VIET NAM",
	},
	{
		value: "VNXKB",
		name: "CT DAIWA VIET NAM",
		label: "VNXKB - CT DAIWA VIET NAM",
	},
	{
		value: "VNXKBL",
		name: "CT DAIWA VIET NAM",
		label: "VNXKBL - CT DAIWA VIET NAM",
	},
	{
		value: "VNXKC",
		name: "CT MABUCHI DA NANG",
		label: "VNXKC - CT MABUCHI DA NANG",
	},
	{
		value: "VNXKCL",
		name: "CT MABUCHI DA NANG",
		label: "VNXKCL - CT MABUCHI DA NANG",
	},
	{
		value: "VNXKD",
		name: "CT HOSO VIET NAM",
		label: "VNXKD - CT HOSO VIET NAM",
	},
	{
		value: "VNXKDL",
		name: "CT HOSO VIET NAM",
		label: "VNXKDL - CT HOSO VIET NAM",
	},
	{
		value: "VNXKE",
		name: "CT KANE M DA NANG",
		label: "VNXKE - CT KANE M DA NANG",
	},
	{
		value: "VNXKEL",
		name: "CT KANE M DA NANG",
		label: "VNXKEL - CT KANE M DA NANG",
	},
	{
		value: "VNXKF",
		name: "CT YURI ABC DA NANG",
		label: "VNXKF - CT YURI ABC DA NANG",
	},
	{
		value: "VNXKFL",
		name: "CT YURI ABC DA NANG",
		label: "VNXKFL - CT YURI ABC DA NANG",
	},
	{
		value: "VNXKG",
		name: "CT VIET NAM KANZAKI",
		label: "VNXKG - CT VIET NAM KANZAKI",
	},
	{
		value: "VNXKGL",
		name: "CT VIET NAM KANZAKI",
		label: "VNXKGL - CT VIET NAM KANZAKI",
	},
	{
		value: "VNXKH",
		name: "CT FUKUI VIET NAM",
		label: "VNXKH - CT FUKUI VIET NAM",
	},
	{
		value: "VNXKHL",
		name: "CT FUKUI VIET NAM",
		label: "VNXKHL - CT FUKUI VIET NAM",
	},
	{
		value: "VNXKI",
		name: "CT OISHI INDUSTRIES",
		label: "VNXKI - CT OISHI INDUSTRIES",
	},
	{
		value: "VNXKIL",
		name: "CT OISHI INDUSTRIES",
		label: "VNXKIL - CT OISHI INDUSTRIES",
	},
	{
		value: "VNXKJ",
		name: "CT DA NANG TELALA",
		label: "VNXKJ - CT DA NANG TELALA",
	},
	{
		value: "VNXKJL",
		name: "CT DA NANG TELALA",
		label: "VNXKJL - CT DA NANG TELALA",
	},
	{
		value: "VNXKK",
		name: "CT MAEDA NAME DANANG",
		label: "VNXKK - CT MAEDA NAME DANANG",
	},
	{
		value: "VNXKKL",
		name: "CT MAEDA NAME DANANG",
		label: "VNXKKL - CT MAEDA NAME DANANG",
	},
	{
		value: "VNXKL",
		name: "CT NITTO JOKASO VN",
		label: "VNXKL - CT NITTO JOKASO VN",
	},
	{
		value: "VNXKLL",
		name: "CT NITTO JOKASO VN",
		label: "VNXKLL - CT NITTO JOKASO VN",
	},
	{
		value: "VNXKM",
		name: "CT NUI CAO",
		label: "VNXKM - CT NUI CAO",
	},
	{
		value: "VNXKML",
		name: "CT NUI CAO",
		label: "VNXKML - CT NUI CAO",
	},
	{
		value: "VNXKN",
		name: "TOKYO KEIKI PREC",
		label: "VNXKN - TOKYO KEIKI PREC",
	},
	{
		value: "VNXKNL",
		name: "TOKYO KEIKI PREC",
		label: "VNXKNL - TOKYO KEIKI PREC",
	},
	{
		value: "VNXKO",
		name: "CT SETO SEISAKUSHO",
		label: "VNXKO - CT SETO SEISAKUSHO",
	},
	{
		value: "VNXKOL",
		name: "CT SETO SEISAKUSHO",
		label: "VNXKOL - CT SETO SEISAKUSHO",
	},
	{
		value: "VNXKP",
		name: "CT SINARAN VN",
		label: "VNXKP - CT SINARAN VN",
	},
	{
		value: "VNXKPL",
		name: "CT SINARAN VN",
		label: "VNXKPL - CT SINARAN VN",
	},
	{
		value: "VNXKQ",
		name: "CT TTTI DA NANG",
		label: "VNXKQ - CT TTTI DA NANG",
	},
	{
		value: "VNXKQL",
		name: "CT TTTI DA NANG",
		label: "VNXKQL - CT TTTI DA NANG",
	},
	{
		value: "VNXKR",
		name: "SX GANG TAY SP BHLD",
		label: "VNXKR - SX GANG TAY SP BHLD",
	},
	{
		value: "VNXKRL",
		name: "SX GANG TAY SP BHLD",
		label: "VNXKRL - SX GANG TAY SP BHLD",
	},
	{
		value: "VNXKS",
		name: "FUJIKURA AUTOMOTIVE",
		label: "VNXKS - FUJIKURA AUTOMOTIVE",
	},
	{
		value: "VNXKSL",
		name: "FUJIKURA AUTOMOTIVE",
		label: "VNXKSL - FUJIKURA AUTOMOTIVE",
	},
	{
		value: "VNXKT",
		name: "CT VN TOKAI",
		label: "VNXKT - CT VN TOKAI",
	},
	{
		value: "VNXKTL",
		name: "CT VN TOKAI",
		label: "VNXKTL - CT VN TOKAI",
	},
	{
		value: "VNXKU",
		name: "CT DET MAY ECLAT VN",
		label: "VNXKU - CT DET MAY ECLAT VN",
	},
	{
		value: "VNXKUL",
		name: "CT DET MAY ECLAT VN",
		label: "VNXKUL - CT DET MAY ECLAT VN",
	},
	{
		value: "VNXKV",
		name: "ADVANCED MULTITECH",
		label: "VNXKV - ADVANCED MULTITECH",
	},
	{
		value: "VNXKVL",
		name: "ADVANCED MULTITECH",
		label: "VNXKVL - ADVANCED MULTITECH",
	},
	{
		value: "VNXKW",
		name: "CTSX ONG THEP K.HAN",
		label: "VNXKW - CTSX ONG THEP K.HAN",
	},
	{
		value: "VNXKWL",
		name: "CTSX ONG THEP K.HAN",
		label: "VNXKWL - CTSX ONG THEP K.HAN",
	},
	{
		value: "VNXKX",
		name: "CT HARADA INDUSTRIES",
		label: "VNXKX - CT HARADA INDUSTRIES",
	},
	{
		value: "VNXKXL",
		name: "CT HARADA INDUSTRIES",
		label: "VNXKXL - CT HARADA INDUSTRIES",
	},
	{
		value: "VNXKY",
		name: "CT YUPOONG VN",
		label: "VNXKY - CT YUPOONG VN",
	},
	{
		value: "VNXKYL",
		name: "CT YUPOONG VN",
		label: "VNXKYL - CT YUPOONG VN",
	},
	{
		value: "VNXKZ",
		name: "NEC TOKIN ELECTRONIC",
		label: "VNXKZ - NEC TOKIN ELECTRONIC",
	},
	{
		value: "VNXKZL",
		name: "NEC TOKIN ELECTRONIC",
		label: "VNXKZL - NEC TOKIN ELECTRONIC",
	},
	{
		value: "VNXLA",
		name: "CT VEGA FASHIONE",
		label: "VNXLA - CT VEGA FASHIONE",
	},
	{
		value: "VNXLAL",
		name: "CT VEGA FASHIONE",
		label: "VNXLAL - CT VEGA FASHIONE",
	},
	{
		value: "VNXLB",
		name: "CT SEORIM",
		label: "VNXLB - CT SEORIM",
	},
	{
		value: "VNXLBL",
		name: "CT SEORIM",
		label: "VNXLBL - CT SEORIM",
	},
	{
		value: "VNXLC",
		name: "CT FC VIETNAM",
		label: "VNXLC - CT FC VIETNAM",
	},
	{
		value: "VNXLCL",
		name: "CT FC VIETNAM",
		label: "VNXLCL - CT FC VIETNAM",
	},
	{
		value: "VNXLD",
		name: "CT TOMIYA SUMMIT",
		label: "VNXLD - CT TOMIYA SUMMIT",
	},
	{
		value: "VNXLDL",
		name: "CT TOMIYA SUMMIT",
		label: "VNXLDL - CT TOMIYA SUMMIT",
	},
	{
		value: "VNXLF",
		name: "CT AUREOLE BCD",
		label: "VNXLF - CT AUREOLE BCD",
	},
	{
		value: "VNXLFL",
		name: "CT AUREOLE BCD",
		label: "VNXLFL - CT AUREOLE BCD",
	},
	{
		value: "VNXLG",
		name: "CT FUJIKURA VIETNAM",
		label: "VNXLG - CT FUJIKURA VIETNAM",
	},
	{
		value: "VNXLGL",
		name: "CT FUJIKURA VIETNAM",
		label: "VNXLGL - CT FUJIKURA VIETNAM",
	},
	{
		value: "VNXLH",
		name: "CT TAEKWANG MTC",
		label: "VNXLH - CT TAEKWANG MTC",
	},
	{
		value: "VNXLHL",
		name: "CT TAEKWANG MTC",
		label: "VNXLHL - CT TAEKWANG MTC",
	},
	{
		value: "VNXLI",
		name: "CT PEAKTOP VN",
		label: "VNXLI - CT PEAKTOP VN",
	},
	{
		value: "VNXLIL",
		name: "CT PEAKTOP VN",
		label: "VNXLIL - CT PEAKTOP VN",
	},
	{
		value: "VNXLJ",
		name: "CT OKEN SEIKO VN",
		label: "VNXLJ - CT OKEN SEIKO VN",
	},
	{
		value: "VNXLJL",
		name: "CT OKEN SEIKO VN",
		label: "VNXLJL - CT OKEN SEIKO VN",
	},
	{
		value: "VNXLK",
		name: "AUREOLE CHEMICAL PRD",
		label: "VNXLK - AUREOLE CHEMICAL PRD",
	},
	{
		value: "VNXLKL",
		name: "AUREOLE CHEMICAL PRD",
		label: "VNXLKL - AUREOLE CHEMICAL PRD",
	},
	{
		value: "VNXLL",
		name: "CT AIDO INDUSTRY VN",
		label: "VNXLL - CT AIDO INDUSTRY VN",
	},
	{
		value: "VNXLLL",
		name: "CT AIDO INDUSTRY VN",
		label: "VNXLLL - CT AIDO INDUSTRY VN",
	},
	{
		value: "VNXLM",
		name: "CT KY THUAT MURO VN",
		label: "VNXLM - CT KY THUAT MURO VN",
	},
	{
		value: "VNXLML",
		name: "CT KY THUAT MURO VN",
		label: "VNXLML - CT KY THUAT MURO VN",
	},
	{
		value: "VNXLN",
		name: "CT SHIRAI VN",
		label: "VNXLN - CT SHIRAI VN",
	},
	{
		value: "VNXLNL",
		name: "CT SHIRAI VN",
		label: "VNXLNL - CT SHIRAI VN",
	},
	{
		value: "VNXLO",
		name: "CT UNIPAX",
		label: "VNXLO - CT UNIPAX",
	},
	{
		value: "VNXLOL",
		name: "CT UNIPAX",
		label: "VNXLOL - CT UNIPAX",
	},
	{
		value: "VNXLOT",
		name: "CUA KHAU BUU DIEN LONG XUYEN (AN GIANG)",
		label: "VNXLOT - CUA KHAU BUU DIEN LONG XUYEN (AN GIANG)",
	},
	{
		value: "VNXLP",
		name: "CT MAY TINH FUJITSU",
		label: "VNXLP - CT MAY TINH FUJITSU",
	},
	{
		value: "VNXLPL",
		name: "CT MAY TINH FUJITSU",
		label: "VNXLPL - CT MAY TINH FUJITSU",
	},
	{
		value: "VNXLR",
		name: "CT VN MEIWA",
		label: "VNXLR - CT VN MEIWA",
	},
	{
		value: "VNXLRL",
		name: "CT VN MEIWA",
		label: "VNXLRL - CT VN MEIWA",
	},
	{
		value: "VNXLS",
		name: "CT CHANG SHIN VN",
		label: "VNXLS - CT CHANG SHIN VN",
	},
	{
		value: "VNXLSL",
		name: "CT CHANG SHIN VN",
		label: "VNXLSL - CT CHANG SHIN VN",
	},
	{
		value: "VNXLT",
		name: "HUNG NHIEP POU CHEN",
		label: "VNXLT - HUNG NHIEP POU CHEN",
	},
	{
		value: "VNXLTL",
		name: "HUNG NHIEP POU CHEN",
		label: "VNXLTL - HUNG NHIEP POU CHEN",
	},
	{
		value: "VNXLU",
		name: "CT TOHOKU CHEMICAL",
		label: "VNXLU - CT TOHOKU CHEMICAL",
	},
	{
		value: "VNXLUL",
		name: "CT TOHOKU CHEMICAL",
		label: "VNXLUL - CT TOHOKU CHEMICAL",
	},
	{
		value: "VNXLW",
		name: "WHITTIER WOOD PRODUC",
		label: "VNXLW - WHITTIER WOOD PRODUC",
	},
	{
		value: "VNXLWL",
		name: "WHITTIER WOOD PRODUC",
		label: "VNXLWL - WHITTIER WOOD PRODUC",
	},
	{
		value: "VNXLX",
		name: "ASIA GARMENT MANUFAC",
		label: "VNXLX - ASIA GARMENT MANUFAC",
	},
	{
		value: "VNXLXL",
		name: "ASIA GARMENT MANUFAC",
		label: "VNXLXL - ASIA GARMENT MANUFAC",
	},
	{
		value: "VNXLY",
		name: "VINA MELT TECHNOS",
		label: "VNXLY - VINA MELT TECHNOS",
	},
	{
		value: "VNXLYL",
		name: "VINA MELT TECHNOS",
		label: "VNXLYL - VINA MELT TECHNOS",
	},
	{
		value: "VNXLZ",
		name: "MABUCHI MOTOR VN",
		label: "VNXLZ - MABUCHI MOTOR VN",
	},
	{
		value: "VNXLZL",
		name: "MABUCHI MOTOR VN",
		label: "VNXLZL - MABUCHI MOTOR VN",
	},
	{
		value: "VNXMA",
		name: "CT RITEK VN",
		label: "VNXMA - CT RITEK VN",
	},
	{
		value: "VNXMAL",
		name: "CT RITEK VN",
		label: "VNXMAL - CT RITEK VN",
	},
	{
		value: "VNXMB",
		name: "KIM CUONG SAO SANG",
		label: "VNXMB - KIM CUONG SAO SANG",
	},
	{
		value: "VNXMBL",
		name: "KIM CUONG SAO SANG",
		label: "VNXMBL - KIM CUONG SAO SANG",
	},
	{
		value: "VNXMC",
		name: "CT FIGLA VIET NAM",
		label: "VNXMC - CT FIGLA VIET NAM",
	},
	{
		value: "VNXMCL",
		name: "CT FIGLA VIET NAM",
		label: "VNXMCL - CT FIGLA VIET NAM",
	},
	{
		value: "VNXMD",
		name: "GIAY TAEKWANG VINA",
		label: "VNXMD - GIAY TAEKWANG VINA",
	},
	{
		value: "VNXMDL",
		name: "GIAY TAEKWANG VINA",
		label: "VNXMDL - GIAY TAEKWANG VINA",
	},
	{
		value: "VNXME",
		name: "ARTUS SCIENTIFIC",
		label: "VNXME - ARTUS SCIENTIFIC",
	},
	{
		value: "VNXMEL",
		name: "ARTUS SCIENTIFIC",
		label: "VNXMEL - ARTUS SCIENTIFIC",
	},
	{
		value: "VNXMF",
		name: "CT ON SEMICONDUCTOR",
		label: "VNXMF - CT ON SEMICONDUCTOR",
	},
	{
		value: "VNXMFL",
		name: "CT ON SEMICONDUCTOR",
		label: "VNXMFL - CT ON SEMICONDUCTOR",
	},
	{
		value: "VNXMG",
		name: "CT SPITFIRE CONTROLS",
		label: "VNXMG - CT SPITFIRE CONTROLS",
	},
	{
		value: "VNXMGL",
		name: "CT SPITFIRE CONTROLS",
		label: "VNXMGL - CT SPITFIRE CONTROLS",
	},
	{
		value: "VNXMH",
		name: "CT JIANGSU JING MENG",
		label: "VNXMH - CT JIANGSU JING MENG",
	},
	{
		value: "VNXMHL",
		name: "CT JIANGSU JING MENG",
		label: "VNXMHL - CT JIANGSU JING MENG",
	},
	{
		value: "VNXMI",
		name: "CT NEW VN",
		label: "VNXMI - CT NEW VN",
	},
	{
		value: "VNXMIL",
		name: "CT NEW VN",
		label: "VNXMIL - CT NEW VN",
	},
	{
		value: "VNXMJ",
		name: "CT EMARALD BLUE VN",
		label: "VNXMJ - CT EMARALD BLUE VN",
	},
	{
		value: "VNXMJL",
		name: "CT EMARALD BLUE VN",
		label: "VNXMJL - CT EMARALD BLUE VN",
	},
	{
		value: "VNXMK",
		name: "CT QTE FLEMING",
		label: "VNXMK - CT QTE FLEMING",
	},
	{
		value: "VNXMKL",
		name: "CT QTE FLEMING",
		label: "VNXMKL - CT QTE FLEMING",
	},
	{
		value: "VNXML",
		name: "CT WATABE WEDDING VN",
		label: "VNXML - CT WATABE WEDDING VN",
	},
	{
		value: "VNXMLL",
		name: "CT WATABE WEDDING VN",
		label: "VNXMLL - CT WATABE WEDDING VN",
	},
	{
		value: "VNXMM",
		name: "CT TNHH MATSUYA RD",
		label: "VNXMM - CT TNHH MATSUYA RD",
	},
	{
		value: "VNXMML",
		name: "CT TNHH MATSUYA RD",
		label: "VNXMML - CT TNHH MATSUYA RD",
	},
	{
		value: "VNXMN",
		name: "CT TNHH SHISEIDO VN",
		label: "VNXMN - CT TNHH SHISEIDO VN",
	},
	{
		value: "VNXMNL",
		name: "CT TNHH SHISEIDO VN",
		label: "VNXMNL - CT TNHH SHISEIDO VN",
	},
	{
		value: "VNXMNT",
		name: "CUA KHAU XIN MAN (HA GIANG)",
		label: "VNXMNT - CUA KHAU XIN MAN (HA GIANG)",
	},
	{
		value: "VNXMO",
		name: "CT TNHH KUREHA VN",
		label: "VNXMO - CT TNHH KUREHA VN",
	},
	{
		value: "VNXMOL",
		name: "CT TNHH KUREHA VN",
		label: "VNXMOL - CT TNHH KUREHA VN",
	},
	{
		value: "VNXMP",
		name: "CT SPCN TOSHIBA ASIA",
		label: "VNXMP - CT SPCN TOSHIBA ASIA",
	},
	{
		value: "VNXMPL",
		name: "CT SPCN TOSHIBA ASIA",
		label: "VNXMPL - CT SPCN TOSHIBA ASIA",
	},
	{
		value: "VNXMQ",
		name: "CT MORITO VN",
		label: "VNXMQ - CT MORITO VN",
	},
	{
		value: "VNXMQL",
		name: "CT MORITO VN",
		label: "VNXMQL - CT MORITO VN",
	},
	{
		value: "VNXMR",
		name: "CT DAIKAN VN",
		label: "VNXMR - CT DAIKAN VN",
	},
	{
		value: "VNXMRL",
		name: "CT DAIKAN VN",
		label: "VNXMRL - CT DAIKAN VN",
	},
	{
		value: "VNXMS",
		name: "CT VN CREATE MEDIC",
		label: "VNXMS - CT VN CREATE MEDIC",
	},
	{
		value: "VNXMSL",
		name: "CT VN CREATE MEDIC",
		label: "VNXMSL - CT VN CREATE MEDIC",
	},
	{
		value: "VNXMT",
		name: "CT CN BROTHER SAIGON",
		label: "VNXMT - CT CN BROTHER SAIGON",
	},
	{
		value: "VNXMTL",
		name: "CT CN BROTHER SAIGON",
		label: "VNXMTL - CT CN BROTHER SAIGON",
	},
	{
		value: "VNXMU",
		name: "CT GOJO PAPER VN",
		label: "VNXMU - CT GOJO PAPER VN",
	},
	{
		value: "VNXMUL",
		name: "CT GOJO PAPER VN",
		label: "VNXMUL - CT GOJO PAPER VN",
	},
	{
		value: "VNXMV",
		name: "TBI TAN TIEN SUMIDEN",
		label: "VNXMV - TBI TAN TIEN SUMIDEN",
	},
	{
		value: "VNXMVL",
		name: "TBI TAN TIEN SUMIDEN",
		label: "VNXMVL - TBI TAN TIEN SUMIDEN",
	},
	{
		value: "VNXMW",
		name: "CT MAJOR CRAFT VN",
		label: "VNXMW - CT MAJOR CRAFT VN",
	},
	{
		value: "VNXMWL",
		name: "CT MAJOR CRAFT VN",
		label: "VNXMWL - CT MAJOR CRAFT VN",
	},
	{
		value: "VNXMX",
		name: "CT MARIGOT VN",
		label: "VNXMX - CT MARIGOT VN",
	},
	{
		value: "VNXMXL",
		name: "CT MARIGOT VN",
		label: "VNXMXL - CT MARIGOT VN",
	},
	{
		value: "VNXMY",
		name: "CROWN ASIA LEATHER",
		label: "VNXMY - CROWN ASIA LEATHER",
	},
	{
		value: "VNXMYL",
		name: "CROWN ASIA LEATHER",
		label: "VNXMYL - CROWN ASIA LEATHER",
	},
	{
		value: "VNXMZ",
		name: "CT FUKUVI VN",
		label: "VNXMZ - CT FUKUVI VN",
	},
	{
		value: "VNXMZL",
		name: "CT FUKUVI VN",
		label: "VNXMZL - CT FUKUVI VN",
	},
	{
		value: "VNXNA",
		name: "CT NISSHIN FEIFUN",
		label: "VNXNA - CT NISSHIN FEIFUN",
	},
	{
		value: "VNXNAL",
		name: "CT NISSHIN FEIFUN",
		label: "VNXNAL - CT NISSHIN FEIFUN",
	},
	{
		value: "VNXNB",
		name: "CT SANOR ELECTRONICS",
		label: "VNXNB - CT SANOR ELECTRONICS",
	},
	{
		value: "VNXNBL",
		name: "CT SANOR ELECTRONICS",
		label: "VNXNBL - CT SANOR ELECTRONICS",
	},
	{
		value: "VNXNC",
		name: "CT LADE SUCCESS",
		label: "VNXNC - CT LADE SUCCESS",
	},
	{
		value: "VNXNCL",
		name: "CT LADE SUCCESS",
		label: "VNXNCL - CT LADE SUCCESS",
	},
	{
		value: "VNXND",
		name: "CT BELMONT",
		label: "VNXND - CT BELMONT",
	},
	{
		value: "VNXNDL",
		name: "CT BELMONT",
		label: "VNXNDL - CT BELMONT",
	},
	{
		value: "VNXNE",
		name: "CT LIXIL GLOBAL",
		label: "VNXNE - CT LIXIL GLOBAL",
	},
	{
		value: "VNXNEL",
		name: "CT LIXIL GLOBAL",
		label: "VNXNEL - CT LIXIL GLOBAL",
	},
	{
		value: "VNXNG",
		name: "CT TERUMO BCT VN",
		label: "VNXNG - CT TERUMO BCT VN",
	},
	{
		value: "VNXNGL",
		name: "CT TERUMO BCT VN",
		label: "VNXNGL - CT TERUMO BCT VN",
	},
	{
		value: "VNXNH",
		name: "CT NEOSYS VN",
		label: "VNXNH - CT NEOSYS VN",
	},
	{
		value: "VNXNHL",
		name: "CT NEOSYS VN",
		label: "VNXNHL - CT NEOSYS VN",
	},
	{
		value: "VNXNI",
		name: "CT PEGASU SHINAMOTO",
		label: "VNXNI - CT PEGASU SHINAMOTO",
	},
	{
		value: "VNXNIL",
		name: "CT PEGASU SHINAMOTO",
		label: "VNXNIL - CT PEGASU SHINAMOTO",
	},
	{
		value: "VNXNJ",
		name: "FUJI IMPULSE LONGDUC",
		label: "VNXNJ - FUJI IMPULSE LONGDUC",
	},
	{
		value: "VNXNJL",
		name: "FUJI IMPULSE LONGDUC",
		label: "VNXNJL - FUJI IMPULSE LONGDUC",
	},
	{
		value: "VNXNK",
		name: "CT NAGAE VN",
		label: "VNXNK - CT NAGAE VN",
	},
	{
		value: "VNXNKL",
		name: "CT NAGAE VN",
		label: "VNXNKL - CT NAGAE VN",
	},
	{
		value: "VNXNL",
		name: "CT FUKUOKARASHI VN",
		label: "VNXNL - CT FUKUOKARASHI VN",
	},
	{
		value: "VNXNLL",
		name: "CT FUKUOKARASHI VN",
		label: "VNXNLL - CT FUKUOKARASHI VN",
	},
	{
		value: "VNXNM",
		name: "CT HORY VN",
		label: "VNXNM - CT HORY VN",
	},
	{
		value: "VNXNML",
		name: "CT HORY VN",
		label: "VNXNML - CT HORY VN",
	},
	{
		value: "VNXNN",
		name: "CT PARAMOUNT BED VN",
		label: "VNXNN - CT PARAMOUNT BED VN",
	},
	{
		value: "VNXNNL",
		name: "CT PARAMOUNT BED VN",
		label: "VNXNNL - CT PARAMOUNT BED VN",
	},
	{
		value: "VNXNO",
		name: "CT OLYMPUS VN",
		label: "VNXNO - CT OLYMPUS VN",
	},
	{
		value: "VNXNOL",
		name: "CT OLYMPUS VN",
		label: "VNXNOL - CT OLYMPUS VN",
	},
	{
		value: "VNXNP",
		name: "CN AIDO INDUSTRY VN",
		label: "VNXNP - CN AIDO INDUSTRY VN",
	},
	{
		value: "VNXNPL",
		name: "CN AIDO INDUSTRY VN",
		label: "VNXNPL - CN AIDO INDUSTRY VN",
	},
	{
		value: "VNXNR",
		name: "CT PERIN ROSTAING VN",
		label: "VNXNR - CT PERIN ROSTAING VN",
	},
	{
		value: "VNXNRL",
		name: "CT PERIN ROSTAING VN",
		label: "VNXNRL - CT PERIN ROSTAING VN",
	},
	{
		value: "VNXNS",
		name: "CT AMAPEX",
		label: "VNXNS - CT AMAPEX",
	},
	{
		value: "VNXNSL",
		name: "CT AMAPEX",
		label: "VNXNSL - CT AMAPEX",
	},
	{
		value: "VNXNT",
		name: "CT ACROWEL VN",
		label: "VNXNT - CT ACROWEL VN",
	},
	{
		value: "VNXNTL",
		name: "CT ACROWEL VN",
		label: "VNXNTL - CT ACROWEL VN",
	},
	{
		value: "VNXNU",
		name: "CT SX TOAN CAU LIXIL",
		label: "VNXNU - CT SX TOAN CAU LIXIL",
	},
	{
		value: "VNXNUL",
		name: "CT SX TOAN CAU LIXIL",
		label: "VNXNUL - CT SX TOAN CAU LIXIL",
	},
	{
		value: "VNXNV",
		name: "CT GC KIM LOAI NIC",
		label: "VNXNV - CT GC KIM LOAI NIC",
	},
	{
		value: "VNXNVL",
		name: "CT GC KIM LOAI NIC",
		label: "VNXNVL - CT GC KIM LOAI NIC",
	},
	{
		value: "VNXNW",
		name: "CT RICOH IMAGING VN",
		label: "VNXNW - CT RICOH IMAGING VN",
	},
	{
		value: "VNXNWL",
		name: "CT RICOH IMAGING VN",
		label: "VNXNWL - CT RICOH IMAGING VN",
	},
	{
		value: "VNXNX",
		name: "CT MALUGO VN",
		label: "VNXNX - CT MALUGO VN",
	},
	{
		value: "VNXNXL",
		name: "CT MALUGO VN",
		label: "VNXNXL - CT MALUGO VN",
	},
	{
		value: "VNXNY",
		name: "CT NAKAMURA VN",
		label: "VNXNY - CT NAKAMURA VN",
	},
	{
		value: "VNXNYL",
		name: "CT NAKAMURA VN",
		label: "VNXNYL - CT NAKAMURA VN",
	},
	{
		value: "VNXNZ",
		name: "CT HEIWA HYGIENE HN",
		label: "VNXNZ - CT HEIWA HYGIENE HN",
	},
	{
		value: "VNXNZL",
		name: "CT HEIWA HYGIENE HN",
		label: "VNXNZL - CT HEIWA HYGIENE HN",
	},
	{
		value: "VNXOA",
		name: "CT AKEBONO KASEI",
		label: "VNXOA - CT AKEBONO KASEI",
	},
	{
		value: "VNXOAL",
		name: "CT AKEBONO KASEI",
		label: "VNXOAL - CT AKEBONO KASEI",
	},
	{
		value: "VNXOB",
		name: "CT OSK METAL VN",
		label: "VNXOB - CT OSK METAL VN",
	},
	{
		value: "VNXOBL",
		name: "CT OSK METAL VN",
		label: "VNXOBL - CT OSK METAL VN",
	},
	{
		value: "VNXOH",
		name: "CT DO CHOI CHEEWAH",
		label: "VNXOH - CT DO CHOI CHEEWAH",
	},
	{
		value: "VNXOHL",
		name: "CT DO CHOI CHEEWAH",
		label: "VNXOHL - CT DO CHOI CHEEWAH",
	},
	{
		value: "VNXOI",
		name: "TOYO ELECTRICCONTROL",
		label: "VNXOI - TOYO ELECTRICCONTROL",
	},
	{
		value: "VNXOIL",
		name: "TOYO ELECTRICCONTROL",
		label: "VNXOIL - TOYO ELECTRICCONTROL",
	},
	{
		value: "VNXOJ",
		name: "CT DOO JUNG VN",
		label: "VNXOJ - CT DOO JUNG VN",
	},
	{
		value: "VNXOJL",
		name: "CT DOO JUNG VN",
		label: "VNXOJL - CT DOO JUNG VN",
	},
	{
		value: "VNXOK",
		name: "CT ESQUEL VN HBINH",
		label: "VNXOK - CT ESQUEL VN HBINH",
	},
	{
		value: "VNXOKL",
		name: "CT ESQUEL VN HBINH",
		label: "VNXOKL - CT ESQUEL VN HBINH",
	},
	{
		value: "VNXOL",
		name: "CT YOUNGFAST OPTO",
		label: "VNXOL - CT YOUNGFAST OPTO",
	},
	{
		value: "VNXOLL",
		name: "CT YOUNGFAST OPTO",
		label: "VNXOLL - CT YOUNGFAST OPTO",
	},
	{
		value: "VNXOM",
		name: "CT MEIKO ELECTRONICS",
		label: "VNXOM - CT MEIKO ELECTRONICS",
	},
	{
		value: "VNXOML",
		name: "CT MEIKO ELECTRONICS",
		label: "VNXOML - CT MEIKO ELECTRONICS",
	},
	{
		value: "VNXON",
		name: "CT KT LUMINOUS VN",
		label: "VNXON - CT KT LUMINOUS VN",
	},
	{
		value: "VNXONL",
		name: "CT KT LUMINOUS VN",
		label: "VNXONL - CT KT LUMINOUS VN",
	},
	{
		value: "VNXOO",
		name: "CT CNDT YAN TIN VN",
		label: "VNXOO - CT CNDT YAN TIN VN",
	},
	{
		value: "VNXOOL",
		name: "CT CNDT YAN TIN VN",
		label: "VNXOOL - CT CNDT YAN TIN VN",
	},
	{
		value: "VNXOP",
		name: "CT NOBLE VIET NAM",
		label: "VNXOP - CT NOBLE VIET NAM",
	},
	{
		value: "VNXOPL",
		name: "CT NOBLE VIET NAM",
		label: "VNXOPL - CT NOBLE VIET NAM",
	},
	{
		value: "VNXOQ",
		name: "CT HICEL VINA",
		label: "VNXOQ - CT HICEL VINA",
	},
	{
		value: "VNXOQL",
		name: "CT HICEL VINA",
		label: "VNXOQL - CT HICEL VINA",
	},
	{
		value: "VNXOR",
		name: "CT HNT VINA",
		label: "VNXOR - CT HNT VINA",
	},
	{
		value: "VNXORL",
		name: "CT HNT VINA",
		label: "VNXORL - CT HNT VINA",
	},
	{
		value: "VNXOS",
		name: "CT TAIPAI PACKING",
		label: "VNXOS - CT TAIPAI PACKING",
	},
	{
		value: "VNXOSL",
		name: "CT TAIPAI PACKING",
		label: "VNXOSL - CT TAIPAI PACKING",
	},
	{
		value: "VNXOT",
		name: "CT MIDORI APPAREL VN",
		label: "VNXOT - CT MIDORI APPAREL VN",
	},
	{
		value: "VNXOTL",
		name: "CT MIDORI APPAREL VN",
		label: "VNXOTL - CT MIDORI APPAREL VN",
	},
	{
		value: "VNXOX",
		name: "CT GOKO SPRING VN",
		label: "VNXOX - CT GOKO SPRING VN",
	},
	{
		value: "VNXOXL",
		name: "CT GOKO SPRING VN",
		label: "VNXOXL - CT GOKO SPRING VN",
	},
	{
		value: "VNXOY",
		name: "CT KISHIRO VN",
		label: "VNXOY - CT KISHIRO VN",
	},
	{
		value: "VNXOYL",
		name: "CT KISHIRO VN",
		label: "VNXOYL - CT KISHIRO VN",
	},
	{
		value: "VNXOZ",
		name: "CT RHYTHM PRECISION",
		label: "VNXOZ - CT RHYTHM PRECISION",
	},
	{
		value: "VNXOZL",
		name: "CT RHYTHM PRECISION",
		label: "VNXOZL - CT RHYTHM PRECISION",
	},
	{
		value: "VNXPA",
		name: "CT TOYADA GIKEN VN",
		label: "VNXPA - CT TOYADA GIKEN VN",
	},
	{
		value: "VNXPAL",
		name: "CT TOYADA GIKEN VN",
		label: "VNXPAL - CT TOYADA GIKEN VN",
	},
	{
		value: "VNXPB",
		name: "CT HONEST VN",
		label: "VNXPB - CT HONEST VN",
	},
	{
		value: "VNXPBL",
		name: "CT HONEST VN",
		label: "VNXPBL - CT HONEST VN",
	},
	{
		value: "VNXPC",
		name: "CT IKI CAST VN",
		label: "VNXPC - CT IKI CAST VN",
	},
	{
		value: "VNXPCL",
		name: "CT IKI CAST VN",
		label: "VNXPCL - CT IKI CAST VN",
	},
	{
		value: "VNXPD",
		name: "CT FUKOKU VN",
		label: "VNXPD - CT FUKOKU VN",
	},
	{
		value: "VNXPDL",
		name: "CT FUKOKU VN",
		label: "VNXPDL - CT FUKOKU VN",
	},
	{
		value: "VNXPE",
		name: "CT TAMRON OPTICAL",
		label: "VNXPE - CT TAMRON OPTICAL",
	},
	{
		value: "VNXPEL",
		name: "CT TAMRON OPTICAL",
		label: "VNXPEL - CT TAMRON OPTICAL",
	},
	{
		value: "VNXPF",
		name: "CT KOSAI VN",
		label: "VNXPF - CT KOSAI VN",
	},
	{
		value: "VNXPFL",
		name: "CT KOSAI VN",
		label: "VNXPFL - CT KOSAI VN",
	},
	{
		value: "VNXPG",
		name: "CT SPINDEX HN",
		label: "VNXPG - CT SPINDEX HN",
	},
	{
		value: "VNXPGL",
		name: "CT SPINDEX HN",
		label: "VNXPGL - CT SPINDEX HN",
	},
	{
		value: "VNXPH",
		name: "CT HOKUYO PRECISION",
		label: "VNXPH - CT HOKUYO PRECISION",
	},
	{
		value: "VNXPHL",
		name: "CT HOKUYO PRECISION",
		label: "VNXPHL - CT HOKUYO PRECISION",
	},
	{
		value: "VNXPI",
		name: "CT INOAC VN",
		label: "VNXPI - CT INOAC VN",
	},
	{
		value: "VNXPIL",
		name: "CT INOAC VN",
		label: "VNXPIL - CT INOAC VN",
	},
	{
		value: "VNXPJ",
		name: "CT VINA OSHOE",
		label: "VNXPJ - CT VINA OSHOE",
	},
	{
		value: "VNXPJL",
		name: "CT VINA OSHOE",
		label: "VNXPJL - CT VINA OSHOE",
	},
	{
		value: "VNXPK",
		name: "CT ASAHI INTECC HN",
		label: "VNXPK - CT ASAHI INTECC HN",
	},
	{
		value: "VNXPKL",
		name: "CT ASAHI INTECC HN",
		label: "VNXPKL - CT ASAHI INTECC HN",
	},
	{
		value: "VNXPL",
		name: "CT BEMAC PANELS",
		label: "VNXPL - CT BEMAC PANELS",
	},
	{
		value: "VNXPLL",
		name: "CT BEMAC PANELS",
		label: "VNXPLL - CT BEMAC PANELS",
	},
	{
		value: "VNXPM",
		name: "CT DENSO VN",
		label: "VNXPM - CT DENSO VN",
	},
	{
		value: "VNXPML",
		name: "CT DENSO VN",
		label: "VNXPML - CT DENSO VN",
	},
	{
		value: "VNXPN",
		name: "CT EIWO RUBBER MFG",
		label: "VNXPN - CT EIWO RUBBER MFG",
	},
	{
		value: "VNXPNL",
		name: "CT EIWO RUBBER MFG",
		label: "VNXPNL - CT EIWO RUBBER MFG",
	},
	{
		value: "VNXPNT",
		name: "CUA KHAU XAM PUN (HA GIANG)",
		label: "VNXPNT - CUA KHAU XAM PUN (HA GIANG)",
	},
	{
		value: "VNXPO",
		name: "CT ENPLAS VN",
		label: "VNXPO - CT ENPLAS VN",
	},
	{
		value: "VNXPOL",
		name: "CT ENPLAS VN",
		label: "VNXPOL - CT ENPLAS VN",
	},
	{
		value: "VNXPP",
		name: "FUJIPLA ENGINEERING",
		label: "VNXPP - FUJIPLA ENGINEERING",
	},
	{
		value: "VNXPPL",
		name: "FUJIPLA ENGINEERING",
		label: "VNXPPL - FUJIPLA ENGINEERING",
	},
	{
		value: "VNXPQ",
		name: "CT HOEV",
		label: "VNXPQ - CT HOEV",
	},
	{
		value: "VNXPQL",
		name: "CT HOEV",
		label: "VNXPQL - CT HOEV",
	},
	{
		value: "VNXPR",
		name: "CT HOYA GLASS DISK",
		label: "VNXPR - CT HOYA GLASS DISK",
	},
	{
		value: "VNXPRL",
		name: "CT HOYA GLASS DISK",
		label: "VNXPRL - CT HOYA GLASS DISK",
	},
	{
		value: "VNXPS",
		name: "CT IKEUCHI VN",
		label: "VNXPS - CT IKEUCHI VN",
	},
	{
		value: "VNXPSL",
		name: "CT IKEUCHI VN",
		label: "VNXPSL - CT IKEUCHI VN",
	},
	{
		value: "VNXPT",
		name: "CT JTEC HN",
		label: "VNXPT - CT JTEC HN",
	},
	{
		value: "VNXPTL",
		name: "CT JTEC HN",
		label: "VNXPTL - CT JTEC HN",
	},
	{
		value: "VNXPU",
		name: "CT KAI VN",
		label: "VNXPU - CT KAI VN",
	},
	{
		value: "VNXPUL",
		name: "CT KAI VN",
		label: "VNXPUL - CT KAI VN",
	},
	{
		value: "VNXPV",
		name: "CT KYOEI DIETECH VN",
		label: "VNXPV - CT KYOEI DIETECH VN",
	},
	{
		value: "VNXPVL",
		name: "CT KYOEI DIETECH VN",
		label: "VNXPVL - CT KYOEI DIETECH VN",
	},
	{
		value: "VNXPW",
		name: "CT MATSUO INDUSTRIES",
		label: "VNXPW - CT MATSUO INDUSTRIES",
	},
	{
		value: "VNXPWL",
		name: "CT MATSUO INDUSTRIES",
		label: "VNXPWL - CT MATSUO INDUSTRIES",
	},
	{
		value: "VNXPX",
		name: "CT BUTCHI MITSUBISHI",
		label: "VNXPX - CT BUTCHI MITSUBISHI",
	},
	{
		value: "VNXPXL",
		name: "CT BUTCHI MITSUBISHI",
		label: "VNXPXL - CT BUTCHI MITSUBISHI",
	},
	{
		value: "VNXPY",
		name: "CT MOLEX VN",
		label: "VNXPY - CT MOLEX VN",
	},
	{
		value: "VNXPYL",
		name: "CT MOLEX VN",
		label: "VNXPYL - CT MOLEX VN",
	},
	{
		value: "VNXPZ",
		name: "CT NAGATSU",
		label: "VNXPZ - CT NAGATSU",
	},
	{
		value: "VNXPZL",
		name: "CT NAGATSU",
		label: "VNXPZL - CT NAGATSU",
	},
	{
		value: "VNXQA",
		name: "NISSEI ELECTRONIC HN",
		label: "VNXQA - NISSEI ELECTRONIC HN",
	},
	{
		value: "VNXQAL",
		name: "NISSEI ELECTRONIC HN",
		label: "VNXQAL - NISSEI ELECTRONIC HN",
	},
	{
		value: "VNXQB",
		name: "CT OHARA PLASTICS VN",
		label: "VNXQB - CT OHARA PLASTICS VN",
	},
	{
		value: "VNXQBL",
		name: "CT OHARA PLASTICS VN",
		label: "VNXQBL - CT OHARA PLASTICS VN",
	},
	{
		value: "VNXQC",
		name: "PANASONIC SYS NETW",
		label: "VNXQC - PANASONIC SYS NETW",
	},
	{
		value: "VNXQCL",
		name: "PANASONIC SYS NETW",
		label: "VNXQCL - PANASONIC SYS NETW",
	},
	{
		value: "VNXQD",
		name: "CT RYONAN ELECTRIC",
		label: "VNXQD - CT RYONAN ELECTRIC",
	},
	{
		value: "VNXQDL",
		name: "CT RYONAN ELECTRIC",
		label: "VNXQDL - CT RYONAN ELECTRIC",
	},
	{
		value: "VNXQE",
		name: "CT SANKO SOKEN VN",
		label: "VNXQE - CT SANKO SOKEN VN",
	},
	{
		value: "VNXQEL",
		name: "CT SANKO SOKEN VN",
		label: "VNXQEL - CT SANKO SOKEN VN",
	},
	{
		value: "VNXQF",
		name: "CT SATO VN",
		label: "VNXQF - CT SATO VN",
	},
	{
		value: "VNXQFL",
		name: "CT SATO VN",
		label: "VNXQFL - CT SATO VN",
	},
	{
		value: "VNXQG",
		name: "CT SD VN",
		label: "VNXQG - CT SD VN",
	},
	{
		value: "VNXQGL",
		name: "CT SD VN",
		label: "VNXQGL - CT SD VN",
	},
	{
		value: "VNXQH",
		name: "CT SEED VN",
		label: "VNXQH - CT SEED VN",
	},
	{
		value: "VNXQHL",
		name: "CT SEED VN",
		label: "VNXQHL - CT SEED VN",
	},
	{
		value: "VNXQI",
		name: "CT LKIEN DTU SEI VN",
		label: "VNXQI - CT LKIEN DTU SEI VN",
	},
	{
		value: "VNXQIL",
		name: "CT LKIEN DTU SEI VN",
		label: "VNXQIL - CT LKIEN DTU SEI VN",
	},
	{
		value: "VNXQJ",
		name: "SUMITOMO HEAVY INDUS",
		label: "VNXQJ - SUMITOMO HEAVY INDUS",
	},
	{
		value: "VNXQJL",
		name: "SUMITOMO HEAVY INDUS",
		label: "VNXQJL - SUMITOMO HEAVY INDUS",
	},
	{
		value: "VNXQK",
		name: "CT SUMITOMO NACCO",
		label: "VNXQK - CT SUMITOMO NACCO",
	},
	{
		value: "VNXQKL",
		name: "CT SUMITOMO NACCO",
		label: "VNXQKL - CT SUMITOMO NACCO",
	},
	{
		value: "VNXQL",
		name: "SUNCALL TECHNOLOGY",
		label: "VNXQL - SUNCALL TECHNOLOGY",
	},
	{
		value: "VNXQLL",
		name: "SUNCALL TECHNOLOGY",
		label: "VNXQLL - SUNCALL TECHNOLOGY",
	},
	{
		value: "VNXQM",
		name: "CT SWCC SHOWA VN",
		label: "VNXQM - CT SWCC SHOWA VN",
	},
	{
		value: "VNXQML",
		name: "CT SWCC SHOWA VN",
		label: "VNXQML - CT SWCC SHOWA VN",
	},
	{
		value: "VNXQN",
		name: "TAKARA TOOL DIE HN",
		label: "VNXQN - TAKARA TOOL DIE HN",
	},
	{
		value: "VNXQNL",
		name: "TAKARA TOOL DIE HN",
		label: "VNXQNL - TAKARA TOOL DIE HN",
	},
	{
		value: "VNXQO",
		name: "CT TOA VN",
		label: "VNXQO - CT TOA VN",
	},
	{
		value: "VNXQOL",
		name: "CT TOA VN",
		label: "VNXQOL - CT TOA VN",
	},
	{
		value: "VNXQP",
		name: "CT TOKYO BYOKANE VN",
		label: "VNXQP - CT TOKYO BYOKANE VN",
	},
	{
		value: "VNXQPL",
		name: "CT TOKYO BYOKANE VN",
		label: "VNXQPL - CT TOKYO BYOKANE VN",
	},
	{
		value: "VNXQQ",
		name: "CT VN IRITANI",
		label: "VNXQQ - CT VN IRITANI",
	},
	{
		value: "VNXQQL",
		name: "CT VN IRITANI",
		label: "VNXQQL - CT VN IRITANI",
	},
	{
		value: "VNXQR",
		name: "CT MHI AEROSPACE VN",
		label: "VNXQR - CT MHI AEROSPACE VN",
	},
	{
		value: "VNXQRL",
		name: "CT MHI AEROSPACE VN",
		label: "VNXQRL - CT MHI AEROSPACE VN",
	},
	{
		value: "VNXQS",
		name: "CT CHIYODA INTEGRE",
		label: "VNXQS - CT CHIYODA INTEGRE",
	},
	{
		value: "VNXQSL",
		name: "CT CHIYODA INTEGRE",
		label: "VNXQSL - CT CHIYODA INTEGRE",
	},
	{
		value: "VNXQT",
		name: "CT CANON",
		label: "VNXQT - CT CANON",
	},
	{
		value: "VNXQTL",
		name: "CT CANON",
		label: "VNXQTL - CT CANON",
	},
	{
		value: "VNXQU",
		name: "CT SANTOMAS VN",
		label: "VNXQU - CT SANTOMAS VN",
	},
	{
		value: "VNXQUL",
		name: "CT SANTOMAS VN",
		label: "VNXQUL - CT SANTOMAS VN",
	},
	{
		value: "VNXQV",
		name: "CT KANEPACKAGE",
		label: "VNXQV - CT KANEPACKAGE",
	},
	{
		value: "VNXQVL",
		name: "CT KANEPACKAGE",
		label: "VNXQVL - CT KANEPACKAGE",
	},
	{
		value: "VNXQW",
		name: "CT IKAWA",
		label: "VNXQW - CT IKAWA",
	},
	{
		value: "VNXQWL",
		name: "CT IKAWA",
		label: "VNXQWL - CT IKAWA",
	},
	{
		value: "VNXQX",
		name: "PANASONIC ELECT DEV",
		label: "VNXQX - PANASONIC ELECT DEV",
	},
	{
		value: "VNXQXL",
		name: "PANASONIC ELECT DEV",
		label: "VNXQXL - PANASONIC ELECT DEV",
	},
	{
		value: "VNXQY",
		name: "CT TOKYO MICRO VN",
		label: "VNXQY - CT TOKYO MICRO VN",
	},
	{
		value: "VNXQYL",
		name: "CT TOKYO MICRO VN",
		label: "VNXQYL - CT TOKYO MICRO VN",
	},
	{
		value: "VNXQZ",
		name: "CT NODA VN",
		label: "VNXQZ - CT NODA VN",
	},
	{
		value: "VNXQZL",
		name: "CT NODA VN",
		label: "VNXQZL - CT NODA VN",
	},
	{
		value: "VNXRA",
		name: "KEIN HING MURAMOTO",
		label: "VNXRA - KEIN HING MURAMOTO",
	},
	{
		value: "VNXRAL",
		name: "KEIN HING MURAMOTO",
		label: "VNXRAL - KEIN HING MURAMOTO",
	},
	{
		value: "VNXRB",
		name: "CT FUJIKIN VN",
		label: "VNXRB - CT FUJIKIN VN",
	},
	{
		value: "VNXRBL",
		name: "CT FUJIKIN VN",
		label: "VNXRBL - CT FUJIKIN VN",
	},
	{
		value: "VNXRC",
		name: "STANDAR UNIT SUPPLY",
		label: "VNXRC - STANDAR UNIT SUPPLY",
	},
	{
		value: "VNXRCL",
		name: "STANDAR UNIT SUPPLY",
		label: "VNXRCL - STANDAR UNIT SUPPLY",
	},
	{
		value: "VNXRD",
		name: "CT ENDO VN",
		label: "VNXRD - CT ENDO VN",
	},
	{
		value: "VNXRDL",
		name: "CT ENDO VN",
		label: "VNXRDL - CT ENDO VN",
	},
	{
		value: "VNXRE",
		name: "CT TOKUSHU",
		label: "VNXRE - CT TOKUSHU",
	},
	{
		value: "VNXREL",
		name: "CT TOKUSHU",
		label: "VNXREL - CT TOKUSHU",
	},
	{
		value: "VNXRF",
		name: "CT TOYODA VAN MOPPES",
		label: "VNXRF - CT TOYODA VAN MOPPES",
	},
	{
		value: "VNXRFL",
		name: "CT TOYODA VAN MOPPES",
		label: "VNXRFL - CT TOYODA VAN MOPPES",
	},
	{
		value: "VNXRG",
		name: "CT PARTRON VINA",
		label: "VNXRG - CT PARTRON VINA",
	},
	{
		value: "VNXRGL",
		name: "CT PARTRON VINA",
		label: "VNXRGL - CT PARTRON VINA",
	},
	{
		value: "VNXRH",
		name: "CT CN MUTO HN",
		label: "VNXRH - CT CN MUTO HN",
	},
	{
		value: "VNXRHL",
		name: "CT CN MUTO HN",
		label: "VNXRHL - CT CN MUTO HN",
	},
	{
		value: "VNXRI",
		name: "CT TERUMO VN",
		label: "VNXRI - CT TERUMO VN",
	},
	{
		value: "VNXRIL",
		name: "CT TERUMO VN",
		label: "VNXRIL - CT TERUMO VN",
	},
	{
		value: "VNXRJ",
		name: "CT NIDEC SANKYO VN",
		label: "VNXRJ - CT NIDEC SANKYO VN",
	},
	{
		value: "VNXRJL",
		name: "CT NIDEC SANKYO VN",
		label: "VNXRJL - CT NIDEC SANKYO VN",
	},
	{
		value: "VNXRK",
		name: "CT CN ADCEL VN",
		label: "VNXRK - CT CN ADCEL VN",
	},
	{
		value: "VNXRKL",
		name: "CT CN ADCEL VN",
		label: "VNXRKL - CT CN ADCEL VN",
	},
	{
		value: "VNXRL",
		name: "DN NITORI",
		label: "VNXRL - DN NITORI",
	},
	{
		value: "VNXRLL",
		name: "DN NITORI",
		label: "VNXRLL - DN NITORI",
	},
	{
		value: "VNXRM",
		name: "CT KATOLEC VN",
		label: "VNXRM - CT KATOLEC VN",
	},
	{
		value: "VNXRML",
		name: "CT KATOLEC VN",
		label: "VNXRML - CT KATOLEC VN",
	},
	{
		value: "VNXRN",
		name: "CT ABEISM VN",
		label: "VNXRN - CT ABEISM VN",
	},
	{
		value: "VNXRNL",
		name: "CT ABEISM VN",
		label: "VNXRNL - CT ABEISM VN",
	},
	{
		value: "VNXRO",
		name: "CT JPK HN",
		label: "VNXRO - CT JPK HN",
	},
	{
		value: "VNXROL",
		name: "CT JPK HN",
		label: "VNXROL - CT JPK HN",
	},
	{
		value: "VNXRP",
		name: "CT HAESUNG VINA",
		label: "VNXRP - CT HAESUNG VINA",
	},
	{
		value: "VNXRPL",
		name: "CT HAESUNG VINA",
		label: "VNXRPL - CT HAESUNG VINA",
	},
	{
		value: "VNXRQ",
		name: "CT PREC VN",
		label: "VNXRQ - CT PREC VN",
	},
	{
		value: "VNXRQL",
		name: "CT PREC VN",
		label: "VNXRQL - CT PREC VN",
	},
	{
		value: "VNXRR",
		name: "CT MD FLEX VINA",
		label: "VNXRR - CT MD FLEX VINA",
	},
	{
		value: "VNXRRL",
		name: "CT MD FLEX VINA",
		label: "VNXRRL - CT MD FLEX VINA",
	},
	{
		value: "VNXRS",
		name: "CT LKIEN FLEXI VN",
		label: "VNXRS - CT LKIEN FLEXI VN",
	},
	{
		value: "VNXRSL",
		name: "CT LKIEN FLEXI VN",
		label: "VNXRSL - CT LKIEN FLEXI VN",
	},
	{
		value: "VNXRT",
		name: "CT TAKASAGO VN",
		label: "VNXRT - CT TAKASAGO VN",
	},
	{
		value: "VNXRTL",
		name: "CT TAKASAGO VN",
		label: "VNXRTL - CT TAKASAGO VN",
	},
	{
		value: "VNXRU",
		name: "CT INKEL VN",
		label: "VNXRU - CT INKEL VN",
	},
	{
		value: "VNXRUL",
		name: "CT INKEL VN",
		label: "VNXRUL - CT INKEL VN",
	},
	{
		value: "VNXRV",
		name: "CT CSM VN",
		label: "VNXRV - CT CSM VN",
	},
	{
		value: "VNXRVL",
		name: "CT CSM VN",
		label: "VNXRVL - CT CSM VN",
	},
	{
		value: "VNXRW",
		name: "CT UJU VINA",
		label: "VNXRW - CT UJU VINA",
	},
	{
		value: "VNXRWL",
		name: "CT UJU VINA",
		label: "VNXRWL - CT UJU VINA",
	},
	{
		value: "VNXRX",
		name: "CT KL PRECISION HN",
		label: "VNXRX - CT KL PRECISION HN",
	},
	{
		value: "VNXRXL",
		name: "CT KL PRECISION HN",
		label: "VNXRXL - CT KL PRECISION HN",
	},
	{
		value: "VNXRY",
		name: "CT HOEI TEKKO VN",
		label: "VNXRY - CT HOEI TEKKO VN",
	},
	{
		value: "VNXRYL",
		name: "CT HOEI TEKKO VN",
		label: "VNXRYL - CT HOEI TEKKO VN",
	},
	{
		value: "VNXRZ",
		name: "CT OPM VINA",
		label: "VNXRZ - CT OPM VINA",
	},
	{
		value: "VNXRZL",
		name: "CT OPM VINA",
		label: "VNXRZL - CT OPM VINA",
	},
	{
		value: "VNXSA",
		name: "CT LINDAN VN",
		label: "VNXSA - CT LINDAN VN",
	},
	{
		value: "VNXSAL",
		name: "CT LINDAN VN",
		label: "VNXSAL - CT LINDAN VN",
	},
	{
		value: "VNXSB",
		name: "CT OHASHI TEKKO VN",
		label: "VNXSB - CT OHASHI TEKKO VN",
	},
	{
		value: "VNXSBL",
		name: "CT OHASHI TEKKO VN",
		label: "VNXSBL - CT OHASHI TEKKO VN",
	},
	{
		value: "VNXSC",
		name: "CT BH VINA",
		label: "VNXSC - CT BH VINA",
	},
	{
		value: "VNXSCL",
		name: "CT BH VINA",
		label: "VNXSCL - CT BH VINA",
	},
	{
		value: "VNXSD",
		name: "CT KY THUAT OKAMOTO",
		label: "VNXSD - CT KY THUAT OKAMOTO",
	},
	{
		value: "VNXSDL",
		name: "CT KY THUAT OKAMOTO",
		label: "VNXSDL - CT KY THUAT OKAMOTO",
	},
	{
		value: "VNXSE",
		name: "CT POWER LOGICS VINA",
		label: "VNXSE - CT POWER LOGICS VINA",
	},
	{
		value: "VNXSEL",
		name: "CT POWER LOGICS VINA",
		label: "VNXSEL - CT POWER LOGICS VINA",
	},
	{
		value: "VNXSF",
		name: "CT CN NAMUGA PHU THO",
		label: "VNXSF - CT CN NAMUGA PHU THO",
	},
	{
		value: "VNXSFL",
		name: "CT CN NAMUGA PHU THO",
		label: "VNXSFL - CT CN NAMUGA PHU THO",
	},
	{
		value: "VNXSG",
		name: "FURUKAWA AUTOMOTIVE",
		label: "VNXSG - FURUKAWA AUTOMOTIVE",
	},
	{
		value: "VNXSGL",
		name: "FURUKAWA AUTOMOTIVE",
		label: "VNXSGL - FURUKAWA AUTOMOTIVE",
	},
	{
		value: "VNXSH",
		name: "KCX TAN THUAN",
		label: "VNXSH - KCX TAN THUAN",
	},
	{
		value: "VNXSHL",
		name: "KCX TAN THUAN",
		label: "VNXSHL - KCX TAN THUAN",
	},
	{
		value: "VNXSI",
		name: "KCX LINH TRUNG",
		label: "VNXSI - KCX LINH TRUNG",
	},
	{
		value: "VNXSIL",
		name: "KCX LINH TRUNG",
		label: "VNXSIL - KCX LINH TRUNG",
	},
	{
		value: "VNXSJ",
		name: "XINDADONG TEXTILES",
		label: "VNXSJ - XINDADONG TEXTILES",
	},
	{
		value: "VNXSJL",
		name: "XINDADONG TEXTILES",
		label: "VNXSJL - XINDADONG TEXTILES",
	},
	{
		value: "VNYVH",
		name: "YEN VIEN (HA NOI)",
		label: "VNYVH - YEN VIEN (HA NOI)",
	},
	{
		value: "VNYVHN",
		name: "YEN VIEN (HA NOI)",
		label: "VNYVHN - YEN VIEN (HA NOI)",
	},
	{
		value: "VNZZZ",
		name: "UNKNOWN",
		label: "VNZZZ - UNKNOWN",
	},
] as const;

export const ECUS_LOCATION_OPTIONS: EcusLocationOption[] =
	LOCATION_OPTIONS_SOURCE.map((option) => {
		const value = option.value.toUpperCase();

		return {
			...option,
			value,
			label: `${value} - ${option.name}`,
			normalized: normalizeEcusLocationText(`${value} ${option.name}`),
		};
	});

export function findEcusLocationOptionByValue(
	value: string | null | undefined,
) {
	const normalized = String(value ?? "")
		.trim()
		.toUpperCase();
	if (!normalized) return null;

	return (
		ECUS_LOCATION_OPTIONS.find((option) => option.value === normalized) ?? null
	);
}

export function buildEcusLocationNamesFromValues(
	values: Array<string | null | undefined>,
	fallbackNames: Array<string | null | undefined> = [],
) {
	const names = values
		.map((value, index) => {
			if (!String(value ?? "").trim()) {
				return null;
			}

			const fallbackName = String(fallbackNames[index] ?? "").trim();
			if (fallbackName) {
				return fallbackName;
			}

			return findEcusLocationOptionByValue(value)?.name ?? null;
		})
		.filter((value): value is string => Boolean(value));

	return names.length > 0 ? names.join(", ") : null;
}

export function findEcusLocationOptionByText(value: string | null | undefined) {
	const normalized = normalizeEcusLocationText(value);
	if (!normalized) return null;

	const exactMatch =
		ECUS_LOCATION_OPTIONS.find((option) => {
			if (option.value === normalized) return true;
			if (option.name === value?.trim()) return true;
			return option.normalized === normalized;
		}) ?? null;

	if (exactMatch) {
		return exactMatch;
	}

	const partialMatches = ECUS_LOCATION_OPTIONS.filter((option) => {
		return (
			option.normalized.includes(normalized) ||
			normalized.includes(option.normalized)
		);
	});

	if (partialMatches.length === 0) {
		return null;
	}

	if (partialMatches.length === 1) {
		return partialMatches[0];
	}

	// Prefer the tightest match when users type a port/city name fragment.
	return (
		partialMatches
			.sort(
				(left, right) =>
					left.normalized.length - right.normalized.length ||
					left.value.localeCompare(right.value),
			)
			.at(0) ?? null
	);
}

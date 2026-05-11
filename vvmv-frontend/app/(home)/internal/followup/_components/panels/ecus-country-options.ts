export type EcusCountryOption = {
	value: string;
	name: string;
	fullName: string;
};

const COUNTRY_OPTIONS_SOURCE = String.raw`
0X|KHONG XAC DINH|Không xác định
AD|ANDORRA|Andorra
AE|U ARB E|United Arab Emirates
AF|AFGNSTN|Afganistan
AG|ANT BAR|Antigua and Barbuda
AI|ANGUILA|Anguilla
AL|ALBANIA|Albania
AM|ARMENIA|Armenia
AO|ANGOLA|Angola
AP|ANGOLA|Angola
AR|ARGENT|Argentina
AS|A.SAMOA|American Samoa
AT|AUSTRIA|Austria
AU|AUSTRAL|Australia
AW|N.ANTIL|Aruba
AZ|AZERBAI|Azerbaijan
BA|BOS.HER|Bosnia and Herzegowina
BB|BARBADS|Barbados
BD|BANGLA|Bangladesh
BE|BELGIUM|Belgium
BF|BURKINA|Burkina Faso
BG|BULGAR|Bulgaria
BH|BAHRAIN|Bahrain
BI|BURUNDI|Burundi
BJ|BENIN|Benin
BM|BERMUDA|Bermuda
BN|BRUNEI|Brunei Darussalam
BO|BOLIVIA|Bolivia
BQ|B.A.T.|z
BR|BRAZIL|Brazil
BS|BAHAMA|Bahamas
BT|BHUTAN|Bhutan
BW|BOTSWAN|Botswana
BY|BELARUS|Belarus
BZ|BELIZE|Belize
CA|CANADA|Canada
CC|OTH.AUS|Cocos (Keeling) Islands
CD|ROCONGO|Congo (Democratic Rep.)
CF|C.AFRCA|Central African Republic
CG|CONGO|Congo
CH|SWITZLD|Switzerland
CI|IVCOAST|Cote DIvoire (Ivory Coast)
CK|COOK I.|Cook Islands
CL|CHILE|Chile
CM|CAMROUN|Cameroon
CN|CHINA|China
CO|COLMBIA|Colombia
CR|CST RCA|Costa Rica
CU|CUBA|Cuba
CV|C VERDE|Cape Verde Islands
CW|CURACAO|CURACAO
CX|CHRISTM|Christmas Islands
CY|CYPRUS|Cyprus
CZ|CZECHO|Czech Republic
DE|GERMANY|Germany
DJ|DJIBOUT|Djibouti
DK|DENMARK|Denmark
DM|C DOMNC|Dominica
DO|DOMNICA|Dominican Republic
DZ|ALGERIA|Algeria
EC|ECUADOR|Ecuador
EE|ESTONIA|Estonia
EG|EGYPT|Egypt
EH|W.SAHAR|Western Sahara
ER|ERITREA|Eritrea
ES|SPAIN|Spain
ET|ETHIOP|Ethiopia
EU|EUUNION|European Union
FI|FINLAND|Finland
FJ|FIJI|Fiji
FK|FALKLND|Falkland Islands (Malvinas)
FM|MICRONE|Micronesia (Federated State)
FO|DENMARK|Faroe Islands
FR|FRANCE|France
GA|GABON|Gabon
GB|U KING|United Kingdom
GD|GRENADA|Grenada
GE|GEORGIA|Georgia
GF|F.GIANA|French Guiana
GH|GHANA|Ghana
GI|GIBRALT|Gibraltar
GL|GREENLD|Greenland
GM|GAMBIA|Gambia
GN|GUINEA|Guinea
GP|F.W.IND|Guadeloupe
GQ|EQ.GNEA|Equatorial Guinea
GR|GREECE|Greece
GS|FALKLND|South Georgia & the South Sandwich Islan
GT|GUATMAL|Guatemala
GU|GUAM|Guam
GW|GINEA B|Guinea-Bissau
GY|GUYANA|Guyana
HK|HG.KONG|HongKong
HN|HONDURS|Honduras
HR|CROATIA|Croatia (Hrvatska)
HT|HAITI|Haiti
HU|HUNGARY|Hungary
ID|INDNSIA|Indonesia
IE|IRELAND|Ireland
IL|ISRAEL|Israel
IN|INDIA|India
IO|IND OCE|British Indian Ocean Territory
IQ|IRAQ|Iraq
IR|IRAN|Iran (Islamic Rep.)
IS|ICELAND|Iceland
IT|ITALY|Italy
JM|JAMAICA|Jamaica
JO|JORDAN|Jordan
JP|JAPAN|Japan
KE|KENYA|Kenya
KG|KYRGYZ|Kyrgyzstan
KH|CAMBOD|Cambodia
KI|KIRIBAT|Kiribati
KM|COMOROS|Comoros
KN|ST CHRI|Saint Kitts & Nevis
KP|N.KOREA|Korea (Democratic Peoples Rep.)
KR|R.KOREA|Korea (Republic)
KW|KUWAIT|Kuwait
KY|CAYMAN|Cayman Islands
KZ|KAZAKHS|Kazakhstan
LA|LAOS|Laos
LB|LEBANON|Lebanon
LC|ST.LUCI|Saint Lucia
LI|LIECHTN|Liechtenstein
LK|SRILANK|Sri Lanka
LR|LIBERIA|Liberia
LS|LESOTHO|Lesotho
LT|LITHUAN|Lithuania
LU|LUXMBRG|Luxembourg
LV|LATVIA|Latvia
LY|LIBYA|Libyan Arab Jamahiriya
MA|MOROCCO|Morocco
MC|MONACO|Monaco
MD|MOLDOVA|Moldova (Rep.)
ME|MONTNEG|Montenegro
MG|MADAGAS|Madagascar
MH|MARSHAL|Marshall Islands
MK|MAKEDON|Macedonia
ML|MALI|Mali
MM|MYANMAR|Myanmar (Burma)
MN|MONGOL|Mongolia
MO|MACAO|Macau
MP|MARIANA|Northern Mariana Islands
MQ|F.W.IND|Martinique
MR|MARITAN|Mauritania
MS|MONT SE|Montserrat
MT|MALTA|Malta
MU|MAURTUS|Mauritius
MV|MALDIVE|Maldives
MW|MALAWI|Malawi
MX|MEXICO|Mexico
MY|MALYSIA|Malaysia
MZ|MOZAMBQ|Mozambique
NA|NAMIBIA|Namibia
NC|NEWCALD|New Caledonia
NE|NIGER|Niger
NF|OTH.AUS|Norfolk Island
NG|NIGERIA|Nigeria
NI|NICARAG|Nicaragua
NL|NETHLDS|Netherlands
NO|NORWAY|Norway
NP|NEPAL|Nepal
NR|R.NAURU|Nauru
NU|NIUE|Niue
NZ|NEWZELD|New Zealand
OM|OMAN|Oman
PA|PANAMA|Panama
PE|PERU|Peru
PF|F.POLYN|French Polinesia
PG|PAP NGA|Papua New Guinea
PH|PHILPIN|Philippines
PK|PAKISTN|Pakistan
PL|POLAND|Poland
PM|ST P MQ|Saint Pierre & Miquelon
PN|PITCARN|Pitcairn
PR|PRTRICO|Puerto Rico
PS|PALESTI|Palestine
PT|PORTUGL|Portugal
PW|PALAU|Palau
PY|PARAGUA|Paraguay
QA|QATAR|Qatar
RE|REUNION|Reunion
RO|ROMANIA|Romania
RS|SERBIA|Serbia
RU|RUSSIAN|Russian Federation
RW|RWANDA|Rwanda
SA|SU ARAB|Saudi Arabia
SB|SOLOMON|Solomon Islands
SC|SEYCHEL|Seychelles
SD|SUDAN|Sudan
SE|SWEDEN|Sweden
SG|SNGAPOR|Singapore
SH|ST.HELE|Saint Helena
SI|SLOVENI|Slovenia
SJ|SVALBAR|Svalbard & Jan Mayen Islands
SK|SLOVAKI|Slovakia (Slovak Rep.)
SL|SIERLEO|Sierra Leone
SM|SANMARI|San Marino
SN|SENEGAL|Senegal
SO|SOMALIA|Somalia
SR|SURINAM|Suriname
SS|S.SUDAN|Sudan
ST|ST PRIN|Sao Tome & Principe
SV|SALVADR|El Salvador
SY|SYRIA|Syrian Arab (Rep.)
SZ|SWAZLND|Swaziland
TC|TUK.CAI|Turks & Caicos Islands
TD|CHAD|Chad
TG|TOGO|Togo
TH|THAILND|Thailand
TJ|TADZHIK|Tajikistan
TK|TOKELAU|Tokelau
TL|TIMOR.L|East Timor
TM|TURKMEN|Turkmenistan
TN|TUNISIA|Tunisia
TO|TONGA|Tonga
TR|TURKEY|Turkey
TT|TRINIDD|Trinidad & Tobago
TV|TUVALU|Tuvalu
TW|TAIWAN|Taiwan
TZ|TANZNIA|Tanzania (United Rep.)
UA|UKRAINE|Ukraine
UG|UGANDA|Uganda
UM|A.OCEAN|United States Minor Outlying Islands
US|U.S.A.|United States of America
UY|URUGUAY|UruGuay
UZ|UZBEKIS|Uzbekistan
VA|VATICAN|Vatican City
VC|ST.VINT|Saint Vincent & Grenadines
VE|VENEZLA|Venezuela
VG|B VIR I|British Virgin Islands
VI|A VIR I|Virgin Islands (U.S.)
VN|VIETNAM|Viet Nam
VU|VANUATU|Vanuatu
WF|W.F.ILD|Wallis & Futuna Islands
WS|SAMOA|Samoa
YE|YEMEN|Yemen
YT|MAYOTTL|Mayotte
ZA|S.AFRCA|South Africa
ZM|ZAMBIA|Zambia
ZW|ZMBABWE|Zimbabwe
ZZ|UNKNOWN|Chưa xác định
`;

export const ECUS_COUNTRY_OPTIONS: EcusCountryOption[] =
	COUNTRY_OPTIONS_SOURCE.trim()
		.split("\n")
		.map((line) => {
			const [value, name, fullName] = line.split("|");
			return {
				value,
				name,
				fullName: fullName || name,
			};
		});

function normalizeCountryText(value: string | null | undefined) {
	return (value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Z0-9]/gi, "")
		.toUpperCase();
}

const COUNTRY_ALIASES: Record<string, string[]> = {
	AE: ["UAE", "UNITEDARABEMIRATES"],
	GB: ["UK", "UNITEDKINGDOM", "BRITAIN"],
	HK: ["HONGKONG", "HONGKONGSAR", "HONGKONGCHINA"],
	KR: ["KOREA", "SOUTHKOREA", "REPUBLICOFKOREA"],
	KP: ["NORTHKOREA", "DPRK"],
	US: ["USA", "UNITEDSTATES", "UNITEDSTATESOFAMERICA"],
	VN: ["VIETNAM"],
};

export function findEcusCountryOptionByText(text: string | null | undefined) {
	const normalizedText = normalizeCountryText(text);
	if (!normalizedText) return null;

	const exact =
		ECUS_COUNTRY_OPTIONS.find(
			(option) =>
				option.value === normalizedText ||
				normalizeCountryText(option.name) === normalizedText ||
				normalizeCountryText(option.fullName) === normalizedText ||
				(COUNTRY_ALIASES[option.value] ?? []).some(
					(alias) => normalizeCountryText(alias) === normalizedText,
				),
		) ?? null;

	if (exact) return exact;

	return (
		ECUS_COUNTRY_OPTIONS.find((option) => {
			const aliases = [
				option.name,
				option.fullName,
				...(COUNTRY_ALIASES[option.value] ?? []),
			];
			return aliases.some((alias) =>
				normalizedText.includes(normalizeCountryText(alias)),
			);
		}) ?? null
	);
}

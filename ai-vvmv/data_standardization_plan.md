# Kế hoạch Chuẩn hóa Dữ liệu VVMV cho LLM

## Tổng quan
- **Nguồn dữ liệu**: 8,934 file JSONL từ hệ thống hải quan Việt Nam
- **Tổng dung lượng**: ~6.6GB (chỉ han-2024)
- **Loại dữ liệu**: Tờ khai hải quan (nhập/xuất), thông tin doanh nghiệp, hàng hóa

## Cấu trúc dữ liệu hiện tại
```
vvmv-dumps/
├── han-2024/
│   └── declarations/
│       └── direction={N,X}/
│           └── year=0000/month=00/
│               └── customs={01B1,01DD,...}/
│                   └── part-*.jsonl
├── han-ecus-2021/
├── han-ecus-2025/
└── han-full/
```

## Schema dữ liệu
```json
{
  "declarationId": "string",
  "declarationNumber": "string|null", 
  "direction": "N|X",
  "declarationDate": "string|null",
  "taxCode": "string",
  "customsCode": "string",
  "operationCode": "string",
  "header": { /* thông tin tờ khai */ },
  "vnaccs2": { /* thông tin VNACCS mở rộng */ },
  "cargo": [ /* danh sách hàng hóa */ ]
}
```

## Quy trình chuẩn hóa

### Phase 1: Data Extraction & Cleaning
1. **Merge tất cả JSONL files**
   - Đọc tất cả part files
   - Merge thành unified dataset
   - Preserve metadata (source, timestamp)

2. **Data Cleaning**
   - Remove records với essential fields null
   - Standardize date formats (ISO 8601)
   - Clean Vietnamese text encoding
   - Remove special characters, normalize whitespace

3. **Validation**
   - Kiểm tra required fields
   - Validate data types
   - Check business logic (direction vs customs code)

### Phase 2: Data Structuring for LLM

#### 2.1 Classification Dataset
```
Input: Tờ khai với header và cargo info
Output: Loại hình, mã HS, thuế suất
Format: JSONL với instruction/response
```

#### 2.2 Entity Recognition Dataset  
```
Input: Text description của tờ khai
Output: Structured entities (doanh nghiệp, hàng hóa, giá trị)
Format: JSONL với labeled entities
```

#### 2.3 Question Answering Dataset
```
Context: Thông tin tờ khai đầy đủ
Question: Các câu hỏi về thủ tục hải quan
Answer: Trả lời dựa trên dữ liệu
Format: JSONL với context/question/answer
```

#### 2.4 Document Generation Dataset
```
Input: Structured data (doanh nghiệp, hàng hóa, etc.)
Output: Tờ khai hoàn chỉnh
Format: JSONL với input/output text
```

### Phase 3: Quality Control

#### 3.1 Data Quality Metrics
- **Completeness**: % records có đủ required fields
- **Accuracy**: Validation pass rate
- **Consistency**: Format consistency
- **Uniqueness**: Duplicate detection

#### 3.2 Validation Rules
```python
required_fields = ['declarationId', 'direction', 'taxCode', 'customsCode']
date_patterns = ['YYYY-MM-DD', 'YYYY-MM-DDTHH:MM:SSZ']
tax_code_pattern = r'^\d{10}$'
customs_code_pattern = r'^\d{2}[A-Z0-9]{2}$'
```

#### 3.3 Data Splits
- **Training**: 80%
- **Validation**: 10% 
- **Test**: 10%
- Stratified by customs code và direction

## Cấu trúc output
```
llm-dataset/
├── raw/                    # Dữ liệu gốc đã merge
├── cleaned/                # Dữ liệu đã clean
├── processed/              # Dữ liệu đã xử lý cho LLM
│   ├── classification/
│   ├── ner/
│   ├── qa/
│   └── generation/
├── splits/                 # Train/val/test splits
├── metadata/               # Data statistics, quality reports
└── scripts/               # Processing scripts
```

## Tools & Technologies
- **Processing**: Python, pandas, PySpark (nếu cần)
- **Text Processing**: regex, unicodedata, underthesea
- **Validation**: Cerberus, Pydantic
- **Storage**: Parquet, JSONL
- **Versioning**: DVC (optional)

## Timeline Estimate
- Phase 1: 2-3 ngày
- Phase 2: 3-4 ngày  
- Phase 3: 1-2 ngày
- Total: 6-9 ngày

## Success Criteria
- Dataset sạch, không lỗi
- Format đồng nhất
- Quality metrics > 95%
- Documentation hoàn chỉnh
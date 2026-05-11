# VVMV Data Standardization for LLM Training

Chuẩn hóa dữ liệu hải quan Việt Nam (VVMV) để xây dựng Large Language Model (LLM).

## Tổng quan

Dự án này xử lý và chuẩn hóa dữ liệu từ hệ thống hải quan Việt Nam để tạo dataset phù hợp cho training LLM. Dữ liệu gốc bao gồm 8,934 file JSONL với tổng dung lượng ~6.6GB.

## Cấu trúc dự án

```
ai-vvmv/
├── vvmv-dumps/                 # Dữ liệu gốc
│   ├── han-2024/
│   ├── han-ecus-2021/
│   └── han-ecus-2025/
├── scripts/                    # Scripts xử lý
│   ├── data_processor.py       # Data cleaning & standardization
│   ├── dataset_generator.py    # LLM dataset generation
│   └── data_validator.py       # Quality validation
├── llm-dataset/               # Output đã chuẩn hóa
│   ├── raw/                   # Dữ liệu gốc merged
│   ├── cleaned/               # Dữ liệu đã clean
│   ├── processed/             # Dataset cho LLM
│   │   ├── classification/    # Classification task
│   │   ├── ner/              # Named Entity Recognition
│   │   ├── qa/               # Question Answering
│   │   └── generation/       # Document generation
│   ├── splits/               # Train/val/test splits
│   └── metadata/             # Statistics & reports
├── run_pipeline.py           # Main pipeline runner
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

## Cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd ai-vvmv
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Sử dụng

### Chạy toàn bộ pipeline
```bash
python run_pipeline.py
```

### Chạy từng bước riêng lẻ
```bash
# Chỉ xử lý và làm sạch dữ liệu
python run_pipeline.py --step process

# Chỉ tạo dataset cho LLM
python run_pipeline.py --step generate

# Chỉ validate dữ liệu
python run_pipeline.py --step validate
```

### Chỉ định paths
```bash
python run_pipeline.py --source /path/to/source --output /path/to/output
```

## Quy trình xử lý

### Phase 1: Data Processing & Cleaning
- Merge tất cả JSONL files
- Remove records thiếu required fields
- Standardize formats (date, text encoding)
- Validate business logic

### Phase 2: Dataset Generation
Tạo 4 loại dataset cho LLM:

1. **Classification Dataset**
   - Input: Summary của tờ khai
   - Output: Phân loại (loại hình, mã HS, thuế suất)

2. **NER Dataset**
   - Input: Text description
   - Output: Labeled entities (doanh nghiệp, hàng hóa, giá trị)

3. **QA Dataset**
   - Context: Thông tin tờ khai đầy đủ
   - Question/Answer: Câu hỏi về thủ tục hải quan

4. **Document Generation Dataset**
   - Input: Structured data
   - Output: Tờ khai hoàn chỉnh

### Phase 3: Validation & Quality Control
- Field completeness checks
- Data consistency validation
- Duplicate detection
- Quality metrics calculation

## Dataset formats

### Classification
```json
{
  "instruction": "Phân loại tờ khai hải quan sau:",
  "input": "Mã HQ: 01B1 | Hướng: Nhập khẩu | Doanh nghiệp: ABC Corp...",
  "output": "Nhập khẩu - Mã hoạt động: A41 - Mã HQ: 01B1"
}
```

### NER
```json
{
  "text": "Doanh nghiệp: ABC Corp, Mã số thuế: 0101234567...",
  "entities": [
    {"text": "ABC Corp", "label": "COMPANY", "start": 13, "end": 21},
    {"text": "0101234567", "label": "TAX_CODE", "start": 35, "end": 45}
  ]
}
```

### QA
```json
{
  "context": "THÔNG TIN TỜ KHAI:\nMã tờ khai: 12345...",
  "question": "Mã hải quan của tờ khai này là gì?",
  "answer": "Mã hải quan là 01B1"
}
```

### Generation
```json
{
  "input": "DECLARATION_INFO:\ncustoms_code: 01B1\ndirection: N...",
  "output": "TỜ KHAI HẢI QUAN\n==================\nMã tờ khai: 12345..."
}
```

## Quality Metrics

Pipeline tự động tính toán các metrics:

- **Completeness Score**: % records có đủ required fields
- **Consistency Score**: % records đúng format (tax code, customs code)
- **Duplicate Score**: 100 - % duplicate records
- **Dataset Quality**: Quality score cho từng task dataset
- **Overall Quality Score**: Tổng hợp tất cả metrics

## Output files

### Cleaned data
- `llm-dataset/cleaned/vvmv_cleaned.jsonl` - Dữ liệu đã chuẩn hóa
- `llm-dataset/cleaned/vvmv_cleaned.parquet` - Format cho efficient processing

### LLM datasets
- `llm-dataset/processed/[task]/[task].jsonl` - Full dataset
- `llm-dataset/splits/[task]/[task]_{train,val,test}.jsonl` - Data splits

### Metadata
- `processing_stats.json` - Statistics từ data processing
- `validation_results.json` - Detailed validation results
- `quality_scores.json` - Quality metrics
- `validation_report.txt` - Human-readable report

## Troubleshooting

### Common issues

1. **Memory errors**: Dataset quá lớn
   - Solution: Process data in chunks, use PySpark

2. **Encoding issues**: Vietnamese text
   - Solution: Ensure UTF-8 encoding throughout pipeline

3. **Missing files**: Source data không tồn tại
   - Solution: Check `vvmv-dumps` directory structure

4. **Timeout**: Scripts chạy quá lâu
   - Solution: Increase timeout in `run_pipeline.py`

### Logs
- `pipeline.log` - Main pipeline execution log
- `data_processing.log` - Data processing details
- Check logs trong `llm-dataset/logs/` directory

## Performance considerations

- **Processing time**: ~2-4 hours for full pipeline (6.6GB data)
- **Memory usage**: ~8-16GB RAM recommended
- **Disk space**: ~15GB needed for output
- **Parallel processing**: Scripts utilize multiple cores where possible

## Next steps after pipeline

1. Review validation report và quality scores
2. Analyze dataset statistics
3. Fine-tune LLM với generated datasets
4. Monitor model performance
5. Iterate on data processing if needed

## Import/Export AI Layer

Dự án đã có thêm lớp chuẩn bị tài sản cho hệ thống AI xuất nhập khẩu:

- Blueprint kiến trúc: `docs/ai_import_export_blueprint.md`
- Runbook xây LLM/RAG: `docs/llm_build_runbook.md`
- Sinh AI assets: `scripts/prepare_ai_assets.py`
- RAG CLI baseline: `scripts/rag_cli.py`
- RAG API service: `scripts/rag_api.py`
- Config fine-tune mẫu: `configs/qlora_vvmv.example.yaml`

Chạy thử trên một phần dữ liệu:

```bash
source venv/bin/activate
python scripts/prepare_ai_assets.py \
  --input llm-dataset/cleaned/vvmv_cleaned.jsonl \
  --output llm-dataset/ai-assets-sample \
  --max-records 2000 \
  --write-cargo-facts
```

Tạo full assets trực tiếp từ raw dumps để tránh phụ thuộc file cleaned chưa hoàn tất:

```bash
source venv/bin/activate
python scripts/prepare_ai_assets.py \
  --source-dir vvmv-dumps \
  --output llm-dataset/ai-assets \
  --write-cargo-facts
```

Hỏi đáp RAG baseline:

```bash
python scripts/rag_cli.py \
  "ma HS 90318090 co nhung to khai nao va rui ro gi" \
  --corpus llm-dataset/ai-assets/private_rag/trade_knowledge_corpus.jsonl \
  --top-k 5
```

Tạo và dùng index truy xuất nhanh:

```bash
python scripts/build_rag_index.py \
  --corpus llm-dataset/ai-assets/private_rag/trade_knowledge_corpus.jsonl \
  --index-dir llm-dataset/rag-index \
  --mode fts

python scripts/rag_index_cli.py \
  "ma HS 90318090 co nhung to khai nao va rui ro gi" \
  --index llm-dataset/rag-index/rag_fts.sqlite \
  --top-k 5
```

Chạy RAG API để tích hợp chatbot/frontend:

```bash
pip install -r requirements-ai.txt
export RAG_INDEX=llm-dataset/rag-index/rag_fts.sqlite
uvicorn scripts.rag_api:app --host 0.0.0.0 --port 8000
```

API chính:

```bash
# Lấy nguồn liên quan, citation, risk_summary và prompt, chưa gọi LLM
curl -X POST http://localhost:8000/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"query":"ma HS 90318090 co rui ro gi","top_k":5}'

# Hỏi đáp qua Ollama local
ollama pull qwen2.5:7b-instruct
curl -X POST http://localhost:8000/ask \
  -H 'Content-Type: application/json' \
  -d '{"query":"ma HS 90318090 co rui ro gi","top_k":5,"model":"qwen2.5:7b-instruct"}'
```

Chuẩn bị dữ liệu huấn luyện LLM:

```bash
python scripts/split_training_dataset.py \
  --input llm-dataset/ai-assets/training/instruction_tuning.jsonl \
  --output-dir llm-dataset/ai-assets/training/splits \
  --train-ratio 0.98 \
  --val-ratio 0.01
```

Runbook training chi tiết: `docs/training_llm_runbook.md`

OCR chứng từ xuất nhập khẩu:

```bash
python scripts/ocr_documents.py \
  --input /path/to/documents \
  --output llm-dataset/ocr-assets/ocr_documents.jsonl \
  --recursive \
  --lang eng

python scripts/ocr_to_rag.py \
  --input llm-dataset/ocr-assets/ocr_documents.jsonl \
  --output-dir llm-dataset/ocr-assets
```

Runbook OCR chi tiết: `docs/ocr_pipeline_runbook.md`

## Contributing

1. Follow coding standards trong scripts
2. Add comprehensive logging
3. Update documentation cho changes
4. Test with sample data before full run

## License

[Add appropriate license information]

## Contact

[Add contact information]
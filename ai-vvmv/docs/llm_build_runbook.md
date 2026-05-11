# Runbook xay dung LLM/RAG cho xuat nhap khau

## 1. Trang thai du lieu hien tai

Da co file cleaned:

```
llm-dataset/cleaned/vvmv_cleaned.jsonl
```

Luu y: log xu ly truoc do cho thay job fast processor tung ghi `Saved 100000/544160 records`, trong khi file cleaned hien tai co khoang 199k dong. Vi vay khi can bo du lieu day du, nen tao AI assets truc tiep tu `vvmv-dumps/` bang `--source-dir` thay vi chi dua vao file cleaned hien co.

## 2. Tao AI assets

### Tao nhanh tren 2,000 record de kiem thu

```bash
cd /Volumes/FastVault-Apps/Projects/ai-vvmv
source venv/bin/activate
python scripts/prepare_ai_assets.py \
  --input llm-dataset/cleaned/vvmv_cleaned.jsonl \
  --output llm-dataset/ai-assets-sample \
  --max-records 2000 \
  --write-cargo-facts
```

### Tao full assets tu raw dumps

```bash
cd /Volumes/FastVault-Apps/Projects/ai-vvmv
source venv/bin/activate
python scripts/prepare_ai_assets.py \
  --source-dir vvmv-dumps \
  --output llm-dataset/ai-assets \
  --write-cargo-facts
```

Mac dinh `cargo_facts` giu toi da 8 dong hang dai dien moi to khai de corpus gon. Neu can phan tich HS tuyet doi tren tat ca dong hang, them:

```bash
--max-cargo 0
```

### Tao full assets tu cleaned JSONL hien co

```bash
cd /Volumes/FastVault-Apps/Projects/ai-vvmv
source venv/bin/activate
python scripts/prepare_ai_assets.py \
  --input llm-dataset/cleaned/vvmv_cleaned.jsonl \
  --output llm-dataset/ai-assets \
  --write-cargo-facts
```

## 3. Output quan trong

```
llm-dataset/ai-assets/
  private_rag/trade_knowledge_corpus.jsonl
  training/instruction_tuning.jsonl
  analytics/declarations_compact.jsonl
  analytics/cargo_facts.jsonl
  reports/ai_assets_summary.json
```

- `private_rag`: dung cho hoi dap noi bo, giu du lieu that.
- `training`: dataset chat da mask thong tin nhay cam, dung fine-tune.
- `analytics`: facts compact de build dashboard, rules, anomaly detection.
- `reports`: thong ke tong quan va phan bo nghiep vu.

## 4. Query RAG baseline

### Tao search index nhanh

Moi truong hien tai chua cai `sentence-transformers`/`faiss`, nen index mac dinh dung SQLite FTS5 offline. FTS5 khong phai semantic vector search, nhung nhanh hon scan JSONL rat nhieu va phu hop tra cuu ma HS, so to khai, ma HQ, loai hinh.

```bash
cd /Volumes/FastVault-Apps/Projects/ai-vvmv
source venv/bin/activate
python scripts/build_rag_index.py \
  --corpus llm-dataset/ai-assets/private_rag/trade_knowledge_corpus.jsonl \
  --index-dir llm-dataset/rag-index \
  --mode fts
```

Ket qua full index hien tai:

```
llm-dataset/rag-index/rag_fts.sqlite
```

Query qua index:

```bash
python scripts/rag_index_cli.py \
  "ma HS 90318090 co nhung to khai nao va rui ro gi" \
  --index llm-dataset/rag-index/rag_fts.sqlite \
  --top-k 5
```

### Query truc tiep corpus JSONL

```bash
python scripts/rag_cli.py \
  "Tim cac to khai co ma HS 90318090 va phan tich rui ro" \
  --corpus llm-dataset/ai-assets/private_rag/trade_knowledge_corpus.jsonl \
  --top-k 5
```

Neu co Ollama local:

```bash
OLLAMA_MODEL=qwen2.5:7b-instruct python scripts/rag_cli.py \
  "To khai 134926 co nhung hang hoa nao?" \
  --corpus llm-dataset/ai-assets/private_rag/trade_knowledge_corpus.jsonl \
  --ollama
```

Neu muon dung prompt tu index FTS5 voi Ollama:

```bash
OLLAMA_MODEL=qwen2.5:7b-instruct python scripts/rag_index_cli.py \
  "To khai 87998 co nhung hang hoa nao va canh bao gi?" \
  --index llm-dataset/rag-index/rag_fts.sqlite \
  --ollama
```

### Nang cap len FAISS semantic vector search

Sau khi cho phep cai dependency:

```bash
pip install -r requirements-ai.txt
python scripts/build_rag_index.py \
  --corpus llm-dataset/ai-assets/private_rag/trade_knowledge_corpus.jsonl \
  --index-dir llm-dataset/rag-index-faiss \
  --mode faiss \
  --model sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
```

Khuyen nghi production: hybrid retrieval = FTS5 exact search cho ma HS/so to khai + FAISS semantic search cho mo ta hang hoa.

## 5. Fine-tune LoRA/QLoRA

Khuyen nghi dung base model:

- Qwen2.5-7B-Instruct / Qwen3-8B-Instruct cho tieng Viet va reasoning tot.
- Llama-3.1-8B-Instruct neu ha tang da co san.
- Gemma-2-9B-It neu uu tien inference gon.

Dung file:

```
configs/qlora_vvmv.example.yaml
```

Chien luoc:

1. Train tren `training/instruction_tuning.jsonl`.
2. Eval bang bo cau hoi nghiep vu co dap an field-level.
3. Khong dua ten doanh nghiep/MST/day du dia chi vao dataset fine-tune public.
4. Sau fine-tune van giu RAG de cap nhat du lieu moi hang ngay.

## 6. Kiem tra chat luong can co

- HS accuracy: model tra ve dung ma HS lich su trong top-1/top-3.
- Field extraction accuracy: direction, customs_code, operation_code, value.
- Risk flag accuracy: so voi rules engine.
- Hallucination rate: cau tra loi khong duoc tu tao so to khai/ma HS khong co trong context.
- Human review pass rate: chuyen gia xuat nhap khau chap nhan cau tra loi.

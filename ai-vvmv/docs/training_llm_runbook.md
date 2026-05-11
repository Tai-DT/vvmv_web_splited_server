# Runbook huan luyen LLM cho AI xuat nhap khau

## 1. Dieu kien hien tai

Dataset fine-tune da co:

```
llm-dataset/ai-assets/training/instruction_tuning.jsonl
```

Quy mo hien tai:

- 1,468,363 chat samples
- Khoang 1.3GB
- Da mask bot thong tin nhay cam trong noi dung training

May hien tai la Mac ARM 24GB RAM va chua co cac thu vien training (`torch`, `transformers`, `peft`, `trl`). Co the chuan bi/split data local, nhung fine-tune LLM 7B nen chay tren GPU/cloud.

## 2. Chia dataset train/validation/test

Split theo `declaration_id` de tranh leakage giua train va validation/test:

```bash
cd /Volumes/FastVault-Apps/Projects/ai-vvmv
source venv/bin/activate

python scripts/split_training_dataset.py \
  --input llm-dataset/ai-assets/training/instruction_tuning.jsonl \
  --output-dir llm-dataset/ai-assets/training/splits \
  --train-ratio 0.98 \
  --val-ratio 0.01
```

Output:

```
llm-dataset/ai-assets/training/splits/
  train.jsonl
  validation.jsonl
  test.jsonl
  manifest.json
```

## 3. Chay smoke-test training dataset nho

Dung de test format truoc khi dua len GPU:

```bash
python scripts/split_training_dataset.py \
  --input llm-dataset/ai-assets/training/instruction_tuning.jsonl \
  --output-dir llm-dataset/ai-assets/training/splits-smoke \
  --max-samples 20000
```

## 4. Cai dependency tren may GPU/cloud

Can approval truoc khi cai package/tai model. Tren may GPU:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements-ai.txt
```

Voi CUDA, cai `torch`/`bitsandbytes` theo dung version CUDA cua may.

## 5. Fine-tune LoRA/QLoRA

Khuyen nghi bat dau bang model:

- `Qwen/Qwen2.5-7B-Instruct`
- Hoac `Qwen/Qwen2.5-3B-Instruct` neu GPU nho

Lenh mau:

```bash
python scripts/train_lora_sft.py \
  --model Qwen/Qwen2.5-7B-Instruct \
  --splits-dir llm-dataset/ai-assets/training/splits \
  --output-dir models/vvmv-qwen2.5-7b-lora \
  --max-seq-length 2048 \
  --epochs 1 \
  --per-device-train-batch-size 1 \
  --gradient-accumulation-steps 16 \
  --bf16
```

Test nhanh truoc tren it samples:

```bash
python scripts/train_lora_sft.py \
  --model Qwen/Qwen2.5-3B-Instruct \
  --splits-dir llm-dataset/ai-assets/training/splits-smoke \
  --output-dir models/vvmv-smoke-lora \
  --max-train-samples 2000 \
  --max-eval-samples 200 \
  --epochs 0.1
```

## 6. Danh gia sau training

Can tao benchmark rieng gom:

- Hoi dap theo so to khai.
- Goi y HS theo mo ta hang hoa.
- Trich xuat field: direction, customs_code, operation_code, value, currency.
- Canh bao risk: mismatch tri gia, so dong, HS thieu/sai format.
- Hallucination check: model khong duoc tao so to khai/ma HS khong co trong context.

## 7. Khuyen nghi production

- Van dung RAG lam nguon su that; fine-tune chi de model hieu format va ngon ngu nghiep vu.
- Tach prompt/rule cho `direction=N` va `direction=X`.
- Moi response co thong tin HS/thue nen co disclaimer va yeu cau human review.

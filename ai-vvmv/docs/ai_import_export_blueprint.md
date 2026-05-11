# Blueprint he thong AI xuat nhap khau

## Muc tieu

Xay dung he thong AI phuc vu nghiep vu xuat nhap khau dua tren du lieu VVMV/ECUS/RPA:

1. Tra cuu va hoi dap thong tin to khai, hang hoa, van don, container, chi cuc hai quan.
2. Phan tich ma HS, mo ta hang hoa, tri gia, xuat xu, thue suat da khai bao.
3. Canh bao rui ro nghiep vu: thieu thong tin, tri gia bat thuong, hang khong co HS, mismatch so hang/tong tri gia.
4. Tao bo du lieu instruction-tuning de fine-tune LLM noi bo.
5. Tao knowledge base cho RAG de tra loi co dan nguon, khong can dua toan bo du lieu vao model.

## Kien truc khuyen nghi

```
Raw VVMV/ECUS/RPA JSONL
        |
        v
Streaming Normalizer
        |
        +--> Compact analytics facts (JSONL/CSV/Parquet)
        +--> Private RAG corpus (unmasked)
        +--> Training dataset (masked)
        +--> Quality/risk report
        |
        v
Hybrid AI Layer
        |
        +--> RAG Retriever: lay to khai/hang hoa lien quan
        +--> Rules Engine: kiem tra loi nghiep vu
        +--> LLM: Q&A, giai thich, tom tat, de xuat buoc tiep theo
        |
        v
API/UI cho nhan vien xuat nhap khau
```

## Chien luoc LLM

Khong nen train LLM tu dau. Nen di theo 2 tang:

1. **RAG noi bo truoc**: dung base model co san nhu Qwen, Llama, Gemma, GPT API hoac Ollama. Model tra loi dua tren corpus trich xuat tu to khai.
2. **Fine-tune LoRA/QLoRA sau**: dung instruction dataset da mask thong tin nhay cam de model hieu ngon ngu va format nghiep vu VVMV.

## Cac module nghiep vu nen co

### 1. Trade Data Analyst

- Hoi dap: "To khai 106503 co nhung mat hang nao?"
- Tong hop: "Top ma HS nhap khau theo tri gia trong thang 06/2025?"
- Giai thich: "Tai sao to khai nay co rui ro thieu thong tin?"

### 2. HS Code Assistant

- Input: mo ta hang hoa, xuat xu, don vi, tri gia.
- Output: ma HS da khai trong lich su tuong tu, canh bao can chuyen chuyen gia neu do tin cay thap.
- Luu y: he thong chi goi y dua tren lich su; khong thay the tu van phap ly/hai quan.

### 3. Declaration Risk Checker

- Rule co ban:
  - Khong co hang hoa.
  - Hang hoa thieu ma HS.
  - So luong <= 0 hoac tri gia < 0.
  - Tong tri gia header chenh lech lon voi tong tri gia hang.
  - So hang header khac so dong hang thuc te.
- Rule nang cao:
  - Gia don vi lech manh so voi lich su cung ma HS.
  - Xuat xu/loai hinh/ma HQ bat thuong.
  - Mo ta hang hoa qua ngan hoac thieu model/nhan hieu/thong so.

### 4. Document Copilot

- Tao ban nhap email follow-up.
- Tao tom tat to khai cho khach hang.
- Tao checklist chung tu can bo sung.

## Data zones

```
llm-dataset/
  cleaned/                 # Du lieu nested da clean; co the rat lon
  ai-assets/
    private_rag/           # Corpus unmasked cho RAG noi bo
    training/              # Dataset masked cho fine-tune
    analytics/             # Facts compact cho BI/rules
    reports/               # Summary va quality report
```

## Bao mat va governance

- Mac dinh mask ma so thue, ten doanh nghiep, dia chi trong dataset fine-tune.
- RAG private co the giu du lieu goc nhung chi chay trong ha tang noi bo.
- Log prompt/response can an danh hoa truoc khi dung de fine-tune.
- Cau tra loi co lien quan thue/HS nen co disclaimer va yeu cau human review.

## Lo trinh trien khai

1. **Week 1**: Tao compact facts, RAG corpus, instruction dataset, baseline CLI.
2. **Week 2**: Xay API va UI noi bo, ket noi Ollama/OpenAI/local model.
3. **Week 3**: Them rules engine va dashboard quality/risk.
4. **Week 4**: Fine-tune LoRA tren dataset masked, danh gia voi bo cau hoi nghiep vu.
5. **Week 5+**: Human-in-loop, feedback loop, retraining dinh ky.

# Chạy CDS AI hàng loạt cho N job mới nhất theo site

Script: [`run-cds-ai-batch.ts`](./run-cds-ai-batch.ts) — npm script `cds:ai-batch`.

Mục đích: chạy **CDS AI (Gemini)** cho `N` follow-up job **mới nhất** của một site rồi
ghi kết quả vào bảng CDS (`follow_up_cds_info`). Mặc định: **10 job HCM (site = `SGN`)**.

> HCM được mã hoá là site `SGN` trong data model (`Site = SGN | DAD | HAN`,
> `vvmv-backend/prisma/schema.prisma`). Không có token "HCM" trong DB.

## Cơ chế

Script không gọi trực tiếp DB/Gemini/Drive — nó điều phối đúng chuỗi HTTP endpoint
mà giao diện web đang dùng, nên hành vi khớp production:

1. `GET  /api/followup?pageSize=..&search=<site>` → lấy job mới nhất (`createdAt desc`), lọc `domain === site`.
2. `GET  /api/google-drive/files?folderId=..` → liệt kê chứng từ trong thư mục Drive của job (lấy `folderId` từ `driveUrl`).
3. `POST /api/followup/:id/cds-ai-document` → Gemini OCR + trích xuất `cdsInfo` / `cargoList` (camelCase theo `contracts/cds_backend_contract.json`).
4. `POST /api/followup/:id/cds-info { data: cdsInfo }` → upsert form CDS (khi `--apply`, mặc định **bật**).

## Yêu cầu môi trường

Chạy ở nơi có hạ tầng thật (không chạy được trong sandbox rỗng):

- Next/backend app đang chạy, truy cập được qua `CDS_AI_BASE_URL`.
- Postgres RPA + `GEMINI_API_KEY` đã cấu hình cho app đó (route CDS AI yêu cầu `GEMINI_API_KEY`).
- Một **session cookie** hợp lệ (better-auth) của user có quyền đọc job của site.
  Dùng tài khoản **SUPERADMIN** để lọc được site tuỳ ý. Lấy cookie từ trình duyệt:
  DevTools → Application → Cookies → copy nguyên chuỗi cookie của phiên đăng nhập.
- Mỗi job cần có **chứng từ nguồn** (PDF/ảnh/Excel/Word…) trong thư mục Drive của nó;
  job không có `driveUrl` hoặc không có chứng từ nguồn sẽ bị **bỏ qua**.

## Cách dùng

Từ thư mục `vvmv-frontend`:

```bash
export CDS_AI_BASE_URL="https://app.noi-bo"
export CDS_AI_AUTH_COOKIE="better-auth.session_token=...; ..."   # cookie của SUPERADMIN

# 10 job SGN (HCM) mới nhất: chạy AI + ghi cds-info (mặc định)
pnpm cds:ai-batch

# Chỉ liệt kê job + chứng từ, KHÔNG gọi Gemini / KHÔNG ghi DB (an toàn để soát trước)
pnpm cds:ai-batch -- --dry-run

# Chạy AI nhưng KHÔNG ghi DB (chỉ xuất báo cáo)
pnpm cds:ai-batch -- --no-apply

# Đổi site / số lượng / model
pnpm cds:ai-batch -- --site HAN --limit 5
pnpm cds:ai-batch -- --model gemini-2.5-pro
```

## Tham số (flag / biến môi trường)

| Flag | Env | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| `--base-url` | `CDS_AI_BASE_URL` | `http://localhost:3000` | Gốc URL của app |
| `--cookie` | `CDS_AI_AUTH_COOKIE` | *(bắt buộc)* | Cookie phiên better-auth |
| `--site` | `CDS_AI_SITE` | `SGN` | `SGN` (HCM) / `HAN` / `DAD` |
| `--limit` | — | `10` | Số job mới nhất |
| `--status` | — | *(tất cả)* | Lọc trạng thái: `active` / `finished` / `done` |
| `--model` | `CDS_AI_MODEL` | *(mặc định app)* | Model Gemini (route sẽ chuẩn hoá/allowlist) |
| `--prompt` | — | OCR toàn bộ chứng từ… | Prompt tuỳ chỉnh cho AI |
| `--dry-run` | — | tắt | Không gọi AI, không ghi DB |
| `--no-apply` | — | tắt | Chạy AI nhưng không ghi cds-info |
| `--max-files` | — | `12` | Giới hạn số chứng từ/ job |
| `--max-total-mb` | — | `40` | Giới hạn tổng dung lượng chứng từ/ job |
| `--out` | — | `scripts/out/cds-ai-batch-<ts>.json` | Đường dẫn báo cáo |
| `--timeout-ms` | — | `180000` | Timeout mỗi request |

## Kết quả

- In tóm tắt ra console: số job `applied` / `ai-only` / `dry-run` / `skipped` / `error`.
- Ghi báo cáo JSON chi tiết từng job (file đã chọn, cảnh báo, số trường cdsInfo, số dòng hàng)
  vào `scripts/out/cds-ai-batch-<timestamp>.json` (cookie được che trong báo cáo).
- Exit code khác 0 nếu có job lỗi.

## Phạm vi

- Script chỉ ghi **`cds-info`** (form CDS header). `cargoList` do AI trả về được **ghi trong báo cáo**
  nhưng **không** tự động ghi vào bảng cargo — áp dụng dòng hàng vẫn qua giao diện web
  (`/api/followup/:id/cargo`) để giữ bước rà soát/giải quyết xung đột của con người.
- Heuristic chọn chứng từ nguồn: bỏ qua Google-native docs/thư mục, chỉ nhận PDF/ảnh/Office/nén.
  Hãy dùng `--dry-run` để kiểm tra danh sách file trước khi chạy thật.

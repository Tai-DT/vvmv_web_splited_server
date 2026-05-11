# VVMV: frontend (Next.js) và backend (NestJS)

## Vai trò

| Package | Vai trò |
|---------|---------|
| **`vvmv-frontend`** | **Frontend**: Next.js App Router (UI), **`/api/auth/*`** (Better Auth), và tạm thời các route **`/api/*`** còn lại cho đến khi chuyển hết sang Nest. |
| **`vvmv-backend`** | **Backend**: NestJS — các endpoint REST đã migrate (ví dụ `GET /shipping-lines`), dùng chung Postgres qua Prisma. |

## Luồng khuyến nghị

1. Trình duyệt vẫn gọi **`/api/...` trên origin của Next** (cookie session không đổi).
2. Đặt **`BACKEND_URL`** trỏ tới Nest; các route Next đã wired (như `shipping-lines`) **proxy** sang Nest và forward header **`Cookie`** — xem [`split-backend.md`](./split-backend.md).
3. **`/api/auth/*`** giữ trên Next/Better Auth cho đến khi có chiến lược auth thống nhất cho Nest.

## Việc cần làm dần

- Di chuyển từng nhóm `app/api/**/route.ts` sang module Nest tương ứng.
- Chỉ khi toàn bộ API đã chạy trên Nest và auth được xử lý rõ ràng, mới có thể gỡ bớt route trong Next hoặc chỉ giữ rewrite/BFF.

import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` chỉ sinh client từ schema, không cần kết nối database.
// Nếu bắt buộc DATABASE_URL ngay lúc nạp config thì máy vừa clone (chưa có
// .env) sẽ không generate được, và lỗi hiện ra dưới dạng "Failed to load
// config file" rất khó hiểu.
//
// Vì vậy khi thiếu biến môi trường, dùng URL giữ chỗ trỏ tới cổng không có
// dịch vụ: generate chạy bình thường, còn migrate/push/studio vẫn báo lỗi
// kết nối ngay thay vì âm thầm nối vào database sai.
const PLACEHOLDER_DATABASE_URL =
  "postgresql://placeholder:placeholder@127.0.0.1:1/placeholder?schema=public";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "[prisma] Chưa có DATABASE_URL — dùng URL giữ chỗ. `prisma generate` vẫn chạy; " +
      "các lệnh cần database sẽ lỗi. Tạo .env từ .env.example để dùng đầy đủ.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl || PLACEHOLDER_DATABASE_URL,
  },
});

Colab upload -> My Drive

Hướng dẫn nhanh

1) Mở [notebooks/colab_upload_to_drive.ipynb](notebooks/colab_upload_to_drive.ipynb) trên Google Colab.
2) Chạy cell `drive.mount('/content/drive')` và xác thực Google account.
3) Chạy cell `files.upload()` để chọn file từ máy bạn. File sẽ được lưu vào `/content/drive/MyDrive/colab-uploads/`.
4) Nếu cần copy toàn bộ repo lên Drive: zip repo, upload theo bước 3, rồi unzip trong Drive.

Mẹo:
- Nếu file lớn (>100MB), dùng `gdown` với file đã được upload lên Drive (public link) hoặc sử dụng `rclone` từ local -> Drive (yêu cầu cấu hình rclone).
- Để chạy pipeline repo trên Colab: copy `scripts/` và `requirements*.txt` lên Drive rồi `pip install -r /content/drive/MyDrive/colab-uploads/requirements-ai.txt`.

Ví dụ lệnh để chạy trong Colab sau khi đã copy repo vào Drive:

```bash
# unzip repo nếu cần
!unzip /content/drive/MyDrive/colab-uploads/your_repo.zip -d /content/drive/MyDrive/colab-uploads/your_repo/
# cài deps
!pip install -r /content/drive/MyDrive/colab-uploads/your_repo/requirements-ai.txt
# chạy script xử lý
!python /content/drive/MyDrive/colab-uploads/your_repo/scripts/data_processor.py --input /content/drive/MyDrive/colab-uploads/data/ --output /content/drive/MyDrive/colab-uploads/processed/
```

Upload trực tiếp từ máy (tùy chọn nâng cao)

- 1) Nén thư mục dữ liệu trên máy của bạn để dễ upload:

```bash
./scripts/zip_for_drive.sh path/to/your/data  # tạo file ZIP trong thư mục hiện tại
```

- 2) Dùng web UI của Google Drive: kéo thả file ZIP vào `My Drive/colab-uploads/`.

- 3) Hoặc dùng `rclone` để upload trực tiếp từ máy (khuyên dùng cho file lớn):

```bash
# macOS (Homebrew)
brew install rclone

# cấu hình remote (chạy tương tác lần đầu)
rclone config

# ví dụ: copy file ZIP vào MyDrive/colab-uploads/
rclone copy /full/path/to/your.zip remote:MyDrive/colab-uploads/ -P
```

Ghi chú: thay `remote` bằng tên cấu hình bạn tạo trong `rclone config` (ví dụ `gdrive`).

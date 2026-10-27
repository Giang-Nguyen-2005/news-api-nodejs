# API upload và xóa file

Cả hai endpoint cần `Authorization: Bearer <accessToken>` từ login. Không có
static route công khai uploads hoặc tích hợp ảnh vào tin tức.

## Upload

```powershell
curl.exe -i -X POST http://localhost:3000/api/files/upload -H "Authorization: Bearer <accessToken>" -F "file=@C:/path/to/photo.png"
```

Multipart/form-data, chỉ một field File tên `file`. Nhận JPG/JPEG, PNG, WEBP tối đa
5 × 1024 × 1024 byte; MIME/extension phải khớp nội dung. Multer nhận trong bộ nhớ;
Sharp đọc metadata và giải mã pixel bằng stats, giới hạn 16 × 1024 × 1024 pixel.
Tên lưu là UUID với extension theo nội dung thật; ghi `wx` để tránh ghi đè.

HTTP 201, ví dụ minh họa:

```json
{
  "success": true,
  "message": "Upload file thanh cong",
  "data": {
    "file": {
      "id": 1,
      "filename": "bd58e494-2401-4c34-a2c6-90a1d1012400.png",
      "size": 1000,
      "mimetype": "image/png",
      "uploaded_by": 1,
      "created_at": "2026-10-27 10:00:00"
    }
  }
}
```

Bảng files: id INTEGER PRIMARY KEY AUTOINCREMENT; filename TEXT UNIQUE NOT NULL;
size INTEGER NOT NULL CHECK(size > 0); mimetype TEXT NOT NULL; uploaded_by INTEGER
NOT NULL REFERENCES users(id) ON DELETE RESTRICT; created_at TEXT NOT NULL DEFAULT
CURRENT_TIMESTAMP. Có index uploaded_by. Không trả path tuyệt đối.

## Xóa

```powershell
curl.exe -i -X DELETE http://localhost:3000/api/files/1 -H "Authorization: Bearer <accessToken>"
```

Chỉ người upload được xóa. HTTP 200:

```json
{"success":true,"message":"Xoa file thanh cong","data":{"id":1}}
```

File trên đĩa đã mất thì vẫn xóa metadata. Tên trong metadata phải đúng mẫu
UUID/extension, path trong upload root, không chấp nhận symlink. Kiểm tra chủ sở hữu
và xóa nằm trong transaction IMMEDIATE.

Upload lỗi database: rollback metadata, xóa file vừa ghi. Xóa lỗi metadata:
rollback và khôi phục bytes. Không ghi file tạm xuống đĩa. SQLite và filesystem
không commit chung; tắt đột ngột hoặc lỗi cả bước bù trừ có thể cần đối soát thủ công.

| Lỗi | HTTP |
| --- | --- |
| JWT thiếu/sai/hết hạn | 401 |
| Thiếu file, sai field/loại ảnh, ảnh hỏng, MIME/extension không khớp | 400 |
| Vượt 5 MiB | 413 |
| Khác người upload | 403 |
| ID sai / không tồn tại | 400 / 404 |
| Server | 500, thông báo chung, không lộ stack/path |

UPLOAD_DIR mặc định ./uploads, tính từ root project; tự tạo khi upload hợp lệ.
Git bỏ qua uploads, .env và database local. Nếu đổi đường dẫn, bổ sung ignore tương ứng.
Test dùng database bộ nhớ và thư mục tạm riêng, tự dọn, không chạm dữ liệu thật.

Xem [README](../README.md) để cài đặt và [Postman](postman.md) để thực hành theo thứ tự.

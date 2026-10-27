# Thực hành API bằng Postman

Khởi động server theo README. Import `postman/News-API.postman_collection.json`
bằng **Import → File**. Trong Variables của collection, giữ `baseUrl` là
`http://localhost:3000` (đổi port nếu .env dùng port khác).

`username`, `email`, `password` là dữ liệu minh họa. Nếu đã đăng ký tài khoản demo,
đổi username/email sang giá trị mới trước bước 02, hoặc bỏ qua register và login
bằng tài khoản đã có. Không xóa database để chạy lại.

`accessToken`, `newsId`, `fileId` ban đầu rỗng. Script sau response login/tạo dữ
liệu tự lưu các biến này. Chỉ lưu local; không gửi token cho người khác hoặc export
lại collection khi còn token/dữ liệu cá nhân. Không nhập JWT_SECRET vào Postman.

## Quy ước chung

- URL dưới đây dùng `{{baseUrl}}`; ID dùng `{{newsId}}`, `{{fileId}}`.
- JSON: **Body → raw → JSON**, header `Content-Type: application/json`.
- Request private: **Authorization → Bearer Token → `{{accessToken}}`**. Postman tự
  thêm `Authorization: Bearer ...`; không thêm hai header Authorization.
- Request public: Authorization = **No Auth**, không có body.
- Upload: Body = **form-data**, không tự đặt Content-Type vì Postman cần tạo boundary.

## Các bước thực hành

| Bước | Method và URL | Headers/Body | Kết quả mong đợi |
| --- | --- | --- | --- |
| 01 | GET `{{baseUrl}}/health` | No Auth, không body | 200; success true, data.status = ok |
| 02 | POST `{{baseUrl}}/api/auth/register` | JSON, No Auth; body A bên dưới | 201; data.user có id, username, email, created_at; không có password/hash |
| 03 | POST `{{baseUrl}}/api/auth/login` | JSON, No Auth; body B | 200; data.accessToken, tokenType = Bearer, expiresIn; lưu accessToken |
| 04 | POST `{{baseUrl}}/api/news` | Bearer, JSON; body C | 201; data.news.author là tài khoản login; lưu data.news.id vào newsId |
| 05 | GET `{{baseUrl}}/api/news` | No Auth, không body | 200; data.news là mảng, có pagination |
| 06 | GET `{{baseUrl}}/api/news/{{newsId}}` | No Auth, không body | 200; data.news là bài vừa tạo |
| 07 | GET `{{baseUrl}}/api/news?search=nodejs&sortBy=title&order=asc&page=1&limit=5` | No Auth, không body | 200; chỉ bài khớp title/content, title tăng dần, total sau lọc, tối đa 5 bài |
| 08 | PUT `{{baseUrl}}/api/news/{{newsId}}` | Bearer, JSON; body D | 200; title/content mới, updated_at cập nhật, author/created_at giữ nguyên |
| 09 | POST `{{baseUrl}}/api/files/upload` | Bearer; form-data: key file, chọn kiểu File và ảnh thật | 201; data.file có id, filename UUID, size, mimetype, uploaded_by, created_at; lưu id vào fileId |
| 10 | DELETE `{{baseUrl}}/api/files/{{fileId}}` | Bearer, không body | 200; data.id trùng fileId; metadata và file bị xóa |
| 11 | DELETE `{{baseUrl}}/api/news/{{newsId}}` | Bearer, không body | 200; data.id trùng newsId; GET lại bài nhận 404 |

Body A — đăng ký (thay bằng tài khoản demo chưa tồn tại):

```json
{"username":"{{username}}","email":"{{email}}","password":"{{password}}"}
```

Body B — đăng nhập:

```json
{"email":"{{email}}","password":"{{password}}"}
```

Body C — tạo tin:

```json
{"title":"Học NodeJS","content":"Nội dung bài học Express và SQLite."}
```

Body D — sửa tin (cần cả title và content):

```json
{"title":"Học NodeJS - đã cập nhật","content":"Nội dung bài học đã được sửa."}
```

Ở bước 09, chọn JPG/PNG/WEBP ≤5 MiB, MIME/extension khớp nội dung ảnh thật;
chỉ gửi field `file`, không gửi thêm field. Collection cố ý không nhúng đường dẫn
ảnh cá nhân. Gửi thủ công hoặc chọn file trước khi chạy Runner.

Script login nằm trong **Scripts → Post-response** của request (bản Postman cũ gọi
là Tests), tương đương:

```javascript
if (pm.response.code === 200) {
  pm.collectionVariables.set('accessToken', pm.response.json().data.accessToken);
}
```

Script tạo tin/upload lưu ID tương tự. Collection còn có request 12 `/api/auth/me`
và request 13 `/api/health` để kiểm tra thêm, không tạo tính năng mới.

## Kiểm tra lỗi cơ bản

Thử private request với No Auth → 401; tin/file thuộc tài khoản khác → 403;
ID sai → 400; ID không tồn tại → 404; register trùng → 409; upload quá 5 MiB → 413.
Lỗi có `success: false`, `data: null`, `errors: null`; không có SQL/stack/path thật.
Để thử quyền sở hữu, đăng ký/login tài khoản demo thứ hai và dùng token đó;
không thay author_id trong body để giả mạo chủ sở hữu.

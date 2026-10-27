# News Management Backend API

Backend quản lý tin tức cho **Nhiệm vụ 17**: đăng ký/đăng nhập, JWT, đọc tin public,
thêm/sửa/xóa theo quyền tác giả, tìm kiếm/sắp xếp/phân trang và upload/xóa ảnh.
Không có frontend hoặc tích hợp ảnh vào tin tức.

Repository: [Giang-Nguyen-2005/news-api-nodejs](https://github.com/Giang-Nguyen-2005/news-api-nodejs).

## Công nghệ

| Thành phần | Công nghệ thực tế |
| --- | --- |
| Ngôn ngữ, HTTP | JavaScript, Node.js, Express |
| Database | SQLite qua better-sqlite3 |
| Xác thực | jsonwebtoken (JWT HS256), bcryptjs (hash mật khẩu, cost 10) |
| Upload | Multer nhận multipart trong bộ nhớ; Sharp giải mã ảnh thật |
| Cấu hình, test | dotenv; node:test, assert, fetch có sẵn trong Node.js |

Đã kiểm tra trên **Windows, Node.js 22.20.0, npm 10.9.3**. Dùng Node.js 22 hoặc
bản được dependency hỗ trợ. Không cần cài database server riêng.

## Cài đặt và chạy

PowerShell, từ thư mục muốn đặt bản clone mới:

```powershell
git clone https://github.com/Giang-Nguyen-2005/news-api-nodejs.git
cd news-api-nodejs
npm ci
Copy-Item .env.example .env
# Tạo secret ngẫu nhiên ngay trong .env, không in secret.
node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); fs.writeFileSync('.env', fs.readFileSync('.env','utf8').replace(/^JWT_SECRET=[^\r\n]*/m, 'JWT_SECRET='+crypto.randomBytes(32).toString('hex')));"
npm start
```

Chỉ copy file mẫu khi **chưa có .env**, tránh ghi đè cấu hình. Với project đang
có tại `C:\Users\Giang\API`, vào thư mục đó rồi cài đặt, không clone lại.
`npm run dev` tự chạy lại khi sửa code; `Ctrl+C` dừng server.

Server mặc định: `http://localhost:3000`. Thử:

```powershell
curl.exe -i http://localhost:3000/health
```

## Biến môi trường và cấu hình dùng chung

| Biến | Mặc định | Điều kiện/ý nghĩa |
| --- | --- | --- |
| PORT | 3000 | Số nguyên 1–65535 |
| NODE_ENV | development | development, test hoặc production |
| DB_PATH | ./data/news.db | File SQLite, tương đối tính từ root project |
| JWT_SECRET | Không có | Bắt buộc, ít nhất 32 ký tự; nên tạo ngẫu nhiên như trên |
| JWT_EXPIRES_IN | 3600 | Số nguyên dương, thời hạn token theo giây |
| UPLOAD_DIR | ./uploads | Thư mục ảnh, tương đối tính từ root project |

Biến process ưu tiên hơn .env. `src/config/env.js` nạp dotenv, kiểm tra PORT,
NODE_ENV, JWT_SECRET, JWT_EXPIRES_IN và export cấu hình chung, không dùng global.
Ví dụ trong server:

```javascript
const { port, nodeEnv } = require('./config/env');
```

`database.js` quản lý SQLite; `files.js` quản lý upload root/giới hạn ảnh.
Không commit .env, secret, token thật hoặc dữ liệu cá nhân. Đổi JWT_SECRET làm
token cũ không hợp lệ.

## Cấu trúc thư mục

```text
src/
  app.js                       # JSON parser, routes, middleware 404/500
  server.js                    # Khởi động HTTP server
  config/
    env.js
    database.js
    files.js
  controllers/
    healthController.js
    authController.js
    newsController.js
    fileController.js
  routes/
    healthRoutes.js
    authRoutes.js
    newsRoutes.js
    fileRoutes.js
  middlewares/
    authenticate.js
    validateAuth.js
    upload.js
    notFound.js
    errorHandler.js
  models/
    userModel.js
    newsModel.js
    fileModel.js
  services/
    authService.js
    newsService.js
    fileService.js
  utils/
    response.js
    httpError.js
test/
  app.test.js
  auth.test.js
  news.test.js
  news-write.test.js
  news-query.test.js
  files.test.js
docs/
  postman.md                    # Quy trình thực hành 11 bước
  files.md                      # Chi tiết API file
  verification.md               # Đối chiếu yêu cầu, kết quả kiểm tra
postman/
  News-API.postman_collection.json
data/                          # Database local, không track
uploads/                       # Ảnh và thư mục test tạm, không track
.env.example
.gitignore
package.json
package-lock.json
README.md
```

Không liệt kê node_modules, .env và file giữ chỗ .gitkeep trong cây trên.

## Request/Response

Request thường dùng `Content-Type: application/json`. Upload dùng multipart/form-data,
chỉ một field kiểu **File** tên `file`.

Thành công qua `sendSuccess`, ví dụ health → HTTP 200:

```json
{"success":true,"message":"Server is running","data":{"status":"ok"}}
```

Lỗi qua `sendError`, ví dụ route không tồn tại → HTTP 404:

```json
{"success":false,"message":"Khong tim thay API","data":null,"errors":null}
```

Message API hiện không dấu hoặc tiếng Anh theo code. `errors` có trong response
lỗi, không bắt buộc khi thành công. HTTP 200: thành công; 201: đã tạo; 400: đầu vào
sai; 401: token/thông tin đăng nhập sai; 403: không có quyền; 404: không tồn tại;
409: tài khoản trùng; 413: file quá lớn; 500: lỗi server, không lộ SQL/stack/path.

## Danh sách API thực tế

| Method | Endpoint | Quyền | Thành công: trường trong data |
| --- | --- | --- | --- |
| GET | /health | Public | 200: status |
| GET | /api/health | Public, alias | 200: status |
| POST | /api/auth/register | Public | 201: user |
| POST | /api/auth/login | Public | 200: user, accessToken, tokenType, expiresIn |
| GET | /api/auth/me | JWT | 200: user |
| GET | /api/news | Public | 200: news[], pagination |
| GET | /api/news/:id | Public | 200: news |
| POST | /api/news | JWT | 201: news |
| PUT | /api/news/:id | JWT, tác giả | 200: news |
| DELETE | /api/news/:id | JWT, tác giả | 200: id |
| POST | /api/files/upload | JWT | 201: file |
| DELETE | /api/files/:id | JWT, người upload | 200: id |

### Đăng ký, đăng nhập, JWT

Body register:

```json
{"username":"sinhvien_demo","email":"sinhvien@example.com","password":"DemoPass123!"}
```

Username/email không trùng; email hợp lệ; password từ 8 ký tự, tối đa 72 byte UTF-8.
Email trim/chuyển chữ thường, username trim. Chỉ lưu hash. Body login dùng email,
password như trên. Sai email/password cùng nhận thông báo chung 401; thiếu trường
hoặc email sai định dạng nhận 400.

Lấy `data.accessToken` từ login, dùng cho me và API private:

```http
Authorization: Bearer <accessToken nhận từ login>
```

Token mặc định 1 giờ. Me trả id, username, email, created_at, không có password/hash.
Token thiếu/sai/hết hạn hoặc tài khoản không còn → 401.

### Tin tức

GET danh sách/chi tiết không cần token. Tin gồm id, title, content,
`author: {id, username}`, created_at, updated_at; không có email/hash tác giả.
POST và PUT đều cần cả hai trường:

```json
{"title":"Học NodeJS","content":"Nội dung bài học Express và SQLite."}
```

Title/content phải là chuỗi không rỗng sau trim. Tác giả lấy từ JWT, bỏ qua
client author_id. PUT thay hai trường, cập nhật updated_at UTC, giữ nguyên tác giả
và created_at. Người khác sửa/xóa → 403; ID sai → 400; không tồn tại → 404.
SQL có điều kiện author_id và transaction IMMEDIATE bảo vệ quyền trong thao tác.

### Tìm kiếm, sắp xếp, phân trang

```http
GET /api/news?search=nodejs&sortBy=title&order=asc&page=1&limit=5
```

| Query | Mặc định | Điều kiện |
| --- | --- | --- |
| search | Rỗng | Chuỗi sau trim ≤200 ký tự, không NUL; tìm trong title/content |
| sortBy | created_at | created_at, updated_at, title |
| order | desc | asc hoặc desc, chữ thường |
| page | 1 | Số nguyên dương trong miền an toàn JavaScript |
| limit | 10 | Số nguyên 1–100; offset cũng phải an toàn |

Tham số sai/lặp → 400. Search rỗng/whitespace trả danh sách thường. Tìm chuỗi con
không phân biệt hoa/thường ASCII; %, _ và backslash là ký tự thường. Dùng placeholder
cho search, allowlist cho sort; trùng giá trị dùng id cùng chiều. Sort title theo
TEXT/BINARY của SQLite, không cam kết thứ tự ngôn ngữ Việt.

`pagination.total` là số bài sau lọc. Không có kết quả vẫn trả 200:

```json
{"success":true,"message":"Lay danh sach tin tuc thanh cong","data":{"news":[],"pagination":{"page":1,"limit":5,"total":0,"totalPages":0}}}
```

### Upload/xóa file

```powershell
curl.exe -i -X POST http://localhost:3000/api/files/upload -H "Authorization: Bearer <accessToken>" -F "file=@C:/path/to/photo.png"
```

Chỉ một field file, không thêm field khác. JPG/JPEG, PNG, WEBP tối đa **5 MiB**
(5 × 1024 × 1024 byte), tối đa 16 × 1024 × 1024 pixel. Sharp giải mã ảnh thật;
MIME/extension phải khớp nội dung. Lưu tên UUID, không dùng tên gốc làm path.
Response 201 chứa `data.file`: id, filename, size, mimetype, uploaded_by, created_at.
Không có path tuyệt đối/URL public. Xóa bằng ID:

```http
DELETE /api/files/1
Authorization: Bearer <accessToken>
```

Chỉ người upload được xóa. Response 200:

```json
{"success":true,"message":"Xoa file thanh cong","data":{"id":1}}
```

Xóa cả metadata/file; file trên đĩa đã mất vẫn dọn metadata. Có kiểm tra traversal
và symlink, không có static route uploads. Chi tiết: [docs/files.md](docs/files.md).

## Thực hành Postman

Import [collection](postman/News-API.postman_collection.json), baseUrl mặc định
`http://localhost:3000`. Export ban đầu để token/ID rỗng; collection lưu sau login
và tạo dữ liệu. Chọn ảnh trên máy cho field upload trước khi gửi.

Thứ tự: health → register → login → tạo tin → danh sách → chi tiết → tìm/sort → sửa
→ upload → xóa ảnh → xóa tin. Chi tiết Method, URL, Headers, Body và kết quả tại
[docs/postman.md](docs/postman.md). Có thêm me và alias health.
Dùng tài khoản demo mới nếu đã đăng ký; không export token/dữ liệu cá nhân sau khi chạy.

## Kiểm thử và đối chiếu

```powershell
npm test
npm audit
```

**188/188 test PASS**, gồm health/404/500, auth/JWT, public/private, quyền tác giả,
search/sort/phân trang, upload thật và rollback. Test dùng SQLite :memory: và thư
mục tạm riêng trong uploads, tự dọn và không sửa dữ liệu thật.
Bằng chứng từng yêu cầu và kiểm tra route: [docs/verification.md](docs/verification.md).

## SQLite, lưu trữ và giới hạn

- Bảng users/news/files được tạo bằng CREATE TABLE IF NOT EXISTS, không seed dữ liệu
  thật. Bật khóa ngoại, username/email UNIQUE với NOCASE (ASCII). Timestamp UTC.
  Không cần xóa database để chạy lại bài.
- Khi sao lưu, dừng server và sao lưu cả database/uploads. Không sửa filename trong
  metadata hoặc xóa file thủ công. Tắt đột ngột/lỗi cả bước bù trừ có thể làm lệch
  file/metadata: SQLite và filesystem không có commit chung.
- .gitignore bỏ qua node_modules, .env, data, uploads, database/journal. Nếu đổi
  đường dẫn dữ liệu, bổ sung ignore tương ứng trước khi commit.
- npm 10.9.3 báo @img/sharp-wasm32, @emnapi/runtime, tslib là extraneous sau npm ci.
  Chúng thuộc nhánh WASM tùy chọn của Sharp; thực tế dùng binary sharp-win32-x64.
  Cài sạch, 188 test và audit đạt; không đổi dependency để che cảnh báo.
- Chưa có refresh token, admin, download ảnh, frontend hoặc deploy; không mô tả
  những chức năng này là đã hoàn thành.

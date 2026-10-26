# News Management Backend API

Backend bai tap Nhiem vu 17, hien hoan thanh giai doan 5: API private them/sua/xoa tin tuc.
Su dung JavaScript, Node.js, Express, SQLite (better-sqlite3), bcryptjs va jsonwebtoken.
Da co dang ky, dang nhap, JWT, API doc public va API ghi tin tuc theo quyen tac gia.
Chua co tim kiem hay sap xep tuy chinh, upload hoac frontend.

## Chay local

Yeu cau Node.js 22 tro len (de dung `node --watch`, `node:test` va `fetch`).

```powershell
npm ci
Copy-Item .env.example .env
# Tao JWT_SECRET ngau nhien trong .env; chi chay sau khi copy file mau.
node -e "const fs = require('node:fs'); fs.writeFileSync('.env', fs.readFileSync('.env', 'utf8').replace(/^JWT_SECRET=$/m, 'JWT_SECRET=' + require('node:crypto').randomBytes(32).toString('hex')));"
npm start
```

`npm run dev` tu khoi dong lai khi source thay doi. `npm test` chay test toi thieu
bang Node.js, khong can cai them framework.

## Bien moi truong va cau hinh dung chung

| Bien | Mac dinh | Gia tri hop le |
| --- | --- | --- |
| PORT | 3000 | So nguyen tu 1 den 65535 |
| NODE_ENV | development | development, test, production |
| DB_PATH | ./data/news.db | Duong dan database SQLite; duong dan tuong doi tinh tu thu muc project |
| JWT_SECRET | Khong co | Secret ngau nhien it nhat 32 ky tu, bat buoc |
| JWT_EXPIRES_IN | 3600 | So nguyen duong, don vi giay (mac dinh 1 gio) |

JWT_SECRET phai duoc thiet lap trong `.env` hoac bien moi truong cua process.
Bien moi truong cua process duoc uu tien hon `.env`.
Cau hinh khong hop le se dung ung dung voi thong bao loi.
`.env` da duoc bo qua boi Git; chi commit `.env.example` khong chua thong tin nhay cam.

`src/config/env.js` nap dotenv va export cau hinh dung chung, khong dung `global`.
Vi du trong `src/server.js`:

```javascript
const { port, nodeEnv } = require('./config/env');
```

Server dung `port` de lang nghe va `nodeEnv` trong log khoi dong. Error middleware
cung dung `nodeEnv` de bo log loi khi chay voi `NODE_ENV=test`.

## Cau truc project

```text
src/
  app.js
  server.js
  config/
    env.js
    database.js
  controllers/
    healthController.js
    authController.js
    newsController.js
  routes/
    healthRoutes.js
    authRoutes.js
    newsRoutes.js
  middlewares/
    .gitkeep
    notFound.js
    errorHandler.js
    validateAuth.js
    authenticate.js
  models/
    .gitkeep
    userModel.js
    newsModel.js
  services/
    .gitkeep
    authService.js
    newsService.js
  utils/
    .gitkeep
    response.js
    httpError.js
test/
  app.test.js
  auth.test.js
  news.test.js
  news-write.test.js
data/                  # Database local tu tao, khong commit
.env.example
.gitignore
package.json
package-lock.json
README.md
```

## Request/Response

Response thanh cong dung helper `sendSuccess(res, message, data, statusCode)`.
Response loi dung `sendError(res, message, statusCode, errors)`. `data` va `errors`
mac dinh la `null`; status thanh cong mac dinh la 200, status loi mac dinh la 500.

### Health: HTTP 200

```powershell
curl.exe -i http://localhost:3000/health
```

```json
{
  "success": true,
  "message": "Server is running",
  "data": { "status": "ok" }
}
```

`GET /api/health` cua giai doan 1 van hoat dong va tra cung response.

### Route khong ton tai: HTTP 404

```powershell
curl.exe -i http://localhost:3000/does-not-exist
```

```json
{
  "success": false,
  "message": "Khong tim thay API",
  "data": null,
  "errors": null
}
```

### JSON khong hop le: HTTP 400

```powershell
Invoke-WebRequest -Uri http://localhost:3000/health -Method Post -ContentType 'application/json' -Body '{invalid json'
```

```json
{
  "success": false,
  "message": "JSON khong hop le",
  "data": null,
  "errors": null
}
```

JSON duoc kiem tra truoc khi tim route, nen request nay nhan 400.

### Loi server: HTTP 500

```json
{
  "success": false,
  "message": "Loi server",
  "data": null,
  "errors": null
}
```

Error middleware duoc gan cuoi cung, sau middleware 404. Loi noi bo va stack trace
khong duoc gui ve client. Test tao mot Express app rieng de gia lap loi va kiem tra
middleware 500; ung dung chinh khong co endpoint co tinh gay loi.

## SQLite va bang users

Database va thu muc cha duoc tao tu dong khi khoi dong. Khong can cai MySQL hoac
SQLite server. Da kiem tra better-sqlite3 tren Node.js 22.20.0 Windows;
[tai lieu better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

| Cot | Kieu va rang buoc |
| --- | --- |
| id | INTEGER PRIMARY KEY AUTOINCREMENT |
| username | TEXT NOT NULL COLLATE NOCASE UNIQUE |
| email | TEXT NOT NULL COLLATE NOCASE UNIQUE |
| password_hash | TEXT NOT NULL, bcrypt cost 10 |
| created_at | TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP (UTC) |

Email duoc trim va chuyen ve chu thuong, username duoc trim. SQLite NOCASE ngan
trung khong phan biet hoa/thuong cho ky tu ASCII. Truy van dung placeholder,
rang buoc UNIQUE bao ve ca request dong thoi. Mat khau toi thieu 8 ky tu, toi da
72 byte UTF-8 de tranh bcrypt cat bot mat khau. Database local, file journal va
`.env` deu bi Git bo qua. Khong commit tai khoan that.

## API xac thuc

| Method | Endpoint | Ket qua |
| --- | --- | --- |
| POST | /api/auth/register | 201; thong tin thieu/sai: 400; username/email trung: 409 |
| POST | /api/auth/login | 200; thieu/sai dinh dang: 400; sai thong tin dang nhap: 401 |
| GET | /api/auth/me | 200; token thieu/sai/het han hoac tai khoan khong con: 401 |

### Dang ky

```http
POST /api/auth/register
Content-Type: application/json

{"username":"giang","email":"giang@example.com","password":"12345678"}
```

HTTP 201 (id va created_at phu thuoc du lieu):

```json
{
  "success": true,
  "message": "Dang ky thanh cong",
  "data": {
    "user": {"id":1,"username":"giang","email":"giang@example.com","created_at":"2026-10-26 10:00:00"}
  }
}
```

### Dang nhap

```http
POST /api/auth/login
Content-Type: application/json

{"email":"giang@example.com","password":"12345678"}
```

HTTP 200 (`accessToken` ben duoi chi la placeholder):

```json
{
  "success": true,
  "message": "Dang nhap thanh cong",
  "data": {
    "user": {"id":1,"username":"giang","email":"giang@example.com","created_at":"2026-10-26 10:00:00"},
    "accessToken": "<JWT access token>",
    "tokenType": "Bearer",
    "expiresIn": 3600
  }
}
```

JWT duoc ky HS256, co subject la user id va thoi diem het han. Middleware chi chap
nhan HS256 va kiem tra tai khoan con ton tai. Doi JWT_SECRET se vo hieu token cu.

Sai mat khau va email khong ton tai cung tra HTTP 401:

```json
{"success":false,"message":"Email hoac mat khau khong dung","data":null,"errors":null}
```

### Lay tai khoan hien tai

```http
GET /api/auth/me
Authorization: Bearer <accessToken nhan tu login>
```

HTTP 200:

```json
{
  "success": true,
  "message": "Lay thong tin tai khoan thanh cong",
  "data": {
    "user": {"id":1,"username":"giang","email":"giang@example.com","created_at":"2026-10-26 10:00:00"}
  }
}
```

Token thieu/sai/het han tra HTTP 401 voi `success: false`, `data: null`,
`errors: null`, message `Token khong hop le hoac da het han`.
Loi database bat ngo tra HTTP 500 `Loi server`, khong lo SQL hoac stack trace.
Moi response tai khoan chi co id, username, email, created_at; khong co password
hoac password_hash.

### Thu nhanh bang PowerShell

```powershell
$body = @{ username = 'giang'; email = 'giang@example.com'; password = '12345678' } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/auth/register -Method Post -ContentType 'application/json' -Body $body
$loginBody = @{ email = 'giang@example.com'; password = '12345678' } | ConvertTo-Json
$login = Invoke-RestMethod http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body $loginBody
Invoke-RestMethod http://localhost:3000/api/auth/me -Headers @{ Authorization = "Bearer $($login.data.accessToken)" }
```

## Kiem thu

`npm test` chay lai test giai doan 2 va test xac thuc. Moi file test thiet lap
`NODE_ENV=test`, `DB_PATH=:memory:` va JWT_SECRET ngau nhien truoc khi import app.
Database test tach rieng trong bo nho, khong mo hoac xoa database su dung thuc te.
Test bao gom validation, trung tai khoan (ke ca request dong thoi), bcrypt,
JWT co han, token sai/het han, response khong chua hash, va loi database 500.

## Bang news (giai doan 4)

Bang duoc bo sung bang `CREATE TABLE IF NOT EXISTS` trong database SQLite hien co.
Khong xoa/tao lai bang users, khong them du lieu tin tuc mau vao database local.

| Cot | Kieu va rang buoc |
| --- | --- |
| id | INTEGER PRIMARY KEY AUTOINCREMENT |
| title | TEXT NOT NULL, CHECK khong rong sau khi trim |
| content | TEXT NOT NULL, CHECK khong rong sau khi trim |
| author_id | INTEGER NOT NULL, FOREIGN KEY den users(id), ON DELETE RESTRICT |
| created_at | TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP (UTC) |
| updated_at | TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP (UTC) |

Bat `PRAGMA foreign_keys = ON` tren connection. Co index theo
`created_at DESC, id DESC` cho danh sach va index `author_id`.
`updated_at` duoc gan luc tao va cap nhat theo UTC khi sua thanh cong. API PUT
dung do chinh xac mili giay. `created_at` va `author_id` khong thay doi khi sua.

## API public doc tin tuc

Hai endpoint deu khong can JWT. `author` chi co `id`, `username`, khong tra email,
password hay password_hash. SQL dung placeholder cho ID, LIMIT va OFFSET.

| Method | Endpoint | Ket qua |
| --- | --- | --- |
| GET | /api/news?page=1&limit=10 | 200, danh sach va thong tin phan trang |
| GET | /api/news/:id | 200, chi tiet tin tuc |

### Danh sach

```powershell
curl.exe -i 'http://localhost:3000/api/news?page=1&limit=10'
```

Mac dinh `page=1`, `limit=10`. Ca hai phai la chuoi so nguyen duong, khong chap
nhan so thap phan, so am, ky tu la hay tham so lap. `limit` toi da 100; page, id
va offset phai trong mien so nguyen an toan cua JavaScript. Gia tri khong hop le
tra HTTP 400. Tin moi nhat truoc theo `created_at DESC`, cung thoi diem thi `id DESC`.

Vi du HTTP 200 khi co du lieu (du lieu minh hoa, khong duoc seed vao database):

```json
{
  "success": true,
  "message": "Lay danh sach tin tuc thanh cong",
  "data": {
    "news": [
      {
        "id": 1,
        "title": "Tieu de tin tuc",
        "content": "Noi dung tin tuc",
        "author": { "id": 1, "username": "giang" },
        "created_at": "2026-10-26 10:00:00",
        "updated_at": "2026-10-26 10:00:00"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
}
```

Database chua co tin tuc van tra HTTP 200:

```json
{
  "success": true,
  "message": "Lay danh sach tin tuc thanh cong",
  "data": {
    "news": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
  }
}
```

Page vuot trang cuoi tra `news: []` va giu nguyen `total`, `totalPages`.

### Chi tiet

```powershell
curl.exe -i http://localhost:3000/api/news/1
```

HTTP 200 khi ID ton tai:

```json
{
  "success": true,
  "message": "Lay chi tiet tin tuc thanh cong",
  "data": {
    "news": {
      "id": 1,
      "title": "Tieu de tin tuc",
      "content": "Noi dung tin tuc",
      "author": { "id": 1, "username": "giang" },
      "created_at": "2026-10-26 10:00:00",
      "updated_at": "2026-10-26 10:00:00"
    }
  }
}
```

ID khong hop le (vi du `/api/news/abc`, `/api/news/0`) tra HTTP 400:

```json
{"success":false,"message":"ID khong hop le","data":null,"errors":null}
```

ID hop le nhung khong ton tai tra HTTP 404:

```json
{"success":false,"message":"Khong tim thay tin tuc","data":null,"errors":null}
```

Loi database bat ngo dung middleware hien co, tra HTTP 500 `Loi server`, khong
lo truy van hoac stack trace. `/api/news/` la danh sach; chi tiet can co `:id`.

### Test tin tuc

`test/news.test.js` dung SQLite `:memory:` rieng va du lieu mau chi trong test.
Test danh sach rong/co du lieu, thu tu on dinh, chi tiet, phan trang, ID khong
hop le/khong ton tai, API public, khong lo thong tin rieng, khoa ngoai va loi 500.
`npm test` chay ca test news va toan bo test giai doan 2, 3.

## API private ghi tin tuc (giai doan 5)

Dang nhap qua `POST /api/auth/login`, lay `data.accessToken` va gui header:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

| Method | Endpoint | Thanh cong |
| --- | --- | --- |
| POST | /api/news | 201, `data.news` chua tin vua tao |
| PUT | /api/news/:id | 200, `data.news` chua tin da sua |
| DELETE | /api/news/:id | 200, `data.id` la ID vua xoa |

POST va PUT can ca `title` va `content`, deu phai la chuoi khong rong sau khi
trim; server luu gia tri da trim. PUT cap nhat ca hai truong. Thieu body, sai
kieu hoac chuoi chi co khoang trang tra 400. Chi title/content duoc lay tu body;
author_id luon lay tu `req.user.id` do middleware JWT xac thuc. Client khong the
gan tac gia, doi tac gia, doi id hay thoi gian tao qua body.

Thieu, sai hoac het han JWT tra 401. ID sai tra 400. Tin khong ton tai tra 404.
Tai khoan khac tac gia khong duoc sua/xoa, tra 403 va khong thay doi du lieu.
Loi database bat ngo tra 500 `Loi server`, khong gui SQL hoac stack trace.
GET danh sach/chi tiet van public va khong can Authorization.

### Them tin

```http
POST /api/news
Authorization: Bearer <accessToken>
Content-Type: application/json

{"title":"Tin moi","content":"Noi dung tin moi"}
```

HTTP 201 (id va thoi gian la vi du):

```json
{
  "success": true,
  "message": "Them tin tuc thanh cong",
  "data": {
    "news": {
      "id": 1,
      "title": "Tin moi",
      "content": "Noi dung tin moi",
      "author": { "id": 1, "username": "giang" },
      "created_at": "2026-10-26 10:00:00",
      "updated_at": "2026-10-26 10:00:00"
    }
  }
}
```

### Sua tin cua minh

```http
PUT /api/news/1
Authorization: Bearer <accessToken>
Content-Type: application/json

{"title":"Tieu de da sua","content":"Noi dung da sua"}
```

HTTP 200 co `success: true`, message `Sua tin tuc thanh cong`, `data.news`
co cau truc nhu response them tin, title/content moi va updated_at da cap nhat.

Vi du HTTP 403 neu tai khoan khac sua:

```json
{"success":false,"message":"Ban khong co quyen sua tin tuc nay","data":null,"errors":null}
```

### Xoa tin cua minh

```http
DELETE /api/news/1
Authorization: Bearer <accessToken>
```

HTTP 200:

```json
{"success":true,"message":"Xoa tin tuc thanh cong","data":{"id":1}}
```

### Quyen so huu va transaction

Model sua/xoa bang SQL parameterized voi `WHERE id = ? AND author_id = ?`.
Moi thao tac chay trong transaction `IMMEDIATE` (giu write lock) gom ghi,
kiem tra ton tai de phan biet 403/404 va doc lai ket qua. Khong co khoang trong
giua kiem tra quyen va thao tac de connection khac thay doi quyen so huu.
Neu co loi, SQLite rollback transaction; middleware cu tra response loi chung.

### Thu bang PowerShell sau khi dang nhap

```powershell
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
$body = @{ title = 'Tin moi'; content = 'Noi dung tin moi' } | ConvertTo-Json
$created = Invoke-RestMethod http://localhost:3000/api/news -Method Post -Headers $headers -ContentType 'application/json' -Body $body
$id = $created.data.news.id
$updatedBody = @{ title = 'Tieu de da sua'; content = 'Noi dung da sua' } | ConvertTo-Json
Invoke-RestMethod "http://localhost:3000/api/news/$id" -Method Put -Headers $headers -ContentType 'application/json' -Body $updatedBody
Invoke-RestMethod "http://localhost:3000/api/news/$id" -Method Delete -Headers $headers
```

`test/news-write.test.js` dung SQLite trong bo nho rieng, hai tai khoan test
va JWT ky bang secret ngau nhien. Test ca quyen so huu, body gia mao author_id,
du lieu sai, token thieu/sai/het han, updated_at, rollback va GET public.
Chay `npm test` de chay ca test ghi va baseline 62 test cua giai doan 4.

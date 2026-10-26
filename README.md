# News Management Backend API

Backend bai tap Nhiem vu 17, hien hoan thanh giai doan 3: dang ky, dang nhap va JWT.
Su dung JavaScript, Node.js, Express, SQLite (better-sqlite3), bcryptjs va jsonwebtoken.
Chua trien khai API tin tuc, upload hoac frontend.

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
  routes/
    healthRoutes.js
    authRoutes.js
  middlewares/
    .gitkeep
    notFound.js
    errorHandler.js
    validateAuth.js
    authenticate.js
  models/
    .gitkeep
    userModel.js
  services/
    .gitkeep
    authService.js
  utils/
    .gitkeep
    response.js
    httpError.js
test/
  app.test.js
  auth.test.js
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

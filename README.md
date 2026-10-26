# News Management Backend API

Backend bai tap Nhiem vu 17, hien hoan thanh cau hinh moi truong va Request/Response.
Su dung JavaScript, Node.js va Express. Chua trien khai database, authentication,
API tin tuc hoac upload.

## Chay local

Yeu cau Node.js 22 tro len (de dung `node --watch`, `node:test` va `fetch`).

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

`npm run dev` tu khoi dong lai khi source thay doi. `npm test` chay test toi thieu
bang Node.js, khong can cai them framework.

## Bien moi truong va cau hinh dung chung

| Bien | Mac dinh | Gia tri hop le |
| --- | --- | --- |
| PORT | 3000 | So nguyen tu 1 den 65535 |
| NODE_ENV | development | development, test, production |

Khong bat buoc tao `.env` khi dung gia tri mac dinh. Bien moi truong cua process
duoc uu tien hon `.env`. Cau hinh khong hop le se dung ung dung voi thong bao loi.
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
  controllers/
    healthController.js
  routes/
    healthRoutes.js
  middlewares/
    .gitkeep
    notFound.js
    errorHandler.js
  models/
    .gitkeep
  services/
    .gitkeep
  utils/
    .gitkeep
    response.js
test/
  app.test.js
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

# API file - giai doan 7

Ca hai endpoint bat buoc `Authorization: Bearer <accessToken>` tu API login.
Khong tao public static route cho uploads, khong lien ket file voi tin tuc.

## Upload

```powershell
curl.exe -i -X POST http://localhost:3000/api/files/upload -H "Authorization: Bearer <accessToken>" -F "file=@C:/path/to/photo.png"
```

Gui multipart/form-data, dung mot field `file`, khong gui them file/field khac.
Nhan JPG/JPEG, PNG, WEBP toi da 5 * 1024 * 1024 byte. MIME va extension phai
khop dinh dang thuc. Multer nhan trong bo nho; Sharp doc metadata va giai ma
pixel (`stats`) de tu choi file hong/gia mao, gioi han 16 * 1024 * 1024 pixel.
Ten goc khong duoc dung lam duong dan luu; server tao UUID va extension theo
dinh dang thuc, tao thu muc neu thieu va ghi file voi che do `wx` tranh ghi de.

HTTP 201 (id, ten va thoi gian la minh hoa):

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

Bang `files`: id INTEGER PRIMARY KEY AUTOINCREMENT; filename TEXT UNIQUE NOT NULL;
size INTEGER NOT NULL CHECK(size > 0); mimetype TEXT NOT NULL; uploaded_by INTEGER
NOT NULL REFERENCES users(id) ON DELETE RESTRICT; created_at TEXT NOT NULL DEFAULT
CURRENT_TIMESTAMP. Co index uploaded_by.

## Xoa

```powershell
curl.exe -i -X DELETE http://localhost:3000/api/files/1 -H "Authorization: Bearer <accessToken>"
```

Chi chu file duoc xoa. HTTP 200:

```json
{"success":true,"message":"Xoa file thanh cong","data":{"id":1}}
```

File tren dia da mat thi van xoa metadata va tra 200. Ten trong metadata phai
dung mau UUID + extension, path phai nam trong upload root, khong chap nhan
symbolic link. Kiem tra chu so huu va xoa chay trong transaction IMMEDIATE.
Loi database khi upload thi rollback metadata va xoa file vua ghi; loi xoa
metadata thi rollback va khoi phuc bytes da xoa. Khong co file tam tren dia.
Filesystem va SQLite khong co commit chung: process/may bi tat dot ngot hoac
loi ca thao tac bu tru van co the can doi soat thu cong, khong cam ket crash-atomic.

| Loi | HTTP |
| --- | --- |
| JWT thieu/sai/het han | 401 |
| Thieu file, sai field, anh hong/sai loai, MIME/extension khong khop | 400 |
| Vuot 5 MiB | 413 |
| Khac nguoi upload | 403 |
| ID sai / khong ton tai | 400 / 404 |
| Loi server | 500, message chung, khong lo path/stack |

`UPLOAD_DIR` mac dinh `./uploads`, tinh tu root project. `.gitignore` da bo qua
uploads. `.env` va database local cung khong duoc commit. Neu doi UPLOAD_DIR,
giu thu muc du lieu ngoai Git. Test dung SQLite :memory: va thu muc mkdtemp
rieng duoi uploads, duoc don sau test; khong cham file that.

Tai lieu ky thuat: [Multer](https://expressjs.com/en/resources/middleware/multer/),
[Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/).

# Đối chiếu Nhiệm vụ 17 và kiểm tra cuối

Ngày kiểm tra: **27/10/2026**, Windows, Node.js 22.20.0, npm 10.9.3.
Code được nghiệm thu từ commit `1c17d1c`; giai đoạn 8 chỉ cập nhật tài liệu/collection.
Không thay source, dependency, schema hoặc dữ liệu thực tế để làm bài kiểm tra này.

## Bằng chứng từng yêu cầu

Chỉ ghi Đạt khi đã kiểm tra code hoặc thực thi kiểm thử tương ứng.

| Yêu cầu | Bằng chứng thực tế | Kết luận |
| --- | --- | --- |
| Chọn ngôn ngữ Backend | package.json: JavaScript/Node.js; src/server.js chạy Express và nhận HTTP thật | Đạt |
| Cấu trúc dự án | src/config, controllers, routes, middlewares, models, services, utils; tách truy vấn, nghiệp vụ và HTTP | Đạt |
| Biến môi trường | src/config/env.js, .env.example; kiểm tra biểu thức tạo secret trên bản sao file mẫu, không in secret | Đạt |
| Cấu hình dùng chung | env.js được require ở server/database/auth; files.js chia sẻ đường dẫn và giới hạn; không dùng global | Đạt |
| Request/Response | src/utils/response.js, middleware notFound/errorHandler; test health/400/404/500 và các API trả JSON thống nhất | Đạt |
| Đăng ký/đăng nhập | authRoutes/authService/userModel; POST /api/auth/register, /login, GET /me; test bcrypt, JWT, trùng tài khoản và thông tin sai | Đạt |
| Public đọc tin | GET /api/news, GET /api/news/:id; test không JWT, danh sách rỗng, phân trang và ID sai/không tồn tại | Đạt |
| Private thêm/sửa/xóa | POST /api/news, PUT/DELETE /api/news/:id; authenticate, newsModel transaction IMMEDIATE; test tác giả/403, giả author_id và rollback | Đạt |
| Tìm kiếm/sắp xếp | newsService/newsModel; search title/content ASCII, allowlist sort, tie-breaker id; test tổng sau lọc, SQL injection và phân trang kết hợp | Đạt |
| Upload/xóa file | fileRoutes/fileService/fileModel, Multer và Sharp; JPG/PNG/WEBP thật, giới hạn 5 MiB, quyền xóa, traversal, dọn/khôi phục file khi lỗi | Đạt |
| Repository GitHub | origin và friend cùng trỏ Giang-Nguyen-2005/news-api-nodejs qua hai alias; fetch trước khi sửa: local và hai remote ở 1c17d1c | Đạt, tài liệu giai đoạn 8 chưa push |

Các file trên nằm dưới root project, route gắn trong `src/app.js`. Bảng SQLite
users/news/files và các ràng buộc nằm trong `src/config/database.js`.

## Kết quả lệnh kiểm tra

| Kiểm tra | Kết quả và bằng chứng |
| --- | --- |
| npm ci | Thành công từ package-lock, không thay dependency/lockfile |
| npm test | 188 test, 188 pass, 0 fail, 0 skipped; giữ nguyên toàn bộ baseline |
| npm audit --json | Exit 0, vulnerabilities rỗng, tổng 0 tại thời điểm kiểm tra |
| Cú pháp | node --check trên toàn bộ src/**/*.js và test/**/*.js đạt |
| Khởi động | Chạy src/server.js với cấu hình test riêng, nhận HTTP qua loopback |
| Route thực tế | 13 request từ collection và script post-response đạt; phủ đủ 12 cặp method/route, GET list được gọi hai lần |
| Xóa dữ liệu demo | Ảnh upload đã biến mất trên đĩa; GET bài vừa xóa nhận 404 |
| Secret trong tài liệu | Collection export có accessToken/newsId/fileId rỗng, không có JWT_SECRET; tài liệu không chứa secret local |
| Git ignore/tracking | .env, data/news.db, uploads/example.png được ignore; không track .env, data, uploads hoặc database; chỉ .env.example được track |

Route chạy thành công: health 200; register 201; login 200; tạo tin 201; danh sách,
chi tiết, search/sort, sửa tin 200; upload 201; xóa ảnh/tin 200; me và alias health 200.
Các trường hợp lỗi/401/403/400/409/413/500 được bao phủ bởi bộ 188 test.

Collection được parse JSON, kiểm tra script, và chạy request qua Node fetch; script
post-response chạy với các API pm dùng trong collection được mô phỏng tối thiểu.
Đây **không phải** kết quả chạy GUI Postman/Newman. Người chấm có thể import và
chạy theo [hướng dẫn Postman](postman.md), chọn ảnh trên máy ở bước upload.

## Cảnh báo Sharp WASM

`npm ls --depth=0` sau npm ci vẫn báo @img/sharp-wasm32 0.35.5,
@emnapi/runtime 1.11.3 và tslib 2.8.1 là extraneous.

Bằng chứng từ package-lock và package.json đã cài:

- Sharp có các dependency tùy chọn @img/sharp-freebsd-wasm32 và
  @img/sharp-webcontainers-wasm32; chúng phụ thuộc @img/sharp-wasm32.
- @img/sharp-wasm32 phụ thuộc @emnapi/runtime; runtime phụ thuộc tslib.
- require.cache xác nhận binary đang nạp là
  `@img/sharp-win32-x64/lib/sharp-win32-x64-0.35.5.node`; libvips 8.18.7.
- Cài sạch, giải mã ảnh thật, 188 test và audit đều thành công.

Vì vậy cảnh báo thuộc nhánh tùy chọn WASM, không phải lỗi thiếu binary Windows
trong lần nghiệm thu này. Không thêm/xóa/đổi phiên bản dependency để che cảnh báo.
Không khẳng định nguyên nhân nội bộ của npm khi chưa điều tra sâu hơn.

## Giới hạn và đánh giá

- SQLite và filesystem không có transaction chung. Bù trừ đã được test cho lỗi
  thông thường; mất điện hoặc lỗi cả bước khôi phục có thể cần đối soát thủ công.
- Search không phân biệt hoa/thường cho ASCII; sort title theo TEXT/BINARY SQLite.
- Ảnh giới hạn 5 MiB và 16 × 1024 × 1024 pixel; chưa có download/static route.
- Không có refresh token, admin, frontend hoặc deploy; không tính là chức năng đã làm.
- Chưa chạy GUI Postman; đã có hướng dẫn, collection sạch và kiểm tra HTTP thực tế.

**Sẵn sàng nộp về chức năng và tài liệu trong phạm vi yêu cầu**, với các giới hạn
đã nêu. Commit tài liệu giai đoạn 8 chỉ ở local cho đến khi người dùng duyệt push.

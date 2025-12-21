# Admin Management Scripts

Các script quản lý admin cho DRM Video Document Library Platform.

## 📋 Danh sách Scripts

### 1. Bổ nhiệm Admin (make-admin.ts)
Gán role admin cho user thông qua email.

### 2. Liệt kê Admin (list-admins.ts)
Xem danh sách tất cả admin trong hệ thống.

---

## 🚀 Hướng dẫn sử dụng

### Bổ nhiệm Admin qua Email

**Lưu ý quan trọng:** User phải đăng nhập ít nhất 1 lần trước khi có thể được bổ nhiệm admin.

**Cách 1: Sử dụng npx tsx (Khuyến nghị)**
```bash
npx tsx server/scripts/make-admin.ts <email>
```

**Ví dụ:**
```bash
npx tsx server/scripts/make-admin.ts admin@example.com
```

**Kết quả thành công:**
```
🔍 Đang tìm user với email: admin@example.com...
⚙️  Đang cập nhật role...

✅ Bổ nhiệm admin thành công!
   Email: admin@example.com
   Tên: Nguyễn Văn A
   Role: admin
   ID: 123e4567-e89b-12d3-a456-426614174000

🎉 User này giờ đã có quyền admin!
```

**Nếu user chưa tồn tại:**
```
❌ Không tìm thấy user với email: unknown@example.com

💡 Lưu ý: User phải đăng nhập ít nhất 1 lần trước khi bổ nhiệm admin
```

**Nếu đã là admin:**
```
✅ User admin@example.com đã là admin rồi!
   Tên: Nguyễn Văn A
   ID: 123e4567-e89b-12d3-a456-426614174000
```

---

### Liệt kê tất cả Admin

**Lệnh:**
```bash
npx tsx server/scripts/list-admins.ts
```

**Kết quả:**
```
🔍 Đang tìm tất cả admin...

✅ Tìm thấy 2 admin:

1. Nguyễn Văn A
   📧 Email: admin1@example.com
   🆔 ID: 123e4567-e89b-12d3-a456-426614174000
   📅 Tạo lúc: 27/10/2025, 11:30:00

2. Trần Thị B
   📧 Email: admin2@example.com
   🆔 ID: 987f6543-c21b-45d6-b789-987654321000
   📅 Tạo lúc: 28/10/2025, 09:15:00
```

---

## 📝 Quy trình bổ nhiệm Admin lần đầu

1. **User đăng nhập vào hệ thống** (qua Replit Auth)
   - Truy cập website
   - Click "Đăng nhập"
   - Đăng nhập bằng tài khoản Replit

2. **Kiểm tra email của user**
   - User có thể xem email trong profile

3. **Chạy script bổ nhiệm admin**
   ```bash
   npx tsx server/scripts/make-admin.ts <email-của-user>
   ```

4. **Xác nhận**
   - User logout và login lại
   - User giờ có quyền truy cập Admin Panel
   - Admin Panel xuất hiện trong menu

---

## 🔧 Troubleshooting

### Lỗi: "Cannot find module"
**Nguyên nhân:** Dependencies chưa được cài đặt

**Giải pháp:**
```bash
npm install
```

### Lỗi: "Database connection failed"
**Nguyên nhân:** Không kết nối được database

**Giải pháp:**
- Kiểm tra biến môi trường DATABASE_URL
- Đảm bảo database đang chạy

### Lỗi: "User must login first"
**Nguyên nhân:** User chưa từng đăng nhập vào hệ thống

**Giải pháp:**
1. Mở website trong trình duyệt
2. Đăng nhập với tài khoản Replit của user
3. Sau đó chạy lại script

---

## 💡 Tips

- **Bổ nhiệm nhiều admin:** Chạy script nhiều lần với email khác nhau
- **Kiểm tra danh sách:** Dùng `list-admins.ts` để xem tất cả admin
- **An toàn:** Script không thể xóa admin, chỉ thêm mới

---

## 🔐 Bảo mật

- Chỉ người có quyền truy cập terminal/database mới chạy được script
- Script không có API endpoint, không thể gọi từ web
- Mọi thay đổi được log ra console

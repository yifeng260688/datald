# 🔐 Hướng dẫn Bổ nhiệm Admin

Quick reference để bổ nhiệm admin cho DRM Video Document Library Platform.

## ⚡ Quick Start

### Bước 1: User đăng nhập vào website
User phải đăng nhập ít nhất 1 lần để tài khoản được tạo trong database.

### Bước 2: Chạy lệnh bổ nhiệm admin

```bash
npx tsx server/scripts/make-admin.ts <email-của-user>
```

**Ví dụ:**
```bash
npx tsx server/scripts/make-admin.ts admin@example.com
```

### Bước 3: Xác nhận
User logout và login lại để thấy Admin Panel.

---

## 📋 Các lệnh thường dùng

### 1. Bổ nhiệm Admin
```bash
npx tsx server/scripts/make-admin.ts <email>
```

### 2. Xem danh sách Admin
```bash
npx tsx server/scripts/list-admins.ts
```

---

## ✅ Kết quả mong đợi

### Thành công:
```
🔍 Đang tìm user với email: admin@example.com...
⚙️  Đang cập nhật role...

✅ Bổ nhiệm admin thành công!
   Email: admin@example.com
   Tên: Nguyễn Văn A
   Role: admin
   ID: 47369284

🎉 User này giờ đã có quyền admin!
```

### User chưa tồn tại:
```
❌ Không tìm thấy user với email: admin@example.com

💡 Lưu ý: User phải đăng nhập ít nhất 1 lần trước khi bổ nhiệm admin
```

### User đã là admin:
```
✅ User admin@example.com đã là admin rồi!
   Tên: Nguyễn Văn A
   ID: 47369284
```

---

## 🎯 Quyền của Admin

Sau khi được bổ nhiệm, admin có thể:
- ✅ Truy cập Admin Panel (menu bên trái)
- ✅ Quản lý tài liệu (thêm/sửa/xóa)
- ✅ Quản lý tags
- ✅ Upload file hàng loạt (max 500MB)
- ✅ Phê duyệt user uploads
- ✅ Quản lý users

---

## 📚 Chi tiết đầy đủ

Xem file `server/scripts/README.md` để biết thêm chi tiết và troubleshooting.

# ✅ Admin Panel Checklist - Kiểm tra nhanh

## 🎯 Mục tiêu: Xác nhận 4 tính năng admin

### ☑️ Yêu cầu 1: Upload File Hàng loạt (500MB)

**Vị trí:** Admin Panel → **Upload Hàng loạt**

- [ ] Thấy trang "Bulk Upload"
- [ ] Có nút chọn file (PDF/Excel/CSV)
- [ ] Giới hạn 500MB được hiển thị
- [ ] Có thanh progress bar
- [ ] Hiển thị bảng lịch sử upload
- [ ] Có trạng thái pipeline (Pending/Processing/Completed/Failed)
- [ ] Có nút xóa file

**Test:**
1. Click "Chọn file"
2. Chọn file PDF/CSV/Excel nhỏ (< 10MB)
3. Click "Upload"
4. Xem thanh progress bar chạy 0% → 100%
5. File xuất hiện trong bảng dưới

---

### ☑️ Yêu cầu 2: Quản lý User Uploads (Approval)

**Vị trí:** Admin Panel → **User Uploads**

- [ ] Thấy trang "User Uploads"
- [ ] Hiển thị danh sách file user đã upload
- [ ] Thấy thông tin: tên user, email, filename, size, ngày upload
- [ ] Thấy trạng thái: Pending/Approved/Rejected
- [ ] File pending có nút "Duyệt" và "Từ chối"
- [ ] Có link xem file (icon external link)

**Test:**
1. Xem danh sách user uploads
2. Tìm file có status "Pending"
3. Click nút "Duyệt" hoặc "Từ chối"
4. Thấy toast notification
5. Status cập nhật ngay lập tức

---

### ☑️ Yêu cầu 3: Quản lý User (Thành viên)

**Vị trí:** Admin Panel → **Người dùng**

- [ ] Thấy trang "Users"
- [ ] Hiển thị tổng số thành viên
- [ ] Bảng user với: tên, email, role, favorites, ngày tham gia
- [ ] Có dropdown thay đổi role (Admin/User)
- [ ] Tìm kiếm user

**Test:**
1. Xem số lượng users
2. Tìm 1 user có role "user"
3. Thay đổi role thành "admin"
4. Thấy toast "Cập nhật thành công"
5. Role cập nhật ngay

---

### ☑️ Yêu cầu 4: Quản lý Tài liệu (Edit/Delete Posts)

**Vị trí:** Admin Panel → **Tài liệu**

- [ ] Thấy trang "Documents"
- [ ] Bảng tài liệu với: cover, title, category, views, tags
- [ ] Nút "Thêm tài liệu"
- [ ] Icon Edit (bút chì) mỗi tài liệu
- [ ] Icon Delete (thùng rác) mỗi tài liệu
- [ ] Tìm kiếm/filter tài liệu

**Test:**
1. Click icon Edit (pencil) bất kỳ document
2. Thấy form chỉnh sửa với tất cả fields
3. Thay đổi title
4. Click "Cập nhật"
5. Thấy toast "Cập nhật thành công"
6. Title đã thay đổi

**Test Delete:**
1. Click icon Delete (trash)
2. Thấy dialog xác nhận
3. Click "Xóa"
4. Document biến mất khỏi list

---

## 🚀 Hướng dẫn nhanh

### Nếu KHÔNG thấy Admin Panel:

1. **Kiểm tra bạn đã login chưa:**
   - Xem góc phải trên có tên user không
   - Nếu chưa → Click "Đăng nhập"

2. **Kiểm tra tài khoản có quyền admin chưa:**
   ```bash
   npx tsx server/scripts/list-admins.ts
   ```

3. **Nếu chưa là admin, bổ nhiệm:**
   ```bash
   npx tsx server/scripts/make-admin.ts <email-của-bạn>
   ```

4. **Logout và login lại:**
   - Click avatar → Logout
   - Login lại
   - Refresh browser (Ctrl+F5)

### Nếu ĐÃ thấy nhưng thiếu menu items:

1. **Hard refresh browser:**
   - Windows/Linux: `Ctrl + Shift + R` hoặc `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

2. **Clear cache và refresh:**
   - Chrome: F12 → Network tab → Check "Disable cache"
   - Firefox: F12 → Network tab → Check "Disable cache"

3. **Thử truy cập trực tiếp:**
   - http://localhost:5000/admin/bulk-upload
   - http://localhost:5000/admin/user-uploads
   - http://localhost:5000/admin/users
   - http://localhost:5000/admin/documents

---

## 📋 Menu Admin Panel (đầy đủ)

Sau khi login với tài khoản admin, bạn phải thấy:

```
Admin Panel
├─ 📊 Dashboard
├─ 📄 Tài liệu          ← YÊU CẦU 4: Edit/Delete posts
├─ 🏷️  Tags
├─ 📤 Upload Hàng loạt  ← YÊU CẦU 1: Bulk upload 500MB
├─ ✅ User Uploads      ← YÊU CẦU 2: Approve user uploads
└─ 👥 Người dùng        ← YÊU CẦU 3: User management
```

---

## ✅ Tất cả tính năng ĐÃ CÓ

Nếu bạn đã làm theo các bước trên mà vẫn không thấy, vui lòng:

1. **Chụp màn hình** menu bên trái Admin Panel
2. **Check console log** (F12 → Console tab)
3. **Kiểm tra email admin:**
   ```bash
   npx tsx server/scripts/list-admins.ts
   ```

Server đang chạy tốt, tất cả API endpoints hoạt động bình thường!

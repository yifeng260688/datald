# 🔐 Hướng dẫn Thiết lập Google OAuth

## 📋 Vấn đề

Lỗi: "redirect_uri_mismatch" - Redirect URI không khớp với URI đã đăng ký trong Google Cloud Console.

## ✅ Giải pháp

### Bước 1: Cấu hình Biến Môi Trường

Thêm các biến sau vào file `.env`:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Custom callback URL (nếu không set, sẽ tự động build từ HOST và PORT)
# GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Server Configuration
PORT=5000
HOST=localhost
NODE_ENV=development
```

### Bước 2: Đăng ký Redirect URI trong Google Cloud Console

1. **Truy cập Google Cloud Console:**
   - Vào: https://console.cloud.google.com/
   - Chọn project của bạn

2. **Điều hướng đến OAuth 2.0 Client IDs:**
   - Vào **APIs & Services** > **Credentials**
   - Tìm OAuth 2.0 Client ID của bạn (hoặc tạo mới nếu chưa có)
   - Click vào Client ID để chỉnh sửa

3. **Thêm Authorized redirect URIs:**
   
   **Cho Development (localhost):**
   ```
   http://localhost:5000/api/auth/google/callback
   http://localhost:3000/api/auth/google/callback  (nếu bạn cũng dùng port 3000)
   ```
   
   **Cho Production:**
   ```
   https://yourdomain.com/api/auth/google/callback
   ```

4. **Lưu thay đổi:**
   - Click **Save** để lưu cấu hình

### Bước 3: Kiểm tra Cấu hình

Sau khi cấu hình xong, khi server khởi động bạn sẽ thấy log:
```
[GoogleAuth] Callback URL configured: http://localhost:5000/api/auth/google/callback
```

## 🔍 Troubleshooting

### Lỗi: "redirect_uri_mismatch"

**Nguyên nhân:**
- Redirect URI trong code không khớp với URI đã đăng ký trong Google Cloud Console
- Port server khác với port đã đăng ký

**Giải pháp:**
1. Kiểm tra PORT trong `.env` file
2. Đảm bảo redirect URI trong Google Cloud Console khớp với:
   ```
   http://localhost:{PORT}/api/auth/google/callback
   ```
3. Nếu dùng custom domain, đảm bảo dùng HTTPS và domain đúng

### Lỗi: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET"

**Giải pháp:**
1. Kiểm tra file `.env` có các biến này không
2. Đảm bảo không có khoảng trắng thừa
3. Restart server sau khi thay đổi `.env`

### Lỗi: "Invalid client"

**Giải pháp:**
1. Kiểm tra GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET đúng chưa
2. Đảm bảo OAuth consent screen đã được cấu hình
3. Kiểm tra OAuth 2.0 Client ID đã được enable chưa

## 📝 Lưu ý quan trọng

1. **Development vs Production:**
   - Development: Dùng `http://localhost:{PORT}`
   - Production: Dùng `https://yourdomain.com`

2. **Multiple Redirect URIs:**
   - Bạn có thể đăng ký nhiều redirect URIs trong Google Cloud Console
   - Mỗi URI trên một dòng riêng

3. **OAuth Consent Screen:**
   - Đảm bảo OAuth consent screen đã được cấu hình
   - Thêm test users nếu app đang ở chế độ testing

4. **Security:**
   - KHÔNG commit file `.env` vào Git
   - Bảo mật GOOGLE_CLIENT_SECRET
   - Sử dụng HTTPS trong production

## 🔗 Tài liệu tham khảo

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Passport.js Google Strategy](http://www.passportjs.org/packages/passport-google-oauth20/)


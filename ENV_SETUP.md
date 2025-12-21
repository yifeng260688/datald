# 🔧 Hướng dẫn Thiết lập Biến Môi Trường

## 📋 Tổng quan

Dự án này sử dụng file `.env` để quản lý các biến môi trường. File `.env` được tự động load khi server khởi động.

## 🚀 Cách sử dụng

### Bước 1: Tạo file .env

Copy file `.env.example` thành `.env`:

```powershell
Copy-Item .env.example .env
```

Hoặc tạo file `.env` mới và copy nội dung từ `.env.example`.

### Bước 2: Điền các giá trị

Mở file `.env` và điền các giá trị thực tế cho các biến môi trường:

#### Biến bắt buộc (tối thiểu để chạy development):
- `NODE_ENV` - Môi trường (development/production)
- `PORT` - Port server (mặc định: 5000)
- `HOST` - Host server (mặc định: localhost)
- `SESSION_SECRET` - Secret key cho session (tạo bằng: `openssl rand -base64 32`)

#### Biến tùy chọn nhưng khuyến nghị:
- `DATABASE_URL` - PostgreSQL/Neon database connection string
- `MONGO_URI` - MongoDB connection string
- `USE_MONGO` - Bật/tắt MongoDB (true/false)

#### Biến cho các tính năng nâng cao:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Cho Google OAuth
- `DO_ACCESS_KEY` / `DO_SECRET_KEY` - Cho DigitalOcean Spaces
- `GOOGLE_API_KEY` - Cho AI metadata generation

## 📝 Các biến môi trường chi tiết

### Server Configuration
```env
NODE_ENV=development
PORT=5000
HOST=localhost
```

### Database
```env
# PostgreSQL/Neon (bắt buộc)
DATABASE_URL=postgresql://user:password@host:5432/database

# MongoDB (tùy chọn)
MONGO_URI=mongodb://localhost:27017/datavault
USE_MONGO=true
```

### Authentication
```env
SESSION_SECRET=your-super-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Storage (DigitalOcean Spaces)
```env
DO_ENDPOINT=https://sgp1.digitaloceanspaces.com
DO_ACCESS_KEY=your-access-key
DO_SECRET_KEY=your-secret-key
DO_BUCKET_NAME=data-ld1
```

### AI Services
```env
GOOGLE_API_KEY=your-gemini-api-key
```

## ⚠️ Lưu ý quan trọng

1. **KHÔNG commit file `.env`** vào Git - file này đã được thêm vào `.gitignore`
2. **Luôn commit file `.env.example`** để team biết cần những biến nào
3. **Sử dụng giá trị mạnh cho `SESSION_SECRET`** trong production
4. **Bảo mật các API keys** - không chia sẻ file `.env` công khai

## 🔍 Kiểm tra biến môi trường

Khi server khởi động, bạn sẽ thấy log:
```
📝 Environment loaded from: /path/to/.env
📝 NODE_ENV: development
```

Nếu thiếu biến bắt buộc, server sẽ hiển thị cảnh báo.

## 🛠️ Troubleshooting

### Lỗi: "Missing required environment variables"
- Kiểm tra file `.env` có tồn tại không
- Kiểm tra các biến bắt buộc đã được điền chưa
- Kiểm tra không có khoảng trắng thừa trong file `.env`

### Lỗi: "Cannot find module 'dotenv'"
- Chạy: `npm install dotenv`
- Đảm bảo `dotenv` có trong `package.json`

### Biến môi trường không được load
- Đảm bảo file `.env` ở thư mục root của project
- Kiểm tra format file `.env` (không có quotes không cần thiết)
- Restart server sau khi thay đổi `.env`

## 📚 Tham khảo

- [dotenv documentation](https://github.com/motdotla/dotenv)
- Xem file `.env.example` để biết tất cả các biến có sẵn


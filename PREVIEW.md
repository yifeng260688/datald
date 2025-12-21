# 🚀 Hướng dẫn Khởi động Preview

## Cách khởi động Preview tự động

### Phương pháp 1: Sử dụng Script PowerShell (Khuyến nghị)

Chạy script tự động:
```powershell
.\preview.ps1
```

### Phương pháp 2: Chạy trực tiếp npm

```powershell
npm run dev
```

### Phương pháp 3: Chạy từng bước

1. Cài đặt dependencies (nếu chưa có):
```powershell
npm install
```

2. Khởi động server development:
```powershell
npm run dev
```

## 🔍 Truy cập Preview

Sau khi server khởi động thành công, bạn sẽ thấy thông báo:

```
🚀 PREVIEW READY: http://localhost:5000
```

Truy cập website tại:
- **http://localhost:5000**
- **http://127.0.0.1:5000**

## ⚠️ Xử lý lỗi

### Port đã được sử dụng
Nếu gặp lỗi `Port 5000 is already in use`, bạn có thể:
- Dừng process đang sử dụng port 5000
- Hoặc thay đổi port bằng cách set biến môi trường:
  ```powershell
  $env:PORT=5001
  npm run dev
  ```

### Dependencies chưa được cài đặt
Chạy lệnh:
```powershell
npm install
```

### MongoDB Connection Issues
Nếu gặp lỗi kết nối MongoDB, server vẫn sẽ chạy với in-memory storage. 
Dữ liệu sẽ không được lưu trữ vĩnh viễn trong trường hợp này.

## 📝 Lưu ý

- Server sẽ tự động reload khi code thay đổi (hot reload)
- Preview chỉ hoạt động trong môi trường development
- Để build cho production, sử dụng: `npm run build`


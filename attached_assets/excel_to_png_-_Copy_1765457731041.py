import os
import pandas as pd
from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright
import math
import shutil
from PIL import Image, ImageFilter, ImageDraw, ImageFont
import re
import warnings
import sys

# --- TẮT CẢNH BÁO PANDAS ---
warnings.simplefilter(action='ignore', category=FutureWarning)

# --- CẤU HÌNH ---
EXCEL_DIR = "excel_files"
HTML_DIR = "output_html"
IMAGE_DIR = "output_images"
DATA_CHECK_DIR = "data_check"

TARGET_WIDTH, TARGET_HEIGHT = 2000, 1300
ROW_HEIGHT = 108
ROWS_PER_PAGE = 10
DATA_COLS_TO_KEEP = 15
INDEX_COL_WIDTH = 50
TOP_3_COL_WIDTH = 200
OTHER_COL_WIDTH = 105
AVG_CHAR_WIDTH = 8.5
CELL_PADDING_X = 10
LINE_HEIGHT_ESTIMATE = 18

# --- CẤU HÌNH GIỚI HẠN LEAK ---
MAX_LEAK_TOLERANCE = 5  # Cho phép lọt tối đa 5 lỗi/file

# --- CẤU HÌNH WATERMARK ---
WATERMARK_TEXT = "DATALD.COM"
WATERMARK_OPACITY = 90  # Độ đậm nhạt (0-255)
GRID_COLS = 3 
GRID_ROWS = 3 

# --- DANH SÁCH TỪ KHÓA CẦN MÃ HÓA (Case-insensitive) ---
KEYWORDS_TO_MASK = [
    "trangvang", 
    "scribd", 
    "hsct", 
    "hosocongty", 
    "masothue", 
    "data5s", 
    "google.com/maps/",
    "thuế",
    "thue"
]

# --- HÀM MÃ HÓA (MASKING) ---
def mask_all_chars(match):
    """Callback: Thay thế toàn bộ chuỗi khớp bằng dấu *"""
    return '*' * len(match.group())

def mask_number_group(match):
    """Callback: Mã hóa 50% độ dài của cụm số"""
    digit_str = match.group()
    length = len(digit_str)
    num_to_mask = math.ceil(length / 2)
    return ("*" * num_to_mask) + digit_str[num_to_mask:]

def mask_email_group(match):
    """Callback: Mã hóa user của email"""
    email = match.group()
    if '@' in email:
        user_part, domain_part = email.split('@', 1)
        masked_user = '*' * len(user_part)
        return f"{masked_user}@{domain_part}"
    return email

def mask_cell_value(value):
    """
    Hàm mã hóa trung tâm.
    Thứ tự ưu tiên: URL -> Từ khóa -> Email -> Số
    """
    text = str(value)
    if not text or text.strip().lower() == 'nan':
        return ""
    
    # --- 1. MÃ HÓA URL (HTTPS/WWW) ---
    url_pattern = r'\b(?:https?://|www\.)\S+\b'
    text = re.sub(url_pattern, mask_all_chars, text)

    # --- 2. MÃ HÓA TỪ KHÓA ĐẶC BIỆT ---
    for keyword in KEYWORDS_TO_MASK:
        pattern = re.compile(re.escape(keyword), re.IGNORECASE)
        text = pattern.sub(mask_all_chars, text)

    # --- 3. MÃ HÓA EMAIL ---
    email_pattern = r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
    text = re.sub(email_pattern, mask_email_group, text)

    # --- 4. MÃ HÓA SỐ ---
    text = re.sub(r'\d+', mask_number_group, text)
    
    return text

# --- HÀM KIỂM TRA BẢO MẬT ---
def check_html_leakage_count(html_path, file_name_check):
    leak_count = 0
    details = []
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check Email
        email_pattern = r'\b[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
        leaked_emails = re.findall(email_pattern, content)
        if leaked_emails:
            leak_count += len(leaked_emails)
            details.extend(leaked_emails)

        # Check Số
        number_pattern = r'(?<!\*)\b\d{7,}\b'
        leaked_numbers = re.findall(number_pattern, content)
        if leaked_numbers:
            for num in leaked_numbers:
                if num in file_name_check: continue
                leak_count += 1
                details.append(num)
            
        return leak_count, details
    except Exception as e:
        print(f"Lỗi check file {html_path}: {e}")
        return 1, ["Lỗi đọc file"]

# --- CÁC HÀM HỖ TRỢ DỮ LIỆU ---
def get_column_widths(df_chunk):
    if df_chunk.empty: return []
    try:
        avg_lengths = df_chunk.astype(str).map(lambda x: len(str(x).strip())).mean()
    except AttributeError:
        avg_lengths = df_chunk.astype(str).applymap(lambda x: len(str(x).strip())).mean()
    top_3_indices = avg_lengths.sort_values(ascending=False).head(3).index
    data_widths = []
    for i in range(len(df_chunk.columns)):
        if i in top_3_indices: data_widths.append(TOP_3_COL_WIDTH)
        else: data_widths.append(OTHER_COL_WIDTH)
    return [INDEX_COL_WIDTH] + data_widths

def get_cell_class(text, col_width):
    text_space = col_width - CELL_PADDING_X
    if text_space <= 0: return "no-wrap-text"
    num_lines = math.ceil(len(str(text).strip()) * AVG_CHAR_WIDTH / text_space)
    estimated_height = num_lines * LINE_HEIGHT_ESTIMATE
    return "wrap-text" if estimated_height <= ROW_HEIGHT else "no-wrap-text"

# --- CORE: TẠO HTML ---
def generate_html_for_sheet(df, file_name, sheet_name, template):
    generated_files = [] 
    
    if len(df.columns) > DATA_COLS_TO_KEEP: df = df.iloc[:, :DATA_COLS_TO_KEEP]
    df = df[df.apply(lambda row: any(str(cell).strip() != '' and str(cell).strip().lower() != 'nan' for cell in row), axis=1)]
    if df.empty: return []

    num_pages = math.ceil(len(df) / ROWS_PER_PAGE)
    for i in range(num_pages):
        page_df = df.iloc[i*ROWS_PER_PAGE : (i+1)*ROWS_PER_PAGE]
        temp_df = page_df.copy()
        while len(temp_df.columns) < DATA_COLS_TO_KEEP: temp_df[f'ph_{len(temp_df.columns)}'] = ''
        col_widths = get_column_widths(temp_df)

        page_data = []
        for r_idx, row in page_df.iterrows():
            row_cells = []
            for c_idx, cell in enumerate(row):
                val = mask_cell_value('' if str(cell).strip().lower() == 'nan' else cell)
                row_cells.append({"value": val, "class": get_cell_class(val, col_widths[c_idx+1])})
            while len(row_cells) < DATA_COLS_TO_KEEP: row_cells.append({"value": "", "class": "wrap-text"})
            page_data.append({"excel_row_num": r_idx + 1, "cells": row_cells})
        while len(page_data) < ROWS_PER_PAGE:
            page_data.append({"excel_row_num": " ", "cells": [{"value": "", "class": "wrap-text"}]*DATA_COLS_TO_KEEP})

        page_html_path = os.path.join(HTML_DIR, f"{file_name}_{sheet_name}_page_{i+1}.html")
        with open(page_html_path, 'w', encoding='utf-8') as f:
            f.write(template.render({"title": f"{file_name} - {sheet_name} - P{i+1}", "page_data": page_data, "column_widths": col_widths}))
        generated_files.append((f"PAGE_{i+1}", page_html_path, sheet_name))
        
    return generated_files

# --- HÀM XỬ LÝ WATERMARK ---
def add_watermark_to_image(image_path):
    """
    Thêm watermark 'datald.com' mờ vào ảnh.
    """
    try:
        base_image = Image.open(image_path).convert("RGBA")
        width, height = base_image.size
        
        txt_layer = Image.new("RGBA", base_image.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(txt_layer)
        
        font_size = int(width / 25) 
        try:
            # Replit (Linux) thường dùng font DejaVu
            font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
            if not os.path.exists(font_path):
                # Fallback nếu không tìm thấy, thử tìm font arial cục bộ hoặc mặc định
                font_path = "arial.ttf"
            
            if os.path.exists(font_path):
                font = ImageFont.truetype(font_path, font_size)
            else:
                font = ImageFont.load_default()
        except IOError:
            font = ImageFont.load_default()
        
        step_x = width / GRID_COLS
        step_y = height / GRID_ROWS
        text_color = (150, 150, 150, WATERMARK_OPACITY)
        
        for r in range(GRID_ROWS):
            for c in range(GRID_COLS):
                center_x = (c * step_x) + (step_x / 2)
                center_y = (r * step_y) + (step_y / 2)
                
                bbox = draw.textbbox((0, 0), WATERMARK_TEXT, font=font)
                text_w = bbox[2] - bbox[0]
                text_h = bbox[3] - bbox[1]
                
                x = center_x - (text_w / 2)
                y = center_y - (text_h / 2)
                
                draw.text((x, y), WATERMARK_TEXT, font=font, fill=text_color)
        
        combined = Image.alpha_composite(base_image, txt_layer)
        combined = combined.convert("RGB")
        combined.save(image_path)
        
    except Exception as e:
        print(f"     ⚠️ Lỗi thêm watermark: {e}")

# --- HÀM TẠO ẢNH TỪ LIST HTML ---
def create_images_from_list(html_list, file_name):
    print(f"     ✅ FILE HỢP LỆ. Đang tạo {len(html_list)} ảnh...")
    
    browser = None
    try:
        with sync_playwright() as p:
            # TRÊN REPLIT: 
            # 1. Không dùng p.chromium.launch() mặc định vì nó tìm bản download.
            # 2. Replit.nix đã cài Chromium vào system path.
            # 3. Ta dùng channel="chrome" hoặc "chromium" để nó tìm bản system.
            # 4. Quan trọng: Thêm args để chạy headless trong container.
            
            launch_args = [
                "--no-sandbox", 
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage", # Quan trọng cho Replit
                "--disable-gpu",
                "--font-render-hinting=none"
            ]

            # Thử khởi động trình duyệt
            try:
                # Cách 1: Thử dùng bản Chromium cài qua Nix
                browser = p.chromium.launch(args=launch_args)
            except Exception:
                # Cách 2: Nếu lỗi, thử chỉ định executable_path (nếu biết)
                # Trên Replit thường nó nằm ở /nix/store/.../bin/chromium
                # Nhưng Playwright thường tự tìm nếu setup env đúng.
                print("     ⚠️ Lỗi launch mặc định, đang thử cấu hình fallback...")
                browser = p.chromium.launch(channel="chromium", args=launch_args)

            page = browser.new_page()
            page.set_viewport_size({"width": TARGET_WIDTH, "height": TARGET_HEIGHT})
            
            for type_label, html_path, sheet_name in html_list:
                sheet_output_dir = os.path.join(IMAGE_DIR, file_name, sheet_name)
                os.makedirs(sheet_output_dir, exist_ok=True)

                img_filename = os.path.basename(html_path).replace(".html", ".png")
                img_path = os.path.join(sheet_output_dir, img_filename)
                
                # 1. Chụp ảnh màn hình
                page.goto(f"file://{os.path.abspath(html_path)}")
                page.screenshot(path=img_path, full_page=False)
                
                # 2. Thêm Watermark
                add_watermark_to_image(img_path)
            
            browser.close()
            return True # Thành công

    except Exception as e:
        print(f"❌ Lỗi CRITICAL khi chạy Playwright: {e}")
        print("💡 GỢI Ý: Hãy kiểm tra file 'replit.nix' đã có 'pkgs.chromium' và 'pkgs.playwright-driver' chưa.")
        if browser:
            try: browser.close()
            except: pass
        return False

def cleanup_htmls(html_list):
    for _, path, _ in html_list:
        if os.path.exists(path):
            os.remove(path)

# --- WORKFLOW CHÍNH ---
def process_excel_file_workflow(excel_path, template):
    file_name = os.path.splitext(os.path.basename(excel_path))[0]
    print(f"\n--- FILE: {os.path.basename(excel_path)} ---")
    
    try:
        all_sheets = pd.read_excel(excel_path, sheet_name=None, header=None)
    except Exception as e:
        print(f"Lỗi đọc file: {e}")
        return

    def generate_all_htmls():
        total_htmls = []
        for sheet_name, df in all_sheets.items():
            sheet_htmls = generate_html_for_sheet(df, file_name, sheet_name, template)
            total_htmls.extend(sheet_htmls)
        return total_htmls

    # 1. Tạo HTML
    print(f"     1️⃣  Giai đoạn 1: Tạo HTML toàn bộ các sheet...")
    all_html_files = generate_all_htmls()
    if not all_html_files:
        print("     ⚠️  File không có dữ liệu hợp lệ.")
        return

    # 2. Check Lần 1
    print(f"     2️⃣  Giai đoạn 2: Quét lỗi bảo mật (Ngưỡng cho phép: {MAX_LEAK_TOLERANCE} lỗi)...")
    total_leaks = 0
    all_leak_details = []
    
    for _, html_path, _ in all_html_files:
        count, details = check_html_leakage_count(html_path, file_name)
        total_leaks += count
        all_leak_details.extend(details)
    
    should_retry = False
    if total_leaks > MAX_LEAK_TOLERANCE:
        print(f"     ⚠️  Cảnh báo: Phát hiện {total_leaks} lỗi. Ví dụ: {all_leak_details[:3]}...")
        print("     🔄 Đang thử tạo lại (Retry toàn bộ file)...")
        should_retry = True
    elif total_leaks > 0:
        print(f"     ⚠️  Thông báo: Phát hiện {total_leaks} lỗi (Trong ngưỡng cho phép). Tiếp tục.")
    else:
        print(f"     ✅ Tuyệt vời: Không phát hiện lỗi nào.")

    # 3. Retry nếu cần
    if should_retry:
        cleanup_htmls(all_html_files)
        all_html_files = generate_all_htmls()
        total_leaks = 0
        all_leak_details = []
        for _, html_path, _ in all_html_files:
            count, details = check_html_leakage_count(html_path, file_name)
            total_leaks += count
            all_leak_details.extend(details)
            
    # 4. Quyết định cuối cùng
    if total_leaks > MAX_LEAK_TOLERANCE:
        # TRƯỜNG HỢP: Lỗi quá nhiều -> CẮT FILE SANG DATA_CHECK
        print(f"     ❌ STOP: Vẫn còn {total_leaks} lỗi sau khi retry.")
        
        dest_path = os.path.join(DATA_CHECK_DIR, os.path.basename(excel_path))
        try:
            if not os.path.exists(dest_path):
                shutil.move(excel_path, dest_path)
                print(f"     -> 📂 Đã CẮT (MOVE) file Excel sang '{DATA_CHECK_DIR}'")
            else:
                print(f"     -> ⚠️ File Excel đã tồn tại trong '{DATA_CHECK_DIR}'. Xóa file gốc.")
                os.remove(excel_path)
        except Exception as move_err:
             print(f"     -> ❌ Lỗi khi di chuyển file: {move_err}")

        cleanup_htmls(all_html_files)
        print("     🚫 Đã hủy bỏ output cho toàn bộ file này.")
        return 
    
    else:
        # TRƯỜNG HỢP: Thành công hoặc lỗi ít -> TẠO ẢNH & GIỮ NGUYÊN FILE GỐC
        success = create_images_from_list(all_html_files, file_name)
        cleanup_htmls(all_html_files)
        
        if success:
            print(f"     ✅ Đã hoàn thành xử lý file: {os.path.basename(excel_path)} (File gốc được giữ lại)")

# --- MAIN ---
def main():
    print(f"🚀 Bắt đầu... (Replit Compatible + Full Masking + No Delete Success)")
    os.makedirs(HTML_DIR, exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)
    os.makedirs(DATA_CHECK_DIR, exist_ok=True)

    env = Environment(loader=FileSystemLoader('.'))
    template = env.get_template('template.html')

    excel_files = [f for f in os.listdir(EXCEL_DIR) if f.endswith(('.xlsx', '.xls'))]
    if not excel_files:
        print("Không tìm thấy file Excel.")
        return

    for filename in excel_files:
        excel_path = os.path.join(EXCEL_DIR, filename)
        process_excel_file_workflow(excel_path, template)

    if os.path.exists(HTML_DIR):
        try: shutil.rmtree(HTML_DIR)
        except: pass
        
    print("\n✅ HOÀN TẤT. Vui lòng kiểm tra thư mục 'output_images' và 'data_check'.")

if __name__ == "__main__":
    main()
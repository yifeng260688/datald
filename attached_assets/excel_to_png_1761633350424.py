import os
import pandas as pd
from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright
import math
import shutil
from PIL import Image, ImageFilter

# --- CẤU HÌNH ---
EXCEL_DIR = "excel_files"
HTML_DIR = "output_html"
IMAGE_DIR = "output_images"

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

# Cover photo
COVER_WIDTH, COVER_HEIGHT = 800, 500
COVER_BLUR_RADIUS = 1.5  # ~10% mờ nhẹ

# --- Hàm phụ trợ ---
def get_column_widths(df_chunk):
    if df_chunk.empty:
        return []
    avg_lengths = df_chunk.astype(str).applymap(lambda x: len(str(x).strip())).mean()
    top_3_indices = avg_lengths.sort_values(ascending=False).head(3).index
    data_widths = []
    for i in range(len(df_chunk.columns)):
        if i in top_3_indices:
            data_widths.append(TOP_3_COL_WIDTH)
        else:
            data_widths.append(OTHER_COL_WIDTH)
    return [INDEX_COL_WIDTH] + data_widths

def get_cell_class(text, col_width):
    text_space = col_width - CELL_PADDING_X
    if text_space <= 0:
        return "no-wrap-text"
    num_lines = math.ceil(len(str(text).strip()) * AVG_CHAR_WIDTH / text_space)
    estimated_height = num_lines * LINE_HEIGHT_ESTIMATE
    return "wrap-text" if estimated_height <= ROW_HEIGHT else "no-wrap-text"

def html_to_fixed_size_image(html_path, image_path):
    print(f"  -> Tạo ảnh {TARGET_WIDTH}x{TARGET_HEIGHT} từ: {os.path.basename(html_path)}")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": TARGET_WIDTH, "height": TARGET_HEIGHT})
        page.goto(f"file://{os.path.abspath(html_path)}")
        page.screenshot(path=image_path, full_page=False)
        browser.close()
    print(f"     ✅ Đã lưu ảnh: {os.path.basename(image_path)}")

def blur_and_resize_cover(image_path, output_path):
    img = Image.open(image_path)
    blurred = img.filter(ImageFilter.GaussianBlur(radius=COVER_BLUR_RADIUS))
    img_w, img_h = blurred.size
    ratio = min(COVER_WIDTH / img_w, COVER_HEIGHT / img_h)
    new_w = int(img_w * ratio)
    new_h = int(img_h * ratio)
    resized = blurred.resize((new_w, new_h), Image.LANCZOS)
    final_img = Image.new("RGB", (COVER_WIDTH, COVER_HEIGHT), (255, 255, 255))
    offset_x = (COVER_WIDTH - new_w) // 2
    offset_y = (COVER_HEIGHT - new_h) // 2
    final_img.paste(resized, (offset_x, offset_y))
    final_img.save(output_path)
    print(f"     🎨 Đã tạo cover photo: {os.path.basename(output_path)}")

# --- Xử lý từng sheet ---
def process_sheet(df, file_name, sheet_name, template):
    # Giữ tối đa DATA_COLS_TO_KEEP cột
    if len(df.columns) > DATA_COLS_TO_KEEP:
        df = df.iloc[:, :DATA_COLS_TO_KEEP]

    # Xóa tất cả row trống hoàn toàn (không có nội dung)
    df = df[df.apply(lambda row: any(str(cell).strip() != '' and str(cell).strip().lower() != 'nan' for cell in row), axis=1)]
    if df.empty:
        print(f"Sheet '{sheet_name}' không có dữ liệu sau khi lọc.")
        return

    # Thư mục output
    image_output_dir = os.path.join(IMAGE_DIR, file_name, sheet_name)
    os.makedirs(image_output_dir, exist_ok=True)
    os.makedirs(HTML_DIR, exist_ok=True)

    # --- Cover photo (trang đầu tiên) ---
    first_page_df = df.iloc[:ROWS_PER_PAGE]
    temp_df = first_page_df.copy()
    while len(temp_df.columns) < DATA_COLS_TO_KEEP:
        temp_df[f'placeholder_{len(temp_df.columns)}'] = ''

    column_widths_px = get_column_widths(temp_df)
    processed_page_data = []
    for r_idx, row in first_page_df.iterrows():
        row_cells = []
        for c_idx, cell_value in enumerate(row):
            cell_value = '' if str(cell_value).strip().lower() == 'nan' else cell_value
            col_width = column_widths_px[c_idx + 1]
            cell_class = get_cell_class(cell_value, col_width)
            row_cells.append({"value": cell_value, "class": cell_class})
        while len(row_cells) < DATA_COLS_TO_KEEP:
            row_cells.append({"value": "", "class": "wrap-text"})
        processed_page_data.append({"excel_row_num": r_idx + 1, "cells": row_cells})
    while len(processed_page_data) < ROWS_PER_PAGE:
        empty_cells = [{"value": "", "class": "wrap-text"}] * DATA_COLS_TO_KEEP
        processed_page_data.append({"excel_row_num": " ", "cells": empty_cells})

    render_data = {"title": f"{file_name} - {sheet_name} - Cover", "page_data": processed_page_data, "column_widths": column_widths_px}
    html_path = os.path.join(HTML_DIR, f"{file_name}_{sheet_name}_cover.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(template.render(render_data))

    cover_image_path = os.path.join(image_output_dir, f"coverphoto-{sheet_name}.png")
    html_to_fixed_size_image(html_path, cover_image_path)
    blur_and_resize_cover(cover_image_path, cover_image_path)
    os.remove(html_path)

    # --- Các trang dữ liệu ---
    total_rows = len(df)
    num_pages = math.ceil(total_rows / ROWS_PER_PAGE)
    for page_idx in range(num_pages):
        start_row = page_idx * ROWS_PER_PAGE
        end_row = start_row + ROWS_PER_PAGE
        page_df = df.iloc[start_row:end_row]

        temp_df = page_df.copy()
        while len(temp_df.columns) < DATA_COLS_TO_KEEP:
            temp_df[f'placeholder_{len(temp_df.columns)}'] = ''
        column_widths_px = get_column_widths(temp_df)

        processed_page_data = []
        for r_idx, row in page_df.iterrows():
            row_cells = []
            for c_idx, cell_value in enumerate(row):
                cell_value = '' if str(cell_value).strip().lower() == 'nan' else cell_value
                col_width = column_widths_px[c_idx + 1]
                cell_class = get_cell_class(cell_value, col_width)
                row_cells.append({"value": cell_value, "class": cell_class})
            while len(row_cells) < DATA_COLS_TO_KEEP:
                row_cells.append({"value": "", "class": "wrap-text"})
            processed_page_data.append({"excel_row_num": r_idx + 1, "cells": row_cells})
        while len(processed_page_data) < ROWS_PER_PAGE:
            empty_cells = [{"value": "", "class": "wrap-text"}] * DATA_COLS_TO_KEEP
            processed_page_data.append({"excel_row_num": " ", "cells": empty_cells})

        render_data = {"title": f"{file_name} - {sheet_name} - Trang {page_idx+1}", "page_data": processed_page_data, "column_widths": column_widths_px}
        html_filename = f"{file_name}_{sheet_name}_page_{page_idx+1}.html"
        html_path = os.path.join(HTML_DIR, html_filename)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(template.render(render_data))

        page_image_path = os.path.join(image_output_dir, f"{sheet_name}_page_{page_idx+1}.png")
        html_to_fixed_size_image(html_path, page_image_path)
        os.remove(html_path)

# --- Xử lý file ---
def process_excel_file(excel_path, template):
    file_name = os.path.splitext(os.path.basename(excel_path))[0]
    print(f"\n--- Xử lý file: {file_name} ---")
    try:
        all_sheets = pd.read_excel(excel_path, sheet_name=None, header=None)
    except Exception as e:
        print(f"Lỗi đọc file '{excel_path}': {e}")
        return
    for sheet_name, df in all_sheets.items():
        print(f"-> Xử lý sheet: {sheet_name}")
        process_sheet(df, file_name, sheet_name, template)

# --- Main ---
def main():
    print("Bắt đầu chuyển đổi Excel sang PNG (xóa row trống, bỏ 'nan', tạo cover)...")
    os.makedirs(HTML_DIR, exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)

    env = Environment(loader=FileSystemLoader('.'))
    template = env.get_template('template.html')

    excel_files = [f for f in os.listdir(EXCEL_DIR) if f.endswith(('.xlsx', '.xls'))]
    if not excel_files:
        print(f"\nCẢNH BÁO: Không tìm thấy file Excel trong '{EXCEL_DIR}'.")
        return

    for filename in excel_files:
        excel_path = os.path.join(EXCEL_DIR, filename)
        process_excel_file(excel_path, template)

    if os.path.exists(HTML_DIR):
        shutil.rmtree(HTML_DIR)

    print("\n🎉 Hoàn tất! Kiểm tra thư mục 'output_images'.")

if __name__ == "__main__":
    main()

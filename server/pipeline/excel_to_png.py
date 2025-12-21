#!/usr/bin/env python3
import os
import sys

# Always use local cache for Playwright browsers (matches pip-installed playwright version)
script_dir = os.path.dirname(os.path.abspath(__file__))
workspace_dir = os.path.dirname(os.path.dirname(script_dir))
playwright_path = os.path.join(workspace_dir, '.cache', 'ms-playwright')
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = playwright_path
print(f"[Pipeline] Set PLAYWRIGHT_BROWSERS_PATH to: {playwright_path}", file=sys.stderr)

import json
import pandas as pd
from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright
import math
import shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import re
import warnings

warnings.simplefilter(action='ignore', category=FutureWarning)

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

MAX_LEAK_TOLERANCE = 5

WATERMARK_TEXT = "DATALD.COM"
WATERMARK_OPACITY = 90
GRID_COLS = 3
GRID_ROWS = 3

COVER_BLUR_RADIUS = 8
FREE_PREVIEW_IMAGES = 10

KEYWORDS_TO_MASK = [
    "trangvang", 
    "scribd", 
    "hsct", 
    "hosocongty", 
    "thuế",
    "thue",
    "masothue", 
    "data5s", 
    "google.com/maps/"
]

# Keywords that trigger complete cell content removal (case-insensitive)
KEYWORDS_TO_REMOVE_CELL = [
    "trang vang",
    "trangvang",
    "scribd",
    "hsct",
    "hosocongty",
    "mst",
    "masothue",
    "data5s",
    "google.com/map"
]

# Facebook URL to check in first 30 rows - if found, delete all rows from that row to row 1
FACEBOOK_URL_TO_CHECK = "https://www.facebook.com/datakhachhangtiemnang1"

def remove_header_rows_with_facebook_url(df):
    """
    Check first 30 rows for the Facebook URL.
    If found, delete all rows from that row back to row 1 (inclusive).
    Returns the cleaned DataFrame.
    """
    max_rows_to_check = min(30, len(df))
    
    for row_idx in range(max_rows_to_check):
        for col_idx in range(len(df.columns)):
            try:
                cell_value = str(df.iloc[row_idx, col_idx]).strip()
                if FACEBOOK_URL_TO_CHECK.lower() in cell_value.lower():
                    # Found the URL - delete all rows from 0 to row_idx (inclusive)
                    rows_to_delete = row_idx + 1
                    log(f"[Cleanup] Found Facebook URL at row {row_idx + 1}, removing {rows_to_delete} header rows")
                    
                    # Remove rows 0 to row_idx
                    cleaned_df = df.iloc[row_idx + 1:].reset_index(drop=True)
                    return cleaned_df
            except Exception:
                continue
    
    return df

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

def log(msg):
    """Print log message to stderr to avoid interfering with JSON output."""
    print(msg, file=sys.stderr)

def should_remove_cell_content(value):
    """
    Check if cell content should be completely removed based on keywords.
    Returns True if the cell contains any keyword from KEYWORDS_TO_REMOVE_CELL (case-insensitive).
    """
    text = str(value).lower()
    if not text or text.strip() == 'nan':
        return False
    
    for keyword in KEYWORDS_TO_REMOVE_CELL:
        if keyword.lower() in text:
            return True
    return False

def clean_dataframe_cells(df):
    """
    Pre-process DataFrame to remove cell contents that contain restricted keywords.
    This must be called BEFORE HTML generation.
    Returns the cleaned DataFrame.
    """
    cleaned_count = 0
    
    def clean_cell(value):
        nonlocal cleaned_count
        if should_remove_cell_content(value):
            cleaned_count += 1
            return ""
        return value
    
    try:
        cleaned_df = df.map(clean_cell)
    except AttributeError:
        cleaned_df = df.applymap(clean_cell)
    
    if cleaned_count > 0:
        log(f"[Cleanup] Removed content from {cleaned_count} cells containing restricted keywords")
    
    return cleaned_df

def mask_cell_value(value):
    """
    Hàm mã hóa trung tâm.
    Thứ tự ưu tiên: URL -> Từ khóa -> Email -> Số
    """
    text = str(value)
    if not text or text.strip().lower() == 'nan':
        return ""
    
    url_pattern = r'\b(?:https?://|www\.)\S+\b'
    text = re.sub(url_pattern, mask_all_chars, text)

    for keyword in KEYWORDS_TO_MASK:
        pattern = re.compile(re.escape(keyword), re.IGNORECASE)
        text = pattern.sub(mask_all_chars, text)

    email_pattern = r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
    text = re.sub(email_pattern, mask_email_group, text)

    text = re.sub(r'\d+', mask_number_group, text)
    
    return text

def check_html_leakage_count(html_path, file_name_check):
    leak_count = 0
    details = []
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        email_pattern = r'\b[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
        leaked_emails = re.findall(email_pattern, content)
        if leaked_emails:
            leak_count += len(leaked_emails)
            details.extend(leaked_emails)

        number_pattern = r'(?<!\*)\b\d{7,}\b'
        leaked_numbers = re.findall(number_pattern, content)
        if leaked_numbers:
            for num in leaked_numbers:
                if num in file_name_check:
                    continue
                leak_count += 1
                details.append(num)
            
        return leak_count, details
    except Exception as e:
        return 1, [f"Error reading file: {e}"]

def get_column_widths(df_chunk):
    if df_chunk.empty:
        return []
    try:
        avg_lengths = df_chunk.astype(str).map(lambda x: len(str(x).strip())).mean()
    except AttributeError:
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

def generate_html_for_sheet(df, file_name, sheet_name, template, html_dir):
    generated_files = []
    
    if len(df.columns) > DATA_COLS_TO_KEEP:
        df = df.iloc[:, :DATA_COLS_TO_KEEP]
    df = df[df.apply(lambda row: any(str(cell).strip() != '' and str(cell).strip().lower() != 'nan' for cell in row), axis=1)]
    if df.empty:
        return []

    num_pages = math.ceil(len(df) / ROWS_PER_PAGE)
    for i in range(num_pages):
        page_df = df.iloc[i*ROWS_PER_PAGE : (i+1)*ROWS_PER_PAGE]
        temp_df = page_df.copy()
        while len(temp_df.columns) < DATA_COLS_TO_KEEP:
            temp_df[f'ph_{len(temp_df.columns)}'] = ''
        col_widths = get_column_widths(temp_df)

        page_data = []
        for r_idx, row in page_df.iterrows():
            row_cells = []
            for c_idx, cell in enumerate(row):
                val = mask_cell_value('' if str(cell).strip().lower() == 'nan' else cell)
                row_cells.append({"value": val, "class": get_cell_class(val, col_widths[c_idx+1])})
            while len(row_cells) < DATA_COLS_TO_KEEP:
                row_cells.append({"value": "", "class": "wrap-text"})
            page_data.append({"excel_row_num": r_idx + 1, "cells": row_cells})
        while len(page_data) < ROWS_PER_PAGE:
            page_data.append({"excel_row_num": " ", "cells": [{"value": "", "class": "wrap-text"}]*DATA_COLS_TO_KEEP})

        page_html_path = os.path.join(html_dir, f"{file_name}_{sheet_name}_page_{i+1}.html")
        with open(page_html_path, 'w', encoding='utf-8') as f:
            f.write(template.render({"title": f"{file_name} - {sheet_name} - P{i+1}", "page_data": page_data, "column_widths": col_widths}))
        generated_files.append((f"PAGE_{i+1}", page_html_path, sheet_name))
        
    return generated_files

def add_blur_to_image(image_path, blur_radius=COVER_BLUR_RADIUS):
    """Apply Gaussian blur to an image for preview protection."""
    try:
        img = Image.open(image_path)
        blurred = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))
        blurred.save(image_path)
        log(f"[Blur] Applied blur (radius={blur_radius}) to: {os.path.basename(image_path)}")
    except Exception as e:
        log(f"Blur error: {e}")

def add_watermark_to_image(image_path, apply_blur=False):
    try:
        base_image = Image.open(image_path).convert("RGBA")
        width, height = base_image.size
        
        if apply_blur:
            base_image = base_image.filter(ImageFilter.GaussianBlur(radius=COVER_BLUR_RADIUS))
        
        txt_layer = Image.new("RGBA", base_image.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(txt_layer)
        
        font_size = int(width / 25)
        try:
            font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
            if not os.path.exists(font_path):
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
        log(f"Watermark error: {e}")

def create_images_from_list(html_list, file_name, image_dir):
    created_images = []
    global_image_index = 0
    
    with sync_playwright() as p:
        launch_args = [
            "--no-sandbox", 
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--single-process"
        ]
        
        log("[Pipeline] Starting browser (System Chromium)...")
        browser = None
        try:
            # Priority 1: Use channel chromium (system installed)
            browser = p.chromium.launch(channel="chromium", args=launch_args)
        except Exception as e1:
            log(f"[Pipeline] Channel chromium failed: {e1}")
            try:
                # Priority 2: Try to find specific path (common on Nix)
                executable_path = shutil.which("chromium")
                if executable_path:
                    log(f"[Pipeline] Found chromium at: {executable_path}")
                    browser = p.chromium.launch(executable_path=executable_path, args=launch_args)
                else:
                    # Priority 3: Use default playwright browser
                    log("[Pipeline] Trying default playwright browser...")
                    browser = p.chromium.launch(args=launch_args)
            except Exception as e2:
                log(f"[Pipeline] All browser launch methods failed: {e2}")
                raise e2
        
        page = browser.new_page()
        page.set_viewport_size({"width": TARGET_WIDTH, "height": TARGET_HEIGHT})
        
        for type_label, html_path, sheet_name in html_list:
            sheet_output_dir = os.path.join(image_dir, file_name, sheet_name)
            os.makedirs(sheet_output_dir, exist_ok=True)

            img_filename = os.path.basename(html_path).replace(".html", ".png")
            img_path = os.path.join(sheet_output_dir, img_filename)
            
            page.goto(f"file://{os.path.abspath(html_path)}")
            page.screenshot(path=img_path, full_page=False)
            
            should_blur = global_image_index >= FREE_PREVIEW_IMAGES
            add_watermark_to_image(img_path, apply_blur=should_blur)
            
            if should_blur:
                log(f"[Preview] Image {global_image_index + 1} blurred (after {FREE_PREVIEW_IMAGES} free previews)")
            
            created_images.append({
                "type": "page",
                "sheet": sheet_name,
                "page": int(type_label.replace("PAGE_", "")) if "PAGE_" in type_label else 1,
                "path": img_path,
                "isBlurred": should_blur
            })
            
            global_image_index += 1

        browser.close()
    
    log(f"[Summary] Created {len(created_images)} images, {min(FREE_PREVIEW_IMAGES, len(created_images))} clear, {max(0, len(created_images) - FREE_PREVIEW_IMAGES)} blurred")
    return created_images

def cleanup_htmls(html_list):
    for _, path, _ in html_list:
        if os.path.exists(path):
            os.remove(path)

def process_excel_file(excel_path, output_dir, template_path):
    file_name = os.path.splitext(os.path.basename(excel_path))[0]
    
    html_dir = os.path.join(output_dir, "temp_html")
    image_dir = output_dir
    
    os.makedirs(html_dir, exist_ok=True)
    os.makedirs(image_dir, exist_ok=True)
    
    try:
        all_sheets = pd.read_excel(excel_path, sheet_name=None, header=None)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to read Excel file: {e}"
        }

    log(f"[Pipeline] Processing: {file_name}")
    
    # Step 0a: Pre-process - Remove header rows containing Facebook URL
    log(f"[Pipeline] Step 0a: Checking for Facebook URL in first 30 rows...")
    for sheet_name in all_sheets:
        all_sheets[sheet_name] = remove_header_rows_with_facebook_url(all_sheets[sheet_name])
    
    # Step 0b: Pre-process - Remove cell contents containing restricted keywords
    log(f"[Pipeline] Step 0b: Cleaning cells with restricted keywords...")
    for sheet_name in all_sheets:
        all_sheets[sheet_name] = clean_dataframe_cells(all_sheets[sheet_name])

    template_dir = os.path.dirname(template_path)
    template_name = os.path.basename(template_path)
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template(template_name)

    def generate_all_htmls():
        total_htmls = []
        for sheet_name, df in all_sheets.items():
            sheet_htmls = generate_html_for_sheet(df, file_name, sheet_name, template, html_dir)
            total_htmls.extend(sheet_htmls)
        return total_htmls

    log(f"[Pipeline] Step 1: Generating HTML...")
    all_html_files = generate_all_htmls()
    if not all_html_files:
        return {
            "success": False,
            "error": "No valid data found in Excel file"
        }

    log(f"[Pipeline] Step 2: Security check (tolerance: {MAX_LEAK_TOLERANCE})...")
    total_leaks = 0
    all_leak_details = []
    
    for _, html_path, _ in all_html_files:
        count, details = check_html_leakage_count(html_path, file_name)
        total_leaks += count
        all_leak_details.extend(details)
    
    should_retry = False
    if total_leaks > MAX_LEAK_TOLERANCE:
        log(f"[Pipeline] Warning: {total_leaks} leaks detected. Retrying...")
        should_retry = True
    elif total_leaks > 0:
        log(f"[Pipeline] Notice: {total_leaks} leaks (within tolerance). Continuing.")
    else:
        log(f"[Pipeline] Excellent: No leaks detected.")

    if should_retry:
        cleanup_htmls(all_html_files)
        all_html_files = generate_all_htmls()
        total_leaks = 0
        all_leak_details = []
        for _, html_path, _ in all_html_files:
            count, details = check_html_leakage_count(html_path, file_name)
            total_leaks += count
            all_leak_details.extend(details)

    if total_leaks > MAX_LEAK_TOLERANCE:
        cleanup_htmls(all_html_files)
        return {
            "success": False,
            "error": f"Security check failed: {total_leaks} leaks detected after retry"
        }

    log(f"[Pipeline] Step 3: Creating images...")
    try:
        created_images = create_images_from_list(all_html_files, file_name, image_dir)
        cleanup_htmls(all_html_files)
        
        if os.path.exists(html_dir):
            try:
                shutil.rmtree(html_dir)
            except:
                pass
        
        cover_photo = created_images[0]["path"] if created_images else None
        
        return {
            "success": True,
            "fileName": file_name,
            "totalImages": len(created_images),
            "coverPhoto": cover_photo,
            "images": created_images,
            "outputDir": image_dir
        }
    except Exception as e:
        cleanup_htmls(all_html_files)
        return {
            "success": False,
            "error": f"Failed to create images: {e}"
        }

def main():
    if len(sys.argv) < 4:
        result = {
            "success": False,
            "error": "Usage: python excel_to_png.py <excel_path> <output_dir> <template_path>"
        }
        print(json.dumps(result))
        sys.exit(1)
    
    excel_path = sys.argv[1]
    output_dir = sys.argv[2]
    template_path = sys.argv[3]
    
    if not os.path.exists(excel_path):
        result = {
            "success": False,
            "error": f"File not found: {excel_path}"
        }
        print(json.dumps(result))
        sys.exit(1)
    
    result = process_excel_file(excel_path, output_dir, template_path)
    
    output_json_path = os.path.join(output_dir, "pipeline_result.json")
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(json.dumps({"success": True, "outputFile": output_json_path}, ensure_ascii=False))

if __name__ == "__main__":
    main()

{ pkgs }: {
  deps = [
    pkgs.python310      # Hoặc version python bạn đang dùng
    pkgs.chromium       # Trình duyệt Chromium hệ thống
    pkgs.playwright-driver # Driver cầu nối
    pkgs.glibcLocales   # Hỗ trợ font/locale
    pkgs.fontconfig
  ];
  env = {
    # Báo cho Playwright biết nơi chứa trình duyệt của hệ thống
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    # Báo cho Playwright KHÔNG được tải trình duyệt mới về
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"; 
  };
}
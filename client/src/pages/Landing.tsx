import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Heart, Search, Video } from "lucide-react";
import { SiGoogle } from "react-icons/si";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="container relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
              <Video className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              Thư viện Tài liệu
              <span className="block text-primary mt-2">Chuyên nghiệp & Bảo mật</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Khám phá hàng nghìn tài liệu chuyên nghiệp được mã hóa DRM. Tìm kiếm, lưu yêu thích và
              xem video trực tuyến một cách an toàn.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" asChild className="text-lg h-12 px-8" data-testid="button-login-hero">
                <a href="/api/auth/google">
                  <SiGoogle className="w-5 h-5 mr-2" />
                  Đăng nhập bằng Google
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-24 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Tính năng nổi bật</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Trải nghiệm xem tài liệu chuyên nghiệp với đầy đủ tính năng hiện đại
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <Card className="p-6 space-y-4 hover-elevate transition-all duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Tìm kiếm thông minh</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tìm kiếm tài liệu nhanh chóng theo từ khóa, category hoặc nội dung. Kết quả hiển thị
                ngay lập tức.
              </p>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate transition-all duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Video DRM an toàn</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tất cả tài liệu được mã hóa DRM chuyên nghiệp. Xem video trực tuyến với HTML5 player
                hiện đại.
              </p>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate transition-all duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Lưu yêu thích</h3>
              <p className="text-muted-foreground leading-relaxed">
                Lưu lại các tài liệu quan trọng vào danh sách yêu thích của bạn. Truy cập nhanh chóng
                mọi lúc mọi nơi.
              </p>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate transition-all duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Thư viện phong phú</h3>
              <p className="text-muted-foreground leading-relaxed">
                Hàng nghìn tài liệu chuyên nghiệp được phân loại rõ ràng theo nhiều category khác nhau.
              </p>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate transition-all duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Gợi ý thông minh</h3>
              <p className="text-muted-foreground leading-relaxed">
                Khám phá các tài liệu liên quan dựa trên nội dung bạn đang xem. Mở rộng kiến thức một
                cách dễ dàng.
              </p>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate transition-all duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Xem mọi thiết bị</h3>
              <p className="text-muted-foreground leading-relaxed">
                Giao diện responsive hoàn hảo. Xem tài liệu trên máy tính, tablet hoặc điện thoại một
                cách mượt mà.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-24">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 sm:p-12 text-center bg-gradient-to-br from-primary/5 to-background border-primary/20">
            <div className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold">
                Sẵn sàng khám phá thư viện?
              </h2>
              <p className="text-lg text-muted-foreground">
                Đăng nhập ngay để truy cập hàng nghìn tài liệu chuyên nghiệp được mã hóa an toàn.
              </p>
              <Button size="lg" asChild className="text-lg h-12 px-8" data-testid="button-login-cta">
                <a href="/api/auth/google">
                  <SiGoogle className="w-5 h-5 mr-2" />
                  Đăng nhập bằng Google
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

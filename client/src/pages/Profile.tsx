import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  User as UserIcon, 
  FileText, 
  Download, 
  Coins, 
  Calendar,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

interface RedeemedFile {
  id: string;
  userId: string;
  documentId: string;
  postId: string;
  documentTitle: string;
  fileName: string;
  fileSize: number;
  pointsCost: number;
  redeemedAt: string;
}

const ITEMS_PER_PAGE = 10;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Profile() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: redeemedFiles = [], isLoading: isFilesLoading } = useQuery<RedeemedFile[]>({
    queryKey: ["/api/user/redeemed-files"],
    enabled: isAuthenticated,
  });

  // Pagination
  const totalPages = Math.ceil(redeemedFiles.length / ITEMS_PER_PAGE);
  const paginatedFiles = redeemedFiles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDownload = (fileId: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = `/api/user/redeemed-files/${fileId}/download`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <UserIcon className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Chưa đăng nhập</h2>
              <p className="text-muted-foreground mb-4">
                Vui lòng đăng nhập để xem thông tin tài khoản
              </p>
              <Button asChild>
                <a href="/api/login">Đăng nhập với Google</a>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-back-home">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Quay lại trang chủ
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                Thông tin tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt="Profile"
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <UserIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold" data-testid="text-username">
                    {user.firstName} {user.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-email">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      <span data-testid="text-points">{user.points || 0} điểm</span>
                    </Badge>
                    {user.role === "admin" && (
                      <Badge variant="default">Admin</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Redeemed Files Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                File đã quy đổi
              </CardTitle>
              <CardDescription>
                Danh sách các file bạn đã quy đổi điểm để tải về
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isFilesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : redeemedFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Bạn chưa quy đổi file nào
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hãy dùng điểm để quy đổi các tài liệu trong thư viện
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {paginatedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`redeemed-file-${file.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate" title={file.documentTitle}>
                            {file.documentTitle}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {file.fileName}
                            </span>
                            <span>{formatFileSize(file.fileSize)}</span>
                            <span className="flex items-center gap-1">
                              <Coins className="w-3 h-3" />
                              {file.pointsCost} điểm
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(file.redeemedAt)}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleDownload(file.id, file.fileName)}
                          data-testid={`button-download-${file.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Tải về
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6" data-testid="files-pagination">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      
                      <span className="text-sm text-muted-foreground px-4">
                        Trang {currentPage} / {totalPages}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

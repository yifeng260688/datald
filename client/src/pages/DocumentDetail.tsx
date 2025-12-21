import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { DocumentCard } from "@/components/DocumentCard";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  AlertCircle, 
  FileText, 
  Heart, 
  ChevronLeft, 
  ChevronRight,
  Lock, 
  Share2, 
  Facebook, 
  MessageCircle, 
  Bell,
  Download,
  Eye,
  Database,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  X,
  Coins
} from "lucide-react";
import type { DocumentWithFavorite, DocumentImage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { InsufficientPointsDialog } from "@/components/InsufficientPointsDialog";

function createSEODescription(description: string): string {
  const maxLength = 160;
  if (description.length <= maxLength) {
    return description;
  }
  
  const truncated = description.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

function shareOnSocial(platform: 'facebook' | 'twitter' | 'zalo', url: string, title: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  
  const shareUrls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    zalo: `https://zalo.me/share?url=${encodedUrl}`,
  };
  
  window.open(shareUrls[platform], '_blank', 'width=600,height=400');
}

function parseImageUrls(imageUrls: string | null | undefined): DocumentImage[] {
  if (!imageUrls) return [];
  try {
    const parsed = JSON.parse(imageUrls);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface ImageGalleryProps {
  images: DocumentImage[];
  coverImageUrl: string;
  title: string;
}

const FREE_PREVIEW_LIMIT = 10;
const RELATED_ITEMS_PER_PAGE = 9; // 3 columns × 3 rows

function ImageGallery({ images, coverImageUrl, title }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setZoomLevel(1);

  const rawImages = images.length > 0 
    ? images 
    : [{ sheet: 'cover', page: 1, url: coverImageUrl }];

  // Only show free preview images + 1 locked representative
  const freeImages = rawImages.slice(0, FREE_PREVIEW_LIMIT);
  const lockedCount = Math.max(0, rawImages.length - FREE_PREVIEW_LIMIT);
  const hasLockedContent = lockedCount > 0;
  
  // Display images: free previews + 1 locked indicator (if any locked exist)
  const displayImages = hasLockedContent 
    ? [...freeImages, { sheet: 'locked', page: 0, url: '' }]
    : freeImages;

  const currentImage = displayImages[currentIndex] || displayImages[0];
  const isCurrentLocked = hasLockedContent && currentIndex === displayImages.length - 1;
  
  const freePreviewCount = freeImages.length;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {lockedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
          <Lock className="w-4 h-4 text-amber-600" />
          <span className="text-amber-700 dark:text-amber-400">
            Thông tin quan trọng đều được mã hóa thành dấu * -&gt; Để xem được toàn bộ nội dung liên hệ Admin
          </span>
        </div>
      )}
      
      <Card className="overflow-hidden shadow-2xl">
        <div className="relative aspect-video bg-muted">
          {isCurrentLocked ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-400 dark:bg-gray-600 mb-6">
                <Lock className="w-10 h-10 text-gray-700 dark:text-gray-300" />
              </div>
              <p className="text-gray-900 dark:text-gray-100 font-bold text-xl md:text-2xl text-center px-4 mb-2">
                ĐỂ MỞ KHÓA XEM NỘI DUNG
              </p>
              <p className="text-gray-900 dark:text-gray-100 font-bold text-xl md:text-2xl text-center px-4">
                LIÊN HỆ ADMIN
              </p>
            </div>
          ) : (
            <>
              <img
                src={currentImage.url}
                alt={`${title} - Trang ${currentIndex + 1}`}
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => setIsLightboxOpen(true)}
                data-testid="img-main-gallery"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-4 right-4 backdrop-blur-sm"
                onClick={() => setIsLightboxOpen(true)}
                data-testid="button-zoom-image"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
            </>
          )}

          {displayImages.length > 1 && (
            <>
              <Button
                size="icon"
                variant="secondary"
                className="absolute left-4 top-1/2 -translate-y-1/2 backdrop-blur-sm"
                onClick={goToPrevious}
                data-testid="button-prev-image"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-4 top-1/2 -translate-y-1/2 backdrop-blur-sm"
                onClick={goToNext}
                data-testid="button-next-image"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-1.5 rounded-full text-sm backdrop-blur-sm flex items-center gap-2">
            {isCurrentLocked && <Lock className="w-3 h-3" />}
            {isCurrentLocked ? `+${lockedCount} ảnh bị khóa` : `${currentIndex + 1} / ${freePreviewCount}`}
          </div>
        </div>
      </Card>

      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {displayImages.map((img, index) => {
            const isLockedThumbnail = hasLockedContent && index === displayImages.length - 1;
            return (
              <button
                key={`${img.sheet}-${img.page}-${index}`}
                onClick={() => setCurrentIndex(index)}
                className={`relative flex-shrink-0 ${isLockedThumbnail ? 'w-24' : 'w-20'} h-14 rounded-md overflow-hidden border-2 transition-all ${
                  index === currentIndex 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-transparent hover:border-muted-foreground/30'
                }`}
                data-testid={`button-thumbnail-${index}`}
              >
                {isLockedThumbnail ? (
                  <div className="w-full h-full flex items-center justify-center gap-1 bg-gray-300 dark:bg-gray-600">
                    <Lock className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">+{lockedCount}</span>
                  </div>
                ) : (
                  <img
                    src={img.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={isLightboxOpen && !isCurrentLocked} onOpenChange={(open) => { setIsLightboxOpen(open); if (!open) resetZoom(); }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <div className="relative w-full h-full flex items-center justify-center min-h-[80vh] overflow-auto">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={() => setIsLightboxOpen(false)}
              data-testid="button-close-lightbox"
            >
              <X className="w-6 h-6" />
            </Button>

            <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                data-testid="button-zoom-out"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <span className="text-white text-sm min-w-[60px] text-center">{Math.round(zoomLevel * 100)}%</span>
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                data-testid="button-zoom-in"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
            </div>

            <img
              src={currentImage.url}
              alt={`${title} - Trang ${currentIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
              data-testid="img-lightbox"
            />

            {freePreviewCount > 1 && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 w-12 h-12"
                  onClick={() => { goToPrevious(); resetZoom(); }}
                  data-testid="button-lightbox-prev"
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 w-12 h-12"
                  onClick={() => { goToNext(); resetZoom(); }}
                  data-testid="button-lightbox-next"
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-1.5 rounded-full text-sm">
              {currentIndex + 1} / {freePreviewCount}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DocumentDetail() {
  const [, params] = useRoute("/document/:id");
  const documentId = params?.id;
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const [relatedPage, setRelatedPage] = useState(1);

  const { data: document, isLoading, error } = useQuery<DocumentWithFavorite>({
    queryKey: [`/api/documents/${documentId}`],
    enabled: !!documentId,
  });

  const { data: relatedDocuments = [] } = useQuery<DocumentWithFavorite[]>({
    queryKey: [`/api/documents/${documentId}/related`],
    enabled: !!documentId && !!document,
  });

  // Check if user has already redeemed this document
  const { data: redemptionStatus } = useQuery<{ hasRedeemed: boolean }>({
    queryKey: [`/api/user/redeemed-check/${documentId}`],
    enabled: !!documentId && isAuthenticated,
  });

  // Mutation for redeeming document
  const redeemMutation = useMutation({
    mutationFn: async (docId: string) => {
      return await apiRequest("POST", `/api/redeem/${docId}`);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Quy đổi thành công!",
        description: "File đã được thêm vào mục 'File đã quy đổi' trong tài khoản của bạn.",
      });
      // Invalidate queries to refresh user data and redeemed status
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: [`/api/user/redeemed-check/${documentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/redeemed-files"] });
    },
    onError: (error: any) => {
      const message = error.message || "Không thể quy đổi tài liệu. Vui lòng thử lại.";
      toast({
        title: "Lỗi quy đổi",
        description: message,
        variant: "destructive",
      });
    },
  });

  interface Category {
    id: string;
    name: string;
    logoUrl?: string;
    order: number;
  }

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const categoryLogoMap: Record<string, string> = {};
  categories.forEach(cat => {
    if (cat.logoUrl) {
      categoryLogoMap[cat.name] = cat.logoUrl;
    }
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ documentId, isFavorited }: { documentId: string; isFavorited: boolean }) => {
      if (isFavorited) {
        await apiRequest("DELETE", `/api/favorites/${documentId}`);
      } else {
        await apiRequest("POST", "/api/favorites", { documentId });
      }
    },
    onMutate: async ({ documentId: docId, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/documents/${docId}`] });
      await queryClient.cancelQueries({ queryKey: ["/api/documents"] });
      
      const previousDocument = queryClient.getQueryData<DocumentWithFavorite>([`/api/documents/${docId}`]);
      const previousDocuments = queryClient.getQueryData<DocumentWithFavorite[]>(["/api/documents"]);
      
      if (previousDocument) {
        queryClient.setQueryData<DocumentWithFavorite>([`/api/documents/${docId}`], {
          ...previousDocument,
          isFavorited: !isFavorited,
          favoriteCount: previousDocument.favoriteCount + (isFavorited ? -1 : 1),
        });
      }
      
      if (previousDocuments) {
        queryClient.setQueryData<DocumentWithFavorite[]>(["/api/documents"], 
          previousDocuments.map((doc) => 
            doc.id === docId 
              ? { ...doc, isFavorited: !isFavorited, favoriteCount: doc.favoriteCount + (isFavorited ? -1 : 1) }
              : doc
          )
        );
      }
      
      return { previousDocument, previousDocuments };
    },
    onError: (error, variables, context) => {
      if (context?.previousDocument) {
        queryClient.setQueryData([`/api/documents/${variables.documentId}`], context.previousDocument);
      }
      if (context?.previousDocuments) {
        queryClient.setQueryData(["/api/documents"], context.previousDocuments);
      }
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Chưa đăng nhập",
          description: "Đang chuyển hướng đến trang đăng nhập...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật yêu thích. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${variables.documentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const images = document ? parseImageUrls(document.imageUrls) : [];

  if (!documentId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Tài liệu không tồn tại.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild data-testid="button-back">
            <Link href="/">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Không thể tải thông tin tài liệu. Vui lòng thử lại sau.
            </AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-8">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="aspect-video w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        )}

        {!isLoading && !error && document && (
          <>
            <SEOHead
              title={`${document.title} - ${document.category}${document.subcategory ? ` › ${document.subcategory}` : ''}`}
              description={createSEODescription(document.description)}
              keywords={`${document.category}, ${document.subcategory || ''}, tài liệu, data khách hàng, ${document.title}`}
              imageUrl={document.coverImageUrl}
              url={window.location.href}
              type="article"
            />

            <article className="space-y-8">
              <header className="space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight" data-testid="text-document-title">
                      {document.title}
                    </h1>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className="mb-2" data-testid="badge-document-category">
                        {document.subcategory 
                          ? <>{document.category} <span className="opacity-60 mx-1">›</span> {document.subcategory}</>
                          : document.category}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        <span>{document.viewCount} lượt xem</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 flex-wrap text-sm text-muted-foreground mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">ID</span>
                        <span data-testid="text-document-postid">{document.postId || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Database className="w-4 h-4" />
                        <span data-testid="text-document-datacount">{(document.pageCount * 10).toLocaleString()} Data</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4" />
                        <span data-testid="text-document-pagecount">{document.pageCount} trang</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4" />
                        <span data-testid="text-document-imagecount">{images.length || 1} hình ảnh</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-amber-600 dark:text-amber-400" data-testid="text-document-points">
                          {document.pointsCost || document.pageCount || 0} điểm
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      variant={document.isFavorited ? "default" : "outline"}
                      onClick={() =>
                        toggleFavoriteMutation.mutate({
                          documentId: document.id,
                          isFavorited: document.isFavorited,
                        })
                      }
                      disabled={toggleFavoriteMutation.isPending}
                      className="toggle-elevate"
                      data-testid="button-favorite-detail"
                    >
                      <Heart
                        className={`w-5 h-5 mr-2 ${
                          document.isFavorited ? "fill-current" : ""
                        }`}
                      />
                      {document.isFavorited ? "Đã lưu" : "Yêu thích"}
                    </Button>
                    {redemptionStatus?.hasRedeemed ? (
                      <Button
                        size="lg"
                        className="bg-green-500 hover:bg-green-600 text-white"
                        asChild
                        data-testid="button-go-to-profile"
                      >
                        <Link href="/profile">
                          <FileText className="w-5 h-5 mr-2" />
                          Đã quy đổi - Xem file
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => {
                          if (!isAuthenticated) {
                            window.location.href = "/api/login";
                            return;
                          }
                          const requiredPoints = document.pointsCost || document.pageCount || 0;
                          const userPoints = user?.points || 0;
                          if (userPoints < requiredPoints) {
                            setShowPointsDialog(true);
                          } else {
                            redeemMutation.mutate(document.id);
                          }
                        }}
                        disabled={redeemMutation.isPending}
                        data-testid="button-exchange-detail"
                      >
                        <Coins className="w-5 h-5 mr-2" />
                        {redeemMutation.isPending 
                          ? "Đang xử lý..." 
                          : `Đổi điểm (${document.pointsCost || document.pageCount || 0})`
                        }
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-base text-foreground leading-relaxed" data-testid="text-document-description">
                  {document.description}
                </p>

                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">Chia sẻ:</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareOnSocial('facebook', window.location.href, document.title)}
                      data-testid="button-share-facebook"
                    >
                      <Facebook className="w-4 h-4 mr-2" />
                      Facebook
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareOnSocial('zalo', window.location.href, document.title)}
                      data-testid="button-share-zalo"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Zalo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast({
                          title: "Đã sao chép",
                          description: "Link tài liệu đã được sao chép vào clipboard",
                        });
                      }}
                      data-testid="button-copy-link"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Sao chép
                    </Button>
                  </div>
                </div>
              </header>

              {isAuthenticated ? (
                <ImageGallery 
                  images={images} 
                  coverImageUrl={document.coverImageUrl} 
                  title={document.title} 
                />
              ) : (
                <Card className="overflow-hidden shadow-2xl" data-testid="card-login-required">
                  <div className="aspect-video bg-muted flex flex-col items-center justify-center p-8 text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                      <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Nội dung yêu cầu đăng nhập</h3>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      Vui lòng đăng nhập để xem hình ảnh và truy cập đầy đủ nội dung tài liệu
                    </p>
                    <Button
                      size="lg"
                      onClick={() => window.location.href = "/api/login"}
                      data-testid="button-login-to-view"
                    >
                      Đăng nhập
                    </Button>
                  </div>
                </Card>
              )}

              <section>
                <h2 className="text-2xl font-bold mb-4" data-testid="heading-table-of-contents">
                  Thông tin tài liệu
                </h2>
                <Card className="p-6">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-sm mt-0.5">
                        1
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Xem hình ảnh tài liệu</h3>
                        <p className="text-sm text-muted-foreground">
                          {images.length > 0 
                            ? `${images.length} hình ảnh chất lượng cao từ file Excel đã được xử lý`
                            : 'Nội dung hình ảnh với chất lượng HD, có watermark bảo vệ'
                          }
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-sm mt-0.5">
                        2
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Data khách hàng</h3>
                        <p className="text-sm text-muted-foreground">
                          {(document.pageCount * 10).toLocaleString()} dữ liệu khách hàng chi tiết
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-sm mt-0.5">
                        3
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Lưu và chia sẻ</h3>
                        <p className="text-sm text-muted-foreground">
                          Lưu vào yêu thích hoặc chia sẻ với bạn bè
                        </p>
                      </div>
                    </li>
                  </ul>
                </Card>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4" data-testid="heading-how-to-use">
                  Hướng dẫn sử dụng
                </h2>
                <Card className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        Để xem hình ảnh
                      </h3>
                      <p className="text-sm text-muted-foreground ml-7">
                        {isAuthenticated 
                          ? "Click vào hình ảnh để phóng to. Sử dụng các nút mũi tên để chuyển trang. Hình ảnh được bảo vệ bằng watermark."
                          : "Vui lòng đăng nhập để xem hình ảnh tài liệu. Nhấn nút 'Đăng nhập' bên trên."
                        }
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Download className="w-5 h-5 text-primary" />
                        Để tải tài liệu
                      </h3>
                      <p className="text-sm text-muted-foreground ml-7">
                        Tài liệu được bảo vệ và chỉ xem trực tuyến. Bạn có thể lưu vào mục yêu thích để dễ dàng truy cập lại.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-primary" />
                        Để chia sẻ
                      </h3>
                      <p className="text-sm text-muted-foreground ml-7">
                        Sử dụng các nút chia sẻ ở đầu trang để chia sẻ tài liệu lên Facebook, Zalo hoặc sao chép link.
                      </p>
                    </div>
                  </div>
                </Card>
              </section>

              <section>
                <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 p-8">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-center md:text-left">
                      <h2 className="text-2xl font-bold mb-2" data-testid="heading-subscribe">
                        Nhận thông báo tài liệu mới
                      </h2>
                      <p className="text-muted-foreground">
                        Đăng ký để nhận thông báo khi có tài liệu mới trong danh mục <strong>{document.subcategory ? `${document.category} › ${document.subcategory}` : document.category}</strong>
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        size="lg" 
                        onClick={() => {
                          if (!isAuthenticated) {
                            window.location.href = "/api/login";
                          } else {
                            toast({
                              title: "Đã đăng ký",
                              description: "Bạn sẽ nhận thông báo khi có tài liệu mới",
                            });
                          }
                        }}
                        data-testid="button-subscribe"
                      >
                        <Bell className="w-5 h-5 mr-2" />
                        {isAuthenticated ? "Đăng ký ngay" : "Đăng nhập để đăng ký"}
                      </Button>
                    </div>
                  </div>
                </Card>
              </section>

              {relatedDocuments.length > 0 && (
                <section className="pt-4">
                  <Separator className="mb-8" />
                  <h2 className="text-2xl font-bold mb-6" data-testid="heading-related">
                    Tài liệu gợi ý
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {relatedDocuments
                      .slice((relatedPage - 1) * RELATED_ITEMS_PER_PAGE, relatedPage * RELATED_ITEMS_PER_PAGE)
                      .map((relatedDoc) => (
                        <DocumentCard
                          key={relatedDoc.id}
                          document={relatedDoc}
                          onFavoriteToggle={(documentId, isFavorited) =>
                            toggleFavoriteMutation.mutate({ documentId, isFavorited })
                          }
                          isTogglingFavorite={toggleFavoriteMutation.isPending}
                          categoryLogoUrl={categoryLogoMap[relatedDoc.category]}
                        />
                      ))}
                  </div>
                  
                  {/* Related Documents Pagination */}
                  {Math.ceil(relatedDocuments.length / RELATED_ITEMS_PER_PAGE) > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8" data-testid="related-pagination">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setRelatedPage((prev) => Math.max(1, prev - 1))}
                        disabled={relatedPage === 1}
                        data-testid="related-pagination-prev"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      
                      {Array.from({ length: Math.ceil(relatedDocuments.length / RELATED_ITEMS_PER_PAGE) }, (_, i) => i + 1)
                        .filter(page => {
                          const totalRelatedPages = Math.ceil(relatedDocuments.length / RELATED_ITEMS_PER_PAGE);
                          if (page === 1 || page === totalRelatedPages) return true;
                          if (Math.abs(page - relatedPage) <= 2) return true;
                          return false;
                        })
                        .map((page, index, array) => {
                          const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                          return (
                            <div key={page} className="flex items-center gap-2">
                              {showEllipsisBefore && (
                                <span className="px-2 text-muted-foreground">...</span>
                              )}
                              <Button
                                variant={relatedPage === page ? "default" : "outline"}
                                size="icon"
                                onClick={() => setRelatedPage(page)}
                                data-testid={`related-pagination-page-${page}`}
                              >
                                {page}
                              </Button>
                            </div>
                          );
                        })}
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setRelatedPage((prev) => Math.min(Math.ceil(relatedDocuments.length / RELATED_ITEMS_PER_PAGE), prev + 1))}
                        disabled={relatedPage === Math.ceil(relatedDocuments.length / RELATED_ITEMS_PER_PAGE)}
                        data-testid="related-pagination-next"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </article>
          </>
        )}
      </main>

      {document && (
        <InsufficientPointsDialog
          open={showPointsDialog}
          onOpenChange={setShowPointsDialog}
          requiredPoints={document.pointsCost || document.pageCount || 0}
          currentPoints={user?.points || 0}
        />
      )}
    </div>
  );
}

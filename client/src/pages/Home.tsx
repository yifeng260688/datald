import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { SearchBar } from "@/components/SearchBar";
import { DocumentCard } from "@/components/DocumentCard";
import { SEOHead } from "@/components/SEOHead";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import type { DocumentWithFavorite } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

const ITEMS_PER_PAGE = 24; // 3 columns × 8 rows

interface Category {
  id: string;
  name: string;
  logoUrl?: string;
  order: number;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const { data: documents = [], isLoading, error } = useQuery<DocumentWithFavorite[]>({
    queryKey: ["/api/documents"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ documentId, isFavorited }: { documentId: string; isFavorited: boolean }) => {
      if (isFavorited) {
        await apiRequest("DELETE", `/api/favorites/${documentId}`);
      } else {
        await apiRequest("POST", "/api/favorites", { documentId });
      }
    },
    onMutate: async ({ documentId, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/documents"] });
      const previousDocuments = queryClient.getQueryData<DocumentWithFavorite[]>(["/api/documents"]);
      queryClient.setQueryData<DocumentWithFavorite[]>(["/api/documents"], (old) => 
        old?.map((doc) => 
          doc.id === documentId 
            ? { ...doc, isFavorited: !isFavorited, favoriteCount: doc.favoriteCount + (isFavorited ? -1 : 1) }
            : doc
        )
      );
      return { previousDocuments };
    },
    onError: (error, variables, context) => {
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.description.toLowerCase().includes(query) ||
          doc.category.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory === "favorites") {
      filtered = filtered.filter((doc) => doc.isFavorited);
    } else if (selectedCategory !== "all") {
      filtered = filtered.filter((doc) => doc.category === selectedCategory);
    }

    return filtered;
  }, [documents, searchQuery, selectedCategory]);

  // Reset page when filters change
  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  // Pagination logic
  const totalPages = Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDocuments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDocuments, currentPage]);

  const seoDescription = `Thư viện ${documents.length} file data khách hàng, thông tin khách hàng, data doanh nghiệp. Danh sách khách hàng chất lượng cao cho kinh doanh online hiệu quả.`;
  const seoKeywords = useMemo(() => {
    const categoryNames = categories.map(c => c.name).join(", ");
    return `data khách hàng, thông tin khách hàng, data doanh nghiệp, data kinh doanh, kinh doanh online, danh sách khách hàng, ${categoryNames}`;
  }, [categories]);

  const categoryLogoMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(cat => {
      if (cat.logoUrl) {
        map[cat.name] = cat.logoUrl;
      }
    });
    return map;
  }, [categories]);

  return (
    <div className="min-h-screen bg-background">
      {/* SEO Meta Tags */}
      <SEOHead
        title="Data Khách Hàng - Thông Tin Khách Hàng - Data Doanh Nghiệp"
        description={seoDescription}
        keywords={seoKeywords}
        type="website"
        url={window.location.href}
      />

      <Header />

      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section with H1 */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3" data-testid="heading-main">
              THƯ VIỆN DATA KHÁCH HÀNG - DATA DOANH NGHIỆP
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-semibold">
              NỀN TẢNG TRAO ĐỔI DỮ LIỆU KINH DOANH DÀNH CHO B2B
            </p>
          </div>
          <SearchBar value={searchQuery} onChange={handleSearchChange} />
        </section>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3" data-testid="category-filter">
            {/* All categories button */}
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => handleCategoryChange("all")}
              data-testid="category-all"
            >
              Tất cả
            </Button>
            
            {/* Favorites button */}
            <Button
              variant={selectedCategory === "favorites" ? "default" : "outline"}
              onClick={() => handleCategoryChange("favorites")}
              data-testid="category-favorites"
            >
              <Heart className="w-4 h-4 mr-2" />
              Yêu thích
            </Button>

            {/* Dynamic categories from API */}
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.name ? "default" : "outline"}
                onClick={() => handleCategoryChange(category.name)}
                data-testid={`category-${category.id}`}
              >
                {category.logoUrl && (
                  <img 
                    src={category.logoUrl} 
                    alt={category.name}
                    className="w-12 h-12 mr-2 object-contain"
                  />
                )}
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Document Library Section */}
        <section>
          {/* Section Header with H2 */}
          {!isLoading && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2" data-testid="heading-library">
                {selectedCategory === "favorites" 
                  ? "Data Yêu Thích" 
                  : selectedCategory === "all" 
                    ? "Danh Sách Data Khách Hàng"
                    : selectedCategory}
              </h2>
              <p className="text-sm text-muted-foreground" data-testid="text-results-count">
                {filteredDocuments.length === 0
                  ? "Không tìm thấy data nào"
                  : `Tìm thấy ${filteredDocuments.length} file data`}
                {searchQuery && ` cho từ khóa "${searchQuery}"`}
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Không thể tải danh sách tài liệu. Vui lòng thử lại sau.
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video w-full rounded-lg" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Documents Grid - 3 columns */}
          {!isLoading && !error && paginatedDocuments.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedDocuments.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    onFavoriteToggle={(documentId, isFavorited) =>
                      toggleFavoriteMutation.mutate({ documentId, isFavorited })
                    }
                    isTogglingFavorite={toggleFavoriteMutation.isPending}
                    categoryLogoUrl={categoryLogoMap[document.category]}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8" data-testid="pagination-controls">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    data-testid="pagination-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first, last, current, and pages around current
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - currentPage) <= 2) return true;
                      return false;
                    })
                    .map((page, index, array) => {
                      // Add ellipsis between non-consecutive pages
                      const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                      return (
                        <div key={page} className="flex items-center gap-2">
                          {showEllipsisBefore && (
                            <span className="px-2 text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="icon"
                            onClick={() => setCurrentPage(page)}
                            data-testid={`pagination-page-${page}`}
                          >
                            {page}
                          </Button>
                        </div>
                      );
                    })}
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="pagination-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Empty State */}
        {!isLoading && !error && filteredDocuments.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Không tìm thấy data</h3>
            <p className="text-muted-foreground">
              {selectedCategory === "favorites"
                ? "Bạn chưa có data yêu thích nào. Hãy thêm vào từ danh sách tất cả!"
                : searchQuery
                ? "Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc."
                : "Chưa có data nào trong thư viện."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

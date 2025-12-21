import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, FileText, Database, Coins, Check } from "lucide-react";
import type { DocumentWithFavorite } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { InsufficientPointsDialog } from "@/components/InsufficientPointsDialog";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DocumentCardProps {
  document: DocumentWithFavorite;
  onFavoriteToggle: (documentId: string, isFavorited: boolean) => void;
  isTogglingFavorite?: boolean;
  categoryLogoUrl?: string;
}

export function DocumentCard({ document, onFavoriteToggle, isTogglingFavorite, categoryLogoUrl }: DocumentCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const dataCount = document.pageCount * 10;
  const requiredPoints = document.pointsCost || document.pageCount || 0;
  const userPoints = user?.points || 0;

  // Check if user has already redeemed this document
  const { data: redemptionStatus } = useQuery<{ hasRedeemed: boolean }>({
    queryKey: [`/api/user/redeemed-check/${document.id}`],
    enabled: isAuthenticated,
  });

  // Mutation for redeeming document
  const redeemMutation = useMutation({
    mutationFn: async (docId: string) => {
      return await apiRequest("POST", `/api/redeem/${docId}`);
    },
    onSuccess: () => {
      toast({
        title: "Quy đổi thành công!",
        description: "File đã được thêm vào mục 'File đã quy đổi' trong tài khoản của bạn.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: [`/api/user/redeemed-check/${document.id}`] });
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

  const handleExchangeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
    
    if (redemptionStatus?.hasRedeemed) {
      setLocation("/profile");
      return;
    }
    
    if (userPoints < requiredPoints) {
      setShowPointsDialog(true);
    } else {
      redeemMutation.mutate(document.id);
    }
  };

  return (
    <Card
      className="overflow-hidden hover-elevate transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/document/${document.id}`} data-testid={`link-document-${document.id}`}>
        <div className="cursor-pointer">
          <div className="relative aspect-video overflow-hidden bg-muted">
            <img
              src={document.coverImageUrl}
              alt={document.title}
              className={`w-full h-full object-cover transition-transform duration-300 ${
                isHovered ? "scale-105" : "scale-100"
              }`}
              data-testid={`img-cover-${document.id}`}
            />
            <div className="absolute top-3 left-3 right-3">
              <Badge
                className="backdrop-blur-sm border-border text-[16px] bg-[#000000] text-[#ffffff] inline-flex items-start gap-1.5 whitespace-normal max-w-full"
                data-testid={`badge-category-${document.id}`}
              >
                {categoryLogoUrl && (
                  <img 
                    src={categoryLogoUrl} 
                    alt={document.category}
                    className="w-5 h-5 object-contain flex-shrink-0 mt-0.5"
                    data-testid={`img-category-logo-${document.id}`}
                  />
                )}
                <span className="break-words">
                  {document.subcategory 
                    ? <>{document.category} <span className="opacity-60">›</span> {document.subcategory}</>
                    : document.category}
                </span>
              </Badge>
            </div>
          </div>
        </div>
      </Link>

      <div className="p-4 space-y-3">
        <Link href={`/document/${document.id}`}>
          <h3
            className="text-xl font-semibold line-clamp-2 hover:text-primary transition-colors cursor-pointer"
            data-testid={`text-title-${document.id}`}
          >
            {document.title}
          </h3>
        </Link>

        <p
          className="text-sm text-muted-foreground line-clamp-3 leading-relaxed"
          data-testid={`text-description-${document.id}`}
        >
          {document.description}
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">ID</span>
              <span data-testid={`text-postid-${document.id}`}>
                {document.postId || 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              <span data-testid={`text-datacount-${document.id}`}>
                {dataCount.toLocaleString()} Data
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span data-testid={`text-pages-${document.id}`}>
                  {document.pageCount} trang
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-amber-600 dark:text-amber-400" data-testid={`text-points-${document.id}`}>
                  {document.pointsCost || document.pageCount || 0} điểm
                </span>
              </div>
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                onFavoriteToggle(document.id, document.isFavorited);
              }}
              disabled={isTogglingFavorite}
              className="toggle-elevate"
              data-testid={`button-favorite-${document.id}`}
            >
              <Heart
                className={`w-5 h-5 transition-all duration-200 ${
                  document.isFavorited
                    ? "fill-destructive text-destructive"
                    : "text-muted-foreground"
                }`}
              />
            </Button>
          </div>
          
          {redemptionStatus?.hasRedeemed ? (
            <Button
              variant="default"
              size="sm"
              className="w-full mt-1 bg-green-500 hover:bg-green-600 text-white"
              onClick={handleExchangeClick}
              data-testid={`button-exchange-${document.id}`}
            >
              <Check className="w-4 h-4 mr-2" />
              Đã quy đổi
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full mt-1 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleExchangeClick}
              disabled={redeemMutation.isPending}
              data-testid={`button-exchange-${document.id}`}
            >
              <Coins className="w-4 h-4 mr-2" />
              {redeemMutation.isPending ? "Đang xử lý..." : "Đổi điểm"}
            </Button>
          )}
        </div>
      </div>

      <InsufficientPointsDialog
        open={showPointsDialog}
        onOpenChange={setShowPointsDialog}
        requiredPoints={requiredPoints}
        currentPoints={userPoints}
      />
    </Card>
  );
}

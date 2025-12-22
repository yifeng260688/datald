import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, File, CheckCircle2, XCircle, AlertCircle, FileText, FileSpreadsheet, Clock, Check, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserUpload } from "@shared/schema";

interface Category {
  id: string;
  name: string;
  logoUrl?: string;
  order: number;
}

export function UploadDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: uploads = [], isLoading } = useQuery<UserUpload[]>({
    queryKey: ["/api/user-uploads"],
    enabled: isOpen,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: isOpen,
  });

  const getUploadRequirements = (categoryName: string) => {
    const lowerName = categoryName.toLowerCase();
    
    if (lowerName.includes("casino")) {
      return {
        title: "Yêu cầu dữ liệu Data Khách Hàng Casino",
        requirements: "Để upload file đủ tiêu chuẩn xét duyệt yêu cầu phải có ít nhất 3 trong số 6 thông tin sau:",
        fields: "Số điện thoại - Họ và tên - Username đăng ký - Email đăng ký - Trang game đăng ký - Số tài khoản đăng ký - Thông tin khác.....",
      };
    }
    
    if (lowerName.includes("doanh nghiệp") || lowerName.includes("doanh nghiep")) {
      return {
        title: "Yêu cầu dữ liệu Data Doanh Nghiệp",
        requirements: "Để upload file đủ tiêu chuẩn xét duyệt yêu cầu phải có ít nhất 4 trong số 7 thông tin sau:",
        fields: "Số điện thoại - Họ và tên - Tên công ty - Địa chỉ - Mã số thuế - Email - Website - Thông tin khác.....",
      };
    }
    
    return {
      title: "Yêu cầu dữ liệu",
      requirements: "Để upload file đủ tiêu chuẩn xét duyệt yêu cầu phải có ít nhất 3 trong số 7 thông tin sau:",
      fields: "Số điện thoại - Họ và tên - Địa chỉ - Giới tính - Ngày sinh - Email - Thông tin khác.....",
    };
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
       // Nếu user chọn rồi thì gửi, nếu chưa chọn thì gửi chuỗi rỗng
      formData.append("category", selectedCategory || ""); 

      setUploadProgress(10);

      const response = await fetch("/api/user-uploads", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      setUploadProgress(80);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(errorData.message || "Upload failed");
      }

      setUploadProgress(100);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-uploads"] });
      toast({
        title: "Tải lên thành công",
        description: "Vui lòng đợi xét duyệt trong vòng 24h. Bạn sẽ nhận được thông báo khi file được duyệt hoặc từ chối.",
      });
      setUploadProgress(0);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tải lên tệp. Vui lòng thử lại.",
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Lỗi",
        description: "Chỉ chấp nhận tệp PDF, CSV, hoặc Excel.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Lỗi",
        description: "Kích thước tệp không được vượt quá 10MB.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);
  };

  const handleConfirmUpload = () => {
    if (!selectedFile) return;
     // --- THÊM ĐOẠN NÀY NẾU MUỐN BẮT BUỘC CHỌN DANH MỤC ---
    if (!selectedCategory) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng chọn danh mục dữ liệu trước khi đăng.",
        variant: "destructive",
      });
      return;
    }
    // ------------------------------------------------------
    uploadMutation.mutate(selectedFile);
  };

  const handleCancelSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const FileIcon = ({ fileType }: { fileType: string }) => {
    if (fileType.includes("pdf")) {
      return <FileText className="w-8 h-8 text-primary" />;
    }
    if (fileType.includes("csv") || fileType.includes("excel") || fileType.includes("spreadsheet")) {
      return <FileSpreadsheet className="w-8 h-8 text-primary" />;
    }
    return <File className="w-8 h-8 text-primary" />;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs" data-testid="badge-approved">
            <Check className="w-3 h-3 mr-1" />
            Đã duyệt
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="text-xs" data-testid="badge-rejected">
            <X className="w-3 h-3 mr-1" />
            Từ chối
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs" data-testid="badge-pending">
            <Clock className="w-3 h-3 mr-1" />
            Đang xử lý
          </Badge>
        );
    }
  };

  const canUploadMore = uploads.length < 10;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-upload-open">
          <Upload className="w-4 h-4 mr-2" />
          Tải lên
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-upload">
        <DialogHeader>
          <DialogTitle>Tệp của tôi</DialogTitle>
          <DialogDescription>
            Bạn có thể tải lên tối đa 10 tệp (PDF, CSV, hoặc Excel, tối đa 10MB mỗi tệp)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category selector for requirements */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Chọn loại dữ liệu để xem yêu cầu</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-upload-category">
                <SelectValue placeholder="Chọn danh mục dữ liệu" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Global warning notice - always visible */}
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" data-testid="alert-upload-warning">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-800 dark:text-amber-300">Lưu ý quan trọng</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              <ul className="text-xs list-disc list-inside space-y-1 mt-1">
                <li>File càng có nhiều cột thông tin thì tỷ lệ được duyệt nhanh và thành công 99%</li>
                <li>File nào không đúng thực tế hoặc không chuẩn thông tin sẽ bị từ chối.</li>
                <li className="text-red-600 dark:text-red-400 font-medium">Nếu User nào có 2 lần trở lên upload file không đúng, không chuẩn thông tin thực tế sẽ bị khóa tài khoản.</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Category-specific requirements notice */}
          {selectedCategory && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" data-testid="alert-upload-requirements">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-300">
                {getUploadRequirements(selectedCategory).title}
              </AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400 space-y-2">
                <p className="font-medium">{getUploadRequirements(selectedCategory).requirements}</p>
                <p className="text-sm italic">{getUploadRequirements(selectedCategory).fields}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* File input (hidden) */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-file"
            disabled={!canUploadMore || uploadMutation.isPending || selectedFile !== null}
          />

          {/* Selected file preview */}
          {selectedFile && !uploadMutation.isPending && (
            <div className="space-y-3">
              <Alert data-testid="alert-file-selected">
                <File className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <p className="text-xs">
                      Tệp sẽ được xử lý tự động bằng AI để tạo tiêu đề, mô tả và phân loại.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmUpload}
                  className="flex-1"
                  data-testid="button-upload-confirm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Đăng lên
                </Button>
                <Button
                  onClick={handleCancelSelection}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-upload-cancel"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Hủy
                </Button>
              </div>
            </div>
          )}

          {/* Upload button (only show when no file selected) */}
          {!selectedFile && !uploadMutation.isPending && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!canUploadMore}
              className="w-full"
              data-testid="button-upload-select"
            >
              <Upload className="w-4 h-4 mr-2" />
              Chọn tệp
            </Button>
          )}

          {/* Upload progress */}
          {uploadMutation.isPending && (
            <div className="space-y-2" data-testid="progress-upload">
              <Progress value={uploadProgress} />
              <p className="text-sm text-muted-foreground text-center">
                {uploadProgress}%
              </p>
            </div>
          )}

          {/* Limit info */}
          {!canUploadMore && (
            <Alert data-testid="alert-limit-reached">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Đã đạt giới hạn 10 tệp. Vui lòng liên hệ admin để được hỗ trợ.
              </AlertDescription>
            </Alert>
          )}

          {/* File list */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Tệp đã tải lên ({uploads.length}/10)</h4>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : uploads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-files">
                <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Chưa có tệp nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center gap-3 p-3 border rounded-md"
                    data-testid={`file-item-${upload.id}`}
                  >
                    <FileIcon fileType={upload.fileType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-filename-${upload.id}`}>
                        {upload.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(upload.fileSize)}
                      </p>
                    </div>
                    <StatusBadge status={upload.approvalStatus} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

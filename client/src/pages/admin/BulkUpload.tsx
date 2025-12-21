import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Upload, File, Trash2, AlertCircle, FileText, FileSpreadsheet, Clock, CheckCircle, XCircle, Loader2, FolderOpen, RefreshCw, FolderTree } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AdminUpload } from "@shared/schema";

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface Category {
  id: string;
  name: string;
  logoUrl?: string;
  order: number;
}

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  parentSubcategoryId?: string | null;
  order: number;
}

export default function AdminBulkUpload() {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: uploads = [], isLoading } = useQuery<AdminUpload[]>({
    queryKey: ["/api/admin/uploads"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const selectedCategoryId = categories.find(c => c.name === selectedCategory)?.id;
  
  const getSubcategoryPath = (subcategoryId: string): string => {
    const sub = subcategories.find(s => s.id === subcategoryId);
    if (!sub) return "";
    if (!sub.parentSubcategoryId) return sub.name;
    return getSubcategoryPath(sub.parentSubcategoryId) + " → " + sub.name;
  };

  const getAllSubcategoriesFlat = (categoryId: string | undefined): Array<{ id: string; name: string; fullPath: string; depth: number }> => {
    if (!categoryId) return [];
    
    const result: Array<{ id: string; name: string; fullPath: string; depth: number }> = [];
    
    const addSubcategories = (parentId: string | null, depth: number) => {
      const children = subcategories
        .filter(s => s.categoryId === categoryId && 
          (parentId === null ? !s.parentSubcategoryId : s.parentSubcategoryId === parentId))
        .sort((a, b) => a.order - b.order);
      
      for (const child of children) {
        const fullPath = getSubcategoryPath(child.id);
        result.push({ id: child.id, name: child.name, fullPath, depth });
        addSubcategories(child.id, depth + 1);
      }
    };
    
    addSubcategories(null, 0);
    return result;
  };

  const flatSubcategories = getAllSubcategoriesFlat(selectedCategoryId);

  const uploadFiles = async (files: File[]) => {
    const initialFiles: UploadingFile[] = files.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
    }));
    
    setUploadingFiles(initialFiles);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("files", file);
      });
      
      if (selectedCategory) {
        formData.append("category", selectedCategory);
      }
      
      if (selectedSubcategory) {
        formData.append("subcategory", selectedSubcategory);
      }

      interface UploadResponse {
        uploads?: AdminUpload[];
        duplicates?: { fileName: string; existingFileName: string }[];
        message?: string;
      }
      
      const response = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadingFiles((prev) => 
              prev.map(uf => ({ ...uf, progress: percentComplete }))
            );
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch {
              reject(new Error("Invalid response from server"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.open("POST", "/api/admin/uploads");
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      setUploadingFiles((prev) =>
        prev.map(uf => ({ ...uf, status: 'success' as const, progress: 100 }))
      );

      queryClient.invalidateQueries({ queryKey: ["/api/admin/uploads"] });

      // Show success message with duplicate info if applicable
      const uploadCount = response.uploads?.length || 0;
      const duplicateCount = response.duplicates?.length || 0;
      
      if (duplicateCount > 0) {
        const duplicateNames = response.duplicates!.map(d => d.fileName).join(", ");
        toast({
          title: "Upload hoàn tất",
          description: `Đã tải lên ${uploadCount} file. ${duplicateCount} file bị trùng lặp đã bị bỏ qua: ${duplicateNames}`,
          variant: duplicateCount > 0 && uploadCount === 0 ? "destructive" : "default",
        });
      } else {
        toast({
          title: "Thành công",
          description: `Đã tải lên ${uploadCount} file. Pipeline đang được xử lý.`,
        });
      }

      setTimeout(() => {
        setUploadingFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 3000);

    } catch (error: any) {
      setUploadingFiles((prev) =>
        prev.map(uf => ({ 
          ...uf, 
          status: 'error' as const, 
          error: error.message || 'Upload failed' 
        }))
      );

      toast({
        title: "Lỗi",
        description: error.message || "Không thể tải lên file. Vui lòng thử lại.",
        variant: "destructive",
      });

      setTimeout(() => {
        setUploadingFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 5000);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/uploads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/uploads"] });
      toast({
        title: "Đã xóa",
        description: "File đã được xóa thành công.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa file. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/uploads/${id}/reprocess`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/uploads"] });
      toast({
        title: "Đang xử lý lại",
        description: "Pipeline đang được chạy lại. Vui lòng đợi...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xử lý lại file. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    if (!selectedCategory) {
      toast({
        title: "Chưa chọn danh mục",
        description: "Vui lòng chọn danh mục trước khi upload file.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Chỉ chấp nhận file PDF, CSV, hoặc Excel`);
        continue;
      }

      if (file.size > 500 * 1024 * 1024) {
        errors.push(`${file.name}: Kích thước file không được vượt quá 500MB`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      toast({
        title: "Một số file không hợp lệ",
        description: errors.join(", "),
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const FileIcon = ({ fileType }: { fileType: string }) => {
    if (fileType.includes("pdf")) {
      return <FileText className="w-5 h-5 text-primary" />;
    }
    if (fileType.includes("csv") || fileType.includes("excel") || fileType.includes("spreadsheet")) {
      return <FileSpreadsheet className="w-5 h-5 text-primary" />;
    }
    return <File className="w-5 h-5 text-primary" />;
  };

  const getPipelineStatusBadge = (status: string, error?: string | null) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" data-testid="badge-pipeline-pending">
            <Clock className="w-3 h-3 mr-1" />
            Đang chờ
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="default" data-testid="badge-pipeline-processing">
            <Clock className="w-3 h-3 mr-1" />
            Đang xử lý
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-pipeline-completed">
            <CheckCircle className="w-3 h-3 mr-1" />
            Hoàn thành
          </Badge>
        );
      case "failed":
        return (
          <div className="space-y-1">
            <Badge variant="destructive" data-testid="badge-pipeline-failed">
              <XCircle className="w-3 h-3 mr-1" />
              Thất bại
            </Badge>
            {error && (
              <div className="max-w-md">
                <p className="text-xs text-destructive whitespace-pre-wrap break-words" data-testid="text-pipeline-error">
                  {error}
                </p>
              </div>
            )}
          </div>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-admin-bulk-upload">Upload hàng loạt</h1>
        <p className="text-muted-foreground">Upload file lớn (tối đa 500MB) để xử lý qua pipeline</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tải lên file mới</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-select">
              <FolderOpen className="w-4 h-4 inline mr-2" />
              Danh mục
            </Label>
            <Select
              value={selectedCategory}
              onValueChange={(value) => {
                setSelectedCategory(value);
                setSelectedSubcategory("");
              }}
              disabled={uploadingFiles.length > 0}
            >
              <SelectTrigger id="category-select" data-testid="select-admin-category">
                <SelectValue placeholder="Chọn danh mục cho file upload" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem 
                    key={category.id} 
                    value={category.name}
                    data-testid={`option-category-${category.id}`}
                  >
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCategory && flatSubcategories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="subcategory-select">
                <FolderTree className="w-4 h-4 inline mr-2" />
                Danh mục con (tùy chọn)
              </Label>
              <Select
                value={selectedSubcategory}
                onValueChange={setSelectedSubcategory}
                disabled={uploadingFiles.length > 0}
              >
                <SelectTrigger id="subcategory-select" data-testid="select-admin-subcategory">
                  <SelectValue placeholder="Chọn danh mục con" />
                </SelectTrigger>
                <SelectContent>
                  {flatSubcategories.map((sub) => (
                    <SelectItem 
                      key={sub.id} 
                      value={sub.fullPath}
                      data-testid={`option-subcategory-${sub.id}`}
                    >
                      <span style={{ paddingLeft: `${sub.depth * 12}px` }}>
                        {sub.depth > 0 ? "└─ " : ""}{sub.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.xlsx,.xls"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-admin-file"
              disabled={uploadingFiles.length > 0 || !selectedCategory}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles.length > 0 || !selectedCategory}
              className="w-full"
              data-testid="button-admin-upload-select"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploadingFiles.length > 0 
                ? "Đang tải lên..." 
                : !selectedCategory 
                  ? "Vui lòng chọn danh mục trước" 
                  : "Chọn file (tối đa 500MB, có thể chọn nhiều file)"}
            </Button>
          </div>

          {uploadingFiles.length > 0 && (
            <div className="space-y-3" data-testid="progress-admin-upload">
              {uploadingFiles.map((uploadingFile, index) => (
                <div key={index} className="space-y-1 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {uploadingFile.status === 'uploading' && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                      )}
                      {uploadingFile.status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                      {uploadingFile.status === 'error' && (
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {uploadingFile.file.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                      {uploadingFile.status === 'uploading' && `${uploadingFile.progress}%`}
                      {uploadingFile.status === 'success' && 'Hoàn thành'}
                      {uploadingFile.status === 'error' && 'Lỗi'}
                    </span>
                  </div>
                  {uploadingFile.status === 'uploading' && (
                    <Progress value={uploadingFile.progress} className="h-1" />
                  )}
                  {uploadingFile.status === 'error' && uploadingFile.error && (
                    <p className="text-xs text-destructive">{uploadingFile.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              File được upload sẽ tự động được xử lý qua pipeline. Bạn có thể chọn nhiều file cùng lúc (tối đa 10 file).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File đã upload ({uploads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Đang tải...</p>
          ) : uploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-admin-files">
              <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Chưa có file nào được upload</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Kích thước</TableHead>
                  <TableHead>Trạng thái Pipeline</TableHead>
                  <TableHead>Ngày upload</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
                  <TableRow key={upload.id} data-testid={`row-admin-upload-${upload.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileIcon fileType={upload.fileType} />
                        <span className="font-medium" data-testid={`text-admin-filename-${upload.id}`}>
                          {upload.fileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {upload.category ? (
                        <Badge variant="outline" data-testid={`badge-category-${upload.id}`}>
                          {upload.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatFileSize(upload.fileSize)}</TableCell>
                    <TableCell>{getPipelineStatusBadge(upload.pipelineStatus, upload.pipelineError)}</TableCell>
                    <TableCell>
                      {upload.uploadedAt ? new Date(upload.uploadedAt).toLocaleString("vi-VN") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {upload.pipelineStatus === "failed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => reprocessMutation.mutate(upload.id)}
                            disabled={reprocessMutation.isPending}
                            title="Xử lý lại"
                            data-testid={`button-admin-reprocess-${upload.id}`}
                          >
                            <RefreshCw className={`w-4 h-4 text-primary ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(upload.id)}
                          disabled={deleteMutation.isPending}
                          title="Xóa"
                          data-testid={`button-admin-delete-${upload.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

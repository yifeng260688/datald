import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Document } from "@shared/schema";

interface Category {
  id: string;
  name: string;
  logoUrl?: string;
  order: number;
}

const documentFormSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  description: z.string().min(1, "Mô tả không được để trống"),
  category: z.string().min(1, "Vui lòng chọn danh mục"),
  pageCount: z.coerce.number().min(1, "Số trang phải lớn hơn 0"),
  coverImageUrl: z.string().url("URL ảnh bìa không hợp lệ"),
  videoUrl: z.string().url("URL video không hợp lệ"),
  drmLicenseUrl: z.string().url("URL DRM license không hợp lệ").optional().or(z.literal("")),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

interface DocumentFormProps {
  documentId?: string;
}

export default function DocumentForm({ documentId }: DocumentFormProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const isEditing = !!documentId;

  const { data: document, isLoading: isLoadingDocument } = useQuery<Document>({
    queryKey: [`/api/admin/documents/${documentId}`],
    enabled: isEditing,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      pageCount: 1,
      coverImageUrl: "",
      videoUrl: "",
      drmLicenseUrl: "",
    },
  });

  // Reset form when document data is loaded
  useEffect(() => {
    if (document && isEditing) {
      form.reset({
        title: document.title,
        description: document.description,
        category: document.category,
        pageCount: document.pageCount,
        coverImageUrl: document.coverImageUrl,
        videoUrl: document.videoUrl,
        drmLicenseUrl: document.drmLicenseUrl || "",
      });
    }
  }, [document, isEditing, form]);

  const mutation = useMutation({
    mutationFn: async (values: DocumentFormValues) => {
      if (isEditing) {
        await apiRequest("PATCH", `/api/documents/${documentId}`, values);
      } else {
        await apiRequest("POST", "/api/documents", values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: isEditing ? "Đã cập nhật" : "Đã thêm",
        description: isEditing ? "Tài liệu đã được cập nhật" : "Tài liệu mới đã được thêm",
      });
      navigate("/admin/documents");
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: isEditing ? "Không thể cập nhật tài liệu" : "Không thể tạo tài liệu",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        "application/pdf",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
      ];
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "File không hợp lệ",
          description: "Chỉ chấp nhận file PDF, Excel hoặc CSV",
          variant: "destructive",
        });
        return;
      }

      setUploadedFile(file);
      toast({
        title: "File đã chọn",
        description: `${file.name} - Lưu ý: Pipeline chuyển đổi video sẽ được tích hợp sau`,
      });
    }
  };

  const onSubmit = (values: DocumentFormValues) => {
    mutation.mutate(values);
  };

  if (isEditing && isLoadingDocument) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/documents">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-document-form">
            {isEditing ? "Chỉnh sửa Tài liệu" : "Thêm Tài liệu Mới"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Cập nhật thông tin tài liệu" : "Tạo tài liệu mới trong hệ thống"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin tài liệu</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {!isEditing && (
                <div className="space-y-2">
                  <FormLabel>Upload File (PDF/Excel/CSV)</FormLabel>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept=".pdf,.xlsx,.xls,.csv"
                        onChange={handleFileChange}
                        data-testid="input-file-upload"
                      />
                    </div>
                    {uploadedFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        {uploadedFile.name}
                      </div>
                    )}
                  </div>
                  <FormDescription>
                    Tải lên file nguồn. Pipeline chuyển đổi sang video DRM sẽ được tích hợp sau.
                  </FormDescription>
                </div>
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiêu đề</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-title" placeholder="Nhập tiêu đề tài liệu" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        data-testid="input-description"
                        placeholder="Nhập mô tả chi tiết về tài liệu"
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Danh mục</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Chọn danh mục" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pageCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số trang</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          data-testid="input-page-count"
                          placeholder="Nhập số trang"
                          min={1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="coverImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL ảnh bìa</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-cover-image-url"
                        placeholder="https://example.com/cover.jpg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL video DRM</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-video-url"
                        placeholder="https://example.com/video.mpd"
                      />
                    </FormControl>
                    <FormDescription>
                      URL của video đã được mã hóa DRM (DASH/HLS)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="drmLicenseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL DRM License (tùy chọn)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-drm-license-url"
                        placeholder="https://example.com/drm/license"
                      />
                    </FormControl>
                    <FormDescription>
                      URL server cấp license DRM (Widevine/PlayReady)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  data-testid="button-submit"
                >
                  {mutation.isPending ? "Đang lưu..." : isEditing ? "Cập nhật" : "Tạo tài liệu"}
                </Button>
                <Link href="/admin/documents">
                  <Button type="button" variant="outline" data-testid="button-cancel">
                    Hủy
                  </Button>
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

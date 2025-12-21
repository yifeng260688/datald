import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, XCircle, Clock, ExternalLink, FolderOpen, Coins, Eye, Download } from "lucide-react";
import type { UserUpload } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

type UserUploadWithUser = UserUpload & { userName: string; userEmail: string };

interface Category {
  id: string;
  name: string;
  logoUrl?: string;
  order: number;
}

export default function AdminUserUploads() {
  const { toast } = useToast();
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<UserUploadWithUser | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [pointsToAward, setPointsToAward] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");

  const { data: uploads = [], isLoading } = useQuery<UserUploadWithUser[]>({
    queryKey: ["/api/admin/user-uploads"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, category, points }: { id: string; category: string; points: number }) => {
      return apiRequest("PATCH", `/api/admin/user-uploads/${id}/approve`, { category, points });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setApproveDialogOpen(false);
      setSelectedUpload(null);
      setSelectedCategory("");
      setPointsToAward("");
      toast({
        title: "Đã phê duyệt",
        description: "File đã được phê duyệt, cộng điểm và gửi thông báo tới user",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể phê duyệt file",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("PATCH", `/api/admin/user-uploads/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-uploads"] });
      setRejectDialogOpen(false);
      setSelectedUpload(null);
      setRejectReason("");
      toast({
        title: "Đã từ chối",
        description: "File đã bị từ chối và gửi thông báo tới user",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể từ chối file",
        variant: "destructive",
      });
    },
  });

  const handleApproveClick = (upload: UserUploadWithUser) => {
    setSelectedUpload(upload);
    setSelectedCategory("");
    setPointsToAward("");
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (upload: UserUploadWithUser) => {
    setSelectedUpload(upload);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleConfirmApprove = () => {
    if (!selectedUpload) return;
    if (!selectedCategory) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn danh mục cho document",
        variant: "destructive",
      });
      return;
    }
    const points = parseInt(pointsToAward) || 0;
    approveMutation.mutate({ id: selectedUpload.id, category: selectedCategory, points });
  };

  const handleConfirmReject = () => {
    if (!selectedUpload) return;
    if (!rejectReason.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập lý do từ chối",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({ id: selectedUpload.id, reason: rejectReason.trim() });
  };

  const getStatusBadge = (status: "pending" | "approved" | "rejected") => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3" />
            Chờ duyệt
          </Badge>
        );
      case "approved":
        return (
          <Badge className="gap-1 bg-green-600 hover:bg-green-700" data-testid={`badge-status-approved`}>
            <CheckCircle className="h-3 w-3" />
            Đã duyệt
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1" data-testid={`badge-status-rejected`}>
            <XCircle className="h-3 w-3" />
            Từ chối
          </Badge>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Uploads</h1>
        <p className="text-muted-foreground">
          Quản lý files được upload bởi users
        </p>
      </div>

      <Alert>
        <AlertDescription>
          Khi phê duyệt file, bạn cần chọn danh mục cho document. Hệ thống sẽ tự động tạo document và trigger pipeline xử lý.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách User Uploads</CardTitle>
          <CardDescription>
            Tổng số: {uploads.length} files
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-uploads">
              Chưa có user upload nào
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Kích thước</TableHead>
                  <TableHead>Ngày upload</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
                  <TableRow key={upload.id} data-testid={`row-upload-${upload.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium" data-testid={`text-username-${upload.id}`}>
                          {upload.userName || "Unknown"}
                        </span>
                        <span className="text-sm text-muted-foreground" data-testid={`text-useremail-${upload.id}`}>
                          {upload.userEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col gap-1">
                          <span className="font-medium" data-testid={`text-filename-${upload.id}`}>
                            {upload.fileName}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs px-2"
                              onClick={() => window.open(`/api/admin/user-uploads/${upload.id}/view-html`, '_blank')}
                              data-testid={`button-view-html-${upload.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Xem file
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs px-2"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `/api/admin/user-uploads/${upload.id}/download`;
                                link.download = upload.fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              data-testid={`button-download-${upload.id}`}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Tải về
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-filesize-${upload.id}`}>
                      {formatFileSize(upload.fileSize)}
                    </TableCell>
                    <TableCell data-testid={`text-uploaddate-${upload.id}`}>
                      {upload.uploadedAt
                        ? new Date(upload.uploadedAt).toLocaleString("vi-VN")
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(upload.approvalStatus as "pending" | "approved" | "rejected")}</TableCell>
                    <TableCell className="text-right">
                      {upload.approvalStatus === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveClick(upload)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            data-testid={`button-approve-${upload.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectClick(upload)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            data-testid={`button-reject-${upload.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Từ chối
                          </Button>
                        </div>
                      )}
                      {upload.approvalStatus === "approved" && (
                        <span className="text-sm text-muted-foreground">
                          Đã duyệt bởi Admin
                        </span>
                      )}
                      {upload.approvalStatus === "rejected" && (
                        <span className="text-sm text-muted-foreground">
                          Đã từ chối
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phê duyệt Upload</DialogTitle>
            <DialogDescription>
              Chọn danh mục cho document sẽ được tạo từ file này.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUpload && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedUpload.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    Bởi: {selectedUpload.userName} ({selectedUpload.userEmail})
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approve-category">
                  <FolderOpen className="w-4 h-4 inline mr-2" />
                  Danh mục <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger id="approve-category" data-testid="select-approve-category">
                    <SelectValue placeholder="Chọn danh mục cho document" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem 
                        key={category.id} 
                        value={category.name}
                        data-testid={`option-approve-category-${category.id}`}
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approve-points">
                  <Coins className="w-4 h-4 inline mr-2" />
                  Số điểm thưởng cho user
                </Label>
                <Input
                  id="approve-points"
                  type="number"
                  min="0"
                  placeholder="Nhập số điểm (VD: 10)"
                  value={pointsToAward}
                  onChange={(e) => setPointsToAward(e.target.value)}
                  data-testid="input-approve-points"
                />
                <p className="text-xs text-muted-foreground">
                  Điểm sẽ được cộng vào tài khoản của user. Để trống hoặc 0 nếu không thưởng điểm.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={approveMutation.isPending}
              data-testid="button-cancel-approve"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmApprove}
              disabled={approveMutation.isPending || !selectedCategory}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Đang xử lý..." : "Xác nhận phê duyệt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối Upload</DialogTitle>
            <DialogDescription>
              Vui lòng nhập lý do từ chối để thông báo cho user.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUpload && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedUpload.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    Bởi: {selectedUpload.userName} ({selectedUpload.userEmail})
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reject-reason">
                  Lý do từ chối <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Nhập lý do từ chối file này..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  data-testid="textarea-reject-reason"
                />
                <p className="text-xs text-muted-foreground">
                  Lý do này sẽ được gửi thông báo tới user.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectMutation.isPending}
              data-testid="button-cancel-reject"
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Đang xử lý..." : "Xác nhận từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

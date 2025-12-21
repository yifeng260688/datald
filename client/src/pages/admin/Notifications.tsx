import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Send, Trash2, Users, User, Loader2 } from "lucide-react";
import AdminLayout from "./Layout";

interface NotificationType {
  id: string;
  title: string;
  content: string;
  type: "all" | "single";
  targetUserId?: string;
  senderId: string;
  senderName?: string;
  isRead: boolean;
  createdAt: string;
}

interface UserType {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export default function Notifications() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notificationType, setNotificationType] = useState<"all" | "single">("all");
  const [targetUserId, setTargetUserId] = useState("");

  const { data: notifications = [], isLoading: loadingNotifications } = useQuery<NotificationType[]>({
    queryKey: ["/api/admin/notifications"],
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; type: "all" | "single"; targetUserId?: string }) => {
      return apiRequest("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Đã gửi thông báo thành công" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      setTitle("");
      setContent("");
      setNotificationType("all");
      setTargetUserId("");
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/notifications/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Đã xóa thông báo" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast({ title: "Vui lòng nhập đầy đủ tiêu đề và nội dung", variant: "destructive" });
      return;
    }
    if (notificationType === "single" && !targetUserId) {
      toast({ title: "Vui lòng chọn người nhận", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      type: notificationType,
      targetUserId: notificationType === "single" ? targetUserId : undefined,
    });
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return userId;
    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return name || user.email;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Quản lý Thông báo</h1>
            <p className="text-muted-foreground">Gửi thông báo tới người dùng</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Tạo thông báo mới
              </CardTitle>
              <CardDescription>
                Gửi thông báo tới tất cả người dùng hoặc một người dùng cụ thể
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Tiêu đề</Label>
                  <Input
                    id="title"
                    placeholder="Nhập tiêu đề thông báo..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="input-notification-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Nội dung</Label>
                  <Textarea
                    id="content"
                    placeholder="Nhập nội dung thông báo..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    data-testid="input-notification-content"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Gửi đến</Label>
                  <RadioGroup
                    value={notificationType}
                    onValueChange={(value: "all" | "single") => {
                      setNotificationType(value);
                      if (value === "all") setTargetUserId("");
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="type-all" data-testid="radio-notification-all" />
                      <Label htmlFor="type-all" className="flex items-center gap-1 cursor-pointer">
                        <Users className="h-4 w-4" />
                        Tất cả người dùng
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="type-single" data-testid="radio-notification-single" />
                      <Label htmlFor="type-single" className="flex items-center gap-1 cursor-pointer">
                        <User className="h-4 w-4" />
                        Một người dùng
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {notificationType === "single" && (
                  <div className="space-y-2">
                    <Label>Chọn người nhận</Label>
                    <Select value={targetUserId} onValueChange={setTargetUserId}>
                      <SelectTrigger data-testid="select-notification-user">
                        <SelectValue placeholder="Chọn người dùng..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName || user.lastName
                              ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                              : user.email}
                            {user.role === "admin" && " (Admin)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-send-notification"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Gửi thông báo
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thống kê</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <Bell className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng thông báo</p>
                    <p className="text-2xl font-bold">{notifications.length}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Gửi tới tất cả</p>
                    <p className="text-2xl font-bold">{notifications.filter((n) => n.type === "all").length}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Gửi riêng</p>
                    <p className="text-2xl font-bold">{notifications.filter((n) => n.type === "single").length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lịch sử thông báo</CardTitle>
            <CardDescription>Danh sách tất cả thông báo đã gửi</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingNotifications ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có thông báo nào
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Người nhận</TableHead>
                    <TableHead>Ngày gửi</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {notification.title}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {notification.content}
                      </TableCell>
                      <TableCell>
                        {notification.type === "all" ? (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Users className="h-3 w-3" />
                            Tất cả
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <User className="h-3 w-3" />
                            Cá nhân
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {notification.type === "single" && notification.targetUserId
                          ? getUserName(notification.targetUserId)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(notification.createdAt).toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(notification.id)}
                          disabled={deleteMutation.isPending}
                          title="Xóa"
                          data-testid={`button-delete-notification-${notification.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Shield, User as UserIcon, Coins, Edit, Ban, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const SUPER_ADMIN_EMAIL = "yifeng260688@gmail.com";

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPointsUser, setEditingPointsUser] = useState<User | null>(null);
  const [newPoints, setNewPoints] = useState("");
  const [blockingUser, setBlockingUser] = useState<User | null>(null);
  const [unblockingUser, setUnblockingUser] = useState<User | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Đã cập nhật",
        description: "Vai trò người dùng đã được thay đổi",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật vai trò",
        variant: "destructive",
      });
    },
  });

  const updatePointsMutation = useMutation({
    mutationFn: async ({ userId, points }: { userId: string; points: number }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/points`, { points });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Đã cập nhật",
        description: "Điểm người dùng đã được thay đổi",
      });
      setEditingPointsUser(null);
      setNewPoints("");
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật điểm. Chỉ Super Admin mới có thể quản lý điểm.",
        variant: "destructive",
      });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/block`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Đã khóa",
        description: "Người dùng đã bị khóa thành công",
      });
      setBlockingUser(null);
      setBlockReason("");
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể khóa người dùng. Chỉ Super Admin mới có quyền này.",
        variant: "destructive",
      });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/admin/users/${userId}/unblock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Đã mở khóa",
        description: "Người dùng đã được mở khóa thành công",
      });
      setUnblockingUser(null);
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể mở khóa người dùng. Chỉ Super Admin mới có quyền này.",
        variant: "destructive",
      });
    },
  });

  const handleEditPoints = (user: User) => {
    setEditingPointsUser(user);
    setNewPoints(String(user.points || 0));
  };

  const handleSavePoints = () => {
    if (!editingPointsUser) return;
    const points = parseInt(newPoints, 10);
    if (isNaN(points) || points < 0) {
      toast({
        title: "Lỗi",
        description: "Điểm phải là số không âm",
        variant: "destructive",
      });
      return;
    }
    updatePointsMutation.mutate({ userId: editingPointsUser.id, points });
  };

  const filteredUsers = users.filter((user) =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-admin-users">Quản lý Người dùng</h1>
        <p className="text-muted-foreground">Xem và quản lý người dùng</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm người dùng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-users"
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Đang tải...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Không tìm thấy người dùng</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Điểm</TableHead>
                  <TableHead>Ngày tham gia</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-foreground">
                            {user.firstName?.[0] ?? user.email?.[0] ?? "?"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : "Chưa cập nhật"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.role === "admin" ? "default" : "secondary"}
                        data-testid={`badge-role-${user.id}`}
                      >
                        {user.role === "admin" ? (
                          <>
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </>
                        ) : (
                          <>
                            <UserIcon className="h-3 w-3 mr-1" />
                            User
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(user as any).isBlocked ? (
                        <Badge variant="destructive" data-testid={`badge-blocked-${user.id}`}>
                          <Ban className="h-3 w-3 mr-1" />
                          Đã khóa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600" data-testid={`badge-active-${user.id}`}>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Hoạt động
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Coins className="h-4 w-4 text-amber-500" />
                          <span className="font-semibold text-amber-600 dark:text-amber-400" data-testid={`text-points-${user.id}`}>
                            {user.points || 0}
                          </span>
                        </div>
                        {isSuperAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditPoints(user)}
                            data-testid={`button-edit-points-${user.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(role) => updateRoleMutation.mutate({ userId: user.id, role })}
                          disabled={updateRoleMutation.isPending}
                        >
                          <SelectTrigger 
                            className="w-28"
                            data-testid={`select-role-${user.id}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        {isSuperAdmin && (
                          (user as any).isBlocked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setUnblockingUser(user)}
                              data-testid={`button-unblock-${user.id}`}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mở khóa
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setBlockingUser(user)}
                              data-testid={`button-block-${user.id}`}
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Khóa
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingPointsUser} onOpenChange={(open) => !open && setEditingPointsUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa điểm người dùng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">
                  {editingPointsUser?.firstName?.[0] ?? editingPointsUser?.email?.[0] ?? "?"}
                </span>
              </div>
              <div>
                <p className="font-medium">
                  {editingPointsUser?.firstName && editingPointsUser?.lastName
                    ? `${editingPointsUser.firstName} ${editingPointsUser.lastName}`
                    : editingPointsUser?.email ?? "Người dùng"}
                </p>
                <p className="text-sm text-muted-foreground">{editingPointsUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Số điểm</label>
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                <Input
                  type="number"
                  min="0"
                  value={newPoints}
                  onChange={(e) => setNewPoints(e.target.value)}
                  placeholder="Nhập số điểm"
                  data-testid="input-new-points"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPointsUser(null)}>
              Hủy
            </Button>
            <Button 
              onClick={handleSavePoints}
              disabled={updatePointsMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600"
              data-testid="button-save-points"
            >
              {updatePointsMutation.isPending ? "Đang lưu..." : "Lưu điểm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block User Dialog */}
      <AlertDialog open={!!blockingUser} onOpenChange={(open) => !open && setBlockingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" />
              Khóa người dùng
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn khóa người dùng <strong>{blockingUser?.email}</strong>?
              <br /><br />
              Người dùng bị khóa sẽ không thể:
              <ul className="list-disc list-inside mt-2 text-left">
                <li>Xem nội dung bài viết</li>
                <li>Upload file</li>
                <li>Quy đổi điểm</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Lý do khóa (không bắt buộc)</label>
            <Textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Nhập lý do khóa người dùng..."
              className="mt-2"
              data-testid="input-block-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setBlockingUser(null); setBlockReason(""); }}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockingUser && blockUserMutation.mutate({ 
                userId: blockingUser.id, 
                reason: blockReason || "Bị khóa bởi admin" 
              })}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-block"
            >
              {blockUserMutation.isPending ? "Đang khóa..." : "Xác nhận khóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock User Dialog */}
      <AlertDialog open={!!unblockingUser} onOpenChange={(open) => !open && setUnblockingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Mở khóa người dùng
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn mở khóa người dùng <strong>{unblockingUser?.email}</strong>?
              <br /><br />
              Người dùng sẽ có thể sử dụng tất cả chức năng bình thường.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUnblockingUser(null)}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unblockingUser && unblockUserMutation.mutate(unblockingUser.id)}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-unblock"
            >
              {unblockUserMutation.isPending ? "Đang mở khóa..." : "Xác nhận mở khóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

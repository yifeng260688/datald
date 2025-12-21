import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "./Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, User as UserIcon, ShieldAlert, ShieldCheck, Ban, Unlock } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserPointsValidation {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  currentPoints: number;
  legitimatePoints: number;
  pointsUsed: number;
  availablePoints: number;
  isValid: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  blockedAt?: string;
}

export default function AdminUserPoints() {
  const { toast } = useToast();
  
  const { data: users = [], isLoading, error } = useQuery<UserPointsValidation[]>({
    queryKey: ["/api/admin/users-points-validation"],
  });

  const blockMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      return apiRequest("POST", `/api/admin/users/${userId}/block`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-points-validation"] });
      toast({ title: "Đã khóa tài khoản" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/users/${userId}/unblock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-points-validation"] });
      toast({ title: "Đã mở khóa tài khoản" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });

  const invalidUsers = users.filter(u => !u.isValid || u.isBlocked);
  const validUsers = users.filter(u => u.isValid && !u.isBlocked);
  const blockedCount = users.filter(u => u.isBlocked).length;
  const totalLegitPoints = users.reduce((sum, u) => sum + u.legitimatePoints, 0);

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-red-500">
          Chỉ super admin mới có quyền xem trang này
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Kiểm tra Điểm Hợp Lệ</h1>
            <p className="text-muted-foreground">
              Xác thực điểm của user (chỉ điểm từ super admin mới hợp lệ)
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User có điểm</CardTitle>
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-users-count">
                {users.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Điểm hợp lệ</CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-legit-points">
                {totalLegitPoints.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Điểm nghi ngờ</CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-invalid-count">
                {invalidUsers.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Đã bị khóa</CardTitle>
              <Ban className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-blocked-count">
                {blockedCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {invalidUsers.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
                User có điểm không hợp lệ / Đã khóa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Điểm hiện tại</TableHead>
                    <TableHead className="text-right">Điểm hợp lệ</TableHead>
                    <TableHead className="text-right">Đã dùng</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invalidUsers.map((user, index) => (
                    <TableRow key={user.userId} data-testid={`row-invalid-user-${user.userId}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-red-500" />
                          </div>
                          <div>
                            <div className="font-medium">{user.email}</div>
                            {user.firstName && (
                              <div className="text-xs text-muted-foreground">
                                {user.firstName} {user.lastName}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {user.currentPoints.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.legitimatePoints.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {user.pointsUsed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.availablePoints.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {user.isBlocked ? (
                          <Badge variant="destructive">
                            <Ban className="w-3 h-3 mr-1" />
                            Đã khóa
                          </Badge>
                        ) : !user.isValid ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            Nghi ngờ
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {user.isBlocked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unblockMutation.mutate(user.userId)}
                            disabled={unblockMutation.isPending}
                            data-testid={`button-unblock-${user.userId}`}
                          >
                            <Unlock className="w-3 h-3 mr-1" />
                            Mở khóa
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => blockMutation.mutate({ 
                              userId: user.userId, 
                              reason: "Điểm không hợp lệ" 
                            })}
                            disabled={blockMutation.isPending}
                            data-testid={`button-block-${user.userId}`}
                          >
                            <Ban className="w-3 h-3 mr-1" />
                            Khóa
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              User có điểm hợp lệ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : validUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-valid-users">
                <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Chưa có user nào có điểm hợp lệ</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Điểm hiện tại</TableHead>
                    <TableHead className="text-right">Điểm hợp lệ</TableHead>
                    <TableHead className="text-right">Đã dùng</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validUsers.map((user, index) => (
                    <TableRow key={user.userId} data-testid={`row-user-${user.userId}`}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium">{user.email}</div>
                            {user.firstName && (
                              <div className="text-xs text-muted-foreground">
                                {user.firstName} {user.lastName}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default" className="bg-primary text-primary-foreground">
                          <Coins className="w-3 h-3 mr-1" />
                          {user.currentPoints.toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {user.legitimatePoints.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {user.pointsUsed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.availablePoints.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Hợp lệ
                        </Badge>
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

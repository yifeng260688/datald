import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Coins, ArrowUpCircle, ArrowDownCircle, FileText, User } from "lucide-react";
import AdminLayout from "./Layout";

interface PointsLog {
  _id: string;
  userId: string;
  userEmail: string;
  adminId: string;
  adminEmail: string;
  previousPoints: number;
  newPoints: number;
  changeAmount: number;
  reason: string;
  actionType: "manual" | "upload_reward" | "redemption";
  relatedDocumentId?: string;
  relatedUploadId?: string;
  createdAt: string;
}

interface RedemptionLog {
  _id: string;
  userId: string;
  userEmail: string;
  documentId: string;
  documentTitle: string;
  postId: string;
  pointsDeducted: number;
  previousPoints: number;
  newPoints: number;
  createdAt: string;
}

function getActionTypeLabel(type: string) {
  switch (type) {
    case "manual":
      return { label: "Điều chỉnh thủ công", variant: "secondary" as const };
    case "upload_reward":
      return { label: "Thưởng upload", variant: "default" as const };
    case "redemption":
      return { label: "Quy đổi", variant: "destructive" as const };
    default:
      return { label: type, variant: "outline" as const };
  }
}

function PointsLogsTable() {
  const { data: logs, isLoading } = useQuery<PointsLog[]>({
    queryKey: ["/api/admin/points-audit"],
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Chưa có nhật ký điểm nào
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Thành viên</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead className="text-right">Thay đổi</TableHead>
            <TableHead className="text-right">Điểm mới</TableHead>
            <TableHead>Lý do</TableHead>
            <TableHead>Admin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const actionType = getActionTypeLabel(log.actionType);
            return (
              <TableRow key={log._id} data-testid={`row-points-log-${log._id}`}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{log.userEmail}</div>
                      <div className="text-xs text-muted-foreground">ID: {log.userId.slice(0, 8)}...</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={actionType.variant}>{actionType.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className={`flex items-center justify-end gap-1 font-medium ${log.changeAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {log.changeAmount >= 0 ? (
                      <ArrowUpCircle className="h-4 w-4" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4" />
                    )}
                    {log.changeAmount >= 0 ? "+" : ""}{log.changeAmount}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {log.newPoints}
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={log.reason}>
                  {log.reason}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.adminEmail}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function RedemptionLogsTable() {
  const { data: logs, isLoading } = useQuery<RedemptionLog[]>({
    queryKey: ["/api/admin/redemption-logs"],
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Chưa có nhật ký quy đổi nào
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Thành viên</TableHead>
            <TableHead>Tài liệu</TableHead>
            <TableHead className="text-right">Điểm trừ</TableHead>
            <TableHead className="text-right">Điểm trước</TableHead>
            <TableHead className="text-right">Điểm sau</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log._id} data-testid={`row-redemption-log-${log._id}`}>
              <TableCell className="whitespace-nowrap">
                {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{log.userEmail}</div>
                    <div className="text-xs text-muted-foreground">ID: {log.userId.slice(0, 8)}...</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm max-w-[200px] truncate" title={log.documentTitle}>
                      {log.documentTitle}
                    </div>
                    <div className="text-xs text-muted-foreground">PostID: {log.postId}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="flex items-center justify-end gap-1 font-medium text-red-600">
                  <ArrowDownCircle className="h-4 w-4" />
                  -{log.pointsDeducted}
                </span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {log.previousPoints}
              </TableCell>
              <TableCell className="text-right font-medium">
                {log.newPoints}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminLogs() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Nhật ký hệ thống</h1>
          <p className="text-muted-foreground">
            Theo dõi điểm thưởng và quy đổi tài liệu của thành viên
          </p>
        </div>

        <Tabs defaultValue="points" className="space-y-4">
          <TabsList>
            <TabsTrigger value="points" className="gap-2" data-testid="tab-points-logs">
              <Coins className="h-4 w-4" />
              Điểm thưởng
            </TabsTrigger>
            <TabsTrigger value="redemptions" className="gap-2" data-testid="tab-redemption-logs">
              <FileText className="h-4 w-4" />
              Quy đổi tài liệu
            </TabsTrigger>
          </TabsList>

          <TabsContent value="points">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Nhật ký điểm thưởng
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PointsLogsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="redemptions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Nhật ký quy đổi tài liệu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RedemptionLogsTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

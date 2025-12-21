import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Heart, Eye } from "lucide-react";
import { User, Document } from "@shared/schema";

export default function AdminDashboard() {
  const { data: stats } = useQuery<{
    totalDocuments: number;
    totalUsers: number;
    totalFavorites: number;
    totalViews: number;
  }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: recentDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/admin/documents/recent"],
  });

  const { data: recentUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users/recent"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-admin-dashboard">Dashboard</h1>
        <p className="text-muted-foreground">Tổng quan hệ thống</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng tài liệu</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-documents">
              {stats?.totalDocuments ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Người dùng</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-users">
              {stats?.totalUsers ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lượt yêu thích</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-favorites">
              {stats?.totalFavorites ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lượt xem</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-views">
              {stats?.totalViews ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tài liệu mới nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có tài liệu nào</p>
              ) : (
                recentDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3" data-testid={`recent-doc-${doc.id}`}>
                    <img 
                      src={doc.coverImageUrl} 
                      alt={doc.title} 
                      className="h-12 w-12 rounded object-cover"
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{doc.title}</p>
                      <p className="text-sm text-muted-foreground">{doc.category}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Người dùng mới</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có người dùng nào</p>
              ) : (
                recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3" data-testid={`recent-user-${user.id}`}>
                    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-foreground">
                        {user.firstName?.[0] ?? user.email?.[0] ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

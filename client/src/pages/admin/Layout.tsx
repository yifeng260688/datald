import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { LayoutDashboard, FileText, Users, Home, Tag, Upload, UserCheck, FolderKanban, MessageCircle, Bell, Coins, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BadgeCounts {
  pendingUploads: number;
  unreadSupport: number;
  newUsers: number;
}

const menuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
    badgeKey: null,
  },
  {
    title: "Tài liệu",
    url: "/admin/documents",
    icon: FileText,
    badgeKey: null,
  },
  {
    title: "Danh mục",
    url: "/admin/categories",
    icon: FolderKanban,
    badgeKey: null,
  },
  {
    title: "Tags",
    url: "/admin/tags",
    icon: Tag,
    badgeKey: null,
  },
  {
    title: "Upload Hàng loạt",
    url: "/admin/bulk-upload",
    icon: Upload,
    badgeKey: null,
  },
  {
    title: "User Uploads",
    url: "/admin/user-uploads",
    icon: UserCheck,
    badgeKey: "pendingUploads" as keyof BadgeCounts,
  },
  {
    title: "Hỗ trợ Chat",
    url: "/admin/support",
    icon: MessageCircle,
    badgeKey: "unreadSupport" as keyof BadgeCounts,
  },
  {
    title: "Thông báo",
    url: "/admin/notifications",
    icon: Bell,
    badgeKey: null,
  },
  {
    title: "Người dùng",
    url: "/admin/users",
    icon: Users,
    badgeKey: "newUsers" as keyof BadgeCounts,
    isRed: true,
  },
  {
    title: "Check Điểm User",
    url: "/admin/user-points",
    icon: Coins,
    badgeKey: null,
  },
  {
    title: "Nhật ký hệ thống",
    url: "/admin/logs",
    icon: ClipboardList,
    badgeKey: null,
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: badgeCounts } = useQuery<BadgeCounts>({
    queryKey: ["/api/admin/badge-counts"],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!user && user.role === "admin",
  });

  // Redirect if not admin
  if (user && user.role !== "admin") {
    window.location.href = "/";
    return null;
  }

  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>
                <Link href="/">
                  <div className="flex items-center gap-2 cursor-pointer hover-elevate active-elevate-2 rounded-md p-2 -m-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span className="font-semibold">Admin Panel</span>
                  </div>
                </Link>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const badgeCount = item.badgeKey && badgeCounts ? badgeCounts[item.badgeKey] : 0;
                    const isRed = (item as any).isRed;
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={location === item.url}>
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.title}</span>
                            {badgeCount > 0 && (
                              <Badge 
                                variant={isRed ? "destructive" : "secondary"}
                                className="ml-auto text-xs min-w-[20px] h-5 flex items-center justify-center"
                                data-testid={`badge-${item.badgeKey}`}
                              >
                                {badgeCount}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/">
                        <Home className="h-4 w-4" />
                        <span>Về trang chủ</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

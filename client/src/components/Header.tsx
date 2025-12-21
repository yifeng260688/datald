import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Heart, LogOut, Shield, Coins, User, FileText } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { UploadDialog } from "@/components/UploadDialog";
import { NotificationBell } from "@/components/NotificationBell";
import logoImage from "@assets/LOGO DATA TÁCH NỀN_1764101818270.png";

export function Header() {
  const { user, isAuthenticated } = useAuth();

  const getInitials = () => {
    if (!user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-24 items-center justify-between">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-3 cursor-pointer hover-elevate rounded-lg px-3 py-2 -ml-3">
              <div className="flex items-center justify-center w-48 h-48">
                <img 
                  src={logoImage} 
                  alt="DATA LD Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="font-bold text-[35px]">DATA LD</h1>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated && <UploadDialog />}
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                    data-testid="button-user-menu"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={user?.profileImageUrl || ""}
                        alt={user?.firstName || "User"}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      {(user?.firstName || user?.lastName) && (
                        <p className="font-medium" data-testid="text-user-name">
                          {[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
                        </p>
                      )}
                      {user?.email && (
                        <p className="text-sm text-muted-foreground" data-testid="text-user-email">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="flex items-center gap-2 p-2 bg-accent/50 rounded-sm mx-1">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Điểm quy đổi</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400" data-testid="text-user-points">
                        {(user?.points ?? 0).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" data-testid="link-profile">
                      <div className="flex items-center gap-2 w-full cursor-pointer">
                        <User className="w-4 h-4" />
                        <span>Tài khoản</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" data-testid="link-redeemed-files">
                      <div className="flex items-center gap-2 w-full cursor-pointer">
                        <FileText className="w-4 h-4" />
                        <span>File đã quy đổi</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/" data-testid="link-favorites">
                      <div className="flex items-center gap-2 w-full cursor-pointer">
                        <Heart className="w-4 h-4" />
                        <span>Yêu thích</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  {user?.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" data-testid="link-admin">
                          <div className="flex items-center gap-2 w-full cursor-pointer">
                            <Shield className="w-4 h-4" />
                            <span>Admin Panel</span>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" className="cursor-pointer" data-testid="link-logout">
                      <div className="flex items-center gap-2 w-full">
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất</span>
                      </div>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild data-testid="button-login">
                <a href="/api/auth/google">
                  <SiGoogle className="w-4 h-4 mr-2" />
                  Đăng nhập bằng Google
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// Reference: javascript_log_in_with_replit blueprint
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useDevToolsDetection } from "@/hooks/useDevToolsDetection";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import DocumentDetail from "@/pages/DocumentDetail";
import AdminLayout from "@/pages/admin/Layout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminDocuments from "@/pages/admin/Documents";
import AdminCategories from "@/pages/admin/Categories";
import AdminTags from "@/pages/admin/Tags";
import AdminUsers from "@/pages/admin/Users";
import AdminBulkUpload from "@/pages/admin/BulkUpload";
import AdminUserUploads from "@/pages/admin/UserUploads";
import AdminSupport from "@/pages/admin/Support";
import AdminNotifications from "@/pages/admin/Notifications";
import AdminUserPoints from "@/pages/admin/UserPoints";
import AdminLogs from "@/pages/admin/Logs";
import DocumentForm from "@/pages/admin/DocumentForm";
import { AdminRoute } from "@/components/AdminRoute";
import { ChatLauncher } from "@/components/ChatWidget";
import Profile from "@/pages/Profile";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/document/:id" component={DocumentDetail} />
      <Route path="/profile" component={Profile} />
      
      {/* Admin routes - protected */}
      <Route path="/admin">
        <AdminRoute>
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/documents">
        <AdminRoute>
          <AdminLayout>
            <AdminDocuments />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/categories">
        <AdminRoute>
          <AdminLayout>
            <AdminCategories />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/tags">
        <AdminRoute>
          <AdminLayout>
            <AdminTags />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/users">
        <AdminRoute>
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/bulk-upload">
        <AdminRoute>
          <AdminLayout>
            <AdminBulkUpload />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/user-uploads">
        <AdminRoute>
          <AdminLayout>
            <AdminUserUploads />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/support">
        <AdminRoute>
          <AdminLayout>
            <AdminSupport />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/notifications">
        <AdminRoute>
          <AdminNotifications />
        </AdminRoute>
      </Route>
      <Route path="/admin/user-points">
        <AdminRoute>
          <AdminUserPoints />
        </AdminRoute>
      </Route>
      <Route path="/admin/logs">
        <AdminRoute>
          <AdminLogs />
        </AdminRoute>
      </Route>
      <Route path="/admin/documents/new">
        <AdminRoute>
          <AdminLayout>
            <DocumentForm />
          </AdminLayout>
        </AdminRoute>
      </Route>
      <Route path="/admin/documents/edit/:id">
        {(params) => (
          <AdminRoute>
            <AdminLayout>
              <DocumentForm documentId={params.id} />
            </AdminLayout>
          </AdminRoute>
        )}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function DevToolsProtection() {
  useDevToolsDetection();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DevToolsProtection />
        <Toaster />
        <Router />
        <ChatLauncher />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

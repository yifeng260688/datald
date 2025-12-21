import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Tag, InsertTag } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Tag as TagIcon } from "lucide-react";

export default function Tags() {
  const { toast } = useToast();
  const [newTagName, setNewTagName] = useState("");
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const { data: tags, isLoading } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  const createMutation = useMutation({
    mutationFn: async (tagData: InsertTag) => {
      const response = await apiRequest("POST", "/api/admin/tags", tagData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setNewTagName("");
      toast({
        title: "Thành công",
        description: "Tag đã được tạo",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể tạo tag",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/tags/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete tag");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setTagToDelete(null);
      toast({
        title: "Thành công",
        description: "Tag đã được xóa",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa tag",
        variant: "destructive",
      });
    },
  });

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên tag không được để trống",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({ name: newTagName.trim() });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <TagIcon className="h-6 w-6" />
          <h1 className="text-3xl font-bold" data-testid="heading-tags">Quản lý Tags</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Thêm Tag Mới</CardTitle>
            <CardDescription>
              Tạo tag mới để phân loại tài liệu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTag} className="flex gap-2">
              <Input
                type="text"
                placeholder="Tên tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                data-testid="input-tag-name"
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-add-tag"
              >
                <Plus className="h-4 w-4 mr-2" />
                Thêm Tag
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách Tags</CardTitle>
            <CardDescription>
              {tags?.length || 0} tag hiện có
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!tags || tags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có tag nào
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id} data-testid={`row-tag-${tag.id}`}>
                      <TableCell className="font-medium">{tag.name}</TableCell>
                      <TableCell>
                        {tag.createdAt
                          ? new Date(tag.createdAt).toLocaleDateString("vi-VN")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setTagToDelete(tag)}
                          data-testid={`button-delete-tag-${tag.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <AlertDialog open={!!tagToDelete} onOpenChange={() => setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa tag "{tagToDelete?.name}"? Hành động này không
              thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tagToDelete && deleteMutation.mutate(tagToDelete.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

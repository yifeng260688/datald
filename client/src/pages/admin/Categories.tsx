import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, Plus, Trash2, Pencil, ImageIcon, ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Category {
  _id: string;
  id: string;
  name: string;
  logoUrl?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Subcategory {
  _id: string;
  id: string;
  name: string;
  categoryId: string;
  parentSubcategoryId?: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function Categories() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryOrder, setNewCategoryOrder] = useState("");
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryOrder, setEditCategoryOrder] = useState("");
  const [editSelectedLogo, setEditSelectedLogo] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [isEditSubcategoryDialogOpen, setIsEditSubcategoryDialogOpen] = useState(false);
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<Category | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategoryOrder, setNewSubcategoryOrder] = useState("");
  const [parentSubcategoryId, setParentSubcategoryId] = useState<string | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [editSubcategoryName, setEditSubcategoryName] = useState("");
  const [editSubcategoryOrder, setEditSubcategoryOrder] = useState("");
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: categories, isLoading, error } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create category");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCreateDialogOpen(false);
      setNewCategoryName("");
      setNewCategoryOrder("");
      setSelectedLogo(null);
      setLogoPreview(null);
      toast({
        title: "Thành công",
        description: "Danh mục đã được tạo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Thành công",
        description: "Danh mục đã được xóa",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update category");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      setEditCategoryName("");
      setEditCategoryOrder("");
      setEditSelectedLogo(null);
      setEditLogoPreview(null);
      toast({
        title: "Thành công",
        description: "Danh mục đã được cập nhật",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: async (data: { name: string; categoryId: string; parentSubcategoryId?: string | null; order: number }) => {
      return await apiRequest("POST", "/api/subcategories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      setIsSubcategoryDialogOpen(false);
      setSelectedCategoryForSubcategory(null);
      setNewSubcategoryName("");
      setNewSubcategoryOrder("");
      setParentSubcategoryId(null);
      toast({
        title: "Thành công",
        description: "Danh mục con đã được tạo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; order: number } }) => {
      return await apiRequest("PATCH", `/api/subcategories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      setIsEditSubcategoryDialogOpen(false);
      setEditingSubcategory(null);
      setEditSubcategoryName("");
      setEditSubcategoryOrder("");
      toast({
        title: "Thành công",
        description: "Danh mục con đã được cập nhật",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/subcategories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      toast({
        title: "Thành công",
        description: "Danh mục con đã được xóa",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCategoryName.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên danh mục không được để trống",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("name", newCategoryName.trim());
    formData.append("order", newCategoryOrder || "0");
    
    if (selectedLogo) {
      formData.append("logo", selectedLogo);
    }

    createMutation.mutate(formData);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa danh mục "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryOrder(category.order.toString());
    setEditLogoPreview(category.logoUrl || null);
    setEditSelectedLogo(null);
    setIsEditDialogOpen(true);
  };

  const handleEditLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditSelectedLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCategory) return;

    if (!editCategoryName.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên danh mục không được để trống",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("name", editCategoryName.trim());
    formData.append("order", editCategoryOrder || "0");
    
    if (editSelectedLogo) {
      formData.append("logo", editSelectedLogo);
    }

    updateMutation.mutate({ id: editingCategory.id, formData });
  };

  const toggleCategoryExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleAddSubcategory = (category: Category) => {
    setSelectedCategoryForSubcategory(category);
    setNewSubcategoryName("");
    setNewSubcategoryOrder("");
    setIsSubcategoryDialogOpen(true);
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCategoryForSubcategory) return;

    if (!newSubcategoryName.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên danh mục con không được để trống",
        variant: "destructive",
      });
      return;
    }

    createSubcategoryMutation.mutate({
      name: newSubcategoryName.trim(),
      categoryId: selectedCategoryForSubcategory.id,
      parentSubcategoryId: parentSubcategoryId || null,
      order: parseInt(newSubcategoryOrder) || 0,
    });
  };

  const toggleSubcategoryExpand = (subcategoryId: string) => {
    setExpandedSubcategories(prev => {
      const next = new Set(prev);
      if (next.has(subcategoryId)) {
        next.delete(subcategoryId);
      } else {
        next.add(subcategoryId);
      }
      return next;
    });
  };

  const getChildSubcategories = (parentId: string | null, categoryId: string) => {
    return subcategories?.filter(s => 
      s.categoryId === categoryId && 
      (parentId === null ? !s.parentSubcategoryId : s.parentSubcategoryId === parentId)
    ) || [];
  };

  const getRootSubcategories = (categoryId: string) => {
    return subcategories?.filter(s => s.categoryId === categoryId && !s.parentSubcategoryId) || [];
  };

  const getSubcategoryPath = (subcategoryId: string): string => {
    const subcategory = subcategories?.find(s => s.id === subcategoryId);
    if (!subcategory) return "";
    if (!subcategory.parentSubcategoryId) return subcategory.name;
    return getSubcategoryPath(subcategory.parentSubcategoryId) + " → " + subcategory.name;
  };

  const openAddChildSubcategory = (category: Category, parentSub: Subcategory | null = null) => {
    setSelectedCategoryForSubcategory(category);
    setParentSubcategoryId(parentSub?.id || null);
    setNewSubcategoryName("");
    setNewSubcategoryOrder("");
    setIsSubcategoryDialogOpen(true);
  };

  const handleEditSubcategory = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setEditSubcategoryName(subcategory.name);
    setEditSubcategoryOrder(subcategory.order.toString());
    setIsEditSubcategoryDialogOpen(true);
  };

  const handleUpdateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingSubcategory) return;

    if (!editSubcategoryName.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên danh mục con không được để trống",
        variant: "destructive",
      });
      return;
    }

    updateSubcategoryMutation.mutate({
      id: editingSubcategory.id,
      data: {
        name: editSubcategoryName.trim(),
        order: parseInt(editSubcategoryOrder) || 0,
      },
    });
  };

  const handleDeleteSubcategory = (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa danh mục con "${name}"?`)) {
      deleteSubcategoryMutation.mutate(id);
    }
  };

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories?.filter(s => s.categoryId === categoryId) || [];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-categories">Quản lý Danh mục</h1>
          <p className="text-muted-foreground">Tạo và quản lý danh mục cho tài liệu</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-category">
              <Plus className="w-4 h-4 mr-2" />
              Tạo Danh mục
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo Danh mục Mới</DialogTitle>
              <DialogDescription>
                Thêm danh mục mới với tên và logo tùy chọn
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCategory}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="category-name">Tên danh mục</Label>
                  <Input
                    id="category-name"
                    placeholder="Nhập tên danh mục..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    data-testid="input-category-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category-order">Thứ tự hiển thị</Label>
                  <Input
                    id="category-order"
                    type="number"
                    placeholder="0"
                    value={newCategoryOrder}
                    onChange={(e) => setNewCategoryOrder(e.target.value)}
                    data-testid="input-category-order"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category-logo">Logo danh mục (tùy chọn)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="category-logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="flex-1"
                      data-testid="input-category-logo"
                    />
                    {logoPreview && (
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="w-12 h-12 object-contain rounded border"
                      />
                    )}
                    {!logoPreview && (
                      <div className="w-12 h-12 rounded border flex items-center justify-center bg-muted">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setNewCategoryName("");
                    setNewCategoryOrder("");
                    setSelectedLogo(null);
                    setLogoPreview(null);
                  }}
                  data-testid="button-cancel"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-category"
                >
                  {createMutation.isPending ? "Đang tạo..." : "Tạo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Category Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chỉnh sửa Danh mục</DialogTitle>
              <DialogDescription>
                Cập nhật thông tin danh mục
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateCategory}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-category-name">Tên danh mục</Label>
                  <Input
                    id="edit-category-name"
                    placeholder="Nhập tên danh mục..."
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    data-testid="input-edit-category-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category-order">Thứ tự hiển thị</Label>
                  <Input
                    id="edit-category-order"
                    type="number"
                    placeholder="0"
                    value={editCategoryOrder}
                    onChange={(e) => setEditCategoryOrder(e.target.value)}
                    data-testid="input-edit-category-order"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category-logo">Logo danh mục</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="edit-category-logo"
                      type="file"
                      accept="image/*"
                      onChange={handleEditLogoSelect}
                      className="flex-1"
                      data-testid="input-edit-category-logo"
                    />
                    {editLogoPreview && (
                      <img 
                        src={editLogoPreview} 
                        alt="Logo preview" 
                        className="w-12 h-12 object-contain rounded border"
                      />
                    )}
                    {!editLogoPreview && (
                      <div className="w-12 h-12 rounded border flex items-center justify-center bg-muted">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Để trống nếu không muốn thay đổi logo
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingCategory(null);
                    setEditCategoryName("");
                    setEditCategoryOrder("");
                    setEditSelectedLogo(null);
                    setEditLogoPreview(null);
                  }}
                  data-testid="button-edit-cancel"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-edit-submit"
                >
                  {updateMutation.isPending ? "Đang cập nhật..." : "Cập nhật"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Subcategory Dialog */}
        <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {parentSubcategoryId ? "Thêm Nhánh Con" : "Tạo Danh mục Con"}
              </DialogTitle>
              <DialogDescription>
                {parentSubcategoryId 
                  ? `Thêm nhánh con cho "${getSubcategoryPath(parentSubcategoryId)}" trong "${selectedCategoryForSubcategory?.name}"`
                  : `Thêm danh mục con cho "${selectedCategoryForSubcategory?.name}"`
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubcategory}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subcategory-name">
                    {parentSubcategoryId ? "Tên nhánh con" : "Tên danh mục con"}
                  </Label>
                  <Input
                    id="subcategory-name"
                    placeholder={parentSubcategoryId ? "Nhập tên nhánh con..." : "Nhập tên danh mục con..."}
                    value={newSubcategoryName}
                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                    data-testid="input-subcategory-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcategory-order">Thứ tự hiển thị</Label>
                  <Input
                    id="subcategory-order"
                    type="number"
                    placeholder="0"
                    value={newSubcategoryOrder}
                    onChange={(e) => setNewSubcategoryOrder(e.target.value)}
                    data-testid="input-subcategory-order"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsSubcategoryDialogOpen(false);
                    setSelectedCategoryForSubcategory(null);
                    setNewSubcategoryName("");
                    setNewSubcategoryOrder("");
                    setParentSubcategoryId(null);
                  }}
                  data-testid="button-subcategory-cancel"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createSubcategoryMutation.isPending}
                  data-testid="button-subcategory-submit"
                >
                  {createSubcategoryMutation.isPending ? "Đang tạo..." : "Tạo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Subcategory Dialog */}
        <Dialog open={isEditSubcategoryDialogOpen} onOpenChange={setIsEditSubcategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chỉnh sửa Danh mục Con</DialogTitle>
              <DialogDescription>
                Cập nhật thông tin danh mục con
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateSubcategory}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-subcategory-name">Tên danh mục con</Label>
                  <Input
                    id="edit-subcategory-name"
                    placeholder="Nhập tên danh mục con..."
                    value={editSubcategoryName}
                    onChange={(e) => setEditSubcategoryName(e.target.value)}
                    data-testid="input-edit-subcategory-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-subcategory-order">Thứ tự hiển thị</Label>
                  <Input
                    id="edit-subcategory-order"
                    type="number"
                    placeholder="0"
                    value={editSubcategoryOrder}
                    onChange={(e) => setEditSubcategoryOrder(e.target.value)}
                    data-testid="input-edit-subcategory-order"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditSubcategoryDialogOpen(false);
                    setEditingSubcategory(null);
                    setEditSubcategoryName("");
                    setEditSubcategoryOrder("");
                  }}
                  data-testid="button-edit-subcategory-cancel"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={updateSubcategoryMutation.isPending}
                  data-testid="button-edit-subcategory-submit"
                >
                  {updateSubcategoryMutation.isPending ? "Đang cập nhật..." : "Cập nhật"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Không thể tải danh sách danh mục. Vui lòng thử lại sau.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách Danh mục</CardTitle>
          <CardDescription>
            {categories?.length || 0} danh mục, {subcategories?.length || 0} danh mục con
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Đang tải...
            </div>
          ) : categories && categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map((category) => {
                const categorySubcategories = getSubcategoriesForCategory(category.id);
                const isExpanded = expandedCategories.has(category.id);
                
                return (
                  <Collapsible 
                    key={category.id} 
                    open={isExpanded}
                    onOpenChange={() => toggleCategoryExpand(category.id)}
                  >
                    <div className="border rounded-lg" data-testid={`row-category-${category.id}`}>
                      <div className="flex items-center p-3 gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-expand-${category.id}`}>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        
                        {category.logoUrl ? (
                          <img 
                            src={category.logoUrl} 
                            alt={category.name} 
                            className="w-10 h-10 object-contain rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium" data-testid={`text-category-name-${category.id}`}>
                            {category.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Thứ tự: {category.order} | {categorySubcategories.length} danh mục con
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAddSubcategory(category)}
                            title="Thêm danh mục con"
                            data-testid={`button-add-subcategory-${category.id}`}
                          >
                            <FolderTree className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditCategory(category)}
                            data-testid={`button-edit-${category.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${category.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      
                      <CollapsibleContent>
                        <div className="border-t bg-muted/30 p-3">
                          {getRootSubcategories(category.id).length > 0 ? (
                            <div className="space-y-1">
                              {getRootSubcategories(category.id).map((sub) => {
                                const childSubs = getChildSubcategories(sub.id, category.id);
                                const isSubExpanded = expandedSubcategories.has(sub.id);
                                return (
                                  <div key={sub.id} className="border rounded bg-background">
                                    <div className="flex items-center p-2 gap-2" data-testid={`row-subcategory-${sub.id}`}>
                                      {childSubs.length > 0 ? (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6"
                                          onClick={() => toggleSubcategoryExpand(sub.id)}
                                        >
                                          {isSubExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </Button>
                                      ) : (
                                        <div className="w-6" />
                                      )}
                                      <span className="font-medium flex-1" data-testid={`text-subcategory-name-${sub.id}`}>
                                        {sub.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">#{sub.order}</span>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => openAddChildSubcategory(category, sub)}
                                          title="Thêm nhánh con"
                                          data-testid={`button-add-child-${sub.id}`}
                                        >
                                          <Plus className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handleEditSubcategory(sub)}
                                          data-testid={`button-edit-subcategory-${sub.id}`}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handleDeleteSubcategory(sub.id, sub.name)}
                                          disabled={deleteSubcategoryMutation.isPending}
                                          data-testid={`button-delete-subcategory-${sub.id}`}
                                        >
                                          <Trash2 className="w-3 h-3 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                    {isSubExpanded && childSubs.length > 0 && (
                                      <div className="pl-6 pb-2 pr-2 space-y-1">
                                        {childSubs.map((childSub) => {
                                          const grandchildSubs = getChildSubcategories(childSub.id, category.id);
                                          const isChildExpanded = expandedSubcategories.has(childSub.id);
                                          return (
                                            <div key={childSub.id} className="border rounded bg-muted/50">
                                              <div className="flex items-center p-2 gap-2" data-testid={`row-subcategory-${childSub.id}`}>
                                                {grandchildSubs.length > 0 ? (
                                                  <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-5 w-5"
                                                    onClick={() => toggleSubcategoryExpand(childSub.id)}
                                                  >
                                                    {isChildExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                  </Button>
                                                ) : (
                                                  <div className="w-5" />
                                                )}
                                                <span className="text-sm flex-1" data-testid={`text-subcategory-name-${childSub.id}`}>
                                                  {childSub.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">#{childSub.order}</span>
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => openAddChildSubcategory(category, childSub)}
                                                    title="Thêm nhánh con"
                                                    data-testid={`button-add-child-${childSub.id}`}
                                                  >
                                                    <Plus className="w-3 h-3" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => handleEditSubcategory(childSub)}
                                                    data-testid={`button-edit-subcategory-${childSub.id}`}
                                                  >
                                                    <Pencil className="w-3 h-3" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => handleDeleteSubcategory(childSub.id, childSub.name)}
                                                    disabled={deleteSubcategoryMutation.isPending}
                                                    data-testid={`button-delete-subcategory-${childSub.id}`}
                                                  >
                                                    <Trash2 className="w-3 h-3 text-destructive" />
                                                  </Button>
                                                </div>
                                              </div>
                                              {isChildExpanded && grandchildSubs.length > 0 && (
                                                <div className="pl-5 pb-2 pr-2 space-y-1">
                                                  {grandchildSubs.map((grandchildSub) => (
                                                    <div key={grandchildSub.id} className="flex items-center p-1.5 gap-2 border rounded bg-background" data-testid={`row-subcategory-${grandchildSub.id}`}>
                                                      <div className="w-4" />
                                                      <span className="text-xs flex-1" data-testid={`text-subcategory-name-${grandchildSub.id}`}>
                                                        {grandchildSub.name}
                                                      </span>
                                                      <span className="text-xs text-muted-foreground">#{grandchildSub.order}</span>
                                                      <div className="flex items-center gap-1">
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-5 w-5"
                                                          onClick={() => handleEditSubcategory(grandchildSub)}
                                                          data-testid={`button-edit-subcategory-${grandchildSub.id}`}
                                                        >
                                                          <Pencil className="w-2.5 h-2.5" />
                                                        </Button>
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-5 w-5"
                                                          onClick={() => handleDeleteSubcategory(grandchildSub.id, grandchildSub.name)}
                                                          disabled={deleteSubcategoryMutation.isPending}
                                                          data-testid={`button-delete-subcategory-${grandchildSub.id}`}
                                                        >
                                                          <Trash2 className="w-2.5 h-2.5 text-destructive" />
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              Chưa có danh mục con. Nhấn nút <FolderTree className="w-4 h-4 inline mx-1" /> để thêm.
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Chưa có danh mục nào. Tạo danh mục đầu tiên!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

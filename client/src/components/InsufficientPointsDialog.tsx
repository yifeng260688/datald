import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Coins } from "lucide-react";

interface InsufficientPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredPoints: number;
  currentPoints: number;
}

export function InsufficientPointsDialog({
  open,
  onOpenChange,
  requiredPoints,
  currentPoints,
}: InsufficientPointsDialogProps) {
  const pointsNeeded = requiredPoints - currentPoints;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-insufficient-points">
        <DialogHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
            <Coins className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-xl text-center">
            Không đủ điểm quy đổi
          </DialogTitle>
          <DialogDescription className="text-center space-y-3 pt-2">
            <div className="flex justify-center gap-4 text-sm">
              <div className="bg-muted rounded-lg px-4 py-2">
                <span className="text-muted-foreground">Điểm hiện tại:</span>
                <span className="font-bold text-foreground ml-2" data-testid="text-current-points">
                  {currentPoints.toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-2">
                <span className="text-muted-foreground">Cần thêm:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 ml-2" data-testid="text-points-needed">
                  {pointsNeeded.toLocaleString('vi-VN')}
                </span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-5 mt-2">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                Upload Data khách hàng bạn có để quy đổi điểm
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-primary">10 Dòng data</span> có thể quy đổi thành <span className="font-semibold text-primary">1 điểm</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-dialog"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

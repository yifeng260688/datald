import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Tìm kiếm tài liệu..." }: SearchBarProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 pl-12 pr-12 text-base rounded-lg border-input focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="input-search"
        />
        {value && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
            data-testid="button-clear-search"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

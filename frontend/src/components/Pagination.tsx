import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-center gap-3 py-4 shrink-0">
            <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="gap-1 glass border-white/20 hover:border-blue-500/30"
            >
                <ChevronLeft className="h-4 w-4" /> 上一页
            </Button>
            <span className="text-sm text-muted-foreground">
                第 {page} / {totalPages} 页 · 共 {total} 条
            </span>
            <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="gap-1 glass border-white/20 hover:border-blue-500/30"
            >
                下一页 <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}

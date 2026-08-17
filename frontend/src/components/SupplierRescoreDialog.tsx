import { useState, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw } from "lucide-react";
import { rescoreSupplier, type Supplier } from "@/api/client";

interface SupplierRescoreDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplier: Supplier | null;
    onRescored: (msg: string) => void;
}

export function SupplierRescoreDialog({ open, onOpenChange, supplier, onRescored }: SupplierRescoreDialogProps) {
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDescription("");
            setError(null);
        }
    }, [open]);

    const handleRescore = async () => {
        if (!supplier) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const res = await rescoreSupplier(supplier.id, description.trim());
            onRescored(`✅ 供应商「${supplier.name}」重新评分：${res.ext_score} 分`);
            onOpenChange(false);
        } catch (e: any) {
            setError(e.message || "重新评分失败");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-white/20">
                <DialogHeader>
                    <DialogTitle>重新评分</DialogTitle>
                    <DialogDescription>
                        当前评分：{supplier?.ext_score} 分。填写资质描述，模型将据此重新打分。
                    </DialogDescription>
                </DialogHeader>

                <Textarea
                    placeholder="例如：有 ISO 9001 认证，成立 15 年，行业知名品牌"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="bg-white/50 dark:bg-black/30"
                />

                {error && <p className="text-sm text-red-500">{error}</p>}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handleRescore} disabled={isSubmitting} className="gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        重新评分
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

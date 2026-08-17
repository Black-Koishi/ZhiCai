import { useState, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { updateSupplier, type Supplier } from "@/api/client";

interface SupplierEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplier: Supplier | null;
    onSaved: (msg: string) => void;
}

export function SupplierEditDialog({ open, onOpenChange, supplier, onSaved }: SupplierEditDialogProps) {
    const [form, setForm] = useState({ name: "", email: "", phone: "", category: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (supplier) {
            setForm({
                name: supplier.name || "",
                email: supplier.email || "",
                phone: supplier.phone || "",
                category: supplier.category || "",
            });
            setError(null);
        }
    }, [supplier]);

    const handleSubmit = async () => {
        if (!supplier) return;
        if (!form.name.trim()) {
            setError("请填写供应商名称");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            await updateSupplier(supplier.id, {
                name: form.name.trim(),
                email: form.email.trim() || undefined,
                phone: form.phone.trim() || undefined,
                category: form.category.trim() || undefined,
            });
            onSaved(`✅ 供应商「${form.name.trim()}」已更新`);
            onOpenChange(false);
        } catch (e: any) {
            setError(e.message || "更新失败");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-white/20">
                <DialogHeader>
                    <DialogTitle>编辑供应商</DialogTitle>
                    <DialogDescription>评分不可直接修改，如需调整请使用「重评」</DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">名称 *</Label>
                        <Input className="col-span-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="供应商名称" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">邮箱</Label>
                        <Input className="col-span-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="sales@example.com" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">电话</Label>
                        <Input className="col-span-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="联系电话" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">主营品类</Label>
                        <Input className="col-span-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="如：金属材料" />
                    </div>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        保存
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

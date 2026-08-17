import { useState, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { onboardItem, createItem, fetchSuppliersPaginated, type Supplier } from "@/api/client";
import { cn } from "@/lib/utils";

interface ItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (msg: string) => void;
}

export function ItemDialog({ open, onOpenChange, onCreated }: ItemDialogProps) {
    const [mode, setMode] = useState<"nl" | "form">("nl");
    const [nlText, setNlText] = useState("");
    const [form, setForm] = useState({ name: "", sku: "", unit: "", unit_price: "", vendor_id: "" });
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            fetchSuppliersPaginated(1, 100)
                .then((d) => setSuppliers(d.suppliers))
                .catch(() => {});
        }
    }, [open]);

    const reset = () => {
        setNlText("");
        setForm({ name: "", sku: "", unit: "", unit_price: "", vendor_id: "" });
        setError(null);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            if (mode === "nl") {
                if (!nlText.trim()) throw new Error("请输入物料信息");
                const res = await onboardItem(nlText.trim());
                onCreated(`✅ 物料「${res.name}」已建档（SKU: ${res.sku || "未生成"}）`);
            } else {
                if (!form.name.trim()) throw new Error("请填写物料名称");
                const res = await createItem({
                    name: form.name.trim(),
                    sku: form.sku.trim() || undefined,
                    unit: form.unit.trim() || undefined,
                    unit_price: Number(form.unit_price) || 0,
                    vendor_id: form.vendor_id ? Number(form.vendor_id) : undefined,
                });
                onCreated(`✅ 物料「${res.name}」已新增`);
            }
            onOpenChange(false);
            reset();
        } catch (e: any) {
            setError(e.message || "提交失败");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
            <DialogContent className="sm:max-w-[520px] bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-white/20">
                <DialogHeader>
                    <DialogTitle>新增物料</DialogTitle>
                    <DialogDescription>支持自然语言建档或逐项填写</DialogDescription>
                </DialogHeader>

                <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-lg">
                    <button
                        onClick={() => setMode("nl")}
                        className={cn(
                            "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                            mode === "nl" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        自然语言建档
                    </button>
                    <button
                        onClick={() => setMode("form")}
                        className={cn(
                            "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                            mode === "form" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        逐项填写
                    </button>
                </div>

                {mode === "nl" ? (
                    <Textarea
                        placeholder="例如：新增物料：冷轧钢板 2mm，单价 45 元每张，默认供应商顶点工业供应"
                        value={nlText}
                        onChange={(e) => setNlText(e.target.value)}
                        rows={4}
                        className="bg-white/50 dark:bg-black/30"
                    />
                ) : (
                    <div className="grid gap-3">
                        <div className="grid grid-cols-4 items-center gap-3">
                            <Label className="text-right">名称 *</Label>
                            <Input className="col-span-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="物料名称" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-3">
                            <Label className="text-right">SKU</Label>
                            <Input className="col-span-3" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="如 RAW-STEEL-2MM" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-3">
                            <Label className="text-right">单位</Label>
                            <Input className="col-span-3" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="如 件/个/米/千克" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-3">
                            <Label className="text-right">单价</Label>
                            <Input className="col-span-3" type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} placeholder="0" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-3">
                            <Label className="text-right">默认供应商</Label>
                            <select
                                className="col-span-3 h-10 px-3 bg-white/50 dark:bg-black/30 border border-white/20 rounded-md text-sm"
                                value={form.vendor_id}
                                onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                            >
                                <option value="">— 未指定 —</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}

                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        提交
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

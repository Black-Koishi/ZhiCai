import { useState, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { updateItem, fetchSuppliersPaginated, type Supplier } from "@/api/client";
import { buildItemUpdatePayload } from "./itemEditForm";

interface ItemEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: any | null;
    onSaved: (msg: string) => void;
}

export function ItemEditDialog({ open, onOpenChange, item, onSaved }: ItemEditDialogProps) {
    const [form, setForm] = useState({ name: "", unit: "", unit_price: "", vendor_id: "", qty_on_hand: "", min_qty: "", max_capacity: "" });
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

    useEffect(() => {
        if (item) {
            setForm({
                name: item.name || "",
                unit: item.unit || "",
                unit_price: item.unit_price != null ? String(item.unit_price) : "",
                vendor_id: item.default_vendor_id != null ? String(item.default_vendor_id) : "",
                qty_on_hand: item.qty_on_hand != null ? String(item.qty_on_hand) : "",
                min_qty: item.min_qty != null ? String(item.min_qty) : "",
                max_capacity: item.max_capacity != null ? String(item.max_capacity) : "",
            });
            setError(null);
        }
    }, [item]);

    const handleSubmit = async () => {
        if (!item) return;
        setIsSubmitting(true);
        setError(null);
        try {
            await updateItem(item.id, buildItemUpdatePayload(form));
            onSaved(`✅ 物料「${form.name.trim()}」已更新`);
            onOpenChange(false);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "更新失败");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-white/20">
                <DialogHeader>
                    <DialogTitle>编辑物料</DialogTitle>
                    <DialogDescription>SKU 不可修改；库存字段留空时保持原值不变</DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">名称 *</Label>
                        <Input className="col-span-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="物料名称" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">SKU</Label>
                        <Input className="col-span-3" value={item?.sku || ""} disabled title="SKU 不可修改（订单回溯以 SKU 为准）" />
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
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">现有库存</Label>
                        <Input className="col-span-3" type="number" min="0" step="1" value={form.qty_on_hand} onChange={(e) => setForm({ ...form, qty_on_hand: e.target.value })} placeholder="留空则不修改" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">最小阈值</Label>
                        <Input className="col-span-3" type="number" min="0" step="1" value={form.min_qty} onChange={(e) => setForm({ ...form, min_qty: e.target.value })} placeholder="留空则不修改" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right">最大容量</Label>
                        <Input className="col-span-3" type="number" min="0" step="1" value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: e.target.value })} placeholder="留空则不修改；0 表示不限制" />
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

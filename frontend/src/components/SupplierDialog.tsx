import { useState } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { onboardSupplier, createSupplier } from "@/api/client";
import { cn } from "@/lib/utils";

interface SupplierDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (msg: string) => void;
}

export function SupplierDialog({ open, onOpenChange, onCreated }: SupplierDialogProps) {
    const [mode, setMode] = useState<"nl" | "form">("nl");
    const [nlText, setNlText] = useState("");
    const [form, setForm] = useState({ name: "", email: "", phone: "", category: "", description: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setNlText("");
        setForm({ name: "", email: "", phone: "", category: "", description: "" });
        setError(null);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            if (mode === "nl") {
                if (!nlText.trim()) throw new Error("请输入供应商信息");
                const res = await onboardSupplier(nlText.trim());
                onCreated(`✅ 供应商「${res.name}」已入驻（评分 ${res.ext_score} 分）`);
            } else {
                if (!form.name.trim()) throw new Error("请填写供应商名称");
                const res = await createSupplier({
                    name: form.name.trim(),
                    email: form.email.trim() || undefined,
                    phone: form.phone.trim() || undefined,
                    category: form.category.trim() || undefined,
                    description: form.description.trim() || undefined,
                });
                onCreated(`✅ 供应商「${res.name}」已新增（评分 ${res.ext_score ?? 60} 分）`);
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
                    <DialogTitle>新增供应商</DialogTitle>
                    <DialogDescription>支持自然语言录入或逐项填写</DialogDescription>
                </DialogHeader>

                {/* 模式切换 */}
                <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-lg">
                    <button
                        onClick={() => setMode("nl")}
                        className={cn(
                            "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                            mode === "nl" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        自然语言录入
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
                        placeholder="例如：新增供应商：恒达轴承，主营机械传动件，邮箱 hd@bearing.com，电话 555-8888，成立 20 年，有 ISO 认证"
                        value={nlText}
                        onChange={(e) => setNlText(e.target.value)}
                        rows={4}
                        className="bg-white/50 dark:bg-black/30"
                    />
                ) : (
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
                        <div className="grid grid-cols-4 items-start gap-3">
                            <Label className="text-right pt-2">描述/资质</Label>
                            <Textarea
                                className="col-span-3"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="例如：有 ISO 9001 认证，成立 15 年，行业知名品牌（模型将据此自动评分）"
                                rows={3}
                            />
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

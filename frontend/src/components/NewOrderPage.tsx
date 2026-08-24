import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, Download, PackageOpen, ShoppingCart, Search, ShieldCheck, Send } from "lucide-react";
import { API_BASE_URL } from "@/api/client";

export function NewOrderPage() {
    // DB Data States
    const [catalogItems, setCatalogItems] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Form States
    const [searchTerm, setSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [matchedVendor, setMatchedVendor] = useState<any>(null);

    const [quantity, setQuantity] = useState<number>(1);

    // Set default expected date to 7 days from now
    const [expectedDate, setExpectedDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split('T')[0];
    });

    const [summary, setSummary] = useState<string>("");

    // Submission States
    const [isChecking, setIsChecking] = useState(false);
    const [complianceResult, setComplianceResult] = useState<{
        passed: boolean;
        explanation: string;
        computed_priority: string;
        context: any;
    } | null>(null);

    const [isOrdering, setIsOrdering] = useState(false);
    const [orderResult, setOrderResult] = useState<{
        orderId: number;
        pdfPath: string;
    } | null>(null);

    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ sent: boolean; message: string } | null>(null);

    // Fetch catalog data on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [itemsRes, vendorsRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/database/tables/items`),
                    fetch(`${API_BASE_URL}/database/tables/vendors`)
                ]);
                const itemsData = await itemsRes.json();
                const vendorsData = await vendorsRes.json();

                setCatalogItems(itemsData.data || []);
                setVendors(vendorsData.data || []);
            } catch (err) {
                console.error("Failed to fetch catalog:", err);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, []);

    // Autocomplete Logic
    const filteredItems = catalogItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5);

    const handleSelectItem = (item: any) => {
        setSelectedItem(item);
        setSearchTerm(item.name);
        setIsDropdownOpen(false);
        setComplianceResult(null);
        setOrderResult(null);
        setSendResult(null);

        // Find matching vendor
        if (item.default_vendor_id) {
            const v = vendors.find(v => v.id === item.default_vendor_id);
            setMatchedVendor(v || null);
        } else {
            setMatchedVendor(null);
        }
    };

    const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        setSelectedItem(null);
        setMatchedVendor(null);
        setIsDropdownOpen(val.length > 0);
        setComplianceResult(null);
        setOrderResult(null);
        setSendResult(null);
    };

    const handleCheckCompliance = async () => {
        if (!selectedItem) return;

        setIsChecking(true);
        setComplianceResult(null);
        setOrderResult(null);

        try {
            const res = await fetch(`${API_BASE_URL}/procurement/manual/compliance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_name: selectedItem.name,
                    quantity,
                    expected_date: expectedDate,
                    summary
                })
            });
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.detail || "合规检查失败。");
            }

            setComplianceResult({
                passed: json.passed,
                explanation: json.explanation,
                computed_priority: json.computed_priority,
                context: json.fake_analysis_context
            });

        } catch (err: any) {
            setComplianceResult({
                passed: false,
                explanation: err.message,
                computed_priority: "Normal",
                context: null
            });
        } finally {
            setIsChecking(false);
        }
    };

    const handleCreateOrder = async () => {
        if (!complianceResult || !complianceResult.passed) return;

        setIsOrdering(true);

        try {
            const res = await fetch(`${API_BASE_URL}/procurement/manual/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: complianceResult.context })
            });
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.detail || "创建订单失败。");
            }

            setOrderResult({
                orderId: json.order_id,
                pdfPath: json.pdf_path
            });

        } catch (err: any) {
            alert(`创建订单出错：${err.message}`);
        } finally {
            setIsOrdering(false);
        }
    };

    const handleSendOrder = async () => {
        if (!orderResult) return;
        setIsSending(true);
        try {
            const res = await fetch(`${API_BASE_URL}/orders/${orderResult.orderId}/send`, { method: 'POST' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || "发送失败。");
            setSendResult({ sent: true, message: json.message });
        } catch (err: any) {
            alert(`发送出错：${err.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const handleReset = () => {
        setSelectedItem(null);
        setSearchTerm("");
        setMatchedVendor(null);
        setQuantity(1);
        setSummary("");
        setComplianceResult(null);
        setOrderResult(null);
        setSendResult(null);
    };

    const totalCost = selectedItem ? selectedItem.unit_price * quantity : 0;

    if (isLoadingData) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center pt-12 pb-20 overflow-y-auto px-4">
            <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header Phase */}
                <div className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                        <ShoppingCart className="w-6 h-6 text-blue-500" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        新建订单
                    </h1>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                        搜索物料目录。
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                    {/* LEFT COLUMN: Input form mapping string to logic */}
                    <div className="md:col-span-7 space-y-6">

                        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 dark:bg-black/20 backdrop-blur-xl shadow-xl space-y-5">

                            {/* ITEM AUTOFILL COMBOBOX */}
                            <div className="space-y-2 relative">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase opacity-80 tracking-wider">物品查找（智能填充）</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="输入物品名称或 SKU 搜索数据库..."
                                        value={searchTerm}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        onFocus={() => { if (searchTerm) setIsDropdownOpen(true); }}
                                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                        className="pl-9 h-12 bg-white/5 border-white/20"
                                        disabled={isChecking || isOrdering || !!orderResult}
                                    />
                                    {isDropdownOpen && filteredItems.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-background/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            {filteredItems.map(item => (
                                                <div
                                                    key={item.id}
                                                    className="px-4 py-3 hover:bg-blue-500/10 cursor-pointer flex justify-between items-center transition-colors"
                                                    onMouseDown={() => handleSelectItem(item)}
                                                >
                                                    <div>
                                                        <p className="font-medium">{item.name}</p>
                                                        {item.sku && <p className="text-xs text-muted-foreground">SKU：{item.sku}</p>}
                                                    </div>
                                                    <span className="text-sm font-mono text-blue-400">${item.unit_price}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* QUANTITY */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase opacity-80">数量</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={quantity}
                                        onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                                        className="h-10 bg-white/5 border-white/20"
                                        disabled={isChecking || isOrdering || !!orderResult}
                                    />
                                </div>

                                {/* EXPECTED DATE */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase opacity-80">预计日期</Label>
                                    <Input
                                        type="date"
                                        value={expectedDate}
                                        onChange={(e) => setExpectedDate(e.target.value)}
                                        className="h-10 w-full bg-white/5 border-white/20 dark:[color-scheme:dark]"
                                        disabled={isChecking || isOrdering || !!orderResult}
                                    />
                                </div>
                            </div>

                            {/* SUMMARY */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase opacity-80">需求说明 / 理由</Label>
                                <Textarea
                                    placeholder="简要说明为何需要该物品..."
                                    value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                    className="min-h-[80px] bg-white/5 border-white/20 resize-none placeholder:text-muted-foreground/50"
                                    disabled={isChecking || isOrdering || !!orderResult}
                                />
                            </div>

                        </div>
                    </div>

                    {/* RIGHT COLUMN: Context & Two-Step Workflow */}
                    <div className="md:col-span-5 flex flex-col gap-6">

                        <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <div className="space-y-5 relative z-10">
                                <div>
                                    <h3 className="text-sm font-semibold uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
                                        <PackageOpen className="w-4 h-4" /> 系统上下文
                                    </h3>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase opacity-80 mb-0.5">已批准供应商</p>
                                        <p className="font-medium text-foreground">{matchedVendor?.name || <span className="text-muted-foreground italic">等待选择物品...</span>}</p>
                                        {matchedVendor && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{matchedVendor.email} • {matchedVendor.phone}</p>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase opacity-80 mb-0.5">计算优先级</p>
                                        <p className="font-medium text-foreground">
                                            {complianceResult ? complianceResult.computed_priority : <span className="text-muted-foreground italic">等待合规检查...</span>}
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t border-blue-500/20">
                                        <p className="text-xs text-muted-foreground uppercase opacity-80 mb-1">实时计算价格</p>
                                        <p className="font-mono text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent transition-all">
                                            ${totalCost.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* WORKFLOW BUTTONS ON THE RIGHT */}
                        <div className="flex-1 flex flex-col gap-4 justify-end pb-2">
                            {/* Step 1: 检查合规 */}
                            {!complianceResult?.passed && (
                                <Button
                                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98]"
                                    onClick={handleCheckCompliance}
                                    disabled={!selectedItem || isChecking}
                                >
                                    {isChecking ? (
                                        <><Loader2 className="w-5 h-5 animate-spin mr-3" /> 正在运行合规检查...</>
                                    ) : (
                                        <><ShieldCheck className="w-5 h-5 mr-3" /> 1. 检查合规</>
                                    )}
                                </Button>
                            )}

                            {/* Step 2: 创建订单 PDF */}
                            {complianceResult?.passed && !orderResult && (
                                <Button
                                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98]"
                                    onClick={handleCreateOrder}
                                    disabled={isOrdering}
                                >
                                    {isOrdering ? (
                                        <><Loader2 className="w-5 h-5 animate-spin mr-3" /> 正在生成 PDF...</>
                                    ) : (
                                        <><PackageOpen className="w-5 h-5 mr-3" /> 2. 创建订单 PDF</>
                                    )}
                                </Button>
                            )}

                            {/* Step 3: 发送邮件 */}
                            {orderResult && !sendResult && (
                                <Button
                                    className="w-full h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98]"
                                    onClick={handleSendOrder}
                                    disabled={isSending}
                                >
                                    {isSending ? (
                                        <><Loader2 className="w-5 h-5 animate-spin mr-3" /> 正在发送邮件...</>
                                    ) : (
                                        <><Send className="w-5 h-5 mr-3" /> 3. 发送邮件给供应商</>
                                    )}
                                </Button>
                            )}

                            {/* 发送完成 */}
                            {sendResult && (
                                <Button
                                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-500 text-white shadow-xl shadow-green-600/20 transition-all active:scale-[0.98]"
                                    onClick={handleReset}
                                >
                                    <CheckCircle2 className="w-5 h-5 mr-3" /> 发送完成，继续新建
                                </Button>
                            )}
                        </div>

                    </div>
                </div>

                {/* RESULTS VIEW */}
                {(complianceResult || orderResult) && (
                    <div className="space-y-4 pt-4 border-t border-white/10 mt-4">
                        {/* Compliance Warning / Error view if failed or just informational if passed */}
                        {complianceResult && !complianceResult.passed && (
                            <div className="p-5 rounded-2xl border bg-red-500/10 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)] flex items-start gap-4 animate-in slide-in-from-bottom-2">
                                <XCircle className="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-lg font-bold text-red-500">合规检查未通过</p>
                                    <p className="text-sm opacity-90 mt-1 whitespace-pre-wrap">{complianceResult.explanation}</p>
                                </div>
                            </div>
                        )}

                        {/* Compliance Passed Status before Order generation */}
                        {complianceResult && complianceResult.passed && !orderResult && (
                            <div className="p-5 rounded-2xl border bg-green-500/10 border-green-500/30 flex items-start gap-4 animate-in slide-in-from-bottom-2">
                                <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-lg font-bold text-green-500">合规检查已通过</p>
                                    <p className="text-sm opacity-90 mt-1 whitespace-pre-wrap">{complianceResult.explanation}</p>
                                    <p className="text-xs text-muted-foreground mt-2">使用右侧按钮生成采购订单 PDF。</p>
                                </div>
                            </div>
                        )}

                        {/* 订单已创建，等待发送 */}
                        {orderResult && !sendResult && (
                            <div className="p-5 rounded-2xl border bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)] flex flex-col sm:flex-row gap-4 items-start sm:items-center animate-in slide-in-from-bottom-2">
                                <div className="flex items-start gap-4 flex-1">
                                    <PackageOpen className="w-8 h-8 text-blue-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-lg font-bold text-blue-500">
                                            订单 #{orderResult.orderId} 已创建，PDF 已生成
                                        </p>
                                        <p className="text-sm opacity-90 mt-1">点击右侧「发送邮件」将 PDF 发送给供应商。</p>
                                    </div>
                                </div>

                                {orderResult.pdfPath && (
                                    <a href={`${API_BASE_URL}${orderResult.pdfPath}`} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto mt-2 sm:mt-0 shrink-0">
                                        <Button className="w-full sm:w-auto h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white gap-2 font-semibold border-none">
                                            <Download className="w-5 h-5" /> 下载 PDF
                                        </Button>
                                    </a>
                                )}
                            </div>
                        )}

                        {/* 发送完成 */}
                        {sendResult && (
                            <div className="p-5 rounded-2xl border bg-green-500/10 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)] flex items-start gap-4 animate-in slide-in-from-bottom-2">
                                <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-lg font-bold text-green-500">
                                        订单 #{orderResult?.orderId} 已发送
                                    </p>
                                    <p className="text-sm opacity-90 mt-1">{sendResult.message}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

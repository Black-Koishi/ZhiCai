import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Download, CheckCircle2, XCircle, AlertCircle, ShoppingCart, Send } from "lucide-react";
import { API_BASE_URL } from "@/api/client";

interface ChatProcurementWidgetProps {
    params: {
        mode: 'manual' | 'email';
        item_name?: string;
        email_id?: string;
    }
}

export function ChatProcurementWidget({ params }: ChatProcurementWidgetProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [quantity, setQuantity] = useState<number>(1);

    // Status
    const [complianceStatus, setComplianceStatus] = useState<string>("Pending");
    const [complianceExplanation, setComplianceExplanation] = useState<string>("");
    const [review, setReview] = useState<{ risk_level: string; risk_points: string[]; suggestions: string[] } | null>(null);
    const [orderId, setOrderId] = useState<number | null>(null);
    const [pdfPath, setPdfPath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);
    const [isGeneratingOrder, setIsGeneratingOrder] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const [cancelReason, setCancelReason] = useState("");
    const [isCancelled, setIsCancelled] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (params.mode === 'manual' && params.item_name) {
                    const res = await fetch(`${API_BASE_URL}/items/lookup?name=${encodeURIComponent(params.item_name)}`);
                    if (!res.ok) throw new Error("未找到物品。请核对准确名称。");
                    const json = await res.json();

                    setData({
                        item_name: json.item.name,
                        item_id: json.item.id,
                        vendor_name: json.vendor?.name || '未知',
                        item_unit_price: json.item.unit_price,
                        total_cost: json.item.unit_price * quantity
                    });
                } else if (params.mode === 'email' && params.email_id) {
                    const res = await fetch(`${API_BASE_URL}/emails/${params.email_id}/analysis`);
                    if (!res.ok) throw new Error("未找到邮件分析");
                    const json = await res.json();
                    if (json.status === "success" && json.data) {
                        setData(json.data);
                        setQuantity(json.data.item_quantity || 1);
                        setComplianceExplanation(json.data.compliance_explanation || "");
                        setPdfPath(json.data.pdf_path || null);

                        // 恢复进度，避免切换后重置导致重复合规/重复下单/重复发送
                        const orderId = json.data.order_id || null;
                        setOrderId(orderId);
                        const orderStatus = json.data.order_status;
                        setIsSent(orderStatus === "sent" || orderStatus === "received");
                        if (orderId) {
                            setComplianceStatus("Passed");
                        } else {
                            const ast = json.data.analysis_status;
                            if (ast === "failed_compliance") {
                                setComplianceStatus("Failed");
                            } else if (ast === "processed" || ast === "pending_review") {
                                setComplianceStatus("Passed");
                            } else {
                                setComplianceStatus("Pending");
                            }
                        }
                    }
                } else {
                    throw new Error("采购参数无效。");
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params]);

    // Update total cost when quantity changes for manual mode
    useEffect(() => {
        if (params.mode === 'manual' && data && !orderId) {
            setData((prev: any) => ({
                ...prev,
                total_cost: prev.item_unit_price * quantity
            }));
        }
    }, [quantity, params.mode]);

    const handleRunCompliance = async () => {
        if (params.mode === 'email' && params.email_id) {
            setIsCheckingCompliance(true);
            try {
                const res = await fetch(`${API_BASE_URL}/procurement/${params.email_id}/compliance`, { method: "POST" });
                const json = await res.json();
                setComplianceStatus(json.passed ? "Passed" : "Failed");
                setComplianceExplanation(json.explanation || "");
                setReview(json.review || null);
                window.dispatchEvent(new Event("email-refresh"));
            } catch (err: any) {
                alert(`失败：${err.message}`);
            } finally {
                setIsCheckingCompliance(false);
            }
        }
    };

    const handleCancelRequest = async () => {
        if (!params.email_id) return;
        if (!cancelReason.trim()) {
            alert("请填写未通过原因");
            return;
        }
        setIsCancelling(true);
        try {
            const res = await fetch(`${API_BASE_URL}/procurement/${params.email_id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: cancelReason.trim() }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || "取消失败");
            setIsCancelled(true);
            window.dispatchEvent(new Event("email-refresh"));
        } catch (err: any) {
            alert(`取消失败：${err.message}`);
        } finally {
            setIsCancelling(false);
        }
    };

    const handleGenerateOrder = async () => {
        setIsGeneratingOrder(true);
        setError(null);
        try {
            if (params.mode === 'manual') {
                const res = await fetch(`${API_BASE_URL}/orders/manual`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item_name: data.item_name, quantity })
                });
                const json = await res.json();
                if (!res.ok) {
                    if (res.status === 400 && json.detail.startsWith("合规检查未通过：")) {
                        setComplianceStatus("Failed");
                        setComplianceExplanation(json.detail.replace("合规检查未通过：", ""));
                        return;
                    }
                    throw new Error(json.detail || "生成订单失败");
                }
                setOrderId(json.order_id);
                setPdfPath(json.pdf_path);
                setComplianceStatus("Passed");
                setComplianceExplanation("已通过手动订单限额自动批准。");
            } else if (params.mode === 'email' && params.email_id) {
                const res = await fetch(`${API_BASE_URL}/procurement/${params.email_id}/order`, { method: "POST" });
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(json.detail || "生成订单失败");
                }
                if (json.status === "success" || json.order_id) {
                    setOrderId(json.order_id);
                    setPdfPath(json.pdf_path);
                    window.dispatchEvent(new Event("email-refresh"));
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGeneratingOrder(false);
        }
    };

    const handleSendOrder = async () => {
        if (!orderId) return;
        setIsSending(true);
        try {
            const res = await fetch(`${API_BASE_URL}/orders/${orderId}/send`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || "发送失败");
            setIsSent(true);
        } catch (err: any) {
            alert(`发送失败：${err.message}`);
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5 animate-pulse flex items-center justify-center gap-3 w-full max-w-sm">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                <span className="text-sm">正在加载采购数据...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-red-500/10 flex items-center gap-3 w-full max-w-sm text-red-500/90 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{error}</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="mt-4 w-full max-w-md rounded-2xl border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-md overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="px-5 py-3 border-b border-white/10 bg-blue-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="font-semibold text-sm">采购订单</span>
                </div>
                {orderId && (
                    <span className="text-xs font-mono bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded border border-green-500/30">
                        #{orderId}
                    </span>
                )}
            </div>

            <div className="p-5 space-y-4 text-sm">
                {/* Product Details */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase">物品</span>
                        <span className="font-medium truncate max-w-[200px]">{data.item_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase">供应商</span>
                        <span className="font-medium text-right text-gray-700 dark:text-gray-300">{data.vendor_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase">单价</span>
                        <span className="font-mono">${data.item_unit_price?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase">数量</span>
                        {!orderId && params.mode === 'manual' ? (
                            <Input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-20 h-7 text-right bg-white/5 border-white/20"
                                min={1}
                            />
                        ) : (
                            <span className="font-medium">{quantity}</span>
                        )}
                    </div>
                </div>

                <div className="h-px bg-white/10 w-full" />

                <div className="flex justify-between items-center">
                    <span className="font-semibold">总成本</span>
                    <span className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">
                        ${data.total_cost?.toFixed(2) || (data.item_unit_price * quantity).toFixed(2)}
                    </span>
                </div>

                {/* Compliance Status Block */}
                {complianceStatus !== 'Pending' && (
                    <div className={`p-3 rounded-xl border flex gap-3 ${complianceStatus === 'Passed'
                        ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                        {complianceStatus === 'Passed' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                        <div className="flex-1 text-xs">
                            <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold">合规检查 {complianceStatus === 'Passed' ? '通过' : '未通过'}</p>
                                {review && (
                                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${review.risk_level === '高'
                                        ? 'bg-red-500/15 text-red-500 border-red-500/30'
                                        : review.risk_level === '中'
                                            ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                                            : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                        }`}>{review.risk_level}风险</span>
                                )}
                            </div>
                            {review && review.risk_points.length > 0 && (
                                <div className="mt-2">
                                    <p className="font-medium mb-1 opacity-80">主要风险点</p>
                                    <ul className="space-y-1">
                                        {review.risk_points.map((p, i) => (
                                            <li key={i} className="flex gap-1.5"><span className="opacity-40">•</span><span className="opacity-90">{p}</span></li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {review && review.suggestions.length > 0 && (
                                <div className="mt-2">
                                    <p className="font-medium mb-1 opacity-80">建议动作</p>
                                    <ul className="space-y-1">
                                        {review.suggestions.map((s, i) => (
                                            <li key={i} className="flex gap-1.5"><span className="opacity-40">→</span><span className="opacity-90">{s}</span></li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {!review && complianceExplanation && (
                                <p className="opacity-80 leading-relaxed mt-1">{complianceExplanation}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="pt-2">
                    {orderId ? (
                        <div className="flex flex-col gap-2">
                            {isSent ? (
                                <Button variant="default" className="w-full bg-green-600 hover:bg-green-500 text-white gap-2 pointer-events-none">
                                    <Send className="w-4 h-4" /> 订单已发送给供应商
                                </Button>
                            ) : (
                                <>
                                    <Button variant="default" className="w-full bg-green-600 hover:bg-green-500 text-white gap-2 pointer-events-none">
                                        <CheckCircle2 className="w-4 h-4" /> 订单已创建
                                    </Button>
                                    <Button
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                                        onClick={handleSendOrder}
                                        disabled={isSending}
                                    >
                                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        发送订单给供应商
                                    </Button>
                                </>
                            )}
                            {pdfPath && (
                                <a
                                    href={`${API_BASE_URL}${pdfPath.startsWith('/') ? '' : '/'}${pdfPath}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full"
                                >
                                    <Button variant="outline" className="w-full gap-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10">
                                        <Download className="w-4 h-4" /> 下载采购订单
                                    </Button>
                                </a>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                {!isCancelled && params.mode === 'email' && complianceStatus !== 'Passed' && complianceStatus !== 'Failed' && (
                                    <Button
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                                        onClick={handleRunCompliance}
                                        disabled={isCheckingCompliance}
                                    >
                                        {isCheckingCompliance ? <Loader2 className="w-4 h-4 animate-spin" /> : "运行合规检查"}
                                    </Button>
                                )}
                                {!isCancelled && (!params.mode || params.mode === 'manual' || complianceStatus === 'Passed') && complianceStatus !== 'Failed' && (
                                    <Button
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white"
                                        onClick={handleGenerateOrder}
                                        disabled={isGeneratingOrder}
                                    >
                                        {isGeneratingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : "提交订单"}
                                    </Button>
                                )}
                            </div>
                            {(complianceStatus === 'Passed' || complianceStatus === 'Failed') && !isCancelled && (
                                <div className="space-y-2 mt-2">
                                    <p className="text-xs font-medium text-muted-foreground">人工审核 · 标记未通过</p>
                                    <textarea
                                        className="w-full h-20 px-3 py-2 rounded-md bg-white/50 dark:bg-black/30 border border-white/20 text-sm resize-none"
                                        placeholder="填写未通过原因（将发送给发件人）..."
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                    />
                                    <Button
                                        className="w-full bg-red-600 hover:bg-red-500 text-white gap-2"
                                        onClick={handleCancelRequest}
                                        disabled={isCancelling}
                                    >
                                        {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                        标记未通过并通知
                                    </Button>
                                </div>
                            )}
                            {isCancelled && (
                                <div className="p-3 rounded-xl border bg-gray-500/10 border-gray-500/20 text-gray-500 text-xs flex items-center gap-2 mt-2">
                                    <XCircle className="w-4 h-4" /> 该采购需求未通过
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

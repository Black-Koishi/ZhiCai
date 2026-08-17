import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Search,
    RotateCw,
    Mail,
    ArrowLeft,
    RefreshCw,
    Wand2,
    Loader2,
    ArrowUpDown,
    Filter,
    AlertTriangle,
    Paperclip,
    FileText,
    Download,
    ShoppingCart,
    EyeOff,
    ShieldCheck,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { fetchEmails, syncEmails, EmailItem, analyzeEmail, analyzeAllEmails, getEmailAnalysis, ignoreEmail, API_BASE_URL } from "@/api/client";
import { Message } from "@/components/ChatInterface";

function formatEmailDate(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const now = new Date();
    const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86400000);

    const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

    if (diffDays === 0) return `今天 ${time}`;
    if (diffDays === 1) return `昨天 ${time}`;
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} 天前`;

    const sameYear = d.getFullYear() === now.getFullYear();
    const datePart = sameYear
        ? d.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
        : d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    return `${datePart} ${time}`;
}

function EmailTag({ status, priority, error }: { status?: string; priority?: string; error?: string }) {
    const base = "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ";

    if (status === "ignored") {
        return <span className={base + "bg-gray-500/10 text-gray-400 dark:text-gray-500 border-gray-500/20 line-through"}>已忽略</span>;
    }
    if (status === "failed") {
        return <span className={base + "bg-rose-500/15 text-rose-500 border-rose-500/30"} title={error || undefined}>分析失败</span>;
    }
    if (status === "processed") {
        return <span className={base + "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"}>已处理</span>;
    }
    if (status === "failed_compliance") {
        return <span className={base + "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30"}>未通过</span>;
    }
    if (status === "pending_review") {
        return <span className={base + "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"}>待审核</span>;
    }
    if (status === "analyzed") {
        const pMap: Record<string, { label: string; className: string }> = {
            High:   { label: "高优先", className: base + "bg-red-500/15 text-red-500 border-red-500/30" },
            Medium: { label: "中优先", className: base + "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
            Low:    { label: "低优先", className: base + "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" },
        };
        const cfg = pMap[priority || ""] || pMap.Medium;
        return <span className={cfg.className}>{cfg.label}</span>;
    }
    // 未分析
    return <span className={base + "bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/30"}>未分析</span>;
}

// 把邮件映射到一个用于筛选的规范状态
function getEmailStatus(email: EmailItem): string {
    const s = email.analysis_status;
    if (s === "ignored") return "ignored";
    if (s === "failed") return "failed";
    if (s === "processed") return "processed";
    if (s === "failed_compliance") return "failed_compliance";
    if (s === "pending_review") return "pending_review";
    if (s === "analyzed") {
        const p = email.priority || "Medium";
        if (p === "High") return "high";
        if (p === "Low") return "low";
        return "medium";
    }
    return "unanalyzed";
}

// 状态筛选值 → 中文标签
const STATUS_LABELS: Record<string, string> = {
    unanalyzed: "未分析",
    high: "高优先",
    medium: "中优先",
    low: "低优先",
    failed: "分析失败",
    pending_review: "待审核",
    processed: "已处理",
    failed_compliance: "未通过",
    ignored: "已忽略",
};

interface EmailPageProps {
    folder: string;
    setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    statusFilter: string;
    setStatusFilter: (val: string) => void;
    sortOrder: "newest" | "oldest";
    setSortOrder: (val: "newest" | "oldest") => void;
    syncVersion?: number;
}

export function EmailPage({
    folder,
    setMessages,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
    syncVersion
}: EmailPageProps) {
    const [emails, setEmails] = useState<EmailItem[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Analysis State
    const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
    const [analyzingEmailId, setAnalyzingEmailId] = useState<string | null>(null);
    const [analysisData, setAnalysisData] = useState<any | null>(null);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

    // Ignore dialog state
    const [ignoreTarget, setIgnoreTarget] = useState<EmailItem | null>(null);
    const [ignoreReason, setIgnoreReason] = useState("");
    const [isIgnoring, setIsIgnoring] = useState(false);

    // Procurement State (Migrated to Chat Widget)
    // The procurement flow is now handled directly within the ChatInterface 
    // using the ChatProcurementWidget.

    const openProcurementFor = (emailId: string) => {
        if (!setMessages) return;

        // Simulate a message from the Orchestrator with the procurement widget
        const newMsg: Message = {
            role: "assistant",
            content: `我可以帮你处理邮件 ${emailId} 的采购订单。请查看下方详情以继续。`,
            ui_actions: [
                {
                    action_type: "open_inline_procurement",
                    params: {
                        mode: "email",
                        email_id: emailId
                    }
                }
            ]
        };

        setMessages(prev => [...prev, newMsg]);
    };

    const handleStartProcurement = () => {
        if (!selectedEmail) return;
        openProcurementFor(selectedEmail.id);
    };

    // Fetch Emails
    const loadEmails = async (deselect = true) => {
        setIsLoading(true);
        try {
            const data = await fetchEmails(folder);
            setEmails(data);
            if (deselect) setSelectedEmail(null); // Deselect on folder change
        } catch (error) {
            console.error("Failed to load emails", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await syncEmails(folder);
            await loadEmails();
        } catch (error) {
            alert("邮件同步失败");
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        loadEmails(true);
    }, [folder]);

    // 收到新邮件时自动刷新列表（不取消当前选中，避免打断阅读）
    useEffect(() => {
        if (syncVersion) loadEmails(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncVersion]);

    // 邮件状态被其他组件（如采购组件）改变后，立即刷新列表
    useEffect(() => {
        const handler = () => loadEmails(false);
        window.addEventListener("email-refresh", handler);
        return () => window.removeEventListener("email-refresh", handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folder]);

    // Handle Analysis
    useEffect(() => {
        if (selectedEmail) {
            const fetchAnalysis = async () => {
                setIsLoadingAnalysis(true);
                setAnalysisData(null);
                try {
                    const res = await getEmailAnalysis(selectedEmail.id);
                    if (res.status === "success") {
                        setAnalysisData(res.data);
                    }
                } catch (e) {
                    console.error("Failed to fetch analysis", e);
                } finally {
                    setIsLoadingAnalysis(false);
                }
            };
            fetchAnalysis();
        } else {
            setAnalysisData(null);
        }
    }, [selectedEmail]);

    const handleAnalyzeEmail = async (emailId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening email detail
        setAnalyzingEmailId(emailId);
        // 立即在 Agent 中提示「开始分析」
        if (setMessages) {
            setMessages(prev => [...prev, { role: "assistant", content: `🔍 邮件智能体：正在分析邮件 ${emailId}...` }]);
        }
        try {
            const res = await analyzeEmail(emailId);
            await loadEmails(false); // 分析成功后自动刷新（不打断选中）

            if (setMessages && res.step) {
                const newMsg: Message = {
                    role: "assistant",
                    content: `✅ 邮件 ${emailId} 分析完成。`,
                    steps: ["邮件智能体：正在分析收件箱...", res.step, "邮件智能体：已处理 1 封邮件。"]
                };
                setMessages(prev => [...prev, newMsg]);
            }
        } catch (error: any) {
            await loadEmails(false); // 失败也刷新，让「分析失败」状态显示出来
            if (setMessages) {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: `❌ 邮件分析失败：${error?.message || "未知错误"}`,
                }]);
            }
        } finally {
            setAnalyzingEmailId(null);
        }
    };

    const handleReview = (email: EmailItem, e: React.MouseEvent) => {
        e.stopPropagation();
        // 与详情页「开始采购」同一逻辑：打开内联采购组件（合规 → 下单 → 发邮件）
        openProcurementFor(email.id);
    };

    const handleIgnore = (email: EmailItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setIgnoreTarget(email);
        setIgnoreReason("");
    };

    const confirmIgnore = async () => {
        if (!ignoreTarget) return;
        setIsIgnoring(true);
        try {
            await ignoreEmail(ignoreTarget.id, ignoreReason.trim());
            await loadEmails(false);
            if (setMessages) {
                setMessages(prev => [...prev, { role: "assistant", content: `已忽略邮件「${ignoreTarget.id}」。` }]);
            }
            setIgnoreTarget(null);
        } catch (error) {
            alert("忽略失败");
        } finally {
            setIsIgnoring(false);
        }
    };

    const handleAnalyzeAll = async () => {
        setIsAnalyzingAll(true);
        // 立即在 Agent 中提示「开始批量分析」
        if (setMessages) {
            setMessages(prev => [...prev, { role: "assistant", content: `🔍 邮件智能体：正在批量分析所有未分析邮件...` }]);
        }
        try {
            const res = await analyzeAllEmails();
            await loadEmails(false); // refresh list

            if (setMessages) {
                const results = res.results || [];
                const successCount = results.filter((r: any) => r.status === "success").length;
                const failCount = results.filter((r: any) => r.status === "error").length;
                const steps = ["邮件智能体：正在分析收件箱..."];
                results.forEach((r: any) => {
                    if (r.status === "success") {
                        steps.push(r.step || `✅ 已分析邮件 ${r.email_id}`);
                    } else {
                        steps.push(`❌ 邮件 ${r.email_id}：${r.message || "分析失败"}`);
                    }
                });
                steps.push(`邮件智能体：分析完成 — 成功 ${successCount} 封，失败 ${failCount} 封。`);

                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: results.length === 0
                        ? "📊 没有需要分析的邮件。"
                        : `📊 全部分析完成：共 ${results.length} 封，成功 ${successCount} 封，失败 ${failCount} 封。`,
                    steps,
                }]);
            }
        } catch (error: any) {
            if (setMessages) {
                setMessages(prev => [...prev, { role: "assistant", content: `❌ 批量分析邮件失败：${error?.message || "未知错误"}` }]);
            }
        } finally {
            setIsAnalyzingAll(false);
        }
    };

    const filteredEmails = emails
        .filter(email => {
            // Search Query
            const matchesSearch =
                email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
                email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                email.body.toLowerCase().includes(searchQuery.toLowerCase());

            // Status Filter
            if (statusFilter === "all") return matchesSearch;
            return matchesSearch && getEmailStatus(email) === statusFilter;
        })
        .sort((a, b) => {
            // Date Sorting
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();

            if (sortOrder === "newest") {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });

    // ----------------------------------------------------------------------
    // View: Email Detail
    // ----------------------------------------------------------------------
    if (selectedEmail) {
        return (
            <div className="h-full flex flex-col bg-white/30 dark:bg-black/20 backdrop-blur-md">
                {/* Detail View Toolbar */}
                <div className="h-16 border-b border-white/20 px-6 flex items-center justify-between bg-white/40 dark:bg-black/40">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedEmail(null)}
                            className="hover:bg-white/20 dark:hover:bg-white/10"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Detail Content */}
                <ScrollArea className="flex-1 p-8">
                    <div className="max-w-3xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold mb-4">{selectedEmail.subject}</h1>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                        {selectedEmail.sender[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-semibold">{selectedEmail.sender}</div>
                                        <div className="text-xs text-muted-foreground">{formatEmailDate(selectedEmail.date)}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground bg-white/10 px-2 py-1 rounded-full border border-white/10 hidden">
                                    {selectedEmail.folder}
                                </div>
                            </div>
                        </div>

                        {/* 附件（已发送邮件随件 PDF 等） */}
                        {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                            <div className="mb-8 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Paperclip className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm font-semibold">附件（{selectedEmail.attachments.length}）</span>
                                </div>
                                <div className="space-y-2">
                                    {selectedEmail.attachments.map((att, idx) => {
                                        const inner = (
                                            <>
                                                <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                <span className="flex-1 truncate">{att.filename}</span>
                                                <span className="text-xs text-muted-foreground shrink-0">{(att.size / 1024).toFixed(1)} KB</span>
                                                {att.storage_key && <Download className="h-4 w-4 text-blue-500 shrink-0" />}
                                            </>
                                        );
                                        return att.storage_key ? (
                                            <a
                                                key={att.storage_key}
                                                href={`${API_BASE_URL}/emails/${selectedEmail.id}/attachment/${att.storage_key}`}
                                                download={att.filename}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/40 dark:bg-black/30 hover:bg-white/60 dark:hover:bg-white/10 transition-colors text-sm"
                                            >
                                                {inner}
                                            </a>
                                        ) : (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/20 dark:bg-black/20 text-sm opacity-70">
                                                {inner}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 分析失败说明 */}
                        {selectedEmail.analysis_status === "failed" && (
                            <div className="mb-8 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-red-500">分析失败</p>
                                    <p className="text-sm text-red-500/80 mt-1">
                                        {selectedEmail.analysis_error || "邮件分析未能完成。"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 已忽略说明 */}
                        {selectedEmail.analysis_status === "ignored" && (
                            <div className="mb-8 p-4 rounded-xl border border-gray-500/30 bg-gray-500/10 flex items-start gap-3">
                                <EyeOff className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-gray-500">已忽略</p>
                                    <p className="text-sm text-gray-500/80 mt-1">
                                        {selectedEmail.analysis_error || "该邮件已被忽略。"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Analysis Card */}
                        {isLoadingAnalysis && (
                            <div className="mb-8 p-6 rounded-xl border border-white/10 bg-white/5 animate-pulse flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                                <span className="text-sm text-foreground/80">正在加载分析...</span>
                            </div>
                        )}
                        {!isLoadingAnalysis && analysisData && (
                            <div className="mb-8 overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5 backdrop-blur-sm">
                                <div className="px-6 py-3 border-b border-purple-500/10 bg-purple-500/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Wand2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                        <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-200">AI 分析摘要</h3>
                                    </div>
                                    {selectedEmail.analysis_status === "analyzed" ? (
                                        <Button size="sm" onClick={handleStartProcurement} className="bg-green-600 hover:bg-green-500 text-white shadow shadow-green-500/20 gap-1 h-8 px-3">
                                            <Wand2 className="h-3.5 w-3.5" /> 开始采购
                                        </Button>
                                    ) : selectedEmail.analysis_status === "pending_review" ? (
                                        <Button size="sm" onClick={handleStartProcurement} className="bg-blue-600 hover:bg-blue-500 text-white shadow shadow-blue-500/20 gap-1 h-8 px-3">
                                            <ShieldCheck className="h-3.5 w-3.5" /> 审核
                                        </Button>
                                    ) : (
                                        <EmailTag status={selectedEmail.analysis_status} priority={selectedEmail.priority} error={selectedEmail.analysis_error} />
                                    )}
                                </div>
                                <div className="p-6">
                                    <p className="text-sm text-foreground/90 mb-4">{analysisData.summary}</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground block text-xs">优先级</span>
                                            <span className={`font-medium ${analysisData.priority === 'High' ? 'text-red-400' :
                                                analysisData.priority === 'Medium' ? 'text-yellow-400' : 'text-green-400'
                                                }`}>{analysisData.priority}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">物品</span>
                                            <span className="font-medium text-foreground">{analysisData.item_name}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">数量</span>
                                            <span className="font-medium text-foreground">{analysisData.item_quantity} 件</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">供应商</span>
                                            <span className="font-medium text-foreground">{analysisData.vendor_name || '无'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">供应商邮箱</span>
                                            <span className="font-medium text-foreground">{analysisData.vendor_email || '无'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">供应商电话</span>
                                            <span className="font-medium text-foreground">{analysisData.vendor_phone || '无'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">预算</span>
                                            <span className="font-medium text-blue-600 dark:text-blue-400">
                                                {analysisData.budget != null ? `$${analysisData.budget.toLocaleString()}` : '无'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">单价</span>
                                            <span className="font-medium text-foreground">
                                                {analysisData.item_unit_price ? `$${analysisData.item_unit_price.toLocaleString()}` : '无'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">总成本</span>
                                            <span className="font-medium text-foreground">
                                                {analysisData.total_cost ? `$${analysisData.total_cost.toLocaleString()}` : '无'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 合规审查结果（已处理 / 未通过 / 待审核时展示 AI 评审） */}
                        {(selectedEmail.analysis_status === "processed" || selectedEmail.analysis_status === "failed_compliance" || selectedEmail.analysis_status === "pending_review") && analysisData?.compliance_explanation && (
                            <div className={`mb-8 p-4 rounded-xl border ${selectedEmail.analysis_status === "processed"
                                ? "border-emerald-500/30 bg-emerald-500/10"
                                : selectedEmail.analysis_status === "failed_compliance"
                                    ? "border-orange-500/30 bg-orange-500/10"
                                    : "border-blue-500/30 bg-blue-500/10"
                                }`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <ShieldCheck className={`h-4 w-4 ${selectedEmail.analysis_status === "processed"
                                        ? "text-emerald-500"
                                        : selectedEmail.analysis_status === "failed_compliance"
                                            ? "text-orange-500"
                                            : "text-blue-500"
                                        }`} />
                                    <span className={`text-sm font-semibold ${selectedEmail.analysis_status === "processed"
                                        ? "text-emerald-500"
                                        : selectedEmail.analysis_status === "failed_compliance"
                                            ? "text-orange-500"
                                            : "text-blue-500"
                                        }`}>
                                        合规审查结果
                                    </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                                    {analysisData.compliance_explanation}
                                </p>
                            </div>
                        )}

                        <div className="prose dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans">
                            {selectedEmail.body}
                        </div>
                    </div>
                </ScrollArea>
            </div>
        );
    }

    // ----------------------------------------------------------------------
    // View: Email List
    // ----------------------------------------------------------------------
    return (
        <div className="h-full flex flex-col bg-white/30 dark:bg-black/20 backdrop-blur-md">
            {/* List View Toolbar */}
            <div className="h-16 border-b border-white/20 px-6 flex items-center justify-between bg-white/40 dark:bg-black/40">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-sm group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder={`搜索邮件...`}
                            className="pl-9 bg-white/50 dark:bg-black/50 border-white/20 dark:border-white/10 focus-visible:ring-blue-500/50 transition-all focus:bg-white/80 dark:focus:bg-black/80"
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 hover:text-primary h-9"
                        title="从服务器同步"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span className="text-xs font-medium">刷新</span>
                    </Button>

                    <div className="h-4 w-[1px] bg-white/20 mx-2" />

                    {/* Sorting & Filtering Controls */}
                    <div className="flex items-center gap-2 mr-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 hover:text-primary h-9">
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">排序</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-white/10">
                                <DropdownMenuLabel>按日期排序</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                                    <DropdownMenuRadioItem value="newest" className="text-sm">最新优先</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="oldest" className="text-sm">最早优先</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className={`gap-2 border-white/10 hover:bg-white/10 hover:text-primary h-9 ${statusFilter !== 'all' ? 'bg-blue-500/10 text-blue-500' : 'bg-white/5'}`}>
                                    <Filter className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">{statusFilter === "all" ? "状态" : STATUS_LABELS[statusFilter]}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-white/10">
                                <DropdownMenuLabel>按状态筛选</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                                    <DropdownMenuRadioItem value="all" className="text-sm">全部状态</DropdownMenuRadioItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuRadioItem value="unanalyzed" className="text-sm text-muted-foreground">未分析</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="high" className="text-sm text-red-500">高优先</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="medium" className="text-sm text-yellow-500">中优先</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="low" className="text-sm text-sky-500">低优先</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="failed" className="text-sm text-rose-500">分析失败</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="pending_review" className="text-sm text-blue-500">待审核</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="processed" className="text-sm text-emerald-500">已处理</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="failed_compliance" className="text-sm text-orange-500">未通过</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="ignored" className="text-sm text-gray-400">已忽略</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {folder === 'inbox' && (
                        <Button
                            variant="outline"
                            className="gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/20 ml-2 shadow-lg shadow-purple-500/10"
                            onClick={handleAnalyzeAll}
                            disabled={isAnalyzingAll}
                        >
                            {isAnalyzingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            全部分析
                        </Button>
                    )}

                </div>
            </div>

            {/* Email List */}
            <ScrollArea className="flex-1">
                <div className="divide-y divide-white/10 dark:divide-white/5">
                    {filteredEmails.map((email) => (
                        <div
                            key={email.id}
                            onClick={() => setSelectedEmail(email)}
                            className="group px-6 py-4 hover:bg-white/40 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-start gap-4"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center border border-white/10 shrink-0">
                                <span className="font-semibold text-sm text-gray-600 dark:text-gray-300">
                                    {email.sender[0]?.toUpperCase()}
                                </span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 min-w-0">
                                    <h4 className="text-sm font-semibold text-foreground truncate min-w-0">
                                        {email.sender}
                                    </h4>
                                    {folder === "inbox" && <EmailTag status={email.analysis_status} priority={email.priority} error={email.analysis_error} />}
                                </div>
                                <h5 className="text-sm font-medium text-foreground/90 truncate">
                                    {email.subject}
                                </h5>
                                <p className="text-xs text-muted-foreground truncate opacity-80 group-hover:opacity-100 transition-opacity">
                                    {email.body}
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                                    {formatEmailDate(email.date)}
                                </span>
                                {folder === "inbox" && (() => {
                                    const status = email.analysis_status;
                                    const showAnalyze = !status || status === "failed";
                                    const showReview = status === "analyzed";
                                    const showAudit = status === "pending_review";
                                    const showIgnore = !status || status === "failed" || status === "analyzed";
                                    if (!showAnalyze && !showReview && !showAudit && !showIgnore) return null;
                                    return (
                                        <div className="flex items-center gap-0.5">
                                            {showAnalyze && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-purple-500 hover:bg-purple-500/20 hover:text-purple-600"
                                                    onClick={(e) => handleAnalyzeEmail(email.id, e)}
                                                    disabled={analyzingEmailId === email.id}
                                                    title="分析邮件"
                                                >
                                                    {analyzingEmailId === email.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                                </Button>
                                            )}
                                            {showReview && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-500 hover:bg-blue-500/20 hover:text-blue-600"
                                                    onClick={(e) => handleReview(email, e)}
                                                    title="开始采购"
                                                >
                                                    <ShoppingCart className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {showAudit && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-500 hover:bg-blue-500/20 hover:text-blue-600"
                                                    onClick={(e) => handleReview(email, e)}
                                                    title="审核"
                                                >
                                                    <ShieldCheck className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {showIgnore && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-gray-400 hover:bg-gray-500/20 hover:text-gray-500"
                                                    onClick={(e) => handleIgnore(email, e)}
                                                    title="忽略"
                                                >
                                                    <EyeOff className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ))}

                    {isLoading && filteredEmails.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-pulse">
                            <RotateCw className="h-8 w-8 mb-4 animate-spin opacity-50" />
                            <p className="text-sm">正在同步邮件...</p>
                        </div>
                    )}

                    {!isLoading && filteredEmails.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Mail className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">该文件夹暂无邮件</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* 忽略邮件弹窗 */}
            <Dialog open={!!ignoreTarget} onOpenChange={(o) => !o && setIgnoreTarget(null)}>
                <DialogContent className="sm:max-w-[480px] bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-white/20">
                    <DialogHeader>
                        <DialogTitle>忽略邮件</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        placeholder="填写忽略理由（可选）..."
                        value={ignoreReason}
                        onChange={(e) => setIgnoreReason(e.target.value)}
                        rows={3}
                        className="bg-white/50 dark:bg-black/30"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIgnoreTarget(null)}>取消</Button>
                        <Button onClick={confirmIgnore} disabled={isIgnoring} className="gap-2 bg-gray-600 hover:bg-gray-500 text-white">
                            {isIgnoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                            确认忽略
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

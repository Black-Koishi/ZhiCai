import { useState, useEffect, useCallback } from "react";
import { fetchOrdersPaginated, fetchOrdersSummary, deleteOrder, sendOrder, receiveOrder, cancelOrder, API_BASE_URL, type OrdersSummary } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Download, Search, Trash2, ShoppingCart, Send, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Pagination } from "./Pagination";

const PER_PAGE = 20;

export function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);

    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const [statusFilter, setStatusFilter] = useState("all");
    const [minAmountInput, setMinAmountInput] = useState("");
    const [maxAmountInput, setMaxAmountInput] = useState("");
    const [dateFromInput, setDateFromInput] = useState("");
    const [dateToInput, setDateToInput] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const [summary, setSummary] = useState<OrdersSummary | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        fetchOrdersSummary().then(setSummary).catch(() => { });
    }, []);

    const loadOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const filters = {
                status: statusFilter === "all" ? undefined : statusFilter,
                min_amount: minAmount.trim() !== "" ? Number(minAmount) : undefined,
                max_amount: maxAmount.trim() !== "" ? Number(maxAmount) : undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
            };
            const data = await fetchOrdersPaginated(page, PER_PAGE, searchQuery || undefined, filters);
            setOrders(data.orders);
            setTotalPages(data.total_pages);
            setTotalOrders(data.total);
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [page, searchQuery, statusFilter, minAmount, maxAmount, dateFrom, dateTo]);

    useEffect(() => { loadOrders(); }, [loadOrders]);
    useEffect(() => { setPage(1); }, [searchQuery, statusFilter, minAmount, maxAmount, dateFrom, dateTo]);

    const handleSearch = () => setSearchQuery(searchInput.trim());

    const applyFilters = () => {
        setMinAmount(minAmountInput.trim());
        setMaxAmount(maxAmountInput.trim());
        setDateFrom(dateFromInput);
        setDateTo(dateToInput);
        setPage(1);
    };

    const clearFilters = () => {
        setStatusFilter("all");
        setMinAmountInput("");
        setMaxAmountInput("");
        setDateFromInput("");
        setDateToInput("");
        setMinAmount("");
        setMaxAmount("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    const handleDelete = async (order: any) => {
        if (!confirm(`确定删除订单 #${order.id} 吗？`)) return;
        try {
            await deleteOrder(order.id);
            setMessage({ type: "success", text: `已删除订单 #${order.id}` });
            await loadOrders();
            fetchOrdersSummary().then(setSummary).catch(() => { });
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        }
    };

    const handleSend = async (order: any) => {
        try {
            const res = await sendOrder(order.id);
            setMessage({ type: "success", text: res.message });
            await loadOrders();
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        }
    };

    const handleReceive = async (order: any) => {
        if (!confirm(`确认已收到订单 #${order.id} 的货物吗？确认后库存将增加。`)) return;
        try {
            const res = await receiveOrder(order.id);
            setMessage({ type: "success", text: res.message });
            await loadOrders();
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        }
    };

    const handleCancel = async (order: any) => {
        if (!confirm(`确定取消订单 #${order.id} 吗？`)) return;
        try {
            const res = await cancelOrder(order.id);
            setMessage({ type: "success", text: res.message });
            await loadOrders();
            fetchOrdersSummary().then(setSummary).catch(() => { });
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        }
    };

    const statusMap: Record<string, { label: string; cls: string }> = {
        draft: { label: "草稿", cls: "bg-gray-500/10 text-gray-500" },
        sent: { label: "已发送", cls: "bg-blue-500/10 text-blue-500" },
        received: { label: "已完成", cls: "bg-emerald-500/10 text-emerald-500" },
        cancelled: { label: "已取消", cls: "bg-red-500/10 text-red-500" },
    };

    return (
        <div className="h-full flex flex-col">
            {/* 工具栏 */}
            <div className="p-4 border-b border-white/10 bg-white/20 dark:bg-black/10 shrink-0 flex items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">总金额</span>
                        <span className="text-lg font-bold">${(summary?.total_volume ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">已完成订单数</span>
                        <span className="text-lg font-bold">{(summary?.total_count ?? 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="搜索订单号 / 物料 / 供应商..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-9 bg-white/50 dark:bg-black/30"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch} className="shrink-0">查询</Button>
                {message && (
                    <span className={`text-sm ${message.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {message.text}
                    </span>
                )}
            </div>

            {/* 筛选栏 */}
            <div className="px-4 py-2 border-b border-white/10 bg-white/10 dark:bg-black/5 shrink-0 flex items-center gap-3 flex-wrap">
                <select
                    className="h-9 px-3 bg-white/50 dark:bg-black/30 border border-white/20 rounded-md text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    title="按状态筛选"
                >
                    <option value="all">全部状态</option>
                    <option value="draft">草稿</option>
                    <option value="sent">已发送</option>
                    <option value="received">已完成</option>
                    <option value="cancelled">已取消</option>
                </select>
                <Input
                    type="number"
                    placeholder="最小金额"
                    value={minAmountInput}
                    onChange={(e) => setMinAmountInput(e.target.value)}
                    className="w-32 h-9 bg-white/50 dark:bg-black/30"
                />
                <Input
                    type="number"
                    placeholder="最大金额"
                    value={maxAmountInput}
                    onChange={(e) => setMaxAmountInput(e.target.value)}
                    className="w-32 h-9 bg-white/50 dark:bg-black/30"
                />
                <Input
                    type="date"
                    value={dateFromInput}
                    onChange={(e) => setDateFromInput(e.target.value)}
                    className="w-40 h-9 bg-white/50 dark:bg-black/30"
                    title="开始日期"
                />
                <Input
                    type="date"
                    value={dateToInput}
                    onChange={(e) => setDateToInput(e.target.value)}
                    className="w-40 h-9 bg-white/50 dark:bg-black/30"
                    title="结束日期"
                />
                <Button size="sm" onClick={applyFilters} className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white">筛选</Button>
                <Button size="sm" variant="outline" onClick={clearFilters} className="shrink-0">清除</Button>
            </div>

            {/* 表格 */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-sm">正在加载订单...</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <ShoppingCart className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">暂无订单</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden bg-white/40 dark:bg-black/30 backdrop-blur-sm">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md">
                                    <TableRow className="hover:bg-transparent border-b border-white/10">
                                        <TableHead className="text-muted-foreground">单号</TableHead>
                                        <TableHead className="text-muted-foreground">物料</TableHead>
                                        <TableHead className="text-muted-foreground">数量</TableHead>
                                        <TableHead className="text-muted-foreground">供应商</TableHead>
                                        <TableHead className="text-muted-foreground">金额</TableHead>
                                        <TableHead className="text-muted-foreground">日期</TableHead>
                                        <TableHead className="text-muted-foreground">状态</TableHead>
                                        <TableHead className="text-muted-foreground text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order) => (
                                        <TableRow key={order.id} className="border-b border-white/5 hover:bg-white/5">
                                            <TableCell className="font-mono font-bold text-foreground/80">#{order.id.toString().padStart(4, '0')}</TableCell>
                                            <TableCell className="font-semibold">{order.item_name || '未知物品'}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-black/5 dark:bg-white/10 text-muted-foreground border-transparent">× {order.qty}</Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{order.vendor_name || '未知供应商'}</TableCell>
                                            <TableCell className="font-mono text-emerald-600 dark:text-emerald-400">
                                                ${(order.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{format(new Date(order.created_at || new Date()), "yyyy-MM-dd")}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={`${(statusMap[order.status] || statusMap.draft).cls} border-transparent`}>
                                                    {(statusMap[order.status] || statusMap.draft).label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {order.pdf_path && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-500/10" asChild title="下载 PDF">
                                                            <a href={`${API_BASE_URL}/static/orders/${order.pdf_path.split('/').pop()}`} target="_blank" rel="noopener noreferrer">
                                                                <Download className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {order.status === 'draft' && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-500/10" onClick={() => handleSend(order)} title="发送邮件给供应商">
                                                                <Send className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:bg-amber-500/10" onClick={() => handleCancel(order)} title="取消订单">
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {order.status === 'sent' && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:bg-emerald-500/10" onClick={() => handleReceive(order)} title="确认收货">
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:bg-amber-500/10" onClick={() => handleCancel(order)} title="取消订单">
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(order)} title="删除">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <Pagination page={page} totalPages={totalPages} total={totalOrders} onPageChange={setPage} />
        </div>
    );
}

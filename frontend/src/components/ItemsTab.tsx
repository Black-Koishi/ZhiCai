import { useState, useEffect, useCallback } from "react";
import { fetchItemsPaginated, deleteItem } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Search, Trash2, Package, Pencil } from "lucide-react";
import { ItemDialog } from "./ItemDialog";
import { ItemEditDialog } from "./ItemEditDialog";
import { Pagination } from "./Pagination";

const PER_PAGE = 20;

export function ItemsTab() {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [stockFilter, setStockFilter] = useState("all");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<any | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await fetchItemsPaginated(page, PER_PAGE, searchQuery || undefined, stockFilter === "all" ? undefined : stockFilter);
            setItems(data.items);
            setTotalPages(data.total_pages);
            setTotal(data.total);
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [page, searchQuery, stockFilter]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [searchQuery, stockFilter]);

    const handleSearch = () => setSearchQuery(searchInput.trim());

    const handleDelete = async (item: any) => {
        if (!confirm(`确定删除物料「${item.name}」吗？`)) return;
        try {
            await deleteItem(item.id);
            setMessage({ type: "success", text: `已删除物料「${item.name}」` });
            await load();
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        }
    };

    const handleCreated = (msg: string) => {
        setMessage({ type: "success", text: msg });
        setPage(1);
        load();
    };

    const handleSaved = (msg: string) => {
        setMessage({ type: "success", text: msg });
        load();
    };

    return (
        <div className="h-full flex flex-col">
            {/* 工具栏 */}
            <div className="p-4 border-b border-white/10 bg-white/20 dark:bg-black/10 shrink-0 flex items-center gap-3">
                <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                    <Plus className="h-4 w-4" /> 新增
                </Button>
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="搜索名称 / SKU / 供应商..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-9 bg-white/50 dark:bg-black/30"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch} className="shrink-0">查询</Button>
                <select
                    className="h-9 px-3 bg-white/50 dark:bg-black/30 border border-white/20 rounded-md text-sm shrink-0"
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    title="按库存筛选"
                >
                    <option value="all">全部库存</option>
                    <option value="sufficient">库存充足</option>
                    <option value="low">低库存</option>
                </select>
                {message && (
                    <span className={`text-sm ${message.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {message.text}
                    </span>
                )}
            </div>

            {/* 表格 */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-sm">正在加载物料...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Package className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">暂无物料</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden bg-white/40 dark:bg-black/30 backdrop-blur-sm">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md">
                                    <TableRow className="hover:bg-transparent border-b border-white/10">
                                        <TableHead className="text-muted-foreground">ID</TableHead>
                                        <TableHead className="text-muted-foreground">物料名称</TableHead>
                                        <TableHead className="text-muted-foreground">SKU</TableHead>
                                        <TableHead className="text-muted-foreground">单位</TableHead>
                                        <TableHead className="text-muted-foreground">单价</TableHead>
                                        <TableHead className="text-muted-foreground">默认供应商</TableHead>
                                        <TableHead className="text-muted-foreground">现有库存</TableHead>
                                        <TableHead className="text-muted-foreground">最小阈值</TableHead>
                                        <TableHead className="text-muted-foreground">最大容量</TableHead>
                                        <TableHead className="text-muted-foreground text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item) => (
                                        <TableRow key={item.id} className="border-b border-white/5 hover:bg-white/5">
                                            <TableCell className="font-mono text-muted-foreground">#{item.id}</TableCell>
                                            <TableCell className="font-semibold">{item.name}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{item.sku || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground">{item.unit || "—"}</TableCell>
                                            <TableCell className="font-mono">${(item.unit_price ?? 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-muted-foreground">{item.vendor_name || "—"}</TableCell>
                                            <TableCell>
                                                {item.qty_on_hand == null ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className="font-medium">{item.qty_on_hand}</span>
                                                        {item.qty_on_hand < (item.min_qty ?? 0) ? (
                                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-red-500/15 text-red-500 border-red-500/30">低库存</span>
                                                        ) : (
                                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">库存充足</span>
                                                        )}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{item.min_qty ?? "—"}</TableCell>
                                            <TableCell className="text-muted-foreground">{item.max_capacity ?? "—"}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-500/10" onClick={() => setEditing(item)} title="编辑">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(item)} title="删除">
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

            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

            <ItemDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={handleCreated} />
            <ItemEditDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} item={editing} onSaved={handleSaved} />
        </div>
    );
}

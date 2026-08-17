import { useState, useEffect, useCallback } from "react";
import { fetchSuppliersPaginated, deleteSupplier, type Supplier } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Search, Trash2, Building2, Pencil, RefreshCw } from "lucide-react";
import { SupplierDialog } from "./SupplierDialog";
import { SupplierEditDialog } from "./SupplierEditDialog";
import { SupplierRescoreDialog } from "./SupplierRescoreDialog";
import { Pagination } from "./Pagination";

const PER_PAGE = 20;

export function SuppliersTab() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [scoreFilter, setScoreFilter] = useState("all");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [rescoring, setRescoring] = useState<Supplier | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            let minScore: number | undefined;
            let maxScore: number | undefined;
            switch (scoreFilter) {
                case "90": minScore = 90; break;
                case "80": minScore = 80; maxScore = 89; break;
                case "70": minScore = 70; maxScore = 79; break;
                case "60": minScore = 60; maxScore = 69; break;
                case "below60": maxScore = 59; break;
            }
            const data = await fetchSuppliersPaginated(page, PER_PAGE, searchQuery || undefined, minScore, maxScore);
            setSuppliers(data.suppliers);
            setTotalPages(data.total_pages);
            setTotal(data.total);
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [page, searchQuery, scoreFilter]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => { setPage(1); }, [searchQuery, scoreFilter]);

    const handleSearch = () => setSearchQuery(searchInput.trim());

    const handleDelete = async (s: Supplier) => {
        if (!confirm(`确定删除供应商「${s.name}」吗？`)) return;
        try {
            await deleteSupplier(s.id);
            setMessage({ type: "success", text: `已删除供应商「${s.name}」` });
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

    const handleRescored = (msg: string) => {
        setMessage({ type: "success", text: msg });
        load();
    };

    const scoreColor = (score: number) => {
        if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
        if (score >= 80) return "text-blue-600 dark:text-blue-400";
        return "text-amber-600 dark:text-amber-400";
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
                        placeholder="搜索名称 / 邮箱 / 电话 / 品类..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-9 bg-white/50 dark:bg-black/30"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch} className="shrink-0">查询</Button>
                <select
                    className="h-9 px-3 bg-white/50 dark:bg-black/30 border border-white/20 rounded-md text-sm shrink-0"
                    value={scoreFilter}
                    onChange={(e) => setScoreFilter(e.target.value)}
                    title="按评分筛选"
                >
                    <option value="all">全部评分</option>
                    <option value="90">90 分以上</option>
                    <option value="80">80 - 89 分</option>
                    <option value="70">70 - 79 分</option>
                    <option value="60">60 - 69 分</option>
                    <option value="below60">60 分以下</option>
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
                            <p className="text-sm">正在加载供应商...</p>
                        </div>
                    ) : suppliers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Building2 className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">暂无供应商</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden bg-white/40 dark:bg-black/30 backdrop-blur-sm">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md">
                                    <TableRow className="hover:bg-transparent border-b border-white/10">
                                        <TableHead className="text-muted-foreground">ID</TableHead>
                                        <TableHead className="text-muted-foreground">供应商名称</TableHead>
                                        <TableHead className="text-muted-foreground">邮箱</TableHead>
                                        <TableHead className="text-muted-foreground">电话</TableHead>
                                        <TableHead className="text-muted-foreground">评分</TableHead>
                                        <TableHead className="text-muted-foreground text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suppliers.map((s) => (
                                        <TableRow key={s.id} className="border-b border-white/5 hover:bg-white/5">
                                            <TableCell className="font-mono text-muted-foreground">#{s.id}</TableCell>
                                            <TableCell className="font-semibold">{s.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{s.email || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground">{s.phone || "—"}</TableCell>
                                            <TableCell><span className={`font-bold ${scoreColor(s.ext_score)}`}>{s.ext_score}</span></TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-500/10" onClick={() => setEditing(s)} title="编辑">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-500 hover:bg-purple-500/10" onClick={() => setRescoring(s)} title="重评">
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(s)} title="删除">
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

            <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={handleCreated} />
            <SupplierEditDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} supplier={editing} onSaved={handleSaved} />
            <SupplierRescoreDialog open={!!rescoring} onOpenChange={(o) => !o && setRescoring(null)} supplier={rescoring} onRescored={handleRescored} />
        </div>
    );
}

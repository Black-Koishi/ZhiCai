import { useState } from "react";
import { SuppliersTab } from "./SuppliersTab";
import { ItemsTab } from "./ItemsTab";
import { OrdersPage } from "./OrdersPage";
import { cn } from "@/lib/utils";
import { Building2, Package, ShoppingCart } from "lucide-react";

type Tab = "suppliers" | "items" | "orders";

export function ManagementPage() {
    const [tab, setTab] = useState<Tab>("orders");

    const tabs: { key: Tab; label: string; icon: any }[] = [
        { key: "orders", label: "订单", icon: ShoppingCart },
        { key: "suppliers", label: "供应商", icon: Building2 },
        { key: "items", label: "物料", icon: Package },
    ];

    return (
        <div className="h-full w-full flex flex-col">
            {/* Tab 栏 */}
            <div className="h-14 border-b border-white/10 px-6 flex items-center gap-2 bg-white/20 dark:bg-black/20 shrink-0">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn(
                            "px-4 h-9 rounded-lg text-sm font-medium flex items-center gap-2 transition-all",
                            tab === t.key
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                    >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-hidden">
                {tab === "suppliers" && <SuppliersTab />}
                {tab === "items" && <ItemsTab />}
                {tab === "orders" && <OrdersPage />}
            </div>
        </div>
    );
}

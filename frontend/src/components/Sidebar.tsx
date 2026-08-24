import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Bot, ChevronLeft, ChevronRight, Home, Settings as SettingsIcon, Mail, LayoutDashboard, PlusCircle, ShoppingCart, TrendingUp } from "lucide-react"
import { NavItem } from "./NavItem"

interface SidebarProps {
    activeView: "home" | "emails" | "settings" | "dashboard" | "new_order" | "orders" | "forecast";
    setActiveView: (view: "home" | "emails" | "settings" | "dashboard" | "new_order" | "orders" | "forecast") => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    onNewOrder: () => void;
    emailBadgeCount?: number;
}

export function Sidebar({
    activeView,
    setActiveView,
    isCollapsed,
    setIsCollapsed,
    onNewOrder,
    emailBadgeCount = 0
}: SidebarProps) {

    const toggleCollapse = () => setIsCollapsed(!isCollapsed);

    return (
        <div className={cn(
            "relative flex flex-col h-full transition-all duration-300 z-20",
            "bg-white/40 dark:bg-black/40 backdrop-blur-xl border-r border-white/20 dark:border-white/10",
            isCollapsed ? "w-20" : "w-72"
        )}>
            {/* Toggle Button */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-8 z-30 h-6 w-6 rounded-full border border-white/20 bg-white/50 dark:bg-black/50 shadow-md backdrop-blur-sm hover:bg-primary hover:text-white transition-colors"
                onClick={toggleCollapse}
            >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>

            {/* Header / Logo */}
            <div className={cn("flex items-center h-20 px-6 mb-2", isCollapsed ? "justify-center" : "")}>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Bot className="h-6 w-6 text-white" />
                </div>
                {!isCollapsed && (
                    <div className="ml-3 flex flex-col">
                        <span className="font-bold text-lg leading-none tracking-tight">智采<span className="text-primary"> ZhiCai</span></span>
                        <span className="text-[10px] text-muted-foreground tracking-widest font-semibold mt-1">智能采购管理</span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 py-4 px-3">
                <nav className="space-y-2">
                    <Button
                        onClick={onNewOrder}
                        className={cn(
                            "w-full bg-blue-600 hover:bg-blue-500 text-white gap-2 mb-4",
                            isCollapsed ? "px-0 justify-center" : "justify-start px-3"
                        )}
                    >
                        <PlusCircle className="h-5 w-5" />
                        {!isCollapsed && <span>新建订单</span>}
                    </Button>
                    <NavItem
                        view="home"
                        icon={Home}
                        label="首页"
                        activeView={activeView}
                        setActiveView={setActiveView}
                        isCollapsed={isCollapsed}
                    />
                    <NavItem
                        view="dashboard"
                        icon={LayoutDashboard}
                        label="仪表盘"
                        activeView={activeView}
                        setActiveView={setActiveView}
                        isCollapsed={isCollapsed}
                    />
                    <NavItem
                        view="emails"
                        icon={Mail}
                        label="邮件"
                        activeView={activeView}
                        setActiveView={setActiveView}
                        isCollapsed={isCollapsed}
                        badge={emailBadgeCount}
                    />
                    <NavItem
                        view="orders"
                        icon={ShoppingCart}
                        label="管理"
                        activeView={activeView}
                        setActiveView={setActiveView}
                        isCollapsed={isCollapsed}
                    />
                    <NavItem
                        view="forecast"
                        icon={TrendingUp}
                        label="趋势"
                        activeView={activeView}
                        setActiveView={setActiveView}
                        isCollapsed={isCollapsed}
                    />
                    <NavItem
                        view="settings"
                        icon={SettingsIcon}
                        label="设置"
                        activeView={activeView}
                        setActiveView={setActiveView}
                        isCollapsed={isCollapsed}
                    />
                </nav>
            </ScrollArea>
        </div>
    )
}

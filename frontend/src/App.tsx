import { useState, useEffect, useRef } from 'react'
import { Sidebar } from "@/components/Sidebar"
import { ChatInterface, Message } from "@/components/ChatInterface"
import { API_BASE_URL, syncEmails, fetchEmails, fetchForecastStatus, fetchLatestForecast } from "@/api/client"
import { Settings } from "@/components/Settings"
import { EmailPage } from "@/components/EmailPage"
import { Dashboard } from "@/components/Dashboard"
import { NewOrderPage } from "@/components/NewOrderPage"
import { ManagementPage } from "@/components/ManagementPage"
import { ForecastPage } from "@/components/ForecastPage"
import "@/index.css"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Inbox, Send, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

function App() {
    // Agent Configuration State
    const [agentEmailEnabled] = useState(true)
    const [agentComplianceEnabled] = useState(true)
    const [agentPdfEnabled] = useState(true)
    const [agentForecastEnabled] = useState(true)

    // UI State
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [activeView, setActiveView] = useState<"home" | "emails" | "settings" | "dashboard" | "new_order" | "orders" | "forecast">("home")
    const [emailFolder, setEmailFolder] = useState("inbox")

    // 邮件自动轮询 + 站内通知状态
    const [newEmailCount, setNewEmailCount] = useState(0)
    const [emailSyncVersion, setEmailSyncVersion] = useState(0)
    const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
    const seenEmailIdsRef = useRef<Set<string>>(new Set())
    const hasInitializedRef = useRef(false)
    const activeViewRef = useRef(activeView)

    // Email Filter State (Lifted for LLM control)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")

    // Chat Session State (Lifted for persistence)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    // Forecast State (Lifted for persistence)
    const [isGeneratingForecast, setIsGeneratingForecast] = useState(false)
    const [forecastReport, setForecastReport] = useState<string | null>(null)
    const [forecastChartData, setForecastChartData] = useState<any[] | null>(null)
    const [forecastError, setForecastError] = useState<string | null>(null)
    const [forecastPolling, setForecastPolling] = useState(false)

    // Settings preload state（应用启动时后台预加载，避免打开设置页才加载造成阻塞）
    const [agentModels, setAgentModels] = useState<Record<string, string>>({})
    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [emailConfig, setEmailConfig] = useState<any>(null)
    const [settingsLoaded, setSettingsLoaded] = useState(false)

    useEffect(() => {
        Promise.all([
            fetch(`${API_BASE_URL}/settings/models`).then((r) => r.json()),
            fetch(`${API_BASE_URL}/settings/ollama-models`).then((r) => r.json()),
            fetch(`${API_BASE_URL}/settings/email`).then((r) => r.json()),
        ])
            .then(([modelsData, ollamaData, emailData]) => {
                if (modelsData.status === "success") setAgentModels(modelsData.models);
                if (ollamaData.status === "success") setAvailableModels(ollamaData.models || []);
                if (emailData.status === "success") setEmailConfig(emailData.config);
            })
            .catch(() => {})
            .finally(() => setSettingsLoaded(true));
    }, [])

    // 跟踪当前视图（供邮箱轮询回调判断是否在邮件页）
    useEffect(() => {
        activeViewRef.current = activeView;
    }, [activeView]);

    // 邮箱自动轮询：定时同步收件箱，检测新邮件并给出站内提示
    useEffect(() => {
        let cancelled = false;

        const checkInbox = async () => {
            try {
                await syncEmails("inbox");
                const emails = await fetchEmails("inbox");
                const ids = emails.map((e) => e.id);
                const seen = seenEmailIdsRef.current;

                if (!hasInitializedRef.current) {
                    ids.forEach((id) => seen.add(id));
                    hasInitializedRef.current = true;
                    return;
                }

                const newIds = ids.filter((id) => !seen.has(id));
                newIds.forEach((id) => seen.add(id));

                if (newIds.length > 0 && !cancelled) {
                    setToast({ id: Date.now(), text: `收到 ${newIds.length} 封新邮件` });
                    setEmailSyncVersion((v) => v + 1);
                    if (activeViewRef.current !== "emails") {
                        setNewEmailCount((prev) => prev + newIds.length);
                    }
                }
            } catch {
                // 静默忽略轮询失败（邮箱服务未启动等）
            }
        };

        const initTimer = setTimeout(checkInbox, 3000);
        const interval = setInterval(checkInbox, 15000);

        return () => {
            cancelled = true;
            clearTimeout(initTimer);
            clearInterval(interval);
        };
    }, []);

    // 站内提示自动消失
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    const handleNavigate = (view: "home" | "emails" | "settings" | "dashboard" | "new_order" | "orders" | "forecast") => {
        setActiveView(view);
        if (view === "emails") setNewEmailCount(0);
    };

    const folderMap: Record<string, string> = {
        inbox: "收件箱",
        sent: "已发送"
    }

    const handleUIAction = (action: { action_type: string; params: any }) => {
        console.log("LLM-Triggered UI Action:", action);
        if (action.action_type === "redirect") {
            if (action.params.view) {
                handleNavigate(action.params.view as any);
            }
        } else if (action.action_type === "set_filter") {
            const { search, status, sort } = action.params;
            // set_filter 表示用户想要的目标视图状态：未指定的属性重置为默认值
            setSearchQuery(search !== undefined ? search : "");
            setStatusFilter(status !== undefined ? status : "all");
            setSortOrder(sort === "oldest" ? "oldest" : "newest");
        } else if (action.action_type === "trigger_api") {
            const { endpoint, method = "POST", payload, label = "正在执行..." } = action.params;
            setIsLoading(true);
            setMessages(prev => [...prev, { role: "user", content: `（已点击）${label}` }]);

            fetch(`${API_BASE_URL}${endpoint}`, {
                method,
                headers: { "Content-Type": "application/json" },
                body: payload ? JSON.stringify(payload) : undefined
            })
                .then(res => res.json())
                .then(data => {
                    setMessages(prev => [...prev, { role: "assistant", content: `结果：${JSON.stringify(data.status)} - ${data.explanation || data.message || "成功"}` }]);
                })
                .catch(err => {
                    setMessages(prev => [...prev, { role: "assistant", content: `执行 API 出错：${err.message}` }]);
                })
                .finally(() => setIsLoading(false));
        } else if (action.action_type === "start_forecast") {
            // 编排器触发了后台预测生成：进入生成状态并开始轮询
            setIsGeneratingForecast(true);
            setForecastError(null);
            setForecastPolling(true);
        } else if (action.action_type === "navigate") {
            if (action.params.view) {
                handleNavigate(action.params.view as any);
            }
        }
    }

    // 后台预测生成完成后：刷新状态、拉取最新结果，并在聊天中提示可跳转
    useEffect(() => {
        if (!forecastPolling) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetchForecastStatus();
                const state = res?.data?.state;
                if (state === "done") {
                    clearInterval(interval);
                    setForecastPolling(false);
                    setIsGeneratingForecast(false);
                    const latest = await fetchLatestForecast();
                    if (latest.status === "success" && latest.data) {
                        setForecastReport(latest.data.markdown || null);
                        if (latest.data.chart_data) {
                            try { setForecastChartData(JSON.parse(latest.data.chart_data)); } catch { /* ignore */ }
                        }
                    }
                    setMessages(prev => [...prev, {
                        role: "assistant",
                        content: "✅ 预测报告已生成，点击下方按钮查看预测分析。",
                        ui_actions: [{ action_type: "navigate", params: { view: "forecast", label: "查看预测分析" } }]
                    }]);
                } else if (state === "error") {
                    clearInterval(interval);
                    setForecastPolling(false);
                    setIsGeneratingForecast(false);
                    setForecastError(res?.data?.message || "预测生成失败");
                    setMessages(prev => [...prev, { role: "assistant", content: `❌ 预测生成失败：${res?.data?.message || "未知错误"}` }]);
                }
            } catch {
                // 轮询失败时静默忽略，等待下一轮
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [forecastPolling]);

    return (
        <div className="flex h-screen w-full overflow-hidden mesh-gradient text-foreground transition-colors duration-500">
            <Sidebar
                activeView={activeView}
                setActiveView={handleNavigate}
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
                onNewOrder={() => {
                    setActiveView("new_order");
                }}
                emailBadgeCount={newEmailCount}
            />

            <main className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300">
                <header className="h-14 border-b border-white/10 flex items-center px-6 bg-background/50 backdrop-blur-sm sticky top-0 z-10 justify-between">
                    <div className="flex items-center gap-2">
                        {activeView === 'emails' ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hover:bg-transparent hover:text-blue-500 p-0 h-auto flex items-center gap-2">
                                        {folderMap[emailFolder]}
                                        <ChevronDown className="h-5 w-5 text-blue-500" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48 glass border-white/20">
                                    <DropdownMenuItem onClick={() => setEmailFolder("inbox")} className="gap-2 cursor-pointer">
                                        <Inbox className="h-4 w-4" /> 收件箱
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setEmailFolder("sent")} className="gap-2 cursor-pointer">
                                        <Send className="h-4 w-4" /> 已发送
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                {activeView === 'home' && '智采 · 智能采购'}
                                {activeView === 'dashboard' && '智能体仪表盘'}
                                {activeView === 'orders' && '采购管理'}
                                {activeView === 'settings' && '设置'}
                                {activeView === 'forecast' && '预测分析'}
                            </h1>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative flex">
                    {/* Main Content Area */}
                    <div className={`flex-1 overflow-hidden h-full relative transition-all duration-300 ${activeView === 'home' ? 'bg-transparent' : ''}`}>

                        {/* Home View (Chat Full Screen) */}
                        {activeView === 'home' && (
                            <ChatInterface
                                agentEmailEnabled={agentEmailEnabled}
                                agentComplianceEnabled={agentComplianceEnabled}
                                agentPdfEnabled={agentPdfEnabled}
                                agentForecastEnabled={agentForecastEnabled}
                                messages={messages}
                                setMessages={setMessages}
                                input={input}
                                setInput={setInput}
                                isLoading={isLoading}
                                setIsLoading={setIsLoading}
                                onUIAction={handleUIAction}
                            />
                        )}

                        {/* Dashboard View */}
                        {activeView === 'dashboard' && <Dashboard messages={messages} isLoading={isLoading} />}

                        {/* Email View */}
                        {activeView === 'emails' && (
                            <EmailPage
                                folder={emailFolder}
                                setMessages={setMessages}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                statusFilter={statusFilter}
                                setStatusFilter={setStatusFilter}
                                sortOrder={sortOrder}
                                setSortOrder={setSortOrder}
                                syncVersion={emailSyncVersion}
                            />
                        )}

                        {/* Management View (供应商 / 物料 / 订单) */}
                        {activeView === 'orders' && <ManagementPage />}

                        {/* Forecast View */}
                        {activeView === 'forecast' && (
                            <ForecastPage 
                                isGenerating={isGeneratingForecast}
                                setIsGenerating={setIsGeneratingForecast}
                                report={forecastReport}
                                setReport={setForecastReport}
                                chartData={forecastChartData}
                                setChartData={setForecastChartData}
                                error={forecastError}
                                setError={setForecastError}
                            />
                        )}

                        {/* New Order Form View */}
                        {activeView === 'new_order' && <NewOrderPage />}

                        {/* Settings View */}
                        {activeView === 'settings' && (
                            <div className="h-full overflow-auto">
                                <Settings
                                    agentModels={agentModels}
                                    availableModels={availableModels}
                                    emailConfig={emailConfig}
                                    settingsLoaded={settingsLoaded}
                                    onModelsChange={setAgentModels}
                                />
                            </div>
                        )}
                    </div>

                    {/* Persistent Side Chat (Visible on emails + dashboard + orders + forecast + settings) */}
                    {['emails', 'dashboard', 'orders', 'forecast', 'settings'].includes(activeView) && (
                        <div className="w-[450px] border-l border-white/10 bg-white/20 dark:bg-black/20 backdrop-blur-lg flex flex-col transition-all duration-300">
                            <div className="p-3 border-b border-white/10 bg-white/10 dark:bg-black/10 backdrop-blur-md">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">编排器</span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <ChatInterface
                                    agentEmailEnabled={agentEmailEnabled}
                                    agentComplianceEnabled={agentComplianceEnabled}
                                    agentPdfEnabled={agentPdfEnabled}
                                    agentForecastEnabled={agentForecastEnabled}
                                    messages={messages}
                                    setMessages={setMessages}
                                    input={input}
                                    setInput={setInput}
                                    isLoading={isLoading}
                                    setIsLoading={setIsLoading}
                                    onUIAction={handleUIAction}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* 站内新邮件提示 */}
            {toast && (
                <div className="fixed top-16 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border border-white/20 shadow-xl">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">{toast.text}</span>
                    <button onClick={() => setToast(null)} className="text-muted-foreground hover:text-foreground text-sm leading-none">✕</button>
                </div>
            )}
        </div>
    )
}

export default App

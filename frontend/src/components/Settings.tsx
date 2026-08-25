import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Moon, Sun, Bot, Mail, Loader2, Cloud } from "lucide-react"
import { useEffect, useState } from "react"
import { API_BASE_URL } from "@/api/client"

interface SettingsProps {
    agentModels: Record<string, string>;
    agentProviders: Record<string, string>;
    availableModels: string[];
    emailConfig: any;
    settingsLoaded: boolean;
    onModelsChange: (models: Record<string, string>) => void;
    onEmailConfigChange: (config: any) => void;
}

export function Settings({ agentModels, agentProviders, availableModels, emailConfig, settingsLoaded, onModelsChange, onEmailConfigChange }: SettingsProps) {
    const [theme, setTheme] = useState<"light" | "dark">(
        () => (localStorage.getItem("vite-ui-theme") as "light" | "dark") || "light"
    )

    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const [providers, setProviders] = useState<Record<string, string>>({})
    const [cloudModelDrafts, setCloudModelDrafts] = useState<Record<string, string>>({})
    const [cloudForm, setCloudForm] = useState({ base_url: "", api_key: "" })
    const [cloudApiKeySet, setCloudApiKeySet] = useState(false)
    const [cloudKeyTouched, setCloudKeyTouched] = useState(false)
    const [savingCloud, setSavingCloud] = useState(false)
    const [cloudMsg, setCloudMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

    const [emailForm, setEmailForm] = useState({
        smtp_server: "localhost",
        smtp_port: "1025",
        imap_server: "imap.gmail.com",
        imap_port: "993",
        email_user: "",
        email_pass: "",
    })
    const [emailPassSet, setEmailPassSet] = useState(false)
    const [passwordTouched, setPasswordTouched] = useState(false)
    const [savingEmail, setSavingEmail] = useState(false)
    const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

    const AGENT_LABELS: Record<string, string> = {
        orchestrator: "编排器智能体",
        email: "邮件提取智能体",
        compliance: "合规智能体",
        forecast: "需求分析智能体"
    }

    useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark")
        root.classList.add(theme)
        localStorage.setItem("vite-ui-theme", theme)
    }, [theme])

    useEffect(() => {
        if (!emailConfig) return;
        setEmailForm({
            smtp_server: emailConfig.smtp_server,
            smtp_port: String(emailConfig.smtp_port),
            imap_server: emailConfig.imap_server,
            imap_port: String(emailConfig.imap_port),
            email_user: emailConfig.email_user || "",
            email_pass: "",
        });
        setEmailPassSet(emailConfig.email_pass_set);
    }, [emailConfig])

    useEffect(() => {
        if (agentProviders) setProviders(agentProviders)
    }, [agentProviders])

    useEffect(() => {
        fetch(`${API_BASE_URL}/settings/cloud`)
            .then((r) => r.json())
            .then((d) => {
                if (d.status === "success") {
                    setCloudForm({ base_url: d.config.base_url || "", api_key: "" })
                    setCloudApiKeySet(d.config.api_key_set)
                }
            })
            .catch(() => {})
    }, [])

    const toggleTheme = (checked: boolean) => {
        setTheme(checked ? "dark" : "light")
    }

    const handleSaveEmail = async () => {
        setSavingEmail(true);
        setEmailMsg(null);
        try {
            const res = await fetch(`${API_BASE_URL}/settings/email`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    smtp_server: emailForm.smtp_server,
                    smtp_port: Number(emailForm.smtp_port),
                    imap_server: emailForm.imap_server,
                    imap_port: Number(emailForm.imap_port),
                    email_user: emailForm.email_user,
                    email_pass: passwordTouched ? (emailForm.email_pass || undefined) : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "保存失败");
            setEmailMsg({ type: "success", text: data.message });
            setEmailForm((prev) => ({ ...prev, email_pass: "" }));
            setPasswordTouched(false);
            // 重新拉取配置，刷新"密码已设置"状态（即时生效，无需重启）
            fetch(`${API_BASE_URL}/settings/email`)
                .then((r) => r.json())
                .then((d) => {
                    if (d.status === "success") {
                        setEmailPassSet(d.config.email_pass_set);
                        onEmailConfigChange(d.config);
                    }
                })
                .catch(() => {});
        } catch (e: any) {
            setEmailMsg({ type: "error", text: e.message });
        } finally {
            setSavingEmail(false);
        }
    }

    const persistModel = async (agentName: string, modelName: string, provider: string) => {
        setErrorMsg(null)
        try {
            const res = await fetch(`${API_BASE_URL}/settings/models`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agent_name: agentName, model_name: modelName, provider })
            })
            if (!res.ok) throw new Error("服务器更新失败")
        } catch (err: any) {
            console.error("Failed to update model:", err)
            setErrorMsg("保存更改失败，请确认后端正在运行。")
        }
    }

    const handleModelChange = async (agentName: string, newModel: string) => {
        // Optimistic update
        onModelsChange({ ...agentModels, [agentName]: newModel })
        await persistModel(agentName, newModel, providers[agentName] || "ollama")
    }

    const handleProviderChange = async (agentName: string, newProvider: string) => {
        setProviders(prev => ({ ...prev, [agentName]: newProvider }))
        await persistModel(agentName, agentModels[agentName] || "mistral", newProvider)
    }

    const handleSaveCloud = async () => {
        setSavingCloud(true)
        setCloudMsg(null)
        try {
            const res = await fetch(`${API_BASE_URL}/settings/cloud`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    base_url: cloudForm.base_url,
                    api_key: cloudKeyTouched ? (cloudForm.api_key || undefined) : undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || "保存失败")
            setCloudMsg({ type: "success", text: data.message })
            setCloudForm(prev => ({ ...prev, api_key: "" }))
            setCloudKeyTouched(false)
            fetch(`${API_BASE_URL}/settings/cloud`)
                .then((r) => r.json())
                .then((d) => { if (d.status === "success") setCloudApiKeySet(d.config.api_key_set) })
                .catch(() => {})
        } catch (e: any) {
            setCloudMsg({ type: "error", text: e.message })
        } finally {
            setSavingCloud(false)
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-3xl font-bold tracking-tight">设置</h2>

            <Card className="bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>外观</CardTitle>
                    <CardDescription>
                        自定义应用的外观。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                            <span>深色模式</span>
                            <span className="font-normal text-xs text-muted-foreground">
                                在浅色和深色主题之间切换。
                            </span>
                        </Label>
                        <div className="flex items-center space-x-2">
                            <Sun className="h-4 w-4 text-muted-foreground" />
                            <Switch
                                id="dark-mode"
                                checked={theme === "dark"}
                                onCheckedChange={toggleTheme}
                            />
                            <Moon className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-indigo-500" />
                        智能体 LLM 模型
                    </CardTitle>
                    <CardDescription>
                        为每个自主智能体动态选择底层 LLM。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!settingsLoaded ? (
                        <div className="text-sm text-muted-foreground animate-pulse">正在加载配置...</div>
                    ) : errorMsg ? (
                        <div className="text-sm font-semibold text-red-500 bg-red-500/10 p-4 rounded-md border border-red-500/20">
                            {errorMsg}
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {Object.entries(AGENT_LABELS).map(([agentKey, agentLabel]) => {
                                const provider = providers[agentKey] || "ollama"
                                return (
                                    <div key={agentKey} className="flex flex-col space-y-2 p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                                        <Label className="font-semibold text-sm">{agentLabel}</Label>
                                        <select
                                            className="h-10 px-3 py-2 bg-white dark:bg-black border border-gray-300 dark:border-gray-700 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
                                            value={provider}
                                            onChange={(e) => handleProviderChange(agentKey, e.target.value)}
                                        >
                                            <option value="ollama">本地 Ollama</option>
                                            <option value="openai">云端（OpenAI 兼容）</option>
                                        </select>
                                        {provider === "openai" ? (
                                            <Input
                                                value={cloudModelDrafts[agentKey] ?? agentModels[agentKey] ?? ""}
                                                onChange={(e) => setCloudModelDrafts(prev => ({ ...prev, [agentKey]: e.target.value }))}
                                                onBlur={() => {
                                                    const val = cloudModelDrafts[agentKey]
                                                    if (val !== undefined && val !== agentModels[agentKey]) {
                                                        handleModelChange(agentKey, val)
                                                    }
                                                }}
                                                placeholder="如 deepseek-chat / gpt-4o-mini"
                                            />
                                        ) : (
                                            <select
                                                className="h-10 px-3 py-2 bg-white dark:bg-black border border-gray-300 dark:border-gray-700 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
                                                value={agentModels[agentKey] || "mistral"}
                                                onChange={(e) => handleModelChange(agentKey, e.target.value)}
                                            >
                                                {[...new Set([...(agentModels[agentKey] ? [agentModels[agentKey]] : []), ...availableModels])].map(model => (
                                                    <option key={model} value={model}>{model}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Cloud className="h-5 w-5 text-sky-500" />
                        云端模型配置
                    </CardTitle>
                    <CardDescription>
                        配置 OpenAI 兼容的云端 API（DeepSeek / OpenAI / Qwen / Moonshot 等），供「云端」提供方的智能体使用。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">API Base URL</Label>
                        <Input
                            autoComplete="off"
                            value={cloudForm.base_url}
                            onChange={(e) => setCloudForm({ ...cloudForm, base_url: e.target.value })}
                            placeholder="https://api.deepseek.com/v1"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">API Key</Label>
                        <Input
                            type="password"
                            autoComplete="new-password"
                            value={!cloudKeyTouched && cloudApiKeySet ? "password" : cloudForm.api_key}
                            onChange={(e) => {
                                setCloudForm({ ...cloudForm, api_key: e.target.value })
                                setCloudKeyTouched(true)
                            }}
                            placeholder="sk-..."
                        />
                    </div>
                    {cloudMsg && (
                        <p className={`text-sm ${cloudMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                            {cloudMsg.text}
                        </p>
                    )}
                    <Button onClick={handleSaveCloud} disabled={savingCloud} className="gap-2 bg-sky-600 hover:bg-sky-500 text-white">
                        {savingCloud ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        保存云端配置
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-blue-500" />
                        邮箱设置
                    </CardTitle>
                    <CardDescription>
                        配置收发邮件的服务器与账号。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!settingsLoaded ? (
                        <div className="text-sm text-muted-foreground animate-pulse py-4">正在加载配置...</div>
                    ) : (
                        <>
                            {/* 真实邮箱配置（autoComplete=off 防止浏览器自动填充干扰） */}
                            <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">SMTP 服务器（发件）</Label>
                            <Input autoComplete="off" value={emailForm.smtp_server} onChange={(e) => setEmailForm({ ...emailForm, smtp_server: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">SMTP 端口</Label>
                            <Input autoComplete="off" value={emailForm.smtp_port} onChange={(e) => setEmailForm({ ...emailForm, smtp_port: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">IMAP 服务器（收件）</Label>
                            <Input autoComplete="off" value={emailForm.imap_server} onChange={(e) => setEmailForm({ ...emailForm, imap_server: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">IMAP 端口</Label>
                            <Input autoComplete="off" value={emailForm.imap_port} onChange={(e) => setEmailForm({ ...emailForm, imap_port: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">邮箱账号</Label>
                            <Input autoComplete="off" value={emailForm.email_user} onChange={(e) => setEmailForm({ ...emailForm, email_user: e.target.value })} placeholder="your@email.com" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">邮箱密码 / 授权码</Label>
                            <Input
                                type="password"
                                autoComplete="new-password"
                                value={!passwordTouched && emailPassSet ? "password" : emailForm.email_pass}
                                onChange={(e) => {
                                    setEmailForm({ ...emailForm, email_pass: e.target.value });
                                    setPasswordTouched(true);
                                }}
                                placeholder="请输入邮箱密码/授权码"
                            />
                        </div>
                    </div>

                    {emailMsg && (
                        <p className={`text-sm ${emailMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                            {emailMsg.text}
                        </p>
                    )}
                            <Button onClick={handleSaveEmail} disabled={savingEmail} className="gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                                {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                保存邮箱配置
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>关于</CardTitle>
                    <CardDescription>
                        应用信息
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">
                        <p>智采 ZhiCai</p>
                        <p>本地优先的 AI 采购管理平台</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

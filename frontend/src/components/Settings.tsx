import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Moon, Sun, Bot, Mail, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { API_BASE_URL } from "@/api/client"

interface SettingsProps {
    agentModels: Record<string, string>;
    availableModels: string[];
    emailConfig: any;
    settingsLoaded: boolean;
    onModelsChange: (models: Record<string, string>) => void;
}

export function Settings({ agentModels, availableModels, emailConfig, settingsLoaded, onModelsChange }: SettingsProps) {
    const [theme, setTheme] = useState<"light" | "dark">(
        () => (localStorage.getItem("vite-ui-theme") as "light" | "dark") || "light"
    )

    const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
        forecast: "预测智能体"
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
                .then((d) => { if (d.status === "success") setEmailPassSet(d.config.email_pass_set); })
                .catch(() => {});
        } catch (e: any) {
            setEmailMsg({ type: "error", text: e.message });
        } finally {
            setSavingEmail(false);
        }
    }

    const handleModelChange = async (agentName: string, newModel: string) => {
        // Optimistic update
        onModelsChange({ ...agentModels, [agentName]: newModel })
        setErrorMsg(null)
        
        try {
            const res = await fetch(`${API_BASE_URL}/settings/models`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agent_name: agentName, model_name: newModel })
            })
            if (!res.ok) {
                 throw new Error("服务器更新失败")
            }
        } catch(err: any) {
            console.error("Failed to update model:", err)
            setErrorMsg("保存更改失败，请确认后端正在运行。")
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
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
                            {Object.entries(AGENT_LABELS).map(([agentKey, agentLabel]) => (
                                <div key={agentKey} className="flex flex-col space-y-2 p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                                    <Label className="font-semibold text-sm">{agentLabel}</Label>
                                    <select
                                        className="h-10 px-3 py-2 bg-white dark:bg-black border border-gray-300 dark:border-gray-700 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
                                        value={agentModels[agentKey] || "mistral"}
                                        onChange={(e) => handleModelChange(agentKey, e.target.value)}
                                    >
                                        {[...new Set([...(agentModels[agentKey] ? [agentModels[agentKey]] : []), ...availableModels])].map(model => (
                                            <option key={model} value={model}>{model}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
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
                        <p>v1.0.0</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

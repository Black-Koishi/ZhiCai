import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// 关闭 HMR 增量更新，改为代码改动后自动整页刷新（避免 HMR 状态错乱导致白屏）
function forceFullReload(): Plugin {
    return {
        name: "force-full-reload",
        handleHotUpdate(ctx) {
            ctx.server.ws.send({ type: "full-reload" })
            return []
        },
    }
}

export default defineConfig({
    plugins: [react(), forceFullReload()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})

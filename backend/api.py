"""FastAPI 应用装配层：中间件、静态文件与路由注册。

业务路由按域拆分在 backend/routers/ 下。
"""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import init_db
from backend.routers import chat, emails, database, orders, forecast, procurement, settings, suppliers, items

app = FastAPI(title="智采 ZhiCai API")

# 从环境变量读取允许的跨域来源（默认本地开发地址）
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保 orders 目录存在，并挂载为静态资源（用于下载生成的 PDF）
PROJECT_ROOT = Path(__file__).resolve().parents[1]
ORDERS_DIR = PROJECT_ROOT / "orders"
ORDERS_DIR.mkdir(exist_ok=True)
app.mount("/static/orders", StaticFiles(directory=str(ORDERS_DIR)), name="orders")


@app.on_event("startup")
def on_startup():
    init_db()


# 注册各业务域路由
app.include_router(chat.router)
app.include_router(emails.router)
app.include_router(database.router)
app.include_router(orders.router)
app.include_router(forecast.router)
app.include_router(procurement.router)
app.include_router(settings.router)
app.include_router(suppliers.router)
app.include_router(items.router)

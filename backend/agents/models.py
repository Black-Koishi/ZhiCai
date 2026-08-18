"""
跨Agent共享的 Pydantic 模型。
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class UIAction(BaseModel):
    action_type: Literal["redirect", "set_filter", "popup", "trigger_api", "open_inline_procurement"] = Field(
        description="The type of UI action to perform."
    )
    params: dict = Field(
        default_factory=dict,
        description="The parameters for the UI action (e.g., view name for redirect, filter values for set_filter, endpoint and label for trigger_api)."
    )


class OrchestrationResponse(BaseModel):
    decision: Literal["email", "compliance", "pdf", "supplier", "forecast", "unknown"] = Field(
        description="The routing decision for the orchestrator."
    )
    ui_actions: List[UIAction] = Field(
        default_factory=list,
        description="A list of UI actions to trigger based on user intent."
    )
    chat_response: Optional[str] = Field(
        default=None,
        description="A direct conversational response for greetings or banter."
    )


class EmailExtraction(BaseModel):
    item_name: str = Field(description="The name or description of the requested product/item.")
    quantity: int = Field(description="The numeric quantity requested.")
    days_available: int = Field(description="The number of days within which the items are needed.")
    priority: str = Field(description="Priority: 'High' (within 7 days), 'Medium' (7-30 days), or 'Low' (after 30 days)")
    summary: str = Field(description="A brief 1-sentence summary of the request.")
    budget: Optional[float] = Field(default=None, description="The total budget for this procurement request.")
    is_procurement_request: bool = Field(default=True, description="True if the email is a genuine procurement/purchase request; false for newsletters, notifications, ads, personal mail, etc.")


class SupplierExtraction(BaseModel):
    """供应商入驻：从自然语言提取的结构化供应商信息。"""
    name: str = Field(description="供应商名称")
    email: Optional[str] = Field(default=None, description="供应商邮箱")
    phone: Optional[str] = Field(default=None, description="供应商电话")
    category: Optional[str] = Field(default=None, description="主营品类/主营业务")
    ext_score: int = Field(default=80, ge=0, le=100, description="初始评分 0-100")
    review: str = Field(default="", description="审核意见（简体中文，1-2 句）")


class ItemExtraction(BaseModel):
    """物料建档：从自然语言提取的结构化物料信息。"""
    name: str = Field(description="物料名称")
    unit: Optional[str] = Field(default=None, description="计量单位")
    unit_price: float = Field(default=0, description="单价")
    vendor_name: Optional[str] = Field(default=None, description="默认供应商名称")
    sku: Optional[str] = Field(default=None, description="SKU 编码")

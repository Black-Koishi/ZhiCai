"""
Backend agents package.

Re-exports all public agent functions so existing imports like
`from backend.agents import convert_num_to_text` continue to work.
"""

from backend.agents.orchestrator import orchestrator_router
from backend.agents.email_analyzer import analyze_email_content
from backend.agents.compliance import run_gatekeeper_checks, explain_compliance_result
from backend.agents.pdf_generator import sanitize_text, generate_order_pdf
from backend.agents.supplier_onboarding import onboard_supplier, score_supplier
from backend.agents.item_onboarding import onboard_item

__all__ = [
    "orchestrator_router",
    "analyze_email_content",
    "run_gatekeeper_checks",
    "explain_compliance_result",
    "sanitize_text",
    "generate_order_pdf",
    "onboard_supplier",
    "score_supplier",
    "onboard_item",
]

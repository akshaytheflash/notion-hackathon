import logging
from typing import Any
from app.models.schemas import PolicyResult

logger = logging.getLogger(__name__)


def evaluate_spending_limit(policy: dict[str, Any], requested_amount: float) -> PolicyResult:
    props = policy.get("properties", {})
    policy_id = ""
    policy_name = ""
    limit = 0.0
    required_action = ""

    for key, prop in props.items():
        if not isinstance(prop, dict):
            continue
        if prop.get("type") == "rich_text":
            texts = prop.get("rich_text", [])
            text = texts[0]["text"]["content"] if texts else ""
            if "POLICY-" in text:
                policy_id = text
        if prop.get("type") == "number":
            limit = prop.get("number", 0.0)

    if not policy_id:
        for key, prop in props.items():
            if isinstance(prop, dict) and prop.get("rich_text"):
                texts = prop.get("rich_text", [])
                if texts:
                    val = texts[0].get("text", {}).get("content", "")
                    if val.startswith("POLICY-"):
                        policy_id = val
                        break

    if "Limit" in props and props["Limit"].get("type") == "number":
        limit = props["Limit"]["number"]
    if "Required Action" in props and props["Required Action"].get("type") == "select":
        required_action = props["Required Action"]["select"]["name"]

    passed = requested_amount <= limit
    violation = None
    if not passed:
        violation = f"Requested amount {requested_amount} exceeds autonomous spending authority {limit}"
        if not required_action:
            required_action = "HUMAN_APPROVAL_REQUIRED"

    return PolicyResult(
        policy_id=policy_id or "POLICY-UNKNOWN",
        policy_name=policy_name or f"Spending Limit ({policy_id})",
        passed=passed,
        requested_amount=requested_amount,
        limit=limit,
        violation=violation,
        required_action=required_action if not passed else None,
    )

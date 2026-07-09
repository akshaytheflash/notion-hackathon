import pytest
from app.core.policy_engine import evaluate_spending_limit


def test_policy_allows_below_limit():
    policy = {
        "properties": {
            "Limit": {"type": "number", "number": 50000},
            "Required Action": {"type": "select", "select": {"name": "HUMAN_APPROVAL_REQUIRED"}},
        }
    }
    result = evaluate_spending_limit(policy, 30000)
    assert result.passed is True
    assert result.violation is None


def test_policy_blocks_above_limit():
    policy = {
        "properties": {
            "Limit": {"type": "number", "number": 50000},
            "Required Action": {"type": "select", "select": {"name": "HUMAN_APPROVAL_REQUIRED"}},
        }
    }
    result = evaluate_spending_limit(policy, 80000)
    assert result.passed is False
    assert result.violation is not None
    assert "exceeds" in result.violation


def test_policy_at_limit():
    policy = {
        "properties": {
            "Limit": {"type": "number", "number": 50000},
            "Required Action": {"type": "select", "select": {"name": "HUMAN_APPROVAL_REQUIRED"}},
        }
    }
    result = evaluate_spending_limit(policy, 50000)
    assert result.passed is True

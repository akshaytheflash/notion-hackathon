import pytest
from app.core.state_machine import validate_transition, InvalidTransitionError, STATES


def test_valid_transitions():
    validate_transition("CREATED", "ENGINEERING_ANALYSIS")
    validate_transition("ENGINEERING_ANALYSIS", "RESOURCE_REQUESTED")
    validate_transition("FINANCE_REJECTED", "ENGINEERING_APPEAL")
    validate_transition("WAITING_FOR_APPROVAL", "APPROVED")
    validate_transition("WAITING_FOR_APPROVAL", "REJECTED")


def test_invalid_transition():
    with pytest.raises(InvalidTransitionError):
        validate_transition("CREATED", "APPROVED")


def test_operations_cannot_execute_before_approval():
    with pytest.raises(InvalidTransitionError):
        validate_transition("CREATED", "EXECUTING")
    with pytest.raises(InvalidTransitionError):
        validate_transition("ENGINEERING_ANALYSIS", "EXECUTING")
    with pytest.raises(InvalidTransitionError):
        validate_transition("FINANCE_REVIEW", "EXECUTING")


def test_approved_leads_to_executing():
    validate_transition("APPROVED", "EXECUTING")


def test_rejected_leads_to_completed():
    validate_transition("REJECTED", "COMPLETED")

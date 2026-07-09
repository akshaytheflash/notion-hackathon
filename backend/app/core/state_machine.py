STATES = [
    "CREATED",
    "ENGINEERING_ANALYSIS",
    "RESOURCE_REQUESTED",
    "FINANCE_REVIEW",
    "FINANCE_REJECTED",
    "ENGINEERING_APPEAL",
    "FINANCE_REEVALUATION",
    "APPROVAL_REQUIRED",
    "WAITING_FOR_APPROVAL",
    "APPROVED",
    "REJECTED",
    "EXECUTING",
    "OPERATIONS_REVIEW",
    "COMPLETED",
    "FAILED",
]

TRANSITIONS = {
    "CREATED": ["ENGINEERING_ANALYSIS"],
    "ENGINEERING_ANALYSIS": ["RESOURCE_REQUESTED", "FAILED"],
    "RESOURCE_REQUESTED": ["FINANCE_REVIEW", "FAILED"],
    "FINANCE_REVIEW": ["FINANCE_REJECTED", "APPROVAL_REQUIRED", "FAILED"],
    "FINANCE_REJECTED": ["ENGINEERING_APPEAL", "REJECTED", "FAILED"],
    "ENGINEERING_APPEAL": ["FINANCE_REEVALUATION", "FAILED"],
    "FINANCE_REEVALUATION": ["APPROVAL_REQUIRED", "REJECTED", "FAILED"],
    "APPROVAL_REQUIRED": ["WAITING_FOR_APPROVAL", "FAILED"],
    "WAITING_FOR_APPROVAL": ["APPROVED", "REJECTED", "FAILED"],
    "APPROVED": ["EXECUTING", "FAILED"],
    "REJECTED": ["COMPLETED", "FAILED"],
    "EXECUTING": ["OPERATIONS_REVIEW", "FAILED"],
    "OPERATIONS_REVIEW": ["COMPLETED", "FAILED"],
    "COMPLETED": [],
    "FAILED": [],
}


class InvalidTransitionError(Exception):
    def __init__(self, current: str, target: str):
        self.current = current
        self.target = target
        super().__init__(f"Invalid transition: {current} -> {target}")


def validate_transition(current: str, target: str) -> None:
    if current not in TRANSITIONS:
        raise InvalidTransitionError(current, target)
    allowed = TRANSITIONS[current]
    if target not in allowed:
        raise InvalidTransitionError(current, target)

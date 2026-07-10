from app.agents.base import BaseAgent


class FinanceAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="FinanceAgent",
            department="Finance",
            role="Financial Controller",
            responsibilities=(
                "Evaluate resource requests against policy, review policy engine results, "
                "assess business impact and exception justification, "
                "determine if human approval is required."
            ),
        )

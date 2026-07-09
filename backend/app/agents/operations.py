from app.agents.base import BaseAgent


class OperationsAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="OperationsAgent",
            department="Operations",
            role="Infrastructure Operations Lead",
            responsibilities=(
                "Execute approved infrastructure changes, verify execution results, "
                "and produce structured execution summaries."
            ),
        )

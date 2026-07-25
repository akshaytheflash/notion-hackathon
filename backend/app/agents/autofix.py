from app.agents.base import BaseAgent


class AutoFixAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="AutoFixAgent",
            department="Engineering",
            role="Automated Fix Engineer",
            responsibilities=(
                "Analyze reported issues in the codebase, determine if they are simple syntactic "
                "or logic errors that can be automatically fixed. If the issue is simple, produce "
                "the exact corrected file content. If the issue is too complex or ambiguous, "
                "set confidence below 0.5 and explain why it cannot be auto-fixed. "
                "Always return the corrected file content in the evidence field."
            ),
        )

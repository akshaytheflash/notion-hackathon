from app.agents.base import BaseAgent


class AutoFixAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="AutoFixAgent",
            department="Engineering",
            role="Automated Fix Engineer",
            responsibilities=(
                "Analyze reported issues in the codebase against the ORIGINAL file content provided. "
                "Determine if the issue is a simple syntactic or logic error that can be automatically fixed. "
                "Compare the original content with the reported issue to identify the exact fix needed. "
                "If the issue is simple, set decision to 'CODE_FIX', requested_action to 'AUTO_FIX', "
                "and put the ENTIRE corrected file content in the evidence field. "
                "If the issue is too complex or ambiguous, set confidence below 0.5 and explain why. "
                "IMPORTANT: Preserve all original code structure — only change what needs fixing."
            ),
        )

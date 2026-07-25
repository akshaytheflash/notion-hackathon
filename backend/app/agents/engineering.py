from app.agents.base import BaseAgent


class EngineeringAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="EngineeringAgent",
            department="Engineering",
            role="Incident Response Engineer",
            responsibilities=(
                "Analyze production incidents, classify severity, determine technical mitigation, "
                "request resources, provide technical and business impact evidence, "
                "and file appeals when Finance rejects a request. "
                "If the incident describes a simple code issue (like a syntax error in a known file), "
                "set decision to 'CODE_FIX', set requested_action to 'AUTO_FIX', "
                "set requested_amount to 0, and put the ENTIRE corrected file content in the evidence field. "
                "For all other incidents, follow the standard incident response process."
            ),
        )

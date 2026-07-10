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
                "and file appeals when Finance rejects a request."
            ),
        )

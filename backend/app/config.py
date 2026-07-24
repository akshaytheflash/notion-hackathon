from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    notion_token: str = ""
    notion_incidents_data_source_id: str = ""
    notion_policies_data_source_id: str = ""
    notion_decisions_data_source_id: str = ""
    notion_approvals_data_source_id: str = ""
    notion_action_log_data_source_id: str = ""

    github_token: str = ""
    github_owner: str = ""
    github_repo: str = "notion-system"

    slack_webhook_url: str = ""

    pagerduty_api_key: str = ""
    pagerduty_service_id: str = ""

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""

    approval_poll_interval_seconds: int = 5

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    frontend_origin: str = "http://localhost:5173"

    database_url: str = f"sqlite+aiosqlite:///{Path(__file__).parent.parent / 'workflow.db'}"

    @property
    def notion_approvals_url(self) -> str:
        if self.notion_approvals_data_source_id:
            return f"https://notion.so/{self.notion_approvals_data_source_id.replace('-', '')}"
        return ""

    @property
    def integrations_status(self) -> dict:
        return {
            "gemini": {"configured": bool(self.gemini_api_key)},
            "notion": {"configured": bool(self.notion_token)},
            "github": {"configured": bool(self.github_token and self.github_owner)},
            "slack": {"configured": bool(self.slack_webhook_url)},
            "pagerduty": {"configured": bool(self.pagerduty_api_key)},
            "email": {"configured": bool(self.smtp_username and self.smtp_password and self.smtp_from_email)},
        }

    model_config = {"env_file": str(Path(__file__).parent.parent.parent / ".env")}


settings = Settings()

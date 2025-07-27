import smtplib
import time
from email import encoders
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List, Optional, Any
from config.config import config
from utils.log import output_log

class SmtpEmailSender:
    def __init__(self):
        """Initialize the EmailSender with SMTP credentials.

        Args:
            username: The email address to send from
            password: The password for the email account
        """
        self.username = config.smtp_username
        self.password = config.smtp_password
        self.smtp_server = config.smtp_server
        self.smtp_port = config.smtp_port
        self.use_ssl = config.smtp_use_ssl
        self.connection = None

    def connect(self) -> bool:
        """Connect to the SMTP server.

        Returns:
            bool: True if connection is successful, False otherwise
        """
        output_log(f"Connecting to SMTP server {self.smtp_server} on port {self.smtp_port} with SSL {self.use_ssl} | Username: {self.username}; Password: {self.password}", "debug")
        try:
            # Attempt to connect to SMTP server with retry logic
            for attempt in range(5):
                try:
                    if self.use_ssl:
                        self.connection = smtplib.SMTP_SSL(
                            self.smtp_server, self.smtp_port
                        )
                    else:
                        self.connection = smtplib.SMTP(self.smtp_server, self.smtp_port)
                        self.connection.starttls()

                    self.connection.login(self.username, self.password)
                    output_log(f"Connected to SMTP server {self.smtp_server}", "info")
                    return True
                except Exception as e:
                    if attempt < 4:  # Try 5 times total
                        wait_time = 2**attempt  # Exponential backoff
                        output_log(
                            f"SMTP connection attempt {attempt + 1} failed, retrying in {wait_time}s: {str(e)}",
                            "warning",
                        )
                        time.sleep(wait_time)
                    else:
                        raise e
        except Exception as e:
            output_log(f"Failed to connect to SMTP server: {str(e)}", "error")
            return False

    def disconnect(self) -> None:
        """Disconnect from the SMTP server."""
        if self.connection:
            self.connection.quit()

    def send_email(
        self,
        to_address: str,
        subject: str,
        body: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> bool:
        """Send an email using SMTP.

        Args:
            to_address: The recipient email address
            subject: The email subject
            body: The email body text
            attachments: Optional list of attachment dictionaries with 'filename' and 'content' keys

        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        if not self.connection:
            output_log("No SMTP connection established, attempting to connect.", "debug")
            if not self.connect():
                return False

        try:
            msg = MIMEMultipart()
            msg["From"] = self.username
            msg["To"] = to_address
            msg["Subject"] = subject

            # Attach the body
            msg.attach(MIMEText(body, "plain"))

            # Add attachments if any
            if attachments:
                for attachment in attachments:
                    filename = attachment.get("filename", "")
                    content = attachment.get("content", b"")

                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(content)
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition", f'attachment; filename="{filename}"'
                    )
                    msg.attach(part)

            # Attempt to send the email with retry logic
            for attempt in range(5):
                try:
                    self.connection.sendmail(self.username, to_address, msg.as_string())
                    output_log(f"Email sent to {to_address}", "info")
                    return True
                except Exception as e:
                    if attempt < 4:  # Try 5 times total
                        wait_time = 2**attempt  # Exponential backoff
                        output_log(
                            f"Email send attempt {attempt + 1} failed, retrying in {wait_time}s: {str(e)}",
                            "warning",
                        )
                        time.sleep(wait_time)
                        # Try to reconnect
                        self.disconnect()
                        self.connect()
                    else:
                        raise e
        except Exception as e:
            output_log(f"Failed to send email to {to_address}: {str(e)}", "error")
            return False
        finally:
            self.disconnect()
        return False
    
from langchain_core.tools import StructuredTool

def send_email_tool(
    to_address: str,
    subject: str,
    body: str,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> bool:
    """Send an email using the SmtpEmailSender class.

    Args:
        to_address: The recipient email address
        subject: The email subject
        body: The email body text
        attachments: Optional list of attachment dictionaries with 'filename' and 'content' keys

    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    sender = SmtpEmailSender()
    sender.connect()
    return sender.send_email(to_address, subject, body, attachments)

email_send_tool = StructuredTool.from_function(
    func=send_email_tool,
    name="email_send_tool",
    description="Send an email using SMTP. Input should be a dictionary with 'to_address', 'subject', 'body', and optional 'attachments'.",
    args_schema={
        "type": "object",
        "properties": {
            "to_address": {"type": "string", "description": "The recipient email address."},
            "subject": {"type": "string", "description": "The subject of the email."},
            "body": {"type": "string", "description": "The body text of the email."},
            "attachments": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "filename": {"type": "string", "description": "The name of the attachment file."},
                        "content": {"type": "string", "format": "binary", "description": "The content of the attachment file."}
                    },
                    "required": ["filename", "content"]
                },
                "description": "Optional list of attachments."
            }
        },
        "required": ["to_address", "subject", "body"]
    },
    return_direct=True,
)
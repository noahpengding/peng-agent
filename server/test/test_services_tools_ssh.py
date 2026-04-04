import json
import unittest
from unittest.mock import MagicMock, mock_open, patch

from services.tools.ssh_tools import (
    _establish_ssh_connection,
    code_execution_tool,
    execute_ssh_command,
)

class TestSshTools(unittest.TestCase):
    @patch("services.tools.ssh_tools.MinioStorage")
    def test_establish_ssh_connection_returns_none_when_config_missing(self, mock_minio_cls):
        mock_minio = mock_minio_cls.return_value
        mock_minio.file_download_to_memory.return_value = None

        result = _establish_ssh_connection("homelab")

        self.assertIsNone(result)

    @patch("services.tools.ssh_tools.paramiko.AutoAddPolicy")
    @patch("services.tools.ssh_tools.paramiko.SSHClient")
    @patch("services.tools.ssh_tools.paramiko.Ed25519Key.from_private_key")
    @patch("services.tools.ssh_tools.os.remove")
    @patch("builtins.open", new_callable=mock_open, read_data="FAKE_PRIVATE_KEY")
    @patch("services.tools.ssh_tools.MinioStorage")
    def test_establish_ssh_connection_success(
        self,
        mock_minio_cls,
        _mock_open,
        mock_remove,
        mock_from_private_key,
        mock_ssh_client_cls,
        mock_auto_add_policy,
    ):
        config_bytes = json.dumps(
            [
                {
                    "hostname": "homelab",
                    "IP": "10.0.0.2",
                    "user": "ubuntu",
                    "private_key_path": "keys/homelab",
                    "port": 2222,
                }
            ]
        ).encode("utf-8")

        mock_minio = mock_minio_cls.return_value
        mock_minio.file_download_to_memory.return_value = config_bytes
        fake_key = MagicMock()
        mock_from_private_key.return_value = fake_key
        fake_ssh = MagicMock()
        mock_ssh_client_cls.return_value = fake_ssh
        policy = object()
        mock_auto_add_policy.return_value = policy

        result = _establish_ssh_connection("homelab")

        self.assertIs(result, fake_ssh)
        mock_minio.file_download.assert_called_once_with(
            "keys/homelab",
            "temp_private_key",
            bucket_name="test",
        )
        mock_remove.assert_called_once_with("temp_private_key")
        fake_ssh.set_missing_host_key_policy.assert_called_once_with(policy)
        fake_ssh.connect.assert_called_once_with(
            hostname="10.0.0.2",
            port=2222,
            username="ubuntu",
            pkey=fake_key,
        )

    @patch("services.tools.ssh_tools._establish_ssh_connection")
    def test_execute_ssh_command_returns_error_when_connection_not_established(self, mock_connect):
        mock_connect.return_value = None

        result = execute_ssh_command("homelab", "echo hello")

        self.assertEqual(result, {"error": "SSH connection could not be established."})

    @patch("services.tools.ssh_tools._establish_ssh_connection")
    def test_execute_ssh_command_returns_output(self, mock_connect):
        fake_ssh = MagicMock()
        stdin = MagicMock()
        stdin.channel = MagicMock()
        stdout = MagicMock()
        stderr = MagicMock()
        stdout.readlines.return_value = ["hello", "\n"]
        stderr.readlines.return_value = []
        fake_ssh.exec_command.return_value = (stdin, stdout, stderr)
        mock_connect.return_value = fake_ssh

        result = execute_ssh_command("homelab", "echo hello")

        self.assertEqual(result, {"output": "hello"})
        fake_ssh.exec_command.assert_called_once_with("source ~/.zshrc\necho hello")
        stdin.write.assert_not_called()
        fake_ssh.close.assert_called_once()

    @patch("services.tools.ssh_tools._establish_ssh_connection")
    def test_execute_ssh_command_writes_stdin_payload(self, mock_connect):
        fake_ssh = MagicMock()
        stdin = MagicMock()
        stdin.channel = MagicMock()
        stdout = MagicMock()
        stderr = MagicMock()
        stdout.readlines.return_value = ["done"]
        stderr.readlines.return_value = []
        fake_ssh.exec_command.return_value = (stdin, stdout, stderr)
        mock_connect.return_value = fake_ssh

        result = execute_ssh_command("homelab", "python -", stdin_data="print(1)")

        self.assertEqual(result, {"output": "done"})
        stdin.write.assert_called_once_with("print(1)")
        stdin.flush.assert_called_once()
        stdin.channel.shutdown_write.assert_called_once()
        fake_ssh.close.assert_called_once()

    @patch("services.tools.ssh_tools._establish_ssh_connection")
    def test_execute_ssh_command_returns_stderr_as_error(self, mock_connect):
        fake_ssh = MagicMock()
        stdout = MagicMock()
        stderr = MagicMock()
        stdout.readlines.return_value = ["ignored"]
        stderr.readlines.return_value = ["permission denied", "\n"]
        fake_ssh.exec_command.return_value = (MagicMock(), stdout, stderr)
        mock_connect.return_value = fake_ssh

        result = execute_ssh_command("homelab", "cat /root/secret")

        self.assertEqual(result, {"error": "permission denied"})
        fake_ssh.exec_command.assert_called_once_with("source ~/.zshrc\ncat /root/secret")
        fake_ssh.close.assert_called_once()

    @patch("services.tools.ssh_tools._establish_ssh_connection")
    def test_execute_ssh_command_catches_exception(self, mock_connect):
        fake_ssh = MagicMock()
        fake_ssh.exec_command.side_effect = RuntimeError("boom")
        mock_connect.return_value = fake_ssh

        result = execute_ssh_command("homelab", "bad")

        self.assertEqual(result, {"error": "boom"})
        fake_ssh.exec_command.assert_called_once_with("source ~/.zshrc\nbad")

    @patch("services.tools.ssh_tools.execute_ssh_command")
    def test_code_execution_tool_python_command(self, mock_execute):
        mock_execute.return_value = {"output": "1"}

        result = code_execution_tool("python", "print(1)")

        self.assertEqual(result, "1")
        mock_execute.assert_called_once_with(
            "homelab", "uv run python -", stdin_data="print(1)"
        )

    @patch("services.tools.ssh_tools.execute_ssh_command")
    def test_code_execution_tool_r_command(self, mock_execute):
        mock_execute.return_value = {"output": "2"}

        result = code_execution_tool("r", "print(2)")

        self.assertEqual(result, "2")
        mock_execute.assert_called_once_with("homelab", "Rscript -", stdin_data="print(2)")

    @patch("services.tools.ssh_tools.execute_ssh_command")
    def test_code_execution_tool_bash_command(self, mock_execute):
        mock_execute.return_value = {"output": "ok"}

        result = code_execution_tool("bash", "echo ok")

        self.assertEqual(result, "ok")
        mock_execute.assert_called_once_with("homelab", "bash -s", stdin_data="echo ok")

    @patch("services.tools.ssh_tools.execute_ssh_command")
    def test_code_execution_tool_javascript_command(self, mock_execute):
        mock_execute.return_value = {"output": "3"}

        result = code_execution_tool("javascript", "console.log(3)")

        self.assertEqual(result, "3")
        mock_execute.assert_called_once_with("homelab", "node -", stdin_data="console.log(3)")

    @patch("services.tools.ssh_tools.execute_ssh_command")
    def test_code_execution_tool_returns_error_payload(self, mock_execute):
        mock_execute.return_value = {"error": "runtime error"}

        result = code_execution_tool("python", "raise Exception()")

        self.assertEqual(result, "runtime error")

    def test_code_execution_tool_unsupported_language(self):
        result = code_execution_tool("ruby", "puts 'hello'")

        self.assertEqual(
            result,
            "Unsupported language: ruby. Supported languages are Python, R, Bash, and JavaScript.",
        )


if __name__ == "__main__":
    unittest.main()

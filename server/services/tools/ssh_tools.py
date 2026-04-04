import paramiko
import json
import os
from langchain_core.tools import StructuredTool
from utils.minio_connection import MinioStorage
from config.config import config
from io import StringIO, BytesIO


def _establish_ssh_connection(hostname: str):
    minio = MinioStorage()
    ssh_data = minio.file_download_to_memory(f"{config.s3_base_path}/ssh_connection.json")
    if ssh_data is None:
        return None
    ssh_config = json.loads(BytesIO(ssh_data).read().decode("utf-8"))
    for entry in ssh_config:
        if entry["hostname"] == hostname:
            minio.file_download(entry["private_key_path"], "temp_private_key", bucket_name="peng-agent")
            file = ""
            with open("temp_private_key", "r") as f:
                file = f.read()
            os.remove("temp_private_key")
            key_file_obj = StringIO(file)
            private_key = paramiko.Ed25519Key.from_private_key(key_file_obj)
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(
                hostname=entry["IP"],
                port=entry.get("port", 22),
                username=entry["user"],
                pkey=private_key,
            )
            return ssh
    return None

def execute_ssh_command(hostname: str, command: str):
    ssh = _establish_ssh_connection(hostname)
    if ssh is None:
        return {"error": "SSH connection could not be established."}
    try:
        stdin, stdout, stderr = ssh.exec_command("source ~/.zshrc \n" + command)
        output = stdout.readlines()
        error = stderr.readlines()
        output = "".join(output).strip()
        error = "".join(error).strip()
        ssh.close()
        if error:
            return {"error": error}
        return {"output": output}
    except Exception as e:
        return {"error": str(e)}

def code_execution_tool(language: str, code: str):
    if language.lower() == "python":
        result = execute_ssh_command("homelab", f"uv run python -c '{code}'")
        return result["output"] if "output" in result else result["error"]
    elif language.lower() == "r":
        result = execute_ssh_command("homelab", f"Rscript -e '{code}'")
        return result["output"] if "output" in result else result["error"]
    elif language.lower() == "bash":
        result = execute_ssh_command("homelab", code)
        return result["output"] if "output" in result else result["error"]
    elif language.lower() == "javascript":
        result = execute_ssh_command("homelab", f"node -e '{code}'")
        return result["output"] if "output" in result else result["error"]
    else:
        return f"Unsupported language: {language}. Supported languages are Python, R, Bash, and JavaScript."


code_execution = StructuredTool.from_function(
    func=code_execution_tool,
    name="code_execution",
    description='''Execute code in various programming languages (Python, R, Bash, JavaScript) on a remote server via SSH. Provide the language and the code to execute.
    You need to be specific about the language. e.g. if you want to execute Python code, you need to set the language to 'python' instead of run it using 'bash'. 
    ''',
    args_schema={
        "type": "object",
        "properties": {
            "language": {
                "type": "string",
                "description": "The programming language of the code (e.g., Python, R, Bash, JavaScript).",
            },
            "code": {
                "type": "string",
                "description": "The code to execute.",
            },
        },
        "required": ["language", "code"],
    },
    return_direct=False,
)

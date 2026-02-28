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
    ssh_config = json.loads(BytesIO(ssh_data).read().decode("utf-8"))
    for entry in ssh_config:
        if entry["hostname"] == hostname:
            minio.file_download(entry["private_key_path"], "temp_private_key")
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
        stdin, stdout, stderr = ssh.exec_command(command)
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


def get_ssh_tool(hostname: str) -> StructuredTool:
    return StructuredTool.from_function(
        func=lambda command: execute_ssh_command(hostname, command),
        name=f"ssh_tool_{hostname}",
        description=f"Execute shell commands on the remote server {hostname} via SSH. Use this tool to run commands and retrieve their output.",
        args_schema={
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute on the remote server.",
                },
            },
            "required": ["command"],
        },
        return_direct=True,
    )


def get_general_ssh_tool(hostname) -> StructuredTool:
    return StructuredTool.from_function(
        func=lambda command: execute_ssh_command(hostname, command),
        name="ssh_tool_general",
        description="This is a general-purpose Linux Environment to run any SSH shell commands for calculation, code execution, or file manipulation. You are allowed to install any tools if needed. Use this tool to run commands and retrieve their output.",
        args_schema={
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute on the remote server.",
                },
            },
            "required": ["command"],
        },
        return_direct=True,
    )

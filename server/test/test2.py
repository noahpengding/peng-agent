import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
dotenv_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "../../test/.env"
)
load_dotenv(dotenv_path)

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.dirname(SCRIPT_DIR + "../"))

from handlers.model_utils import get_model_instance_by_operator
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    SystemMessage,
    HumanMessage,
    BaseMessage,
    ToolMessage,
)


model = get_model_instance_by_operator("openai", "gpt-5-mini")

messages = [
    SystemMessage(content="You are a helpful assistant."),
    HumanMessage(content="Thinking and explain step by step how to solve the differencial equaltion x*dy/dx - y(ln(xy) - 1) = 0"),
]

for chunk in model.stream(messages):
    if chunk.content_blocks:
        content = chunk.content_blocks[0]
        if content["type"] == "text":
            print(content["text"], end="", flush=True)
        if content["type"] == "reasoning":
            print(f"\n[Reasoning]: {content['resoning']}\n", flush=True)
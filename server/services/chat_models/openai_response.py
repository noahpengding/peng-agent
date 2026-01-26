from langchain_core.callbacks import (
    CallbackManagerForLLMRun,
)
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    SystemMessage,
    HumanMessage,
    BaseMessage,
    ToolMessage,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import Field
from config.config import config
from openai import OpenAI
from utils.log import output_log

from collections.abc import Sequence
from typing import Any, Callable, Dict, Literal, Optional, Union, List, Iterator
from langchain_core.tools import BaseTool
from langchain_core.runnables import Runnable
from langchain_core.language_models import LanguageModelInput

import ast


class CustomOpenAIResponse(BaseChatModel):
    model_name: str = Field(alias="model")
    reasoning_effect: str = Field(default="not a reasoning model")
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = config.output_max_length
    base_url: Optional[str]
    api_key: str
    organization_id: str
    project_id: str
    client: Optional[OpenAI] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.client = OpenAI(
            api_key=self.api_key,
            organization=self.organization_id,
            project=self.project_id,
            base_url=self.base_url,
        )

    def _openai_prepare(
        self, prompt: List[BaseMessage], streaming: bool = False, **kwargs
    ) -> Dict[str, Any]:
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        request_params = {
            "model": self.model_name,
            "input": prompt_translated,
            "stream": streaming,
        }
        if self.reasoning_effect != "not a reasoning model":
            request_params["reasoning"] = {
                "effort": self.reasoning_effect,
                "summary": "auto",
            }
        tools = kwargs.get("tools")
        tool_choice = kwargs.get("tool_choice")
        if tools:
            request_params["tools"] = []
            for tool in tools:
                parameters = tool.get("function", {}).get("parameters", {})
                parameters["additionalProperties"] = False
                request_params["tools"].append(
                    {
                        "type": "function",
                        "name": tool.get("function", {}).get("name"),
                        "description": tool.get("function", {}).get("description"),
                        "parameters": parameters,
                        "strict": False,
                    }
                )
        if self.model_name.find("deep-research") != -1:
            if "tools" not in request_params:
                request_params["tools"] = []
            request_params["tools"].append(
                {"type": "web_search_preview"},
            )
            request_params["tools"].append(
                {"type": "code_interpreter", "container": {"type": "auto"}}
            )
        if tool_choice:
            request_params["tool_choice"] = tool_choice

        return request_params

    def _generate(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        request_params = self._openai_prepare(prompt, streaming=False, **kwargs)
        responses = self.client.responses.create(**request_params)
        generate_message = None
        for response in responses.output:
            if response.type == "message":
                message_content = response.content[0].text
                generate_message = AIMessage(
                    content_blocks=[
                        {
                            "type": "text",
                            "text": message_content,
                        }
                    ]
                )
            elif response.type == "function_call":
                generate_message = AIMessage(
                    content_blocks=[
                        {
                            "type": "tool_call",
                            "name": response.name,
                            "args": ast.literal_eval(response.arguments),
                            "id": response.call_id,
                        }
                    ]
                )
        generation = ChatGeneration(message=generate_message)
        return ChatResult(generations=[generation])

    def _stream(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        request_params = self._openai_prepare(prompt, streaming=True, **kwargs)
        stream = self.client.responses.create(**request_params)
        for event in stream:
            if event.type == "response.output_text.delta":
                token = event.delta
                if token:
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {"type": "text", "text": token, "annotations": []}
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
            elif event.type == "response.reasoning_summary_text.delta":
                token = event.delta
                if token:
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "reasoning",
                                "reasoning": token,
                                "extras": {},
                            }
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
            elif event.type == "response.output_item.done":
                token = event.item
                if token and token.type == "function_call":
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "tool_call",
                                "name": token.name,
                                "args": ast.literal_eval(token.arguments),
                                "id": token.call_id,
                            }
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
            else:
                continue

    def bind_tools(
        self,
        tools: Sequence[Union[dict[str, Any], type, Callable, BaseTool]],
        *,
        tool_choice: Optional[
            Union[dict, str, Literal["auto", "none", "required", "any"], bool]
        ] = None,
        strict: Optional[bool] = None,
        parallel_tool_calls: Optional[bool] = None,
        **kwargs: Any,
    ) -> Runnable[LanguageModelInput, BaseMessage]:
        if parallel_tool_calls is not None:
            kwargs["parallel_tool_calls"] = parallel_tool_calls
        formatted_tools = [
            convert_to_openai_tool(tool, strict=strict) for tool in tools
        ]
        tool_names = []
        for index, tool in enumerate(formatted_tools):
            if "function" in tool:
                tool_names.append(tool["function"]["name"])
            elif "name" in tool:
                tool_names.append(tool["name"])

            if "properties" not in tool:
                formatted_tools[index]["function"]["parameters"]["properties"] = {}
                formatted_tools[index]["function"]["parameters"]["required"] = []
                formatted_tools[index]["properties"] = {
                    "additionalProperties": False,
                }
                formatted_tools[index]["required"] = []
        kwargs["tools"] = formatted_tools
        return super().bind(**kwargs)

    def list_models(self):
        response = self.client.models.list()
        models = [model.id for model in response.data]
        return "\n".join(models)

    def list_parameters(self):
        return f"""
        model_id: {self.model_name}
        temperature: {self.temperature}
        max_tokens: {self.max_tokens}
        reasoning_effect: {self.reasoning_effect}
        """

    def set_parameters(self, name, value) -> str:
        if name == "model_id" or name == "model":
            self.model_name = str(value)
            return f"Model set to {self.model_id}"
        elif name == "max_completion_tokens":
            self.max_tokens = int(value)
            return f"Max completion tokens set to {self.max_completion_tokens}"
        elif name == "temperature":
            self.temperature = float(value)
            return f"Temperature set to {self.temperature}"
        else:
            output_log(f"Invalid parameter: {name}", "error")
            return f"Invalid parameter: {name}, {value}"

    def _prompt_translate(self, prompt: List[BaseMessage]) -> List[Dict[str, Any]]:
        prompt_messages = []
        for message in prompt:
            if isinstance(message, AIMessage):
                for m in message.content_blocks:
                    if m["type"] == "tool_call":
                        msg_dict = {
                            "type": "function_call",
                            "name": m["name"],
                            "call_id": m["id"],
                            "arguments": str(m["args"]),
                        }
                    elif m["type"] == "text":
                        msg_dict = {
                            "role": "assistant",
                            "content": m["text"],
                        }
                    elif m["type"] == "reasoning":
                        msg_dict = {
                            "role": "assistant",
                            "content": m["reasoning"],
                        }
                prompt_messages.append(msg_dict)
            elif isinstance(message, SystemMessage):
                prompt_messages.append(
                    {
                        "role": "system",
                        "content": message.content,
                    }
                )
            elif isinstance(message, HumanMessage):
                if (
                    message.content_blocks
                    and message.content_blocks[0]["type"] == "image"
                ):
                    prompt_messages.append(
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_image",
                                    "image_url": f"data:{m['mime_type']};base64,{m['base64'].decode('utf-8')}"
                                }
                                for m in message.content_blocks
                            ],
                        }
                    )
                else:
                    prompt_messages.append(
                        {
                            "role": "user",
                            "content": message.content,
                        }
                    )
            elif isinstance(message, ToolMessage):
                prompt_messages.append(
                    {
                        "type": "function_call_output",
                        "call_id": message.tool_call_id,
                        "output": str(message.content),
                    },
                )
        return prompt_messages

    @property
    def _llm_type(self) -> str:
        return "OpenAI Response"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

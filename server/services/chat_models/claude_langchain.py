from typing import Any, Dict, List, Optional, Iterator

from langchain_core.callbacks import (
    CallbackManagerForLLMRun,
)
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    SystemMessage,
    HumanMessage,
    ToolMessage,
    BaseMessage,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from pydantic import Field
from config.config import config
from anthropic import Anthropic
from utils.log import output_log

from collections.abc import Sequence
from typing import Callable, Literal, Union
from langchain_core.tools import BaseTool
from langchain_core.runnables import Runnable
from langchain_core.language_models import LanguageModelInput

import ast
import json

THINKING_BUDGET_TOKENS = int(8192 * 0.8)


class CustomClaude(BaseChatModel):
    model_name: str = Field(alias="model")
    reasoning_effect: str = Field(default="not a reasoning model")
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = config.output_max_length
    api_key: str
    client: Optional[Anthropic] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.client = Anthropic(
            api_key=self.api_key,
        )

    def _claude_prepare(self, prompt: List[BaseMessage], **kwargs: Any):
        output_log(f"Chat completion request: {prompt}", "debug")
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        request_params = {
            "model": self.model_name,
            "messages": prompt_translated,
            "max_tokens": self.max_tokens,
        }
        if self.reasoning_effect != "not a reasoning model":
            request_params["thinking"] = {
                "type": "enabled",
                "budget_tokens": THINKING_BUDGET_TOKENS,
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
                        "name": tool.get("function", {}).get("name"),
                        "description": tool.get("function", {}).get("description"),
                        "input_schema": parameters,
                    }
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
        request_params = self._claude_prepare(prompt, **kwargs)
        responses = self.client.messages.create(**request_params)
        generate_message = None
        for response in responses.content:
            if response.type == "text":
                generate_message = AIMessage(
                    content_blocks=[
                        {
                            "type": "text",
                            "text": response.text,
                        }
                    ],
                )
            elif response.type == "tool_use":
                generate_message = AIMessage(
                    content_blocks=[
                        {
                            "type": "tool_use",
                            "id": response.id,
                            "name": response.name,
                            "args": ast.literal_eval(response.input),
                        }
                    ],
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
        request_params = self._claude_prepare(prompt, **kwargs)
        with self.client.messages.stream(**request_params) as stream:
            tool_calls_id = ""
            tool_calls_name = ""
            tool_calls_input = ""
            for event in stream:
                if event.type == "content_block_start" and event.content_block.type in (
                    "server_tool_use",
                    "tool_use",
                ):
                    tool_calls_id = event.content_block.id
                    tool_calls_name = event.content_block.name
                elif event.type == "content_block_stop" and tool_calls_id != "":
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "tool_call",
                                "id": tool_calls_id,
                                "name": tool_calls_name,
                                "args": json.loads(tool_calls_input),
                            }
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
                    break
                elif event.type == "content_block_delta":
                    if event.delta.type == "input_json_delta":
                        tool_calls_input += event.delta.partial_json
                        continue
                    elif event.delta.type == "thinking_delta":
                        message_chunk = AIMessageChunk(
                            content_blocks=[
                                {
                                    "type": "reasoning",
                                    "reasoning": event.delta.thinking,
                                    "extras": {},
                                }
                            ]
                        )
                        yield ChatGenerationChunk(message=message_chunk)
                    elif event.delta.type == "text_delta":
                        message_chunk = AIMessageChunk(
                            content_blocks=[
                                {
                                    "type": "text",
                                    "text": event.delta.text,
                                }
                            ]
                        )
                        yield ChatGenerationChunk(message=message_chunk)

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
        from langchain_core.utils.function_calling import convert_to_openai_tool

        formatted_tools = [
            convert_to_openai_tool(tool, strict=strict) for tool in tools
        ]
        tool_names = []
        for tool in formatted_tools:
            if "function" in tool:
                tool_names.append(tool["function"]["name"])
            elif "name" in tool:
                tool_names.append(tool["name"])
            else:
                pass
        kwargs["tools"] = formatted_tools
        return super().bind(**kwargs)

    def list_models(self):
        # Place Need to Change for other Provider
        models = [model.id for model in self.client.models.list().data]
        return "\n".join(models)

    def list_parameters(self):
        return f"""
        model_id: {self.model_name}
        temperature: {self.temperature}
        max_tokens: {self.max_tokens}
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

    def _prompt_translate(self, prompt: List[BaseMessage]) -> str:
        prompt_text = []
        for message in prompt:
            if isinstance(message, AIMessage):
                for m in message.content_blocks:
                    if m["type"] == "text":
                        prompt_text.append(
                            {
                                "role": "assistant",
                                "content": [{"type": "text", "text": m["text"]}],
                            }
                        )
                    elif m["type"] == "tool_call":
                        prompt_text.append(
                            {
                                "role": "assistant",
                                "content": [
                                    {
                                        "type": "tool_use",
                                        "id": m["id"],
                                        "name": m["name"],
                                        "input": m["args"],
                                    }
                                ],
                            }
                        )
                    elif m["type"] == "reasoning":
                        prompt_text.append(
                            {
                                "role": "assistant",
                                "content": [
                                    {
                                        "type": "thinking",
                                        "thinking": m["reasoning"],
                                    }
                                ],
                            }
                        )
            elif isinstance(message, SystemMessage):
                prompt_text.append(
                    {
                        "role": "assistant",
                        "content": [{"type": "text", "text": message.content}],
                    }
                )
            elif isinstance(message, HumanMessage):
                if (
                    message.content_blocks
                    and message.content_blocks[0]["type"] == "image"
                ):
                    prompt_text.append(
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": m["mime_type"],
                                        "data": m["base64"].decode("utf-8").split(",")[1],
                                    },
                                }
                                for m in message.content_blocks
                            ],
                        }
                    )
                else:
                    prompt_text.append(
                        {
                            "role": "user",
                            "content": [{"type": "text", "text": message.content}],
                        }
                    )
            elif isinstance(message, ToolMessage):
                prompt_text.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "tool_result",
                                "tool_use_id": message.tool_call_id,
                                "content": str(message.content),
                            }
                        ],
                    }
                )
        return prompt_text

    @property
    def _llm_type(self) -> str:
        return "Anthropic Claude"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

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
from langchain_core.messages.ai import UsageMetadata
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import Field
from config.config import config
from openai import OpenAI
from utils.log import output_log

from collections.abc import Sequence
from typing import Callable, Literal, Union
from langchain_core.tools import BaseTool
from langchain_core.runnables import Runnable
from langchain_core.language_models import LanguageModelInput

import time


class CustomOpenAICompletion(BaseChatModel):
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

    def _generate(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        now = time.time()
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        request_params = {
            "model": self.model_name,
            "messages": prompt_translated,
            "stream": False,
        }
        if self.reasoning_effect != "not a reasoning model":
            request_params["reasoning_effort"] = self.reasoning_effect
        request_params["extra_headers"] = {
            "HTTP-Referer": "https://agent.tenawalcott.com",
            "X-Title": "Peng Agent",
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
                        "function": {
                            "name": tool.get("function", {}).get("name", ""),
                            "description": tool.get("function", {}).get(
                                "description", ""
                            ),
                            "parameters": parameters,
                        },
                        "strict": False,
                    }
                )
        if tool_choice:
            request_params["tool_choice"] = tool_choice
        responses = self.client.chat.completions.create(**request_params)
        additional_kwargs = {}
        message_content = ""
        for choice in responses.choices:
            if choice.finish_reason == "stop":
                message_content = choice.message.content
                additional_kwargs = {
                    "type": "output_text",
                }
            elif (
                choice.finish_reason == "tool_calls"
                or choice.finish_reason == "function_call"
            ):
                tool_call = (
                    choice.message.tool_calls[0]
                    if choice.finish_reason == "tool_calls"
                    else choice.message.function_call[0]
                )
                tool_call.type = "function_call"
                additional_kwargs = {
                    "tool_calls": [
                        {
                            "id": tool_call.id,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments,
                            },
                            "type": tool_call.type,
                        }
                    ],
                    "type": "tool_calls",
                }
        generate_message = AIMessage(
            content=message_content,
            additional_kwargs=additional_kwargs,
            response_metadata={
                "time_in_seconds": time.time() - now,
            },
            metadata={
                "input_tokens": len(prompt),
                "output_tokens": len(message_content),
                "total_tokens": len(prompt) + len(message_content),
            },
        )
        output_log(f"Generated message: {generate_message}", "debug")
        generation = ChatGeneration(message=generate_message)
        return ChatResult(generations=[generation])

    def _stream(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt for streaming{prompt_translated}", "debug")
        request_params = {
            "model": self.model_name,
            "messages": prompt_translated,
            "max_tokens": self.max_tokens,
            "stream": True,
        }
        if self.reasoning_effect != "not a reasoning model":
            request_params["reasoning_effort"] = self.reasoning_effect
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
                        "function": {
                            "name": tool.get("function", {}).get("name", ""),
                            "description": tool.get("function", {}).get(
                                "description", ""
                            ),
                            "parameters": parameters,
                        },
                        "strict": False,
                    }
                )
        if tool_choice:
            request_params["tool_choice"] = tool_choice
        stream = self.client.chat.completions.create(**request_params)
        token_count = len(prompt)
        tool_calls_name = ""
        tool_calls_args = ""
        tool_calls_id = ""
        tool_calls_type = ""
        for event in stream:
            output_log(f"Received event: {event}", "debug")
            choice = event.choices[0]
            if choice.finish_reason == "tool_calls":
                message_chunk = AIMessageChunk(
                    content="",
                    additional_kwargs={
                        "tool_calls": [
                            {
                                "id": tool_calls_id,
                                "function": {
                                    "name": tool_calls_name,
                                    "arguments": tool_calls_args,
                                },
                                "type": tool_calls_type,
                            }
                        ],
                        "type": "tool_calls",
                    },
                    usage_metadata=UsageMetadata(
                        {
                            "input_tokens": len(prompt),
                            "output_tokens": len(tool_calls_args) + 1,
                            "total_tokens": token_count + len(tool_calls_args) + 1,
                        }
                    ),
                )
                chunk = ChatGenerationChunk(message=message_chunk)
                yield chunk
            if choice.finish_reason is None:
                token = choice.delta
                if getattr(token, "tool_calls", None):
                    tool_call = token.tool_calls[0]
                    if tool_call.id:
                        tool_calls_id = tool_call.id
                    if tool_call.function.name:
                        tool_calls_name = tool_call.function.name
                    if tool_call.function.arguments:
                        tool_calls_args += tool_call.function.arguments
                    if tool_call.type:
                        tool_calls_type = tool_call.type
                    continue
                elif getattr(token, "reasoning_content", None):
                    message_chunk = AIMessageChunk(
                        content=token.reasoning_content,
                        additional_kwargs={"type": "reasoning_summary"},
                        usage_metadata=UsageMetadata(
                            {
                                "input_tokens": len(prompt),
                                "output_tokens": len(token.reasoning_content),
                                "total_tokens": token_count
                                + len(token.reasoning_content),
                            }
                        ),
                    )
                    chunk = ChatGenerationChunk(message=message_chunk)
                    yield chunk
                elif getattr(token, "reasoning", None):
                    message_chunk = AIMessageChunk(
                        content=token.reasoning,
                        additional_kwargs={"type": "reasoning_summary"},
                        usage_metadata=UsageMetadata(
                            {
                                "input_tokens": len(prompt),
                                "output_tokens": len(token.reasoning),
                                "total_tokens": token_count + len(token.reasoning),
                            }
                        ),
                    )
                    chunk = ChatGenerationChunk(message=message_chunk)
                    yield chunk
                elif getattr(token, "content", None):
                    message_chunk = AIMessageChunk(
                        content=token.content,
                        additional_kwargs={"type": "output_text"},
                        usage_metadata=UsageMetadata(
                            {
                                "input_tokens": len(prompt),
                                "output_tokens": len(token.content),
                                "total_tokens": token_count + len(token.content),
                            }
                        ),
                    )
                    chunk = ChatGenerationChunk(message=message_chunk)
                    yield chunk

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
        response = self.client.models.list()
        models = [model.id for model in response.data]
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
            if message.content == "":
                continue
            if isinstance(message, AIMessage) or isinstance(message, ToolMessage):
                prompt_text.append(
                    {
                        "role": "assistant",
                        "content": message.content,
                    }
                )
            elif isinstance(message, SystemMessage):
                prompt_text.append(
                    {
                        "role": "system",
                        "content": message.content,
                    }
                )
            elif isinstance(message, HumanMessage):
                prompt_text.append(
                    {
                        "role": "user",
                        "content": message.content,
                    }
                )
        return prompt_text

    @property
    def _llm_type(self) -> str:
        return "OpenAI Completion"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

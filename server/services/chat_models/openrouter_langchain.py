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
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import Field
from config.config import config
from openrouter import OpenRouter
from utils.log import output_log

from collections.abc import Sequence
from typing import Callable, Literal, Union
from langchain_core.tools import BaseTool
from langchain_core.runnables import Runnable
from langchain_core.language_models import LanguageModelInput

import ast


class CustomOpenRouterCompletion(BaseChatModel):
    model_name: str = Field(alias="model")
    reasoning_effect: str = Field(default="not a reasoning model")
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = config.output_max_length
    api_key: str
    client: Optional[OpenRouter] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.client = OpenRouter(
            api_key=self.api_key,
        )

    def _openrouter_prepare(
        self, prompt: List[BaseMessage], streaming: bool, **kwargs: Any
    ) -> Dict[str, Any]:
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        request_params = {
            "model": self.model_name,
            "messages": prompt_translated,
            "stream": streaming,
        }
        if self.reasoning_effect != "not a reasoning model":
            request_params["reasoning"] = {
                "effort": self.reasoning_effect
            }
        tools = kwargs.get("tools")
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
        return request_params

    def _generate(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        request_params = self._openrouter_prepare(prompt, streaming=False, **kwargs)
        responses = self.client.chat.send(**request_params)
        generate_message = None
        for choice in responses.choices:
            if choice.finish_reason == "stop":
                generate_message = AIMessage(
                    content_blocks=[
                        {
                            "type": "text",
                            "text": choice.message.content,
                        }
                    ]
                )
            elif (
                choice.finish_reason == "tool_calls"
                or choice.finish_reason == "function_call"
            ):
                if choice.finish_reason == "function_call":
                    generate_message = AIMessage(
                        content_blocks=[
                            {
                                "type": "tool_call",
                                "name": choice.message.function_call[0].function.name,
                                "args": ast.literal_eval(
                                    choice.message.function_call[0].function.arguments
                                ),
                                "id": choice.message.function_call[0].id,
                            }
                        ]
                    )
                else:
                    generate_message = AIMessage(
                        content_blocks=[
                            {
                                "type": "tool_call",
                                "name": choice.message.tool_calls[0].name,
                                "args": ast.literal_eval(
                                    choice.message.tool_calls[0].function.arguments
                                ),
                                "id": choice.message.tool_calls[0].id,
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
        request_params = self._openrouter_prepare(prompt, streaming=True, **kwargs)
        stream = self.client.chat.send(**request_params)
        tool_calls_name = ""
        tool_calls_args = ""
        tool_calls_id = ""
        for event in stream:
            output_log(f"Received event: {event}", "debug")
            choice = event.choices[0]
            token = choice.delta
            if getattr(token, "tool_calls", None):
                tool_call = token.tool_calls[0]
                if tool_call.id:
                    tool_calls_id = tool_call.id
                if tool_call.function.name:
                    tool_calls_name = tool_call.function.name
                if tool_call.function.arguments:
                    tool_calls_args += tool_call.function.arguments
            if choice.finish_reason == "tool_calls":
                message_chunk = AIMessageChunk(
                    content_blocks=[
                        {
                            "type": "tool_call",
                            "name": tool_calls_name,
                            "args": ast.literal_eval(tool_calls_args),
                            "id": tool_calls_id,
                        }
                    ]
                )
                yield ChatGenerationChunk(message=message_chunk)
                tool_calls_id = ""
                tool_calls_name = ""
                tool_calls_args = ""
            elif choice.finish_reason is None:
                if getattr(token, "reasoning_content", None) and token.reasoning_content != "":
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "reasoning",
                                "reasoning": token.reasoning_content,
                                "extras": {},
                            }
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
                elif getattr(token, "reasoning", None) and token.reasoning != "":
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "reasoning",
                                "reasoning": token.reasoning,
                                "extras": {},
                            }
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
                elif getattr(token, "content", None):
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "text",
                                "text": token.content,
                                "extras": {},
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
            if isinstance(message, AIMessage):
                for m in message.content_blocks:
                    if m["type"] == "tool_call":
                        prompt_text.append(
                            {
                                "role": "assistant",
                                "tool_calls": [{
                                    "id": m["id"],
                                    "type": "function",
                                    "function": {
                                        "name": m["name"],
                                        "arguments": str(m["args"]),
                                    },
                                }]
                            }
                        )
                    elif m["type"] == "reasoning":
                        prompt_text.append(
                            {
                                "role": "assistant",
                                "content": m["reasoning"],
                            }
                        )
                    elif m["type"] == "text":
                        prompt_text.append(
                            {
                                "role": "assistant",
                                "content": m["text"],
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
                if (
                    message.content_blocks
                    and message.content_blocks[0]["type"] == "image"
                ):
                    prompt_text.append(
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{m['mime_type']};base64,{m['base64'].decode('utf-8')}",
                                        "detail": "auto",
                                    },
                                }
                                for m in message.content_blocks
                            ],
                        },
                    )
                else:
                    prompt_text.append(
                        {
                            "role": "user",
                            "content": message.content,
                        }
                    )
            elif isinstance(message, ToolMessage):
                prompt_text.append(
                    {
                        "role": "tool",
                        "content": str(message.content),
                        "tool_call_id": message.tool_call_id,
                    }
                )
        return prompt_text

    @property
    def _llm_type(self) -> str:
        return f"{self.model_name} Powered by OpenRouter"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

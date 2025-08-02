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
from langchain_core.messages.ai import UsageMetadata
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

import time


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

    def _generate(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        output_log(f"Chat completion request: {prompt}", "debug")
        now = time.time()
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        request_params = {
            "model": self.model_name,
            "input": prompt_translated,
            "stream": False,
        }
        if self.reasoning_effect != "not a reasoning model":
            request_params["reasoning"] = {
                "effort": self.reasoning_effect,
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
        if tool_choice:
            request_params["tool_choice"] = tool_choice
        responses = self.client.responses.create(**request_params)
        additional_kwargs = {}
        message_content = ""
        for response in responses.output:
            if response.type == "message":
                message_content = response.content[0].text
            elif response.type == "function_call":
                additional_kwargs = {
                    "tool_calls": [
                        {
                            "id": response.call_id,
                            "function": {
                                "name": response.name,
                                "arguments": response.arguments,
                            },
                            "type": response.type,
                        }
                    ]
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
        generation = ChatGeneration(message=generate_message)
        return ChatResult(generations=[generation])

    def _stream(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        output_log(f"Streaming chat completion request: {prompt}", "debug")
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt for streaming: {prompt_translated}", "debug")
        request_params = {
            "model": self.model_name,
            "input": prompt_translated,
            "stream": True,
        }
        if self.reasoning_effect != "not a reasoning model":
            request_params["reasoning"] = {
                "effort": self.reasoning_effect,
                "summary": "auto"
            }
        tools = kwargs.get("tools")
        tool_choice = kwargs.get("tool_choice")
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
        if tool_choice:
            request_params["tool_choice"] = tool_choice

        stream = self.client.responses.create(**request_params)
        token_count = len(prompt)
        for event in stream:
            output_log(f"Received event: {event}", "debug")
            if event.type == "response.output_text.delta":
                token = event.delta
                if token:
                    token_count += 1
                    message_chunk = AIMessageChunk(
                        content=token,
                        additional_kwargs={},
                        usage_metadata=UsageMetadata(
                            {
                                "input_tokens": len(prompt),
                                "output_tokens": len(token),
                                "total_tokens": token_count,
                            }
                        ),
                    )
                    chunk = ChatGenerationChunk(message=message_chunk)
                    if run_manager:
                        run_manager.on_llm_new_token(token, chunk=chunk)
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
                msg_dict = {
                    "role": "assistant",
                    "content": message.content,
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
                if isinstance(message.content, str) and message.content.startswith(
                    "data:image"
                ):
                    prompt_messages.append(
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_image",
                                    "image_url": message.content,
                                }
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
                        "role": "assistant",
                        "content": message.content,
                    }
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

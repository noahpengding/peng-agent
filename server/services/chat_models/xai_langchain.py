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
from xai_sdk import Client
from xai_sdk.chat import image, user, system, tool, tool_result, assistant
from xai_sdk.tools import get_tool_call_type
from utils.log import output_log

from collections.abc import Sequence
from typing import Any, Callable, Dict, Literal, Optional, Union, List, Iterator
from langchain_core.tools import BaseTool
from langchain_core.runnables import Runnable
from langchain_core.language_models import LanguageModelInput

import ast


class CustomXAIResponse(BaseChatModel):
    model_name: str = Field(alias="model")
    reasoning_effect: str = Field(default="not a reasoning model")
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = config.output_max_length
    api_key: str
    client: Optional[Client] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.client = Client(
            api_key=self.api_key,
        )

    def _xai_prepare(
        self, prompt: List[BaseMessage], **kwargs
    ) -> Dict[str, Any]:
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        request_params = {
            "model": self.model_name,
            "messages": prompt_translated,
        }
        if self.reasoning_effect != "not a reasoning model" and self.reasoning_effect != "medium":
            request_params["reasoning_effort"] = self.reasoning_effect
        tools = kwargs.get("tools")
        if tools:
            request_params["tools"] = []
            for tool_sample in tools:
                request_params["tools"].append(tool(
                    name=tool_sample.get("function", {}).get("name"),
                    description=tool_sample.get("function", {}).get("description"),
                    parameters=tool_sample.get("function", {}).get("parameters", {}),
                ))

        return request_params

    def _generate(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        request_params = self._xai_prepare(prompt, **kwargs)
        chat = self.client.chat.create(**request_params)
        responses = chat.sample()
        generate_message = None
        if get_tool_call_type(responses) == "client_side_tool":
            generate_message = AIMessage(
                content_blocks=[
                    {
                        "type": "tool_call",
                        "name": responses.function.name,
                        "args": ast.literal_eval(responses.function.arguments),
                        "id": responses.id,
                    }
                ]
            )
        else:
            generate_message = AIMessage(
                content_blocks=[
                    {
                        "type": "text",
                        "text": responses.content,
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
        request_params = self._xai_prepare(prompt, **kwargs)
        chat = self.client.chat.create(**request_params)
        for _, chunk in chat.stream():
            for tool_call in chunk.tool_calls:
                if get_tool_call_type(tool_call) == "client_side_tool":
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "tool_call",
                                "name": tool_call.function.name,
                                "args": ast.literal_eval(tool_call.function.arguments),
                                "id": tool_call.id,
                            }
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
            token = chunk.content
            if token:
                message_chunk = AIMessageChunk(
                    content_blocks=[
                        {
                            "type": "text",
                            "text": token,
                        }
                    ]
                )
                yield ChatGenerationChunk(message=message_chunk)
        

    def bind_tools(
        self,
        tools: Sequence[Union[dict[str, Any], type, Callable, BaseTool]],
        *,
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
                        msg_dict = assistant(f"Tool call: {m['name']} with args {m['args']}")
                    elif m["type"] == "text":
                        msg_dict = assistant(m["text"])
                    elif m["type"] == "reasoning":
                        msg_dict = assistant(m["reasoning"])
                prompt_messages.append(msg_dict)
            elif isinstance(message, SystemMessage):
                prompt_messages.append(system(message.content))
            elif isinstance(message, HumanMessage):
                if (
                    message.content_blocks
                    and message.content_blocks[0]["type"] == "image"
                ):
                    m = message.content_blocks[0]
                    prompt_messages.append(
                        user(
                            "Read the Image below:",
                            image(f"data:{m['mime_type']};base64,{m['base64'].decode('utf-8')}"),
                        )
                    )
                else:
                    prompt_messages.append(user(message.content))
            elif isinstance(message, ToolMessage):
                prompt_messages.append(tool_result(str(message.content)))
        return prompt_messages

    @property
    def _llm_type(self) -> str:
        return "xAI Response"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

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
    BaseMessage,
    ToolMessage,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import Field
from config.config import config
from google import genai
from google.genai import types
from utils.log import output_log

from collections.abc import Sequence
from typing import Callable, Literal, Union
from langchain_core.tools import BaseTool
from langchain_core.runnables import Runnable
from langchain_core.language_models import LanguageModelInput

import ast
import json
import uuid


class CustomGemini(BaseChatModel):
    model_name: str = Field(alias="model")
    # In fact Gemini used thinking budget; Will Work on that with #74
    reasoning_effect: str = Field(default="not a reasoning model")
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = config.output_max_length
    api_key: str
    client: Optional[genai.Client] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.client = genai.Client(
            api_key=self.api_key,
            http_options=types.HttpOptions(api_version="v1alpha"),
        )

    def _gemini_prepare(self, prompt: List[BaseMessage], **kwargs: Any):
        output_log(f"Chat completion request: {prompt}", "debug")
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        request_params = {
            "max_output_tokens": self.max_tokens,
            "temperature": self.temperature,
        }
        if self.reasoning_effect != "not a reasoning model":
            request_params["config"] = types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_level=self.reasoning_effect)
            )
        tools = kwargs.get("tools")
        if tools:
            request_params["tools"] = []
            for tool in tools:
                request_params["tools"].append(
                    {
                        "name": tool.get("function", {}).get("name"),
                        "description": tool.get("function", {}).get("description"),
                        "parameters": tool.get("function", {}).get("parameters", {}),
                    }
                )
            request_params["tools"] = [
                types.Tool(function_declarations=request_params["tools"])
            ]

        return prompt_translated, request_params

    def _generate(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        prompt_translated, request_params = self._gemini_prepare(prompt, **kwargs)
        responses = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt_translated,
            config=types.GenerateContentConfig(**request_params),
        )
        generate_message = None
        if responses.candidates[0].content.parts[0].function_call:
            function_call = responses.candidates[0].content.parts[0].function_call
            function_call.id = f"function_call_{uuid.uuid4()}"
            generate_message = AIMessage(
                content_blocks=[
                    {
                        "type": "tool_call",
                        "name": function_call.name,
                        "args": ast.literal_eval(json.dumps(function_call.args)),
                        "id": function_call.id,
                    }
                ]
            )
        else:
            generate_message = AIMessage(
                content_blocks=[
                    {
                        "type": "text",
                        "text": responses.candidates[0].content.parts[0].text,
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
        prompt_translated, request_params = self._gemini_prepare(prompt, **kwargs)
        stream = self.client.models.generate_content_stream(
            model=self.model_name,
            contents=prompt_translated,
            config=types.GenerateContentConfig(**request_params),
        )
        for event in stream:
            output_log(f"Received event: {event}", "debug")
            if event.candidates is None:
                continue
            token = event.candidates[0]
            if token.finish_reason is None or token.finish_reason == "STOP":
                part = token.content.parts[0]
                if getattr(part, "function_call", None):
                    fc = part.function_call
                    fc.id = f"function_call_{uuid.uuid4()}"
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "tool_call",
                                "name": fc.name,
                                "args": ast.literal_eval(json.dumps(fc.args)),
                                "id": fc.id,
                                "extras": {
                                    "thought_signature": part.thought_signature
                                }
                            }
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
                elif getattr(part, "thought", None):
                    message_chunk = AIMessageChunk(
                        content_blocks=[
                            {
                                "type": "reasoning",
                                "reasoning": part.thought,
                                "extras": {
                                    "thought_signature": part.thought_signature
                                },
                            }
                        ]
                    )
                    yield ChatGenerationChunk(message=message_chunk)
                elif getattr(part, "text", None):
                    try:
                        message_chunk = AIMessageChunk(
                            content_blocks=[
                                {
                                    "type": "text",
                                    "text": part.text,
                                }
                            ]
                        )
                        yield ChatGenerationChunk(message=message_chunk)
                    except Exception as e:
                        output_log(f"Error processing token: {e}", "debug")
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
        models = [model.name.split("/")[1] for model in self.client.models.list()]
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

    def _prompt_translate(self, prompt: List[BaseMessage]):
        prompt_text = []
        for message in prompt:
            if isinstance(message, SystemMessage):
                prompt_text.append(
                    types.Content(
                        role="model",
                        parts=[types.Part.from_text(text=message.content)],
                    )
                )
            elif isinstance(message, AIMessage):
                for m in message.content:
                    if m["type"] == "text":
                        prompt_text.append(
                            types.Content(
                                role="model",
                                parts=[types.Part.from_text(text=m["text"])],
                            )
                        )
                    elif m["type"] == "tool_call":
                        prompt_text.append(
                            types.Content(
                                role="model",
                                parts=[
                                    types.Part(
                                        function_call=types.FunctionCall(
                                            name=m["name"],
                                            args=ast.literal_eval(json.dumps(m["args"])),
                                        ),
                                        thought_signature=m["extras"]["thought_signature"],
                                    )
                                ],
                            )
                        )
                    elif m["type"] == "reasoning":
                        prompt_text.append(
                            types.Content(
                                role="model",
                                parts=[
                                    types.Part(
                                        thought=m["reasoning"],
                                        thought_signature=m["extras"]["thought_signature"],
                                    )
                                ],
                            )
                        )
            elif isinstance(message, HumanMessage):
                if (
                    message.content_blocks
                    and message.content_blocks[0]["type"] == "image"
                ):
                    prompt_text.append(
                        types.Content(
                            role="user",
                            parts=[
                                types.Part.from_bytes(
                                    data=m["base64"].decode("utf-8"),
                                    mime_type="image/png",
                                )
                                for m in message.content_blocks
                            ],
                        )
                    )
                else:
                    prompt_text.append(
                        types.Content(
                            role="user",
                            parts=[types.Part.from_text(text=message.content)],
                        )
                    )
            elif isinstance(message, ToolMessage):
                prompt_text.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=message.name,
                                response={"result": str(message.content)},
                            )
                        ],
                    )
                )
        return prompt_text

    @property
    def _llm_type(self) -> str:
        return "Google Gemini"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

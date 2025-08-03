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
from langchain_core.messages.ai import UsageMetadata
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

import time
import json


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
            "max_output_tokens": self.max_tokens,
            "temperature": self.temperature,
        }
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
        responses = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt_translated,
            config=types.GenerateContentConfig(**request_params),
        )
        additional_kwargs = {}
        message_content = ""
        if responses.candidates[0].content.parts[0].function_call:
            function_call = responses.candidates[0].content.parts[0].function_call
            import uuid

            function_call.id = f"function_call_{uuid.uuid4()}"
            additional_kwargs = {
                "tool_calls": [
                    {
                        "id": function_call.id,
                        "function": {
                            "name": function_call.name,
                            "arguments": json.dumps(function_call.args),
                        },
                        "type": "function",
                    }
                ]
            }
            message_content = [
                {
                    "id": function_call.id,
                    "name": function_call.name,
                    "args": function_call.args,
                }
            ]
        else:
            message_content = responses.candidates[0].content.parts[0].text
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
        output_log(f"Streaming chat completion request{prompt}", "debug")
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt for streaming{prompt_translated}", "debug")
        output_log(
            f"Requesting streaming response from model: {self.model_name}", "debug"
        )
        stream = self.client.models.generate_content_stream(
            model=self.model_name,
            contents=prompt_translated,
            config=types.GenerateContentConfig(
                max_output_tokens=self.max_tokens, temperature=self.temperature
            ),
        )
        token_count = len(prompt)
        for event in stream:
            output_log(f"Received event: {event}", "debug")
            token = event.text
            if token:
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
            if isinstance(message, SystemMessage) or isinstance(message, AIMessage):
                if isinstance(message.content, str):
                    prompt_text.append(
                        types.Content(
                            role="model",
                            parts=[types.Part.from_text(text=message.content)],
                        )
                    )
                else:
                    prompt_text.append(
                        types.Content(
                            role="model",
                            parts=[
                                types.Part.from_function_call(
                                    name=message.content[0]["name"],
                                    args=message.content[0]["args"],
                                )
                            ],
                        )
                    )
            elif isinstance(message, HumanMessage):
                prompt_text.append(
                    types.Content(
                        role="user", parts=[types.Part.from_text(text=message.content)]
                    )
                )
            elif isinstance(message, ToolMessage):
                prompt_text.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=message.name, response={"result": message.content}
                            )
                        ],
                    )
                )
        return prompt_text

    def embed_documents(self, query: List[str]) -> List[List[float]]:
        texts = list(map(lambda x: x.replace("\n", " "), query))
        embeddings = self.client.models.embed_content(
            model=self.model_name,
            contents=texts,
            config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY"),
        )
        if isinstance(embeddings, list):
            raise TypeError(
                "Expected embeddings to be a Tensor or a numpy array, "
                "got a list instead."
            )
        return embeddings.tolist()

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]

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

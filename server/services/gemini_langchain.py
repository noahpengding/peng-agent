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
)
from langchain_core.messages.ai import UsageMetadata
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from pydantic import Field
from config.config import config
from google import genai
from google.genai import types
from utils.log import output_log
import time


class CustomGemini(BaseChatModel):
    model_name: str = Field(alias="model")
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = config.output_max_length

    def _generate(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
    ) -> ChatResult:
        output_log(f"Chat completion request: {prompt}", "debug")
        now = time.time()
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        client = genai.Client(
            api_key=config.gemni_api_key,
            http_options=types.HttpOptions(api_version="v1alpha"),
        )
        responses = client.models.generate_content(
            model=self.model_name,
            contents=prompt_translated,
            config=types.GenerateContentConfig(
                max_output_tokens=self.max_tokens, temperature=self.temperature
            ),
        )
        message = responses.text
        generate_message = AIMessage(
            content=message,
            additional_kwargs={},
            response_metadata={
                "time_in_seconds": time.time() - now,
            },
            metadata={
                "input_tokens": len(prompt),
                "output_tokens": len(message),
                "total_tokens": len(prompt) + len(message),
            },
        )
        generation = ChatGeneration(message=generate_message)
        return ChatResult(generations=[generation])

    def _stream(
        self,
        prompt: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
    ) -> Iterator[ChatGenerationChunk]:
        output_log(f"Streaming chat completion request{prompt}", "debug")
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt for streaming{prompt_translated}", "debug")
        client = genai.Client(
            api_key=config.gemni_api_key,
            http_options=types.HttpOptions(api_version="v1alpha"),
        )
        output_log(
            f"Requesting streaming response from model: {self.model_name}", "debug"
        )
        stream = client.models.generate_content_stream(
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
                            "output_tokens": 1,
                            "total_tokens": token_count,
                        }
                    ),
                )
                chunk = ChatGenerationChunk(message=message_chunk)
                if run_manager:
                    run_manager.on_llm_new_token(token, chunk=chunk)
                yield chunk

    def list_models(self):
        client = genai.Client(
            api_key=config.gemni_api_key,
            http_options=types.HttpOptions(api_version="v1alpha"),
        )
        models = [model.name.split("/")[1] for model in client.models.list()]
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
            if isinstance(message, SystemMessage) or isinstance(message, AIMessage):
                prompt_text.append(
                    types.Content(
                        role="model", parts=[types.Part.from_text(text=message.content)]
                    )
                )
            elif isinstance(message, HumanMessage):
                prompt_text.append(
                    types.Content(
                        role="user", parts=[types.Part.from_text(text=message.content)]
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

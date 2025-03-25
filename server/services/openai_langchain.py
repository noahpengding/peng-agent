from typing import Any, Dict, List, Optional

from langchain_core.callbacks import (
    CallbackManagerForLLMRun,
)
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    SystemMessage,
    HumanMessage,
    BaseMessage,
)
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field
from config.config import config
from openai import OpenAI
from utils.log import output_log
import re
import time


class CustomOpenAI(BaseChatModel):
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
        client = OpenAI(
            api_key=config.openai_api_key,
            organization=config.openai_organization_id,
            project=config.openai_project_id,
        )
        prompt_translated = self._prompt_translate(prompt)
        output_log(f"Translated prompt: {prompt_translated}", "debug")
        responses = client.responses.create(
            model=self.model_name,
            input=prompt_translated,
            max_output_tokens=self.max_tokens,
        )
        for response in responses.output:
            if re.match(r"^msg_", response.id):
                message = response.content[0].text
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

    def _prompt_translate(self, prompt: List[BaseMessage]) -> str:
        prompt_text = []
        for message in prompt:
            if isinstance(message, AIMessage):
                prompt_text.append(
                    {
                        "role": "assistant",
                        "content": [{"type": "input_text", "text": message.content}],
                    }
                )
            elif isinstance(message, SystemMessage):
                prompt_text.append(
                    {
                        "role": "system",
                        "content": [{"type": "input_text", "text": message.content}],
                    }
                )
            elif isinstance(message, HumanMessage):
                prompt_text.append(
                    {
                        "role": "user",
                        "content": [{"type": "input_text", "text": message.content}],
                    }
                )
        return prompt_text

    @property
    def _llm_type(self) -> str:
        return "echoing-chat-model-advanced"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
        }

from handlers.operator_handlers import get_operator
from handlers.model_handlers import get_reasoning_effect
from utils.log import output_log
from config.config import config
import os


def get_model_instance(model_name: str = "", operator_name: str = None):
    real_model_name = model_name
    if operator_name is None:
        if "/" in model_name:
            operator_name, real_model_name = model_name.split("/", 1)
        else:
            output_log(
                f"Operator not provided and not found in model name: {model_name}",
                "error",
            )
            return None

    if "/" not in model_name and operator_name:
        full_model_name = f"{operator_name}/{model_name}"
    else:
        full_model_name = model_name

    operator = get_operator(operator_name)
    base_model_ins = None
    if operator is None:
        output_log(
            f"Operator {operator_name} not found in the database.",
            "error",
        )
        return None
    if operator.runtime == "openai_response":
        from services.chat_models.openai_response import CustomOpenAIResponse

        base_model_ins = CustomOpenAIResponse(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            organization_id=operator.org_id,
            project_id=operator.project_id,
            model=real_model_name,
            reasoning_effect=get_reasoning_effect(full_model_name),
        )
    elif operator.runtime == "openai_completion":
        from services.chat_models.openai_completion import CustomOpenAICompletion

        base_model_ins = CustomOpenAICompletion(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            organization_id=operator.org_id,
            project_id=operator.project_id,
            model=real_model_name,
            reasoning_effect=get_reasoning_effect(full_model_name),
        )
    elif operator.runtime == "gemini":
        from services.chat_models.gemini_langchain import CustomGemini

        base_model_ins = CustomGemini(
            api_key=operator.api_key,
            model=real_model_name,
            reasoning_effect=get_reasoning_effect(full_model_name),
        )
    elif operator.runtime == "claude":
        from services.chat_models.claude_langchain import CustomClaude

        base_model_ins = CustomClaude(
            api_key=operator.api_key,
            model=real_model_name,
            reasoning_effect=get_reasoning_effect(full_model_name),
        )
    elif operator.runtime == "xai":
        from services.chat_models.xai_langchain import CustomXAIResponse

        base_model_ins = CustomXAIResponse(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            model=real_model_name,
            reasoning_effect=get_reasoning_effect(full_model_name),
        )
    elif operator.runtime == "openrouter":
        from services.chat_models.openrouter_langchain import CustomOpenRouterCompletion

        base_model_ins = CustomOpenRouterCompletion(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            model=real_model_name,
            reasoning_effect=get_reasoning_effect(full_model_name),
        )
    elif operator.runtime == "huggingface":
        from langchain_huggingface import ChatHuggingFace, HuggingFacePipeline

        os.environ["HUGGINGFACEHUB_API_TOKEN"] = operator.api_key
        llm = HuggingFacePipeline.from_model_id(
            model_id=real_model_name,
            task="text-generation",
            trust_remote_code=True,
            pipeline_kwargs=dict(
                max_new_tokens=config.output_max_length,
                do_sample=False,
            ),
            model_kwargs=dict(
                temperature=1.0,
                max_length=config.output_max_length,
                trust_remote_code=True,
            ),
        )
        base_model_ins = ChatHuggingFace(llm=llm)
    return base_model_ins


def get_embedding_instance(model_name: str = "", operator_name: str = None):
    real_model_name = model_name

    operator = get_operator(operator_name)
    embedding_model_ins = None
    if operator.runtime == "openai_response":
        from langchain_openai import OpenAIEmbeddings

        embedding_model_ins = OpenAIEmbeddings(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            model=real_model_name,
        )

    return embedding_model_ins

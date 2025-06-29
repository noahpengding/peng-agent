from handlers.operator_handlers import get_operator
from utils.log import output_log
from config.config import config
import os
import pickle


def get_model_instance_by_operator(operator_name, model_name: str = ""):
    operator = get_operator(operator_name)
    if operator is None:
        output_log(
            f"Operator {operator_name} not found in the database.",
            "error",
        )
        return None
    if operator.runtime == "openai_response":
        from services.openai_response import CustomOpenAIResponse

        base_model_ins = CustomOpenAIResponse(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            organization_id=operator.org_id,
            project_id=operator.project_id,
            model=model_name,
        )
    elif operator.runtime == "openai_completion":
        from services.openai_completion import CustomOpenAICompletion

        base_model_ins = CustomOpenAICompletion(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            organization_id=operator.org_id,
            project_id=operator.project_id,
            model=model_name,
        )
    elif operator.runtime == "gemini":
        from services.gemini_langchain import CustomGemini

        base_model_ins = CustomGemini(
            api_key=operator.api_key,
            model=model_name,
        )
    elif operator.runtime == "claude":
        from services.claude_langchain import CustomClaude

        base_model_ins = CustomClaude(
            api_key=operator.api_key,
            model=model_name,
        )
    elif operator.runtime == "huggingface":
        from langchain_huggingface import ChatHuggingFace, HuggingFacePipeline

        os.environ["HUGGINGFACEHUB_API_TOKEN"] = operator.api_key
        llm = HuggingFacePipeline.from_model_id(
            model_id=model_name,
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


def get_embedding_instance_by_operator(operator_name, model_name: str = ""):
    operator = get_operator(operator_name)
    if operator is None:
        output_log(
            f"Operator {operator_name} not found in the database.",
            "error",
        )
        return None
    if operator.runtime == "huggingface":
        from langchain_huggingface import HuggingFaceEmbeddings

        if os.path.exists(
            f"{config.huggingface_cache_dir}/{model_name.split('/')[-1]}.pickle"
        ):
            pickle_file = open(
                f"{config.huggingface_cache_dir}/{model_name.split('/')[-1]}.pickle",
                "rb",
            )
            embedding_model_ins = pickle.load(pickle_file)
            pickle_file.close()
        else:
            encode_kwargs = {"normalize_embeddings": False}
            embedding_model_ins = HuggingFaceEmbeddings(
                cache_folder=config.huggingface_cache_dir,
                model_name=model_name,
                encode_kwargs=encode_kwargs,
            )
            pickle_file = open(
                f"{config.huggingface_cache_dir}/{model_name.split('/')[-1]}.pickle",
                "wb",
            )
            pickle.dump(embedding_model_ins, pickle_file)
            pickle_file.close()
    elif operator.runtime == "openai_response":
        from langchain_openai import OpenAIEmbeddings

        embedding_model_ins = OpenAIEmbeddings(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            model=model_name,
        )
    elif operator.runtime == "gemini":
        from langchain_gemini import GeminiEmbeddings

        embedding_model_ins = GeminiEmbeddings(
            api_key=operator.api_key,
            model=model_name,
        )
    return embedding_model_ins

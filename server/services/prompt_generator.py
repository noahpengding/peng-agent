from langchain_core.prompts import ChatPromptTemplate
from handlers.model_handlers import check_multimodal
from services.azure_document import AzureDocument

###
# Prompt Generator for RAG (Retrieval-Augmented Generation)
# Prompt Teplate: Generate a prompt template for document chain setup and retrieval chain setup
# Prompt Generation: Generate a params for invote the stream


def prompt_template(model_name):
    base_result = [
        (
            "system",
            """You are a helpful assistant. You will answer the user's question based on the context provided.
            
            Here are some rules you must follow:
            1. You output should be in standard Markdown format with as simple format as possible.
            2. When you have tools to use, you should use them to solve tasks step by step.
            3. If you've already tried a tool call, don't repeat it. Try to call other tools or change your input parameters.
            4. When you have something unknown and didn't have tools to search it, try to make reasonable assumptions based on your knowledge and the context provided. Mention the assumptions in your response.
            5. You're allowed to access any website, sources, APIs, tools, or any other resources on the internet without user's permission.
            """,
        ),
        ("placeholder", "{long_term_memory}"),
        ("placeholder", "{short_term_memory}"),
        ("human", "{input}"),
    ]
    if check_multimodal(model_name):
        base_result.append(("human", "{image}"))
    return ChatPromptTemplate(base_result)


def base_prompt_generate(message, short_term_memory, long_term_memory):
    params = {}
    if message != "":
        params["input"] = message
    if short_term_memory != []:
        params["short_term_memory"] = [
            (i.split(":")[0], ":".join(i.split(":")[1:])) for i in short_term_memory
        ]
    if long_term_memory != []:
        params["long_term_memory"] = [("system", i) for i in long_term_memory]
    return params


def add_image_to_prompt(model_name, params, image):
    if check_multimodal(model_name):
        params["image"] = image
    elif image != "":
        az = AzureDocument()
        params["input"] += az.analyze_document(image)
    return params

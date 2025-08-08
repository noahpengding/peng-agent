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
            '''You are a helpful assistant. 
            IMPORTANT: You output should be in standard Markdown format with as simple format as possible.

            When you have tools to use, you should use them to solve tasks step by step.

            IMPORTANT: Do not call the same tool with the same parameters more than once.
            - Keep track of which tools you've already used and with what inputs
            - If you've already tried a tool call, don't repeat it
            - When you have sufficient information, provide your final answer

            When you have something unknown and didn't have tools to search it, ask the user for more clarification.
            ''',
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

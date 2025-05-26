from langchain_core.prompts import ChatPromptTemplate
from handlers.model_handlers import check_multimodal
from services.azure_document import AzureDocument
from utils.log import output_log
from config.config import config

###
# Prompt Generator for RAG (Retrieval-Augmented Generation)
# Prompt Teplate: Generate a prompt template for document chain setup and retrieval chain setup
# Prompt Generation: Generate a params for invote the stream


def prompt_template(model_name, has_document=False, has_websearch=False):
    base_result = [
        ("system", "You are a helpful assistant. You output should be in standard Markdown format with as simple format as possible."),
        ("placeholder", "{long_term_memory}"),
        ("placeholder", "{short_term_memory}"),
        ("human", "{input}"),
    ]
    if check_multimodal(model_name):
        base_result.append(("human", "{image}"))
    if has_document:
        base_result.insert(0, ("system", "Use following context to answer the question:"))
        base_result.insert(1, ("system", "{context}"))
    if has_websearch:
        base_result.insert(0, ("system", "Answer the question based on the context below:"))
        base_result.insert(1, ("system", "{websearch}"))
    return ChatPromptTemplate(base_result)

def base_prompt_generate(message, short_term_memory, long_term_memory):
    params = {}
    if message != "":
        params["input"] = message
    if short_term_memory != []:
        params["short_term_memory"] = [
            ("system", i) for i in short_term_memory
        ]
    if long_term_memory != []:
        params["long_term_memory"] = [
            ("system", i) for i in long_term_memory
        ]
    return params

def add_image_to_prompt(model_name, params, image):
    if check_multimodal(model_name):
        params["image"] = image
    elif image != "":
        az = AzureDocument()
        params["input"] += az.analyze_document(image)
    return params


def add_websearch_to_prompt(params, query):
    from services.websearch import websearch_main
    from handlers.model_utils import get_model_instance_by_operator
    prompt = [
        ("system", '''
        You are a Search Query Optimizer. Your job is to take a user’s free-form query and split it into a small set of high-value keywords and key-phrases that maximize web-search relevance.
        Rules:
        1. Identify all noun phrases, named entities, numbers, dates, locations, and technical terms.
        2. Group related words into meaningful phrases (e.g. “Italian restaurant NYC”).
        3. Drop purely grammatical or filler words (a, the, of, for, etc.), unless essential to the meaning.
        4. Include standalone keywords when they add value.
        5. Do not include duplicates.
        6. Output ONLY a JSON array of strings. No extra text.
        Example:
        User query: “Find best Italian restaurants in New York under $50 with outdoor seating”
        Output:
        [
            "best Italian restaurants",
            "Italian restaurants New York",
            "Italian restaurants under $50",
            "outdoor seating"
        ]
        Now process the following user query and return a JSON array of search terms.
        '''),
        ("human", "User query:{query}"),
    ]
    openai = get_model_instance_by_operator(
        config.default_operator,
        config.default_base_model,
    )
    websearch_queries = openai.invoke(
        ChatPromptTemplate(prompt).invoke({"query": query})
    )
    params["websearch"] = ""
    import ast
    try:
        websearch_queries = ast.literal_eval(websearch_queries.content)
    except (SyntaxError, ValueError):
        websearch_queries = []
    if isinstance(websearch_queries, list):
        for query in websearch_queries:
            if query.strip() != "":
                params["websearch"] = websearch_main(query.strip())
        return params

def add_document_to_prompt(params, query, collection_name="default"):
    from services.rag_usage import RagUsage
    prompt = [
        ("system", '''
        You are a Document Retriever. Your job is to first retrieve relevant documents from a collection based on the user query.
        You will list a set of documents that are most relevant to the user query.
        Rules:
        1. Retrieve documents that are most relevant to the user query.
        2. Use the retrieved documents to create a detailed context for the user query.
        3. All information in the context must be based on the retrieved documents.
        4. Do not include any information that is not in the retrieved documents.
        5. Output a numbering list with only the detailed related context of each document realted to the user's query.
        Now process the following user query and return a list of retrieved documents.
        '''),
        ("human", "User query:{input}"),
        ("system", "{context}"),
    ]
    rag_usage = RagUsage(
        user_name="RAG Retriever",
        collection_name=collection_name,
    )
    params["context"] = ""
    context = rag_usage.invoke(
        ChatPromptTemplate(prompt),
        {"input": query},
    )
    output_log(f"RAG Usage context: {context.content}", "debug")
    if isinstance(context.content, str) and context.content.strip() != "":
        params["context"] = context.content.strip()
    return params
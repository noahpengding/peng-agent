from config.config import config
from langchain_core.tools import StructuredTool


def _rag_usage_tool(query: str, collection: str) -> str:
    from services.rag.rag_usage import RagUsage
    from langchain_core.prompts import ChatPromptTemplate

    prompt = [
        (
            "system",
            """
        You are a Document Retriever. Your job is to first retrieve relevant documents from a collection based on the user query.
        You will list a set of documents that are most relevant to the user query.
        Rules:
        1. Retrieve documents that are most relevant to the user query.
        2. Use the retrieved documents to create a detailed context for the user query.
        3. All information in the context must be based on the retrieved documents.
        4. Do not include any information that is not in the retrieved documents.
        5. Output a numbering list with only the detailed related context of each document realted to the user's query.
        Now process the following user query and return a list of retrieved documents.
        """,
        ),
        ("human", "User query:{input}"),
        ("system", "{context}"),
    ]

    rag_usage = RagUsage(
        user_name="Tools",
        collection_name=collection,
    )
    context = rag_usage.invoke(
        ChatPromptTemplate(prompt),
        {"input": query},
    )
    return context.content.strip()


def get_all_collections() -> list:
    from services.rag.qdrant_api import Qdrant

    qdrant = Qdrant(
        host=config.qdrant_host,
        port=config.qdrant_port,
    )
    return qdrant.get_all_collections()


all_collections = get_all_collections()

rag_usage_tool = StructuredTool.from_function(
    func=_rag_usage_tool,
    name="documentation_retrieval_tool",
    description="Retrieves information from the specified collection of professional document in the system.",
    args_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The query to search in the collection.",
            },
            "collection": {
                "type": "string",
                "enum": all_collections,
                "description": "The collection to search in.",
            },
        },
        "required": ["query", "collection"],
    },
    return_direct=False,
)

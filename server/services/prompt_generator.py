from langchain_core.prompts import ChatPromptTemplate


def prompt_template():
    return ChatPromptTemplate(
        [
            ("placeholder", "{document}"),
            ("system", "{context}"),
            ("placeholder", "{long-term-memory}"),
            ("placeholder", "{short-term-memory}"),
            ("human", "{input}"),
        ]
    )

from langchain_core.prompts import ChatPromptTemplate


def prompt_template():
    return ChatPromptTemplate(
        [
            ("placeholder", "{document}"),
            ("system", "{context}"),
            ("placeholder", "{long_term_memory}"),
            ("placeholder", "{short_term_memory}"),
            ("human", "{input}"),
        ]
    )

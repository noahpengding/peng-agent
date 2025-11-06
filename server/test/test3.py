import os
os.environ["OPENAI_API_KEY"] = "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"

from langchain_openai import ChatOpenAI

model = ChatOpenAI(model_name="gpt-5-mini")

for chunk in model.stream(
    [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain what is reinforcement learning."},
    ]
):
    if chunk.content_blocks:
        content = chunk.content_blocks[0]
        print(content)
        if content["type"] == "text":
            print(content["text"], end="", flush=True)
        if content["type"] == "reasoning":
            print(f"\n[Reasoning]: {content['reasoning']}\n", flush=True)
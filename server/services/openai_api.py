from openai import OpenAI
from config.config import config
from utils.log import output_log
from utils.mysql_connect import MysqlConnect
from datetime import datetime, timedelta

class OpenAIHandler:
    def __init__(self, user_id = "admin"):
        self.user_id = user_id
        self.client = OpenAI(
            api_key=config.openai_api_key,
            organization=config.openai_organization_id, 
            project=config.openai_project_id)
        self.start_prompt = config.start_prompt
        self.model_id = "gpt-4o-mini"
        self.image_model_id = "dall-e-3"
        self.max_completion_tokens = 5000

    def list_models(self):
        response = self.client.models.list()
        models = [model.id for model in response.data]
        return "\n".join(models)
    
    def list_parameters(self):
        return f'''
        model_id: {self.model_id}
        image_model_id: {self.image_model_id}
        max_completion_tokens: {self.max_completion_tokens}
        '''
    
    def set_parameters(self, name, value) -> str:
        if name == "model_id" or name == "model":
            self.model_id = str(value)
            return f"Model set to {self.model_id}"
        elif name == "image_model_id" or name == "image_model":
            self.image_model_id = str(value)
            return f"Image model set to {self.image_model_id}"
        elif name == "max_completion_tokens":
            self.max_completion_tokens = int(value)
            return f"Max completion tokens set to {self.max_completion_tokens}"
        else:
            output_log(f"Invalid parameter: {name}", "error")
            return f"Invalid parameter: {name}, {value}"

    def chat_completion(self, prompt, messages):
        output_log(f"Chat completion request: {prompt}", "debug")
        response = self.client.chat.completions.create(
            model=self.model_id,
            messages=prompt,
            max_completion_tokens=self.max_completion_tokens,
        )
        generate_message = response.choices[0].message.content
        mysql = MysqlConnect()
        mysql.create_record(
            "chat",
            {
                "user_name": self.user_id,
                "base_model": self.model_id,
                "embedding_model": "openai",
                "human_input": messages,
                "ai_response": generate_message[:2048] if len(generate_message) > 2048 else generate_message,
                "knowledge_base": "openai",
                "created_at": datetime.now(),
                "expire_at": datetime.now() + timedelta(days=7)
            }
        )
        return generate_message.replace("\n\n", "\n")
    
    def image_generation(self, messages, size="1024x1024"):
        response = self.client.images.generate(
            model=self.image_model_id,
            prompt=messages,
            size=size,
            n=1
        )
        return response.data[0].url


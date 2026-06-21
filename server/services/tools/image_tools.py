from langchain_core.tools import StructuredTool
from config.config import config
from datetime import datetime
from utils.minio_connection import MinioStorage


def _image_generation_tool(prompt: str) -> str:
    image_model_operator = config.image_model_operator
    image_model = config.image_model
    if prompt is None or prompt.strip() == "":
        return "Error: Prompt for image generation cannot be empty."
    from handlers.model_utils import get_model_instance
    model_instance = get_model_instance(image_model, image_model_operator)
    image_response = model_instance.generate_image(prompt)
    if image_response is not None:
        image_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}.png"
        with open(f"{image_name}", "wb") as f:
            f.write(image_response)
        minio_storage = MinioStorage()
        upload = minio_storage.file_upload(image_name, f"generated_images/{image_name}", "image/png", bucket_name=config.s3_public_bucket)
        if upload:
            image_url = f"{config.webdav_public_url}/generated_images/{image_name}"
            return image_url
    return "Unsupported image model runtime or failed to generate image."

image_generation_tool = StructuredTool.from_function(
    func=_image_generation_tool, 
    name="image_generation_tool",
    description="Generate an image based on the given prompt. The tool will return the generated image in base64 format.",
    args_schema={
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": '''The prompt describing the image to be generated. 
                The prompt should first describe the size of the image (e.g., "size: 512x512"), followed by the content description for the image generation model. 
                The prompt should clearly descibe the theme, style, and elements to be included in the image. 
                For example: "size: 512x512, a futuristic cityscape at sunset with flying cars and neon lights in a cyberpunk style".''',
            },
        },
        "required": ["prompt"],
    },
    return_direct=True,
)

from utils.log import output_log

TEMP_RESPONSE = ""

def response_formatter_main(operator: str, response: str):
    global TEMP_RESPONSE
    output_log(f"Response from {operator}: {response} | Temp_respons: {TEMP_RESPONSE}", "DEBUG")
    response_format = response.replace("\n\n", "\n")
    response_format = response_format.replace("---\n", "")
    if TEMP_RESPONSE != "":
        response_format = TEMP_RESPONSE + response_format
        TEMP_RESPONSE = ""
    if operator == "openai" or operator == "grok" or operator == "deepseek" or operator == "nvidia":
        if response_format.strip().endswith("\\"):
            TEMP_RESPONSE = response_format.strip()
            response_format = ""
        response_format = response_format.replace("\\[", "\n$").replace("\\]", "$\n")
        response_format = response_format.replace("\\(", "$").replace("\\)", "$")
    output_log(f"After formatting response: {response_format}", "DEBUG")
    return response_format
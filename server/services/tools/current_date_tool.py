from datetime import datetime
from langchain.tools import StructuredTool


def get_current_date():
    """Returns the current date in YYYY-MM-DD format."""
    return datetime.now().strftime("%Y-%m-%d")


def get_current_day_of_week():
    """Returns the current day of the week."""
    return datetime.now().strftime("%A")


def get_current_month():
    """Returns the current month in YYYY-MM format."""
    return datetime.now().strftime("%Y-%m")


def get_current_year():
    """Returns the current year."""
    return datetime.now().strftime("%Y")


current_date_tool = StructuredTool.from_function(
    func=get_current_date,
    name="current_date_tool",
    description="Get the current date in YYYY-MM-DD format.",
    args_schema={"type": "object", "properties": {}, "required": []},
    return_direct=False,
)

current_day_of_week_tool = StructuredTool.from_function(
    func=get_current_day_of_week,
    name="current_day_of_week_tool",
    description="Get the current day of the week.",
    args_schema={"type": "object", "properties": {}, "required": []},
    return_direct=False,
)

current_month_tool = StructuredTool.from_function(
    func=get_current_month,
    name="current_month_tool",
    description="Get the current month in YYYY-MM format.",
    args_schema={"type": "object", "properties": {}, "required": []},
    return_direct=False,
)

current_year_tool = StructuredTool.from_function(
    func=get_current_year,
    name="current_year_tool",
    description="Get the current year.",
    args_schema={"type": "object", "properties": {}, "required": []},
    return_direct=False,
)

date_tools = [
    current_date_tool,
    current_day_of_week_tool,
    current_month_tool,
    current_year_tool,
]

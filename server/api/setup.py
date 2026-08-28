from models.db_models import Base, create_db_engine
from utils.log import output_log
from config.config import config
from services.redis_service import setup_redis_cache
from handlers.tool_handlers import update_tools
from typing import Optional
from ddtrace.llmobs import LLMObs, LLMObsSpan


def set_up():
    """Initialize database tables using SQLAlchemy ORM models"""
    try:
        output_log("Initiallizing", "info")
        engine = create_db_engine()
        output_log("Creating database tables...", "info")
        Base.metadata.create_all(engine)
        output_log("Database tables created successfully using SQLAlchemy", "info")
        setup_redis_cache()
        output_log("Redis cache setup completed", "info")
        
        from handlers.model_handlers import load_models_from_s3, refresh_models
        load_models_from_s3()
        refresh_models()
        output_log("Operators and models loaded from S3 to Redis", "info")
        
        update_tools()
        output_log("Initial tools loaded from S3 to Redis", "info")
    except Exception as e:
        output_log(f"Error creating database tables: {e}", "error")
        raise

    # datadog_setup()
    dd_setup()


def phoenix_setup():
    from phoenix.otel import register

    output_log("Setting up Phoenix APM integration...", "info")
    register(
        project_name=config.phoenix_project,
        endpoint=config.phoenix_endpoint,
        batch=True,
        set_global_tracer_provider=False,
        auto_instrument=True,
    )

def _mark_ips_in_span(span: LLMObsSpan) -> LLMObsSpan:
    import ipaddress
    import re

    OCTET = r"(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)"
    IP_CANDIDATE = re.compile(
        rf"""
        # IPv4
        (?P<ipv4>
            (?<![\w.:])
            (?:{OCTET}\.){{3}}{OCTET}
            (?![\w.])
        )
        |
        # IPv6 candidate; ipaddress performs final validation
        (?P<ipv6>
            (?<![\w:])
            (?=[0-9A-Fa-f:.]*:)
            (?:
                ::
                |
                (?:::|[0-9A-Fa-f])
                [0-9A-Fa-f:.]*
                (?:[0-9A-Fa-f]|::)
            )
            (?!\w)
        )
        """,
        re.VERBOSE,
    )
    def replace_ip(match: re.Match) -> str:
        ip = match.group(0)
        try:
            ipaddress.ip_address(ip)
            return "[REDACTED_IP]"
        except ValueError:
            return ip
    for message in span.input:
        message["content"] = IP_CANDIDATE.sub(replace_ip, message["content"])
    return span

def _datadog_span_process(span: LLMObsSpan) -> Optional[LLMObsSpan]:
    output_log(f"Filtering span: {span.get_tag('temp_chat')}", "debug")
    if span.get_tag("temp_chat") == "True":
        return None
    return _mark_ips_in_span(span)

def dd_setup():
    output_log("Setting up Datadog APM integration...", "info")

    LLMObs.enable(
        ml_app=config.app_name,
        api_key=config.dd_api_key,
        site=config.dd_site,
        service=config.dd_service,
        env=config.env,
        span_processor=_datadog_span_process
    )

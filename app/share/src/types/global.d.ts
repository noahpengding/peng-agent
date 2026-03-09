interface Window {
  RUNTIME_CONFIG?: {
    API_BASE_URL: string;
    DATADOG_APPLICATION_ID?: string;
    DATADOG_CLIENT_TOKEN?: string;
    DATADOG_SITE?: string;
    DATADOG_SERVICE?: string;
    DATADOG_ENV?: string;
    APP_VERSION?: string;
  };
  API_URL?: string;
}

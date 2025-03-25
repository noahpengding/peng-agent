from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import (
    AnalyzeDocumentRequest,
    DocumentAnalysisFeature,
    AnalyzeResult,
)
from config.config import config


class AzureDocument:
    def __init__(self):
        self.endpoint = config.azure_document_endpoint
        self.key = config.azure_document_key
        self.client = DocumentIntelligenceClient(
            endpoint=self.endpoint, credential=AzureKeyCredential(self.key)
        )

    def analyze_document(self, document: bytes) -> str:
        if len(document.split(",")) > 1:
            document = document.split(",")[1]

        poller = self.client.begin_analyze_document(
            model_id="prebuilt-layout",
            body=AnalyzeDocumentRequest(bytes_source=document),
            features=[DocumentAnalysisFeature.KEY_VALUE_PAIRS],
        )
        result: AnalyzeResult = poller.result()

        # Store text with layout information
        document_text = ""

        # Process tables if present to maintain tabular structure
        if result.tables:
            for table in result.tables:
                table_text = "\n"
                # Create a 2D grid for the table
                grid = [
                    ["" for _ in range(table.column_count)]
                    for _ in range(table.row_count)
                ]

                # Fill in the grid with cell content
                for cell in table.cells:
                    grid[cell.row_index][cell.column_index] = cell.content

                # Calculate column widths for proper alignment
                col_widths = [0] * table.column_count
                for i in range(table.row_count):
                    for j in range(table.column_count):
                        col_widths[j] = max(col_widths[j], len(grid[i][j]))

                # Format the table with proper spacing
                for row in grid:
                    table_text += (
                        " | ".join(
                            cell.ljust(col_widths[i]) for i, cell in enumerate(row)
                        )
                        + "\n"
                    )

                document_text += table_text + "\n"
        for page in result.pages:
            if page.lines:
                sorted_lines = sorted(
                    page.lines, key=lambda line: line.polygon[1] if line.polygon else 0
                )

                for line in sorted_lines:
                    if line.spans[0].length < 20:
                        continue
                    document_text += line.content + "\n"
        return document_text

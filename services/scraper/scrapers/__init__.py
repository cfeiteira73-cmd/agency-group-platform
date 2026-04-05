# scrapers package
from .idealista import fetch_idealista_properties
from .imovirtual import fetch_imovirtual_properties
from .remax import fetch_remax_properties
from .dre import fetch_dre_signals

__all__ = [
    "fetch_idealista_properties",
    "fetch_imovirtual_properties",
    "fetch_remax_properties",
    "fetch_dre_signals",
]

"""TaskGuard backend entrypoint.

Run with:  python run.py
Starts uvicorn bound to 127.0.0.1 only.
"""

from __future__ import annotations

import uvicorn

from app.config import API_HOST, API_PORT

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=API_HOST, port=API_PORT, reload=False)
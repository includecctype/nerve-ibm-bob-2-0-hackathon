import uvicorn

from gateway.config import app
from gateway.connect import socket_handlers  # noqa: F401
from gateway.storage import storage_handlers  # noqa: F401

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)  # nosec B104

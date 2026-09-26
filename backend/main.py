import uvicorn

import gateway.connect.socket_handlers  # noqa: F401
from gateway.config import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)  # nosec B104

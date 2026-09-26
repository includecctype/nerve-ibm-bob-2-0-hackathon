from gateway.config import sio


@sio.event
async def connect(sid, environ, auth):
    await sio.emit("connection_status", False, to=sid)


@sio.event
async def disconnect(sid):
    pass

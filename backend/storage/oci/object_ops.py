from __future__ import annotations

from dataclasses import dataclass

import oci

from storage.oci.oci_client import getBucket, getClient, getNamespace


@dataclass
class ObjectEntry:
    name: str
    size: int
    updated_at: str


@dataclass
class Listing:
    prefixes: list[str]
    objects: list[ObjectEntry]
    next_start_with: str | None


def listObjects(
    prefix: str,
    delimiter: str | None = None,
    limit: int = 500,
    start: str | None = None,
) -> Listing:
    """One page of a bucket listing, optionally folded by a delimiter."""
    response = getClient().list_objects(
        namespace_name=getNamespace(),
        bucket_name=getBucket(),
        prefix=prefix,
        delimiter=delimiter,
        limit=limit,
        start=start,
    )
    data = response.data
    objects = [
        ObjectEntry(name=obj.name, size=obj.size, updated_at=str(obj.time_created))
        for obj in (data.objects or [])
    ]
    return Listing(
        prefixes=list(data.prefixes or []),
        objects=objects,
        next_start_with=data.next_start_with,
    )


def getBytes(object_key: str) -> bytes:
    response = getClient().get_object(getNamespace(), getBucket(), object_key)
    content = response.data.content
    if isinstance(content, str):
        return content.encode("utf-8")
    return content


def getText(object_key: str) -> str:
    return getBytes(object_key).decode("utf-8", errors="replace")


def putBytes(object_key: str, content: bytes) -> None:
    getClient().put_object(getNamespace(), getBucket(), object_key, content)


def putText(object_key: str, content: str) -> None:
    putBytes(object_key, content.encode("utf-8"))


def deleteObject(object_key: str) -> None:
    getClient().delete_object(getNamespace(), getBucket(), object_key)


def objectSize(object_key: str) -> int:
    response = getClient().head_object(getNamespace(), getBucket(), object_key)
    return int(response.headers.get("content-length", 0))


def objectExists(object_key: str) -> bool:
    try:
        objectSize(object_key)
    except oci.exceptions.ServiceError as exc:
        if exc.status == 404:
            return False
        raise
    return True

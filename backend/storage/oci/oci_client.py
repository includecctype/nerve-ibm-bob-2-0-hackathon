from __future__ import annotations

import os
from functools import lru_cache

import oci

DEFAULT_CONFIG_FILE = os.path.expanduser("~/.oci/config")
DEFAULT_PROFILE = "DEFAULT"


class OciConfigError(RuntimeError):
    """Raised when the OCI settings required for object storage are missing."""


@lru_cache(maxsize=1)
def getNamespace() -> str:
    namespace = os.getenv("OCI_NAMESPACE", "").strip()
    if not namespace:
        raise OciConfigError("OCI_NAMESPACE is not set")
    return namespace


@lru_cache(maxsize=1)
def getBucket() -> str:
    bucket = os.getenv("OCI_BUCKET", "").strip()
    if not bucket:
        raise OciConfigError("OCI_BUCKET is not set")
    return bucket


@lru_cache(maxsize=1)
def getConfig() -> dict:
    """Read the OCI API-key config; lazily so imports never need credentials."""
    config_file = os.getenv("OCI_CONFIG_FILE", DEFAULT_CONFIG_FILE)
    profile = os.getenv("OCI_CONFIG_PROFILE", DEFAULT_PROFILE)
    try:
        return oci.config.from_file(file_location=config_file, profile_name=profile)
    except Exception as exc:
        raise OciConfigError(
            f"could not read OCI config ({config_file}, profile {profile}): {exc}"
        ) from exc


@lru_cache(maxsize=1)
def getClient() -> oci.object_storage.ObjectStorageClient:
    return oci.object_storage.ObjectStorageClient(getConfig())

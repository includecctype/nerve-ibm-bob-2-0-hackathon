from __future__ import annotations

import os
from functools import lru_cache

import oci


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
    """Build the OCI API-key config from environment variables.

    Resolved lazily so imports (and CI) never need credentials. The private key
    can be a mounted file (OCI_KEY_FILE) or supplied inline with escaped
    newlines (OCI_KEY_CONTENT).
    """
    values = {
        "tenancy": os.getenv("OCI_TENANCY", "").strip(),
        "user": os.getenv("OCI_USER", "").strip(),
        "fingerprint": os.getenv("OCI_FINGERPRINT", "").strip(),
        "region": os.getenv("OCI_REGION", "").strip(),
    }
    key_file = os.getenv("OCI_KEY_FILE", "").strip()
    key_content = os.getenv("OCI_KEY_CONTENT", "").strip()
    pass_phrase = os.getenv("OCI_PRIVATE_KEY_PASSPHRASE", "").strip()

    missing = [
        name
        for name, value in (
            ("OCI_TENANCY", values["tenancy"]),
            ("OCI_USER", values["user"]),
            ("OCI_FINGERPRINT", values["fingerprint"]),
            ("OCI_REGION", values["region"]),
        )
        if not value
    ]
    if not key_file and not key_content:
        missing.append("OCI_KEY_FILE or OCI_KEY_CONTENT")
    if missing:
        raise OciConfigError("missing OCI settings: " + ", ".join(missing))

    config = dict(values)
    if key_content:
        config["key_content"] = key_content.replace("\\n", "\n")
    else:
        config["key_file"] = key_file
    if pass_phrase:
        config["pass_phrase"] = pass_phrase
    return config


@lru_cache(maxsize=1)
def getClient() -> oci.object_storage.ObjectStorageClient:
    return oci.object_storage.ObjectStorageClient(getConfig())

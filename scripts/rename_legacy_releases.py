#!/usr/bin/env python3
"""Rename all known historical release titles without replacing tags.
Keep dev-build-N attached to the existing release so every previously shared
installation-package URL continues working. Never rebuild or delete assets.
Only update the explicit historical release IDs in legacy-releases.json.
"""
import json
import os
import re
from pathlib import Path
import subprocess
from versioning import version_for
repo = os.environ["GITHUB_REPOSITORY"]
rows = json.loads(Path(__file__).with_name("legacy-releases.json").read_text())
def gh(*args, missing=False):
    result = subprocess.run(["gh", "api", *args], capture_output=True, text=True)
    if result.returncode:
        if missing and "HTTP 404" in result.stderr:
            return None
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout) if result.stdout.strip() else None
for row in rows:
    n, rid, old = row["build"], row["release_id"], row["tag"]
    version = version_for(n)
    release = gh(f"repos/{repo}/releases/{rid}")
    if release["tag_name"] != old:
        raise RuntimeError(f"Unexpected legacy release tag {release['tag_name']} for {n}")
    title = f"SmartyNote {version} (build {n})"
    marker = f"Product version: **{version}** · Original GitHub build: **{n}**."
    body = release.get("body") or ""
    body = re.sub(r"^Product version: \*\*[^\n]+\n\nHistorical package retained unchanged;[^\n]+\n\n", "", body)
    if marker not in body:
        body = marker + "\n\nHistorical package retained unchanged; installed version text may still use its original numbering. The original release tag is kept for existing download links.\n\n" + body
    if release["name"] != title or (release.get("body") or "") != body:
        gh("-X", "PATCH", f"repos/{repo}/releases/{rid}", "-f", f"name={title}", "-f", f"body={body}")
    verified = gh(f"repos/{repo}/releases/{rid}")
    assert verified["name"] == title and verified["tag_name"] == old
    assert [a["id"] for a in verified["assets"]] == [a["id"] for a in release["assets"]]
    print(f"{old} -> {version}; original tag and package preserved", flush=True)
print(f"Verified {len(rows)} historical releases.", flush=True)

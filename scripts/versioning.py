#!/usr/bin/env python3
"""SmartyNote display versions; original workflow run numbers remain immutable."""
import argparse
import json
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
# build anchor, major, minor, initial patch. Bump the milestone explicitly
# when a new feature generation is approved; never rewrite existing anchors.
MILESTONES = [[1,0,0,1],[15,0,1,0],[33,0,2,0],[44,0,3,0],[48,0,4,0],[55,0,5,0],[57,0,6,0],[62,0,7,0],[68,0,8,0],[69,0,9,0]]
def version_for(build):
    if not isinstance(build, int) or build < 1:
        raise ValueError("Build number must be a positive integer")
    start, major, minor, initial = next(row for row in reversed(MILESTONES) if row[0] <= build)
    patch = initial + build - start
    if major > 99 or minor > 99 or patch > 999:
        raise ValueError("Version range exhausted; approve the next milestone")
    return f"{major:02d}.{minor:02d}.{patch:03d}"

def prepare(build):
    display = version_for(build)
    semver = ".".join(str(int(part)) for part in display.split("."))
    config = ROOT / "PluginConfig.json"
    data = json.loads(config.read_text())
    data["versionName"], data["versionCode"] = display, str(build)
    config.write_text(json.dumps(data, indent=2) + "\n")
    # npm requires unpadded SemVer, even though the product display is padded.
    for name in ("package.json", "package-lock.json"):
        path = ROOT / name
        data = json.loads(path.read_text())
        data["version"] = semver
        if name == "package-lock.json":
            data["packages"][""]["version"] = semver
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    (ROOT / "src/prettyBuild.ts").write_text(
        f"export const BUILD_LABEL='{display}';\nexport const ORIGINAL_BUILD={build};\n"
    )
    if os.environ.get("GITHUB_ENV"):
        with open(os.environ["GITHUB_ENV"], "a") as f:
            f.write(f"SMARTYNOTE_VERSION={display}\n")
    print(f"SmartyNote {display} (original build {build})")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("build", type=int)
    p.add_argument("--prepare", action="store_true")
    args = p.parse_args()
    assert [version_for(n) for n in (15,33,44,48,55,57,62,68,69,110)] == [
        "00.01.000","00.02.000","00.03.000","00.04.000","00.05.000",
        "00.06.000","00.07.000","00.08.000","00.09.000","00.09.041"]
    if args.prepare:
        prepare(args.build)
    else:
        print(version_for(args.build))

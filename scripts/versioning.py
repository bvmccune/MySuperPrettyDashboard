#!/usr/bin/env python3
"""SmartyNote display versions; original workflow run numbers remain immutable."""
import argparse
import json
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
# Build anchor, major, feature cycle, original build number. Device-installed
# builds close their cycle; the next build advances the feature number.
# The last three digits ALWAYS preserve the original GitHub build number.
MILESTONES = [[1,0,1,1],[16,0,2,16],[34,0,3,34],[45,0,4,45],[49,0,5,49],[56,0,6,56],[58,0,7,58],[63,0,8,63],[69,0,9,69]]
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
    assert [version_for(n) for n in (1,15,16,33,34,44,45,48,49,55,56,57,58,62,63,68,69,110,111,112)] == ["00.01.001","00.01.015","00.02.016","00.02.033","00.03.034","00.03.044","00.04.045","00.04.048","00.05.049","00.05.055","00.06.056","00.06.057","00.07.058","00.07.062","00.08.063","00.08.068","00.09.069","00.09.110","00.09.111","00.09.112"]
    if args.prepare:
        prepare(args.build)
    else:
        print(version_for(args.build))

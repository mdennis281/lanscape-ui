#!/usr/bin/env python3
"""
Tag and push a release for LANscape UI.

Stamps a date-based version (YYYY.MM.DD.HHMMSS), commits, tags, and pushes.
The tag format is  releases/<version>.

Usage: python scripts/tag_release.py
"""

import json
import subprocess
import sys
from pathlib import Path


def run_git(args: list[str]) -> None:
    """Run a git command and exit on failure."""
    result = subprocess.run(['git'] + args, check=False)
    if result.returncode != 0:
        print(f"Git command failed: git {' '.join(args)}")
        sys.exit(1)


def run_capture(args: list[str]) -> str:
    """Run a command and return stripped stdout."""
    result = subprocess.run(args, capture_output=True, text=True, check=True)
    return result.stdout.strip()


def main() -> None:
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    package_json_path = project_root / "package.json"

    if not package_json_path.exists():
        print(f"Error: package.json not found at {package_json_path}")
        sys.exit(1)

    # Stamp the version via the Node script
    print("Stamping version...")
    stamp_result = subprocess.run(
        ['node', str(script_dir / 'stamp-version.js')],
        cwd=str(project_root),
        check=False,
    )
    if stamp_result.returncode != 0:
        print("Error: stamp-version.js failed")
        sys.exit(1)

    # Read the stamped version
    with open(package_json_path, 'r', encoding='utf-8') as f:
        version = json.load(f)['version']

    tag = f"releases/{version}"
    print(f"Version: {version}")
    print(f"Tag:     {tag}")

    # Commit, tag, push
    run_git(['add', 'package.json'])
    run_git(['commit', '-m', f'Release {version}'])
    run_git(['tag', tag])
    run_git(['push', 'origin', 'HEAD'])
    run_git(['push', 'origin', tag])

    print(f"\nTagged and pushed {tag}")


if __name__ == '__main__':
    main()

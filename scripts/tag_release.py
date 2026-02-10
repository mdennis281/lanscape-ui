#!/usr/bin/env python3
"""
Tag and push a release for LANscape UI.

Usage: python scripts/tag_release.py <version>
Examples: 1.0.0, 1.0.0-beta.1, 1.0.0-alpha.2
"""

import json
import re
import subprocess
import sys
from pathlib import Path


def run_git(args: list[str]) -> None:
    """Run a git command and exit on failure."""
    result = subprocess.run(['git'] + args, check=False)
    if result.returncode != 0:
        print(f"Git command failed: git {' '.join(args)}")
        sys.exit(1)


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/tag_release.py <version>")
        print("Examples: 1.0.0, 1.0.0-beta.1, 1.0.0-alpha.2")
        sys.exit(1)

    version = sys.argv[1]

    # Determine if pre-release
    if re.search(r'-(alpha|beta|rc)', version):
        print(f"Pre-release version detected: {version}")
        tag = f"pre-releases/{version}"
    else:
        print(f"Release version detected: {version}")
        tag = f"releases/{version}"

    # Find package.json relative to script location
    script_dir = Path(__file__).parent
    package_json_path = script_dir.parent / "package.json"

    if not package_json_path.exists():
        print(f"Error: package.json not found at {package_json_path}")
        sys.exit(1)

    # Update package.json version
    print(f"Updating package.json version to {version}...")
    with open(package_json_path, 'r', encoding='utf-8') as f:
        package_data = json.load(f)

    package_data['version'] = version

    with open(package_json_path, 'w', encoding='utf-8') as f:
        json.dump(package_data, f, indent=2)
        f.write('\n')  # Trailing newline

    # Commit the version change
    run_git(['add', 'package.json'])
    run_git(['commit', '-m', f'Finalize version: {version}'])

    # Create and push tag
    run_git(['tag', tag])
    run_git(['push', 'origin', 'HEAD'])
    run_git(['push', 'origin', tag])

    print(f"\nTagged and pushed {tag}")
    print(f"\nVersion {version} will be built and released automatically.")


if __name__ == '__main__':
    main()

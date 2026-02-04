#!/bin/bash

set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
    echo "Usage: ./tag_release.sh <version>"
    echo "Examples: 1.0.0, 1.0.0-beta.1, 1.0.0-alpha.2"
    exit 1
fi

# NPM versioning: beta/alpha use -beta.X or -alpha.X suffix
if [[ "$VERSION" =~ -(alpha|beta|rc) ]]; then
    echo "Pre-release version detected: $VERSION"
    TAG="pre-releases/$VERSION"
else
    echo "Release version detected: $VERSION"
    TAG="releases/$VERSION"
fi

# Update package.json version
echo "Updating package.json version to $VERSION..."
npm version "$VERSION" --no-git-tag-version

# Commit the version change
git add package.json
git commit -m "Finalize version: $VERSION"

# Create and push tag
git tag "$TAG"
git push origin HEAD
git push origin "$TAG"

echo "Tagged and pushed $TAG"
echo ""
echo "Version $VERSION will be built and released automatically."

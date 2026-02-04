param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

# NPM versioning: beta/alpha use -beta.X or -alpha.X suffix
# e.g., 1.0.0-beta.1, 1.0.0-alpha.2, 1.0.0-rc.1
if ($Version -match "-(alpha|beta|rc)") {
    Write-Host "Pre-release version detected: $Version"
    $tag = "pre-releases/$Version"
} else {
    Write-Host "Release version detected: $Version"
    $tag = "releases/$Version"
}

# Update package.json version
Write-Host "Updating package.json version to $Version..."
$packageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 100 | Set-Content -Path "package.json" -Encoding UTF8

# Commit the version change
git add package.json
git commit -m "chore: bump version to $Version"

# Create and push tag
git tag $tag
git push origin HEAD
git push origin $tag

Write-Host "Tagged and pushed $tag"
Write-Host ""
Write-Host "Version $Version will be built and released automatically."

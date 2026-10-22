#!/usr/bin/env bash
# Replace the vendored PDF.js in lib/ with a given release.
#
#   scripts/update-pdfjs.sh <version> [sha256]
#
# The SHA-256 of the release zip is taken from KNOWN_SHA256 below, or from the
# second argument for a version not yet listed. Compare a new value against the
# "digest" GitHub shows for the asset before adding it here:
#   curl -s https://api.github.com/repos/mozilla/pdf.js/releases/tags/v<version> | grep digest
set -euo pipefail

declare -A KNOWN_SHA256=(
  [6.4.299]=f2245eb7ef3f674c872fe568a177bfec15874f5c034613e55d8e307f93ebd86d
)

version=${1:?usage: $0 <version> [sha256]}
expected=${2:-${KNOWN_SHA256[$version]:-}}
if [[ -z $expected ]]; then
  echo "No known SHA-256 for PDF.js $version; pass it as the second argument." >&2
  exit 1
fi

root=$(cd "$(dirname "$0")/.." && pwd)
lib=$root/lib
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

zip=$tmp/pdfjs.zip
url=https://github.com/mozilla/pdf.js/releases/download/v$version/pdfjs-$version-dist.zip
echo "Downloading $url"
curl -fsSL -o "$zip" "$url"

actual=$(sha256sum "$zip" | cut -d' ' -f1)
if [[ $actual != "$expected" ]]; then
  echo "SHA-256 mismatch: expected $expected, got $actual" >&2
  exit 1
fi

mkdir "$tmp/dist"
unzip -q "$zip" -d "$tmp/dist"
for f in build/pdf.mjs build/pdf.worker.mjs web/viewer.html web/viewer.mjs web/viewer.css; do
  [[ -f $tmp/dist/$f ]] || { echo "Release is missing $f" >&2; exit 1; }
done

# Not used by the extension: the sample PDF, the PDF.js debugger, source maps
# and the scripting sandbox with its QuickJS engine (scripting is disabled in
# lib/main.js)
rm -f "$tmp/dist/web/compressed.tracemonkey-pldi-09.pdf"
rm -f "$tmp/dist/web/debugger."* "$tmp/dist/build/pdf.sandbox."*
rm -f "$tmp/dist/web/wasm/quickjs-eval."*
find "$tmp/dist" -name '*.map' -delete

# lib/main.js and lib/pdf.css are ours and stay untouched
rm -rf "$lib/build" "$lib/web"
mv "$tmp/dist/build" "$tmp/dist/web" "$lib/"
cp "$tmp/dist/LICENSE" "$lib/LICENSE"
echo "$version" > "$lib/PDFJS_VERSION"

echo "PDF.js $version installed in lib/"

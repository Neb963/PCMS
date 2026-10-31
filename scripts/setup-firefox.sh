#!/usr/bin/env bash
set -euo pipefail
# A later Developer Edition qualifies against the packaged final 154.0 floor.
version='155.0b1'
root="${RUNNER_TEMP:-/tmp}/pcms-firefox"
mkdir -p "$root"
base="https://archive.mozilla.org/pub/devedition/releases/$version"
name="firefox-$version.tar.xz"
curl --fail --location --silent --show-error --retry 2 --connect-timeout 20 --max-time 180 "$base/linux-x86_64/en-US/$name" -o "$root/$name"
curl --fail --location --silent --show-error --connect-timeout 20 --max-time 60 "$base/SHA512SUMS" -o "$root/SHA512SUMS"
python3 - "$root" "$name" <<'PY'
import hashlib, pathlib, sys
root=pathlib.Path(sys.argv[1]);name=sys.argv[2]
rows=[line.split() for line in (root/'SHA512SUMS').read_text().splitlines()]
expected=[row[0] for row in rows if len(row)>=2 and row[-1]=='linux-x86_64/en-US/'+name]
assert len(expected)==1, 'Exact Mozilla checksum entry absent'
assert hashlib.sha512((root/name).read_bytes()).hexdigest()==expected[0], 'Firefox archive checksum mismatch'
PY
tar -xJf "$root/$name" -C "$root"
geo='geckodriver-v0.36.0-linux64.tar.gz'
curl --fail --location --silent --show-error --connect-timeout 20 --max-time 120 "https://github.com/mozilla/geckodriver/releases/download/v0.36.0/$geo" -o "$root/$geo"
tar -xzf "$root/$geo" -C "$root"
printf 'FIREFOX_BINARY=%s\nGECKODRIVER_BINARY=%s\n' "$root/firefox/firefox" "$root/geckodriver" >> "$GITHUB_ENV"
"$root/firefox/firefox" --version

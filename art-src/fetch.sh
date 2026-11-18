#!/bin/bash
# usage: fetch.sh urls.txt  -> downloads "<name>.png" for each "name url" line
while read -r name url; do [ -z "$name" ] && continue; curl -sS -o "$name.png" "$url" -w "$name %{http_code} %{size_download}\n"; done < "$1"

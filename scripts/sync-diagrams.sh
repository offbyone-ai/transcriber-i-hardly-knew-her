#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
README="$ROOT/README.md"
COMPONENT_MMD="$ROOT/docs/diagrams/component.mmd"
SEQUENCE_MMD="$ROOT/docs/diagrams/sequence.mmd"

if [[ ! -f "$README" ]]; then
  echo "ERROR: README.md not found at $README" >&2
  exit 1
fi
if [[ ! -f "$COMPONENT_MMD" ]]; then
  echo "ERROR: component diagram source not found: $COMPONENT_MMD" >&2
  exit 1
fi
if [[ ! -f "$SEQUENCE_MMD" ]]; then
  echo "ERROR: sequence diagram source not found: $SEQUENCE_MMD" >&2
  exit 1
fi

# Create backup
cp "$README" "$README.bak"

# Helper: replace a marker block with the contents of a file (wrapped in ```mermaid ... ```)
# Arguments: marker_file_path
replace_marker() {
  local marker="$1"
  local mmdfile="$2"
  local tmp
  tmp=$(mktemp)

  awk -v marker="$marker" -v mmdfile="$mmdfile" 'BEGIN{skip=0}
  {
    if(skip==0 && $0==marker){
      print $0
      print ""
      print "```mermaid"
      while((getline line < mmdfile) > 0) print line
      close(mmdfile)
      print "```"
      skip=1
      next
    }
    if(skip==1){
      if($0=="```") { skip=0; next }
      else next
    }
    print $0
  }' "$README" > "$tmp"

  mv "$tmp" "$README"
}

replace_marker "<!-- Source: docs/diagrams/component.mmd -->" "$COMPONENT_MMD"
replace_marker "<!-- Source: docs/diagrams/sequence.mmd -->" "$SEQUENCE_MMD"

echo "README.md updated from diagram sources. Backup saved to README.md.bak"

exit 0

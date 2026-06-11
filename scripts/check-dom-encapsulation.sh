#!/usr/bin/env bash
# Raw selection/range/walker DOM APIs are allowed only inside features/tokens.
# Spec: docs/superpowers/specs/2026-06-11-tokenmodel-dom-encapsulation-design.md
set -uo pipefail

violations=$(grep -rn --include='*.ts' \
	-e 'window\.getSelection' \
	-e 'document\.getSelection' \
	-e 'createRange' \
	-e 'createTreeWalker' \
	-e 'caretRangeFromPoint' \
	-e 'caretPositionFromPoint' \
	-e "from '.*tokens/caret'" \
	-e "from '.*tokens/textOffsets'" \
	-e "from '.*tokens/boundary'" \
	packages/core/src \
	| grep -v 'packages/core/src/features/tokens/' \
	| grep -v '\.spec\.ts'); status=$?

if [ "$status" -eq 2 ]; then
	echo 'grep failed (filesystem error)'
	exit 2
fi

if [ -n "$violations" ]; then
	echo 'DOM encapsulation violations (raw selection APIs outside features/tokens):'
	echo "$violations"
	exit 1
fi
echo 'DOM encapsulation: clean'

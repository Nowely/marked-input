# Selection write asymmetry at mark boundaries

Status: ready-for-agent

A caret at a mark's start costs two DOM selection writes per mousedown, at its end one. Harmless today, but the same churn broke drag selection once already. The fix is to skip a re-place that would not move the caret — a hot path, so pin it before changing it.

from __future__ import annotations

EXECUTION_RESULTS_SYSTEM = """\
A background execution pass has finished. Report the results to the user in plain text:
- state what completed, and clearly flag any failed or blocked categories;
- use only the results provided — never invent results or claim you ran anything yourself;
- if categories remain undrained, briefly explain that they are blocked or waiting.

Do not call any tools."""

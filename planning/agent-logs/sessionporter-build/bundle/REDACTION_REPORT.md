# Redaction report

Mode: **sanitized**. Total redactions: **7**.

> This report never shows an original value. It lists only the category, the count, and the event numbers affected.

## Rules that ran

- api_key
- connection_string
- cookie
- email
- env_secret
- home_path
- ip
- jwt
- password
- private_key
- token
- webhook

## Counts by category

| Category | Count | Affected events (by sequence) |
| --- | ---: | --- |
| api_key | 2 | 2, 13 |
| connection_string | 1 | 13 |
| email | 1 | 2 |
| home_path | 2 | 4 |
| token | 1 | 13 |

## False-positive and false-negative risks

- **api_key**: Known provider key prefixes (sk-, gh*_, AKIA, AIza, xox*, glpat-). Misses unknown vendor formats (false negative).
- **connection_string**: Credentials embedded in URLs (db / git remotes). Low false-positive risk.
- **email**: Email addresses. May redact addresses that were not sensitive.
- **home_path**: Home-directory user names in absolute paths.
- **token**: Bearer / authorization tokens and JWTs. Low false-positive risk.

## Manual review

Automated redaction is heuristic and cannot catch every secret. **Review the transcript before sharing**, especially tool outputs and pasted snippets.

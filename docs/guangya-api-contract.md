# Guangya API contract

This project treats Guangya endpoints as an internal, versioned-by-observation API.
No credential values are stored in this repository.

Observed on 2026-09-30 from the authenticated web application:

| Operation | Method | Primary path | Compatible path |
| --- | --- | --- | --- |
| List files | POST | `/userres/v1/file/get_file_list` | `/nd.bizuserres.s/v1/file/get_file_list` |
| File detail | POST | `/userres/v1/file/get_file_detail` | `/nd.bizuserres.s/v1/file/get_file_detail` |
| Rename file | POST | `/userres/v1/file/rename` | `/nd.bizuserres.s/v1/file/rename` |

Forwarded request headers are allowlisted to `authorization`, `content-type`,
`did`, `dt`, `x-device-id`, and `x-requested-with`. Browser-managed headers and
cookies are never copied into persistent storage.

Minimal request bodies:

```json
{"parentId":"<id>","pageSize":100,"orderBy":0,"sortType":0}
```

```json
{"fileId":"<id>"}
```

The file-detail response exposes video variants under `data.videoResource`.
Resolution is read from each variant's `info.resolution.width` and
`info.resolution.height` (with `info.width`/`info.height` accepted as a fallback).
Detail lookup is read-only and best-effort: a failure for one file keeps its list
record intact and does not block preview generation.

```json
{"fileId":"<id>","newName":"<filename>"}
```

The page bridge learns actual endpoint paths, request headers, pagination fields,
and any stable extra rename fields at runtime. Only field names and redacted shapes
are used as fixtures. A temporary rename probe was restored to its original name.

Source cross-check: the public `serenalee87/guangya-cloud-helper` implementation
uses the same header allowlist and dynamically selects `fileId`/`newName` from a
captured official rename request.

# Iteration 13 — Inspector video attachment

## Implemented
- Mini App inspector form accepts one optional MP4, WebM, or MOV video.
- Browser reads media metadata and blocks files longer than 60 seconds.
- Upload uses multipart FormData instead of JSON/base64 for the video binary.
- Server validates MIME type, size (50 MB maximum), and the submitted duration value.
- Video is stored as a file in the existing persistent photo/media directory on the same volume as the database; the report stores a `/api/photos/<filename>` URL.
- Media route serves MP4, WebM, and MOV with inline disposition.
- Inspector notification includes a reference to the attached video.

## Important limitations
- Duration is checked in the browser and the supplied duration is range-checked by the server; this is not a server-side media probe. A modified client could misreport duration. Production-grade enforcement requires ffprobe or an equivalent media parser.
- Video Telegram archival, retry queue, and archive confirmation are NOT implemented in this iteration. The local file is deliberately retained; it is not deleted after upload.
- The existing photo/media route is not yet authenticated at the HTTP layer. Access control should be reviewed before enabling confidential inspector media in production.
- Android/iOS device testing and full Next.js build/typecheck remain outstanding.

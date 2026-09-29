-- Media bucket — images uploaded from the admin (gallery designs, blog
-- covers, project screenshots).
--
-- Why Storage and not the content JSON: uploads used to be inlined as
-- base64 data URLs inside site_content, which every visitor downloads in
-- full on every load and which the browser cache keeps in localStorage
-- (a ~5 MB quota). A design gallery would blow through both.
--
-- How uploads work: an authed admin asks POST /api/content?op=upload for
-- a signed upload URL; the server picks the path; the browser PUTs the
-- file straight to Storage. The file never passes through a Vercel
-- function, so the 4.5 MB request-body cap doesn't apply, and no policy
-- is needed on storage.objects — the signed URL is the permission.
--
-- The bucket is public-read (the site links the files directly) and
-- restricted to raster images. SVG is deliberately excluded: it can carry
-- script, and a signed URL doesn't bind the content type.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  10485760, -- 10 MB
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

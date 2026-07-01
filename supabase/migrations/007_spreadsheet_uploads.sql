alter type public.document_file_type add value if not exists 'xlsx';
alter type public.document_file_type add value if not exists 'xls';
alter type public.document_file_type add value if not exists 'csv';

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
]
where id = 'documents';

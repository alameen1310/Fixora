alter table public.messages
  add constraint messages_body_raw_length_check
  check (char_length(body) between 1 and 2000 and char_length(btrim(body)) >= 1);

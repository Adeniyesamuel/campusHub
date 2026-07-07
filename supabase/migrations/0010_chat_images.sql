-- Phase 4 follow-up 2: image sharing in chat
-- Run this once in the Supabase Dashboard -> SQL Editor, after 0009.

-- ---------- messages: allow an image-only message ----------
-- text becomes optional and image_path is added; a message must carry
-- at least one of the two (never neither).
alter table public.messages
  add column image_path text,
  alter column text drop not null;

alter table public.messages
  add constraint text_or_image check (text is not null or image_path is not null);

-- message_reports snapshots an image-only message's text as '[image]'
-- instead of null, since message_text is not-null (evidence still needs
-- *something* readable even when there's no caption).
create or replace function public.set_message_report_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  select sender_id, text, conversation_id into m
  from public.messages where id = new.message_id;

  if not found then
    raise exception 'Message not found';
  end if;
  if not public.is_conversation_participant(m.conversation_id) then
    raise exception 'Not a participant in this conversation';
  end if;

  new.reporter_id := auth.uid();
  new.reported_user_id := m.sender_id;
  new.message_text := coalesce(m.text, '[image]');
  return new;
end;
$$;

-- ---------- private chat-images bucket ----------
-- Objects are stored as {conversation_id}/{uuid}.jpg — the folder IS the
-- conversation id, so one is_conversation_participant() check gates both
-- read and write. This is scoped to conversation participancy only, the
-- same trust boundary as every other bucket in this app — it does NOT
-- additionally re-check block status the way the messages select policy
-- does. In practice a blocker never learns a post-block image's path
-- (the messages row that references it is already hidden from them by
-- the 0009 policy), so this is a narrow, intentional gap rather than an
-- oversight — flagging it here in case you want storage-level
-- enforcement later too.
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

create policy "Conversation participants can view chat images"
  on storage.objects for select
  using (
    bucket_id = 'chat-images'
    and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
  );

create policy "Conversation participants can upload chat images"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-images'
    and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
  );

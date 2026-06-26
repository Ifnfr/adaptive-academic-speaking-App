create table word_builder_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references word_builder_sessions(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table word_builder_chat_messages enable row level security;

create policy "service_role_only"
  on word_builder_chat_messages as restrictive
  to anon
  using (false);

create index word_builder_chat_messages_session_id_idx on word_builder_chat_messages (session_id);
create index word_builder_chat_messages_user_id_idx on word_builder_chat_messages (user_id);

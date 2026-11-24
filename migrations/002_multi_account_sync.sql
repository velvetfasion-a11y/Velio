create table if not exists accounts (
  id text primary key,
  provider text not null,
  name text not null,
  email text not null default '',
  phone text not null default '',
  provider_id text,
  account_mode text not null default 'customer',
  created_at timestamptz not null default now(),
  unique (provider)
);

create table if not exists sessions (
  token text primary key,
  account_id text not null references accounts (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_account_idx on sessions (account_id);

create table if not exists jobs (
  id text primary key,
  owner_id text not null references accounts (id) on delete cascade,
  service_id text not null,
  text text not null,
  when_label text not null,
  address text not null,
  rate text not null default 'hour',
  price integer not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists jobs_created_idx on jobs (created_at desc);
create index if not exists jobs_status_idx on jobs (status);

create table if not exists conversations (
  id text primary key,
  account_a text not null references accounts (id) on delete cascade,
  account_b text not null references accounts (id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (account_a, account_b)
);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations (id) on delete cascade,
  sender_id text not null references accounts (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages (conversation_id, created_at);

insert into accounts (id, provider, name, email, phone, provider_id, account_mode) values
  ('acc-bankid', 'bankid', 'Anna Karlsson', 'anna.karlsson@velio.se', '+46 70 123 45 67', null, 'customer'),
  ('acc-google', 'google', 'Erik Lindberg', 'erik.lindberg@gmail.com', '+46 70 222 33 44', 'el-erik', 'business'),
  ('acc-apple', 'apple', 'Sofia Andersson', 'sofia.andersson@icloud.com', '+46 70 555 66 77', 'st-sofia', 'business'),
  ('acc-phone', 'phone', 'Amir Hassan', 'amir.hassan@velio.se', '+46 70 888 99 00', 'st-amir', 'business'),
  ('acc-cleanpro', 'cleanpro', 'CleanPro', 'hello@cleanpro.se', '+46 8 123 45 67', 'st-cleanpro', 'business')
on conflict (provider) do nothing;

insert into jobs (id, owner_id, service_id, text, when_label, address, rate, price, status)
values (
  'job-seed-anna',
  'acc-bankid',
  'el',
  'Byta två belysningsarmaturer i köket och kontrollera jordfelsbrytaren.',
  'Imorgon, 10:00',
  'Strandvägen 12, Stockholm',
  'hour',
  890,
  'open'
)
on conflict (id) do nothing;

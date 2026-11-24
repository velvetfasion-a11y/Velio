create table if not exists profiles (
  owner text not null,
  stage text not null default 'production',
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  account_mode text not null default 'customer',
  app_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, stage)
);

create index if not exists profiles_email_idx on profiles (email);

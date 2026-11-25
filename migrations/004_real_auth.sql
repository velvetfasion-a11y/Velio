alter table accounts add column if not exists email_verified boolean not null default false;
alter table accounts add column if not exists phone_verified boolean not null default false;
alter table accounts add column if not exists id_verified boolean not null default false;
alter table accounts add column if not exists id_method text;
alter table accounts add column if not exists google_sub text;
alter table accounts add column if not exists passport_number text;
alter table accounts add column if not exists passport_country text;

create unique index if not exists accounts_google_sub_uidx on accounts (google_sub) where google_sub is not null;

create table if not exists auth_challenges (
  id text primary key,
  kind text not null,
  target text not null,
  code_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_challenges_target_idx on auth_challenges (kind, target);

update accounts set email_verified = true where provider in ('google', 'apple', 'bankid') and email <> '';
update accounts set phone_verified = true where provider = 'phone' and phone <> '';
update accounts set id_verified = true, id_method = 'bankid' where account_mode = 'business';

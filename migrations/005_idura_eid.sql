alter table accounts add column if not exists eid_sub text;
alter table accounts add column if not exists identity_scheme text;
alter table accounts add column if not exists eid_acr text;
alter table accounts add column if not exists personal_number_hash text;
alter table accounts add column if not exists personal_number_enc text;

create unique index if not exists accounts_eid_sub_uidx on accounts (eid_sub) where eid_sub is not null;
create unique index if not exists accounts_personal_number_hash_uidx
  on accounts (personal_number_hash) where personal_number_hash is not null;

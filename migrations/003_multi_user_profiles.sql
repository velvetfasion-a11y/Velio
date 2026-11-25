alter table accounts drop constraint if exists accounts_provider_key;

create index if not exists accounts_provider_idx on accounts (provider);
create index if not exists accounts_email_idx on accounts (email);

insert into accounts (id, provider, name, email, phone, provider_id, account_mode) values
  ('acc-bankid-lisa', 'bankid', 'Lisa Berg', 'lisa.berg@velio.se', '+46 70 111 22 33', null, 'customer'),
  ('acc-google-maria', 'google', 'Maria Norén', 'maria.noren@gmail.com', '+46 70 444 55 66', null, 'customer'),
  ('acc-apple-johan', 'apple', 'Johan Ek', 'johan.ek@icloud.com', '+46 70 777 88 99', 'tr-johan', 'business'),
  ('acc-phone-karin', 'phone', 'Karin Holm', 'karin.holm@velio.se', '+46 70 101 20 30', 'sa-karin', 'business')
on conflict (id) do nothing;

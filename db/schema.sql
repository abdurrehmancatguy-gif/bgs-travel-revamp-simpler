-- Visa checkout: orders and the documents attached to them.
--
-- Two tables rather than one, because a visa order is one thing and the
-- documents are many, and the count varies per applicant per visa: the
-- catalogue asks for anywhere between zero and nineteen documents depending on
-- the country.
--
-- Files live in the database as bytea rather than on disk. At this scale that
-- is the honest choice: an order is a handful of passport scans, the whole
-- thing arrives and leaves as one unit, and a row that carries its own files
-- cannot end up pointing at a file somebody moved. If volume ever makes that
-- wrong, the files move to object storage and only this table changes.

create extension if not exists "pgcrypto";

create table if not exists visa_orders (
  id             uuid primary key default gen_random_uuid(),
  -- Short, sayable over the phone. The customer quotes this, not the uuid.
  reference      text unique not null,

  visa_name      text not null,
  visa_country   text,
  visa_type      text,

  applicants     integer not null check (applicants between 1 and 20),
  tier           text not null default 'normal' check (tier in ('normal', 'express')),
  unit_price     numeric(10,2),
  currency       text default 'AED',
  -- Stored rather than derived, so a later price change cannot silently
  -- rewrite what somebody was quoted.
  total          numeric(10,2),

  contact_name   text not null,
  contact_email  text,
  contact_phone  text not null,
  notes          text,

  status         text not null default 'new'
                 check (status in ('new', 'in_progress', 'submitted', 'issued', 'cancelled')),
  created_at     timestamptz not null default now()
);

create table if not exists visa_order_files (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references visa_orders(id) on delete cascade,

  -- Which applicant, and which of that visa's requirements this answers.
  applicant      integer not null check (applicant >= 1),
  requirement    text not null,

  filename       text not null,
  mime           text not null,
  byte_size      bigint not null check (byte_size > 0),
  data           bytea not null,

  created_at     timestamptz not null default now()
);

create index if not exists visa_order_files_order_idx on visa_order_files (order_id);
create index if not exists visa_orders_created_idx on visa_orders (created_at desc);
create index if not exists visa_orders_status_idx on visa_orders (status);

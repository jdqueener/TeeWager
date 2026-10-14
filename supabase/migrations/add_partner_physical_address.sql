-- partners only had one address field (mailing_address), used both as the
-- course's real location and as the shipping/payout address — no way to
-- track a course whose physical address differs from where print packets
-- or checks should go. physical_address is now the primary address; the
-- CRM defaults mailing_address to it when left blank, so every existing
-- mailing_address-driven feature (print packets, CSV export, badges) keeps
-- working unchanged for the common "they're the same" case.

alter table public.partners add column physical_address text;

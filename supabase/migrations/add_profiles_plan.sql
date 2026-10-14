-- Nothing recorded which Pro plan (monthly/annual/lifetime) a profile bought,
-- so the partner portal's subscription breakdown and live earnings could
-- never be computed — only is_pro existed. Written by grantPro (native
-- RevenueCat) and the stripe-webhook function (web).

alter table public.profiles add column plan text;

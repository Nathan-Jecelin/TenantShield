ALTER TABLE landlord_profiles ADD COLUMN stripe_customer_id text;
ALTER TABLE landlord_profiles ADD COLUMN stripe_subscription_id text;
ALTER TABLE landlord_profiles ADD COLUMN plan_status text NOT NULL DEFAULT 'active'
  CHECK (plan_status IN ('active', 'past_due', 'canceled'));
ALTER TABLE landlord_profiles ADD COLUMN current_period_end timestamptz;

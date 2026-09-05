DELETE FROM referral_rewards
WHERE referrer_id = referred_user_id;

DELETE FROM referral_rewards victim
USING referral_rewards keeper
WHERE victim.id <> keeper.id
  AND victim.referrer_id = keeper.referrer_id
  AND victim.referred_user_id = keeper.referred_user_id
  AND victim.trigger = keeper.trigger
  AND victim.program = keeper.program
  AND COALESCE(victim.source_subscription_id, '') = COALESCE(keeper.source_subscription_id, '')
  AND (victim.created_at, victim.id) > (keeper.created_at, keeper.id);

ALTER TABLE referral_rewards
  ADD CONSTRAINT referral_rewards_no_self_referral
  CHECK (referrer_id <> referred_user_id);

ALTER TABLE referral_rewards
  ADD CONSTRAINT referral_rewards_positive_amount
  CHECK (amount > 0);

ALTER TABLE referral_rewards
  ADD CONSTRAINT referral_rewards_valid_trigger
  CHECK (trigger IN ('signup', 'booking', 'subscription'));

ALTER TABLE referral_rewards
  ADD CONSTRAINT referral_rewards_valid_program
  CHECK (program IN ('guest', 'host'));

ALTER TABLE referral_rewards
  ADD CONSTRAINT referral_rewards_valid_status
  CHECK (status IN ('pending', 'earned', 'paid', 'rejected'));

CREATE UNIQUE INDEX referral_rewards_unique_workflow_idx
  ON referral_rewards (
    referrer_id,
    referred_user_id,
    trigger,
    program,
    (COALESCE(source_subscription_id, ''))
  );

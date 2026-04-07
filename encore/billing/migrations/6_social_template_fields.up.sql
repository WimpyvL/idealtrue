ALTER TABLE content_drafts
  ADD COLUMN template_id TEXT NOT NULL DEFAULT 'featured_stay',
  ADD COLUMN template_name TEXT NOT NULL DEFAULT 'Featured Stay';

CREATE INDEX content_drafts_template_id_idx ON content_drafts (template_id);

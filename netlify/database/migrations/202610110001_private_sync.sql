CREATE TABLE study_state (
  owner_id text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, key)
);
CREATE TABLE study_versions (
  owner_id text NOT NULL,
  request_id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  base_version bigint NOT NULL,
  accepted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, request_id)
);

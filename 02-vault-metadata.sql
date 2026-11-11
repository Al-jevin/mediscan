BEGIN;

ALTER TABLE public.vault_items
    ADD COLUMN IF NOT EXISTS vault_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS vault_status TEXT NOT NULL DEFAULT 'verified',
    ADD COLUMN IF NOT EXISTS vault_source TEXT NOT NULL DEFAULT 'scan',
    ADD COLUMN IF NOT EXISTS vault_confidence SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_vault_status'
          AND conrelid = 'public.vault_items'::regclass
    ) THEN
        ALTER TABLE public.vault_items
            ADD CONSTRAINT chk_vault_status
            CHECK (vault_status IN ('verified', 'needs_verification'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_vault_source'
          AND conrelid = 'public.vault_items'::regclass
    ) THEN
        ALTER TABLE public.vault_items
            ADD CONSTRAINT chk_vault_source
            CHECK (vault_source IN ('scan', 'manual'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_vault_confidence'
          AND conrelid = 'public.vault_items'::regclass
    ) THEN
        ALTER TABLE public.vault_items
            ADD CONSTRAINT chk_vault_confidence
            CHECK (vault_confidence IS NULL OR vault_confidence BETWEEN 0 AND 100);
    END IF;
END
$$;

COMMIT;

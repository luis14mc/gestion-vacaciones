-- Trigger autoritativo de cantidad_disponible en balances.
-- Hasta ahora solo vivia en database/09_cni_business_logic.sql (aplicado por
-- db:install/db:init, NO por db:migrate), por lo que no estaba versionado en
-- las migraciones. Se versiona aqui de forma idempotente para garantizar que
-- exista en cualquier ruta de despliegue.
CREATE OR REPLACE FUNCTION actualizar_cantidad_disponible_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cantidad_disponible :=
        (NEW.cantidad_inicial + NEW.cantidad_acumulada) -
        (NEW.cantidad_usada + NEW.cantidad_pendiente);
    IF NEW.cantidad_disponible < 0 THEN
        NEW.cantidad_disponible := 0;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_actualizar_cantidad_disponible ON balances;
--> statement-breakpoint
CREATE TRIGGER trg_actualizar_cantidad_disponible
    BEFORE INSERT OR UPDATE OF cantidad_inicial, cantidad_acumulada, cantidad_usada, cantidad_pendiente
    ON balances
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_cantidad_disponible_balance();

-- this function runs every time someone inserts, updates or deletes an order
-- it packages up what changed and sends it as a notification
CREATE OR REPLACE FUNCTION notify_order_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
    changed_row JSON;
BEGIN
    -- for delete we grab the old row, for insert/update we grab the new one
    IF (TG_OP = 'DELETE') THEN
        changed_row := row_to_json(OLD);
    ELSE
        changed_row := row_to_json(NEW);
    END IF;

    -- build a json object with everything the backend needs to know
    payload := json_build_object(
        'operation', TG_OP,
        'data',      changed_row
    );

    -- fire the notification on the channel our backend is listening on
    PERFORM pg_notify('order_changes', payload::TEXT);

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- drop old trigger if it exists then recreate it
DROP TRIGGER IF EXISTS orders_notify_trigger ON orders;

CREATE TRIGGER orders_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_order_change();
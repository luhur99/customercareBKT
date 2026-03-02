-- Server-side aggregation functions for Dashboard stats
-- Replaces client-side computation that fetched ALL tickets

-- Function: Calculate SLA performance percentage
-- SLA rule: 24h deadline. "Green" = resolved within 24h OR still within 24h of creation
CREATE OR REPLACE FUNCTION get_sla_performance()
RETURNS TABLE(sla_percentage NUMERIC) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_tickets INTEGER;
  sla_met_tickets INTEGER;
  sla_deadline_hours CONSTANT INTEGER := 24;
BEGIN
  SELECT COUNT(*) INTO total_tickets FROM tickets;
  
  IF total_tickets = 0 THEN
    sla_percentage := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO sla_met_tickets
  FROM tickets t
  WHERE 
    -- Resolved tickets: resolved within 24h of creation
    (t.status IN ('resolved', 'closed') AND t.resolved_at IS NOT NULL 
      AND EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600 <= sla_deadline_hours)
    OR
    -- Open/in-progress tickets: still within 24h of creation
    (t.status NOT IN ('resolved', 'closed') 
      AND EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 <= sla_deadline_hours)
    OR
    -- Resolved tickets without resolved_at: count as not breached if status is resolved
    (t.status IN ('resolved', 'closed') AND t.resolved_at IS NULL);

  sla_percentage := ROUND((sla_met_tickets::NUMERIC / total_tickets::NUMERIC) * 100, 1);
  RETURN NEXT;
  RETURN;
END;
$$;

-- Function: Calculate ticket status percentages
CREATE OR REPLACE FUNCTION get_ticket_status_percentages()
RETURNS TABLE(open_pct NUMERIC, in_progress_pct NUMERIC, resolved_pct NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_tickets INTEGER;
  open_count INTEGER;
  in_progress_count INTEGER;
  resolved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tickets FROM tickets;
  
  IF total_tickets = 0 THEN
    open_pct := 0;
    in_progress_pct := 0;
    resolved_pct := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO open_count FROM tickets WHERE status = 'open';
  SELECT COUNT(*) INTO in_progress_count FROM tickets WHERE status = 'in_progress';
  SELECT COUNT(*) INTO resolved_count FROM tickets WHERE status IN ('resolved', 'closed');

  open_pct := ROUND((open_count::NUMERIC / total_tickets::NUMERIC) * 100, 1);
  in_progress_pct := ROUND((in_progress_count::NUMERIC / total_tickets::NUMERIC) * 100, 1);
  resolved_pct := ROUND((resolved_count::NUMERIC / total_tickets::NUMERIC) * 100, 1);
  
  RETURN NEXT;
  RETURN;
END;
$$;

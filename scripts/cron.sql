-- scripts/cron.sql
-- Sets up scheduled tick execution using pg_cron and pg_net.
-- Reads the application URL and cron secret securely from Supabase Vault.

-- 1. Enable pg_cron and pg_net extensions if not enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Remove previous scheduled jobs if they exist
select cron.unschedule('invoke-tick-every-minute') 
where exists (select 1 from cron.job where jobname = 'invoke-tick-every-minute');

select cron.unschedule('prune-cron-logs-daily') 
where exists (select 1 from cron.job where jobname = 'prune-cron-logs-daily');

-- 3. Schedule /api/internal/tick every minute
select cron.schedule(
  'invoke-tick-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/internal/tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- 4. Daily job that prunes cron.job_run_details older than 2 days
select cron.schedule(
  'prune-cron-logs-daily',
  '0 3 * * *',
  $$
  delete from cron.job_run_details where start_time < now() - interval '2 days';
  $$
);

-- 4.1 (B14): reporte semanal automático, lunes 7:00 a.m.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'reporte_semanal';
exception when others then
  null;
end $$;

select cron.schedule(
  'reporte_semanal',
  '0 7 * * 1',
  $$select fn_llamar_edge_function('reporte-semanal', '{}'::jsonb);$$
);

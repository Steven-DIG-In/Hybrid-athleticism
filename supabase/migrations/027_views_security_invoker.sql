-- These two views ran with their owner's rights, bypassing RLS on the tables behind them.
alter view public.exercise_progression set (security_invoker = true);
alter view public.weekly_volume_summary set (security_invoker = true);

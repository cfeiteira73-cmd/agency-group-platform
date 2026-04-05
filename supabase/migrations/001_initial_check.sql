-- Run this first to verify your existing tables
select table_name,
       (select count(*) from information_schema.columns where table_name = t.table_name and table_schema = 'public') as col_count
from information_schema.tables t
where table_schema = 'public'
order by table_name;

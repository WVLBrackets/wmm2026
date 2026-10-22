// Local verification subprocess only. No external database can be contacted.
require('./vintage-network-stubs.cjs');
const { newDb, DataType } = require('pg-mem');
const memory = newDb({ noAstCoverageCheck: true });
memory.public.registerFunction({ name: 'pg_advisory_xact_lock', args: [DataType.integer], returns: DataType.integer, implementation: () => 1 });
memory.public.none('CREATE TABLE brackets (id TEXT, environment TEXT, year INTEGER)');
const pg = require('pg');
pg.Pool = memory.adapters.createPg().Pool;

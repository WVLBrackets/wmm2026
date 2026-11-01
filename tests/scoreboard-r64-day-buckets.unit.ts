import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bucketR64ByTipoffDay,
  tipoffCalendarDayKeyEt,
} from '../src/lib/scoreboardR64DayBuckets';

describe('tipoffCalendarDayKeyEt', () => {
  it('maps late-evening UTC tips onto the Eastern calendar day', () => {
    // 3/20/2026 00:30 UTC = 3/19/2026 20:30 ET
    assert.equal(
      tipoffCalendarDayKeyEt('2026-03-20T00:30:00.000Z'),
      '2026-03-19',
    );
  });
});

describe('bucketR64ByTipoffDay', () => {
  it('puts 3/19 tips on Day 1 and 3/20 tips on Day 2', () => {
    const buckets = bucketR64ByTipoffDay([
      { gameKey: 'Top Left-r64-1', tipoffAt: '2026-03-20T00:00:00.000Z' }, // 3/19 ET
      { gameKey: 'Bottom Right-r64-8', tipoffAt: '2026-03-20T23:00:00.000Z' }, // 3/20 ET
      { gameKey: 'Top Right-r64-1', tipoffAt: '2026-03-19T17:00:00.000Z' }, // 3/19 ET
      { gameKey: 'Bottom Left-r64-1', tipoffAt: '2026-03-20T16:00:00.000Z' }, // 3/20 ET
      { gameKey: 'Top Left-r64-2', tipoffAt: null },
    ]);

    assert.deepEqual(buckets.day1Keys, [
      'Top Right-r64-1',
      'Top Left-r64-1',
    ]);
    assert.deepEqual(buckets.day2Keys, [
      'Bottom Left-r64-1',
      'Bottom Right-r64-8',
    ]);
    assert.deepEqual(buckets.unscheduledKeys, ['Top Left-r64-2']);
  });

  it('does not split by region key when dates differ within a region', () => {
    const buckets = bucketR64ByTipoffDay([
      { gameKey: 'Top Left-r64-1', tipoffAt: '2026-03-19T16:00:00.000Z' },
      { gameKey: 'Top Left-r64-2', tipoffAt: '2026-03-20T16:00:00.000Z' },
      { gameKey: 'Top Left-r64-3', tipoffAt: '2026-03-19T18:00:00.000Z' },
      { gameKey: 'Top Left-r64-4', tipoffAt: '2026-03-20T18:00:00.000Z' },
    ]);
    assert.equal(buckets.day1Keys.length, 2);
    assert.equal(buckets.day2Keys.length, 2);
    assert.ok(buckets.day1Keys.every((k) => k.startsWith('Top Left')));
    assert.ok(buckets.day2Keys.every((k) => k.startsWith('Top Left')));
  });
});

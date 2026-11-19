import test from 'node:test';
import assert from 'node:assert/strict';
import { countActualDistrictCompletions } from '../lib/monitoring-metrics.ts';

test('counts unique ATMs by actual master-data district, not planned crew districts', () => {
  const result = countActualDistrictCompletions(
    [{ atmId: 'a1' }, { atmId: 'a1' }, { atmId: 'a2' }, { atmId: 'a3' }],
    [
      { id: 'a1', region: 'Город Ташкент', district: 'Мирабадский' },
      { id: 'a2', region: 'Город Ташкент', district: 'Мирабадский' },
      { id: 'a3', region: 'Ташкентская область', district: 'Мирабадский' },
    ],
  );
  assert.equal(result.length, 2);
  assert.equal(result.find((row) => row.region === 'Город Ташкент').cleaned, 2);
  assert.equal(result.find((row) => row.region === 'Ташкентская область').cleaned, 1);
});

test('does not silently discard reports whose ATM is missing from the master list', () => {
  const result = countActualDistrictCompletions([{ atmId: 'missing' }], []);
  assert.equal(result.length, 1);
  assert.equal(result[0].district, 'Банкомат отсутствует в справочнике');
  assert.equal(result[0].cleaned, 1);
});


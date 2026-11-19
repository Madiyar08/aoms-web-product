import test from 'node:test';
import assert from 'node:assert/strict';
import { atmChangeStatusLabel, atmChangeSummary, atmChangeTypeLabel } from '../lib/atm-history-view.ts';

test('labels known ATM change types and safely handles future types', () => {
  assert.equal(atmChangeTypeLabel('district'), 'Изменение района');
  assert.equal(atmChangeTypeLabel('future_change'), 'Изменение данных');
});

test('maps all change states to readable status labels', () => {
  assert.equal(atmChangeStatusLabel('pending'), 'Ожидает проверки');
  assert.equal(atmChangeStatusLabel('applied'), 'Применено');
  assert.equal(atmChangeStatusLabel('rejected'), 'Отклонено');
  assert.equal(atmChangeStatusLabel('unknown'), 'Ожидает проверки');
});

test('summarizes district and coordinate changes with explicit old and new values', () => {
  assert.equal(atmChangeSummary({ changeType: 'district', oldDistrict: 'Старый', newDistrict: 'Новый' }), 'Район: Старый → Новый');
  assert.equal(atmChangeSummary({ changeType: 'location', oldLat: '41.1', oldLon: '69.1', newLat: '41.2', newLon: '69.2' }), 'Координаты: 41.1, 69.1 → 41.2, 69.2');
});

test('summarizes ID and new ATM signals without inventing missing values', () => {
  assert.equal(atmChangeSummary({ changeType: 'id_change', newCode: 'ATM-2' }), 'Новый ID: ATM-2');
  assert.equal(atmChangeSummary({ changeType: 'new_atm' }), 'Предложены координаты: —, —');
  assert.equal(atmChangeSummary({ changeType: 'other' }), 'Получен сигнал об изменении данных');
});

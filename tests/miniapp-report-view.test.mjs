import test from 'node:test';
import assert from 'node:assert/strict';
import { toEmployeeCleaningReportView } from '../lib/miniapp-report-view.ts';

const base = {
  id: 'report-1', createdAt: '2026-11-19T06:00:00.000Z', updatedAt: '2026-11-19T06:00:00.000Z',
  atmId: 'atm-1', atmCode: 'ATM-001', employeeId: 'employee-1', employeeName: 'Test Employee', machineId: 'machine-1',
  photoData: '/api/photos/private.jpg', gpsLat: '41.3', gpsLon: '69.2', gpsAccuracy: 8,
  clientTime: '2026-11-19T06:00:00.000Z', inRoute: true, distanceMeters: 4, antifraudFlags: [],
  enteredCode: 'ATM-001', codeMismatch: false, reportedWorkStatusId: '', reportedWorkStatusName: '',
  addressCorrect: true, coordsCorrect: true, locationComment: '',
};

test('employee view defaults legacy reports to pending', () => {
  const view = toEmployeeCleaningReportView(base);
  assert.equal(view.status, 'pending');
  assert.equal(view.reviewedAt, null);
  assert.equal(view.reviewComment, '');
});

test('employee view exposes decision and only a boolean antifraud indicator', () => {
  const view = toEmployeeCleaningReportView({ ...base, approvalStatus: 'rejected', reviewedAt: '2026-11-19T07:00:00Z', reviewComment: 'Проверьте фото', antifraudResult: 'review', antifraudFlags: ['подробная внутренняя причина'] });
  assert.equal(view.status, 'rejected');
  assert.equal(view.reviewComment, 'Проверьте фото');
  assert.equal(view.antifraud, true);
  assert.equal('antifraudFlags' in view, false);
  assert.equal('gpsLat' in view, false);
  assert.equal('photoData' in view, false);
  assert.equal('employeeId' in view, false);
});

test('approved reports remain approved in employee history', () => {
  assert.equal(toEmployeeCleaningReportView({ ...base, approvalStatus: 'approved' }).status, 'approved');
});

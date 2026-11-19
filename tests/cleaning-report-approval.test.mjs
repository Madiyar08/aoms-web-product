import test from 'node:test';
import assert from 'node:assert/strict';

function isPending(report) { return !report.approvalStatus || report.approvalStatus === 'pending'; }
function countsForKpi(report) { return report.approvalStatus === 'approved'; }

test('new and legacy reports remain pending until a reviewer approves them', () => {
  assert.equal(isPending({}), true);
  assert.equal(isPending({ approvalStatus: 'pending' }), true);
  assert.equal(countsForKpi({}), false);
  assert.equal(countsForKpi({ approvalStatus: 'pending' }), false);
});

test('only explicitly approved reports contribute to KPI', () => {
  assert.equal(countsForKpi({ approvalStatus: 'approved' }), true);
  assert.equal(countsForKpi({ approvalStatus: 'rejected' }), false);
});

test('pending queue excludes approved and rejected reports', () => {
  const reports = [{}, { approvalStatus: 'pending' }, { approvalStatus: 'approved' }, { approvalStatus: 'rejected' }];
  assert.equal(reports.filter(isPending).length, 2);
});

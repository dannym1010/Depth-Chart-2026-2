import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callSheetPlayFromWristbandSlot, restampWristbandNumbers } from './wristbandLinking';

// One card, Blue / Gold / Green / Pink, 16 rows each: Pink 49-64... then Green gets a 17th play (the card goes to 17
// rows). The numbers saved on Pink's plays still say 49+, but the card now puts Pink at 52+.
const card = () => {
  const col = (name: string, n: number, firstNum: number) => ({
    name,
    color: '#000',
    plays: Array.from({ length: n }, (_, i) => ({ text: `${name} ${i + 1}`, wristbandNum: firstNum + i })),
  });
  return {
    id: 'wb_1',
    title: 'Card',
    labelingMode: 'continuous',
    startNumber: 1,
    rowsCount: 17,
    columns: [col('BLUE', 17, 1), col('GOLD', 17, 18), col('GREEN', 17, 35), col('PINK', 16, 51)],
  } as any;
};

test('the call sheet numbers wristband plays by their spot on the card, not a stale saved number', () => {
  const wb = card();
  const pink = wb.columns[3];
  const first = callSheetPlayFromWristbandSlot(pink.plays[0], pink, wb, [wb], 0, 3, 0);
  assert.equal(first?.wristbandNum, 52, 'Pink starts right after Green (35-51)');
  const green17 = callSheetPlayFromWristbandSlot(wb.columns[2].plays[16], wb.columns[2], wb, [wb], 0, 2, 16);
  assert.equal(green17?.wristbandNum, 51);
});

test('re-saving the numbers after the rows change', () => {
  const wb = restampWristbandNumbers(card(), [card()]);
  assert.deepEqual(
    wb.columns[3].plays.slice(0, 3).map((p: any) => p.wristbandNum),
    [52, 53, 54]
  );
  assert.equal(wb.columns[0].plays[0].wristbandNum, 1);
  assert.equal(wb.columns[3].plays[15].wristbandNum, 67);
});

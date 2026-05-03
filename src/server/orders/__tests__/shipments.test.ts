import { describe, expect, it } from 'vitest';
import { splitOrderIntoShipments } from '../shipments';

type Item = { id: string; isPreorder: boolean; preorderBatchId: string | null };

describe('splitOrderIntoShipments', () => {
  it('returns no groups for empty input', () => {
    expect(splitOrderIntoShipments([], 'GB')).toEqual([]);
  });

  it('all-in-stock UK order produces one ROYAL_MAIL group', () => {
    const items: Item[] = [
      { id: 'i1', isPreorder: false, preorderBatchId: null },
      { id: 'i2', isPreorder: false, preorderBatchId: null },
    ];
    const groups = splitOrderIntoShipments(items, 'GB');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      carrier: 'ROYAL_MAIL',
      preorderBatchId: null,
      itemIds: ['i1', 'i2'],
    });
  });

  it('all-in-stock non-UK order produces one DHL group', () => {
    const items: Item[] = [{ id: 'i1', isPreorder: false, preorderBatchId: null }];
    const groups = splitOrderIntoShipments(items, 'DE');
    expect(groups).toHaveLength(1);
    expect(groups[0].carrier).toBe('DHL');
  });

  it('mixed cart splits into in-stock + per-batch preorder groups', () => {
    const items: Item[] = [
      { id: 'a', isPreorder: false, preorderBatchId: null },
      { id: 'b', isPreorder: true, preorderBatchId: 'batch-1' },
      { id: 'c', isPreorder: true, preorderBatchId: 'batch-2' },
      { id: 'd', isPreorder: true, preorderBatchId: 'batch-1' },
    ];
    const groups = splitOrderIntoShipments(items, 'GB');
    expect(groups).toHaveLength(3);
    const inStock = groups.find((g) => g.preorderBatchId === null);
    expect(inStock?.itemIds).toEqual(['a']);
    const b1 = groups.find((g) => g.preorderBatchId === 'batch-1');
    expect(b1?.itemIds.sort()).toEqual(['b', 'd']);
    const b2 = groups.find((g) => g.preorderBatchId === 'batch-2');
    expect(b2?.itemIds).toEqual(['c']);
    for (const g of groups) {
      expect(g.carrier).toBe('ROYAL_MAIL');
    }
  });

  it('preorder-only cart produces no in-stock group', () => {
    const items: Item[] = [
      { id: 'a', isPreorder: true, preorderBatchId: 'batch-1' },
      { id: 'b', isPreorder: true, preorderBatchId: 'batch-1' },
    ];
    const groups = splitOrderIntoShipments(items, 'FR');
    expect(groups).toHaveLength(1);
    expect(groups[0].preorderBatchId).toBe('batch-1');
    expect(groups[0].carrier).toBe('DHL');
  });

  it('skips preorder items missing a batch id', () => {
    const items: Item[] = [
      { id: 'a', isPreorder: false, preorderBatchId: null },
      { id: 'b', isPreorder: true, preorderBatchId: null },
    ];
    const groups = splitOrderIntoShipments(items, 'GB');
    expect(groups).toHaveLength(1);
    expect(groups[0].itemIds).toEqual(['a']);
  });
});

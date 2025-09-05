import { describe, it, expect } from 'vitest';
import { groupSelected, ungroupGroup, type RFNode, type RFEdge } from '../src/core/graph/grouping';

function idGenFactory(start = 1000) {
  let i = start;
  return () => String(++i);
}

function makeAddNode(id: string, x: number, y: number): RFNode {
  return {
    id,
    position: { x, y },
    data: {
      label: 'Add',
      type: 'add',
      template: {
        id: Number(id),
        type: 'add',
        name: 'Add',
        meta: [],
        position: [x, y],
        nodes: [],
        inputs: [
          { id: 0, name: 'a', type: ['float', 'float2', 'float3', 'float4'] },
          { id: 1, name: 'b', type: ['float', 'float2', 'float3', 'float4'] },
        ],
        outputs: [
          { id: 0, name: 'out', type: ['float', 'float2', 'float3', 'float4'] },
        ],
      },
    },
  } as any;
}

function makeColorNode(id: string, x: number, y: number): RFNode {
  return {
    id,
    position: { x, y },
    data: {
      label: 'Color',
      type: 'color',
      template: {
        id: Number(id),
        type: 'color',
        name: 'Color',
        meta: [],
        position: [x, y],
        nodes: [],
        inputs: [ { id: 0, name: 'in', type: 'float4', value: [1,1,1,1] } ],
        outputs: [ { id: 0, name: 'out', type: 'float4' } ],
      },
    },
  } as any;
}

function makeFloatNode(id: string, x: number, y: number): RFNode {
  return {
    id,
    position: { x, y },
    data: {
      label: 'Float',
      type: 'float',
      template: {
        id: Number(id),
        type: 'float',
        name: 'Float',
        meta: [],
        position: [x, y],
        nodes: [],
        inputs: [ { id: 0, name: 'in', type: 'float', value: [1] } ],
        outputs: [ { id: 0, name: 'out', type: 'float' } ],
      },
    },
  } as any;
}

describe('grouping and ungrouping', () => {
  it('groups two inputs and restores on ungroup', () => {
    const add = makeAddNode('100', 400, 200);
    const color = makeColorNode('1', 200, 160);
    const flt = makeFloatNode('2', 200, 230);
    const nodes: RFNode[] = [add, color, flt];
    const edges: RFEdge[] = [
      { id: 'e1', source: '1', target: '100', sourceHandle: 'out-0', targetHandle: 'in-0' },
      { id: 'e2', source: '2', target: '100', sourceHandle: 'out-0', targetHandle: 'in-1' },
    ];

    const idGen = idGenFactory(1000);
    const sel = new Set(['1','2']);
    const grouped = groupSelected(nodes, edges, sel, idGen);

    // Expectations after grouping
    const gNodes = grouped.nodes;
    const gEdges = grouped.edges;
    const group = gNodes.find((n) => n.id === grouped.groupId)!;
    expect(group).toBeTruthy();
    expect((group.data as any)?.type).toBe('group');

    // internal IO nodes exist
    expect(gNodes.find((n) => n.id === grouped.groupInputId)).toBeTruthy();
    expect(gNodes.find((n) => n.id === grouped.groupOutputId)).toBeTruthy();

    // add inputs now come from group, not from inner nodes
    const hasDirectColorToAdd = gEdges.some((e) => e.source === '1' && e.target === '100');
    const hasDirectFloatToAdd = gEdges.some((e) => e.source === '2' && e.target === '100');
    expect(hasDirectColorToAdd).toBe(false);
    expect(hasDirectFloatToAdd).toBe(false);
    // there should be edges group -> add for a and b
    const groupToAddA = gEdges.find((e) => e.source === group.id && e.target === '100' && e.targetHandle === 'in-0');
    const groupToAddB = gEdges.find((e) => e.source === group.id && e.target === '100' && e.targetHandle === 'in-1');
    expect(groupToAddA).toBeTruthy();
    expect(groupToAddB).toBeTruthy();

    // Now ungroup and expect original graph restored
    const ungrouped = ungroupGroup(gNodes, gEdges, group.id);
    const uNodes = ungrouped.nodes;
    const uEdges = ungrouped.edges;

    // group + IO nodes removed
    expect(uNodes.find((n) => (n.data as any)?.type === 'group')).toBeFalsy();
    expect(uNodes.find((n) => (n.data as any)?.type === 'group_input')).toBeFalsy();
    expect(uNodes.find((n) => (n.data as any)?.type === 'group_output')).toBeFalsy();

    // original nodes remain
    expect(uNodes.find((n) => n.id === '1')).toBeTruthy();
    expect(uNodes.find((n) => n.id === '2')).toBeTruthy();
    expect(uNodes.find((n) => n.id === '100')).toBeTruthy();

    // restored edges: color->add.a and float->add.b
    const restoredColor = uEdges.find((e) => e.source === '1' && e.target === '100' && e.sourceHandle === 'out-0' && e.targetHandle === 'in-0');
    const restoredFloat = uEdges.find((e) => e.source === '2' && e.target === '100' && e.sourceHandle === 'out-0' && e.targetHandle === 'in-1');
    expect(restoredColor).toBeTruthy();
    expect(restoredFloat).toBeTruthy();
  });
});

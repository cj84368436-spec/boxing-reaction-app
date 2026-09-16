import { buildBoxerRig } from './buildBoxerRig.js';
import type { ScreenPoint, ScreenPose } from './types.js';

// One small SVG vocabulary is drawn by both React Native and the browser preview.
// All positions come from the existing projected rig; this layer only dresses it.
export interface ArtworkNode {
  readonly tag: 'g' | 'path' | 'ellipse' | 'circle' | 'rect' | 'line';
  readonly attrs: Readonly<Record<string, string | number>>;
  readonly children?: readonly ArtworkNode[];
}
const path = (d: string, fill: string, attrs: ArtworkNode['attrs'] = {}): ArtworkNode =>
  ({ tag: 'path', attrs: { d, fill, ...attrs } });
const group = (attrs: ArtworkNode['attrs'], children: readonly ArtworkNode[]): ArtworkNode =>
  ({ tag: 'g', attrs, children });
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string): ArtworkNode =>
  ({ tag: 'ellipse', attrs: { cx, cy, rx, ry, fill } });
const ink = { stroke: '#352D32', strokeWidth: 1.6, strokeLinejoin: 'round' };

/** The knuckle stays centred at (0, 0); the cuff extends towards the forearm. */
function glove(color: 'red' | 'blue'): readonly ArtworkNode[] {
  const base = color === 'red' ? '#D94745' : '#3278AA';
  const shadow = color === 'red' ? '#962E39' : '#204A76';
  const light = color === 'red' ? '#F78066' : '#79B9D7';
  return [
    path('M -17 22 L -18 43 Q 0 49 18 43 L 18 22 Z', shadow, ink),
    path('M -18 27 Q 0 33 18 27 L 18 39 Q 0 45 -18 39 Z', '#E9DDC7', ink),
    path('M -11 32 L 11 34 M -11 36 L 11 38', 'none', { stroke: '#B4A793', strokeWidth: 1.2 }),
    path('M -23 17 C -29 7 -30 -12 -22 -23 C -15 -33 13 -33 23 -24 C 31 -17 32 0 28 14 Q 22 28 9 30 L -10 29 Q -20 27 -23 17 Z', base, ink),
    path('M -23 -7 Q -28 13 -13 24 Q 3 31 18 21 Q 27 14 29 1 Q 33 20 14 30 L -11 29 Q -25 26 -26 9 Z', shadow),
    path('M -19 -19 Q -4 -31 18 -22 L 20 -14 Q 0 -21 -19 -10 Z', light),
    path('M -23 2 C -14 -3 -6 5 -8 15 L -14 26 Q -20 32 -26 24 Q -32 13 -28 7 Z', base, ink),
    path('M -23 8 Q -17 7 -16 15', 'none', { stroke: light, strokeWidth: 2.2, strokeLinecap: 'round' }),
    path('M -6 18 Q 7 21 20 15', 'none', { stroke: shadow, strokeWidth: 1.4 }),
  ];
}
const redGlove = glove('red'), blueGlove = glove('blue');

function limb(from: ScreenPoint, to: ScreenPoint, startRadius: number, endRadius: number, fill: string, shadow = '#995D49', highlight = '#F0B985'): ArtworkNode {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  const a = startRadius, b = endRadius, l = length;
  return group({ transform: `translate(${from.x} ${from.y}) rotate(${angle})` }, [
    path(`M 0 ${-a} C ${l * .4} ${-a} ${l * .8} ${-b} ${l} ${-b} Q ${l + b} 0 ${l} ${b} C ${l * .65} ${b} ${l * .35} ${a} 0 ${a} Q ${-a} 0 0 ${-a} Z`, fill, ink),
    path(`M 2 ${a * .48} Q ${l * .45} ${a * .62} ${l} ${b * .45} Q ${l + b * .4} ${b} ${l} ${b} Q ${l * .3} ${a * 1.08} 0 ${a} Z`, shadow),
    path(`M 2 ${-a * .65} Q ${l * .3} ${-a * .72} ${l * .58} ${-b * .62}`, 'none', { stroke: highlight, strokeWidth: 2.5, strokeLinecap: 'round' }),
  ]);
}

function boxerHead(x: number, y: number, radius: number): ArtworkNode {
  return group({ transform: `translate(${x} ${y}) scale(${radius / 30})`, testID: 'boxer-face' }, [
    ellipse(-27, 5, 6, 10, '#BE8060'), ellipse(27, 5, 6, 10, '#BE8060'),
    path('M -27 -16 Q -24 -34 0 -34 Q 26 -34 28 -13 L 24 17 Q 17 33 0 36 Q -19 31 -25 15 Z', '#D99D72', ink),
    path('M 15 -25 Q 31 -14 23 18 Q 12 34 0 36 L -8 26 Q 12 27 15 10 Z', '#BA7859'),
    path('M -28 -5 L -31 -26 L -22 -36 L -8 -34 L 4 -39 L 23 -33 L 30 -23 L 28 -3 L 20 -15 Q -2 -8 -22 -18 L -24 0 Z', '#232A33', ink),
    path('M -21 -25 Q 0 -22 20 -29', 'none', { stroke: '#4E535B', strokeWidth: 3 }),
    path('M -20 -1 L -6 3 M 7 3 L 21 -1', 'none', { stroke: '#3E2B27', strokeWidth: 4, strokeLinecap: 'round' }),
    path('M -20 7 L -7 8 M 8 8 L 21 6', 'none', { stroke: '#F7ECD7', strokeWidth: 3 }),
    ellipse(-12, 7, 2, 2.4, '#30282A'), ellipse(13, 6, 2, 2.4, '#30282A'),
    path('M 1 5 L -2 15 L 5 16 M -10 23 Q 1 20 12 22', 'none', { stroke: '#884F40', strokeWidth: 1.8, strokeLinecap: 'round' }),
    path('M -8 27 L 9 26', 'none', { stroke: '#EDBE94', strokeWidth: 2 }),
  ]);
}

export function buildBoxerArtwork(pose: ScreenPose, activeHand?: 'lHand' | 'rHand'): readonly ArtworkNode[] {
  const left = pose.lShoulder.x < pose.rShoulder.x ? pose.lShoulder : pose.rShoulder;
  const right = left === pose.lShoulder ? pose.rShoulder : pose.lShoulder;
  const { neck: n, chest: c, pelvis: p } = pose;
  const waist = Math.max(30, Math.min(43, Math.abs(right.x - left.x) * .36));
  const nodes: ArtworkNode[] = [];
  // One garment connects the waist to both moving thighs, including lateral steps.
  const legs = (["l", "r"] as const).map(prefix => {
    const hip = pose[`${prefix}Hip`], knee = pose[`${prefix}Knee`];
    nodes.push(limb(hip, knee, 28, 24, "#D39A70"));
    const length = Math.max(1, Math.hypot(knee.x - hip.x, knee.y - hip.y));
    const nx = (knee.y - hip.y) / length, ny = -(knee.x - hip.x) / length;
    const hem = { x: hip.x + (knee.x - hip.x) * .52, y: hip.y + (knee.y - hip.y) * .52 };
    return { hip, minus: { x: hem.x - nx * 29, y: hem.y - ny * 29 }, plus: { x: hem.x + nx * 29, y: hem.y + ny * 29 } };
  }).sort((a, b) => a.hip.x - b.hip.x);
  const [a, b] = legs;
  const crotch = { x: (a!.hip.x + b!.hip.x) / 2, y: Math.max(a!.hip.y, b!.hip.y) + 12 };
  nodes.push(path(`M ${p.x - waist} ${p.y - 9} L ${p.x + waist} ${p.y - 9}
    Q ${b!.hip.x + 30} ${b!.hip.y} ${b!.plus.x} ${b!.plus.y}
    L ${b!.minus.x} ${b!.minus.y} Q ${crotch.x} ${crotch.y} ${a!.plus.x} ${a!.plus.y}
    L ${a!.minus.x} ${a!.minus.y} Q ${a!.hip.x - 30} ${a!.hip.y} ${p.x - waist} ${p.y - 9} Z`,
    "#286260", { ...ink, testID: "connected-boxing-trunks" }));
  nodes.push(path(`M ${p.x} ${p.y + 12} L ${crotch.x} ${crotch.y}
    M ${a!.minus.x} ${a!.minus.y} L ${a!.plus.x} ${a!.plus.y}
    M ${b!.minus.x} ${b!.minus.y} L ${b!.plus.x} ${b!.plus.y}`,
    "none", { stroke: "#6B9B86", strokeWidth: 3, strokeLinejoin: "round" }));
  nodes.push(path(`M ${n.x - 13} ${n.y - 10} L ${n.x + 13} ${n.y - 10} L ${n.x + 17} ${n.y + 17} Q ${right.x + 25} ${right.y - 23} ${right.x + 19} ${right.y + 13} Q ${right.x - 2} ${c.y + 24} ${p.x + waist} ${p.y - 5} Q ${p.x} ${p.y + 13} ${p.x - waist} ${p.y - 5} Q ${left.x + 4} ${c.y + 29} ${left.x - 19} ${left.y + 13} Q ${left.x - 24} ${left.y - 20} ${n.x - 17} ${n.y + 17} Z`, '#D39A70', ink));
  nodes.push(path(`M ${left.x - 4} ${left.y + 14} Q ${left.x + 14} ${c.y + 40} ${p.x - waist + 8} ${p.y - 6} L ${p.x - waist} ${p.y - 5} Q ${left.x + 3} ${c.y + 25} ${left.x - 19} ${left.y + 13} Z`, '#AE7055'));
  nodes.push(path(`M ${n.x - 13} ${n.y + 7} L ${n.x + 12} ${n.y + 10} L ${n.x + 9} ${n.y + 25} L ${n.x} ${n.y + 32} Z`, '#AE7055'));
  nodes.push(path(`M ${left.x + 6} ${left.y + 12} Q ${c.x - 21} ${c.y - 4} ${c.x - 3} ${c.y + 4} M ${c.x + 5} ${c.y + 4} Q ${c.x + 30} ${c.y - 2} ${right.x - 6} ${right.y + 13} M ${c.x} ${c.y + 14} L ${p.x} ${p.y - 24} M ${p.x - 13} ${p.y - 30} Q ${p.x} ${p.y - 24} ${p.x + 13} ${p.y - 29}`, 'none', { stroke: '#AF7458', strokeWidth: 2, strokeLinecap: 'round' }));
  nodes.push(path(`M ${p.x - waist - 1} ${p.y - 9} Q ${p.x} ${p.y + 4} ${p.x + waist + 1} ${p.y - 9} L ${p.x + waist + 3} ${p.y + 8} Q ${p.x} ${p.y + 19} ${p.x - waist - 3} ${p.y + 8} Z`, '#EBDCB5', ink));
  nodes.push(path(`M ${p.x - 8} ${p.y + 1} L ${p.x + 8} ${p.y + 1} L ${p.x + 8} ${p.y + 10} L ${p.x - 8} ${p.y + 10} Z`, '#305553'));

  for (const command of buildBoxerRig(pose)) {
    const prefix = command.side === 'left' ? 'l' : 'r';
    if (command.part === 'head' && command.kind === 'circle') {
      nodes.push(boxerHead(pose.head.x, pose.head.y, command.diameter * .58));
    } else if (command.part === 'upperArm') {
      nodes.push(limb(pose[`${prefix}Shoulder`], pose[`${prefix}Elbow`], 19, 14, '#CF9068'));
    } else if (command.part === 'forearm') {
      const scale = Math.max(.9, Math.min(1.2, pose[`${prefix}Hand`].scale / pose.chest.scale));
      nodes.push(limb(pose[`${prefix}Elbow`], pose[`${prefix}Hand`], 15 * scale, 11 * scale, '#DCA078'));
    } else if (command.part === 'glove' && command.kind === 'circle') {
      const h = pose[`${prefix}Hand`], e = pose[`${prefix}Elbow`];
      // Cuff follows the existing forearm. Glove centre and depth envelope stay on the hand joint.
      const angle = Math.atan2(h.y - e.y, h.x - e.x) * 180 / Math.PI + 90;
      const scale = command.diameter / 60;
      const mirror = command.side === 'left' ? 1 : -1;
      nodes.push(group({ testID: `opponent-glove-${command.side}`, transform: `translate(${h.x} ${h.y}) rotate(${angle}) scale(${scale * mirror} ${scale})` }, redGlove));
      if (activeHand === `${prefix}Hand`) nodes.push({ tag: 'circle', attrs: { cx: h.x, cy: h.y, r: command.diameter / 2 + 3, fill: 'none', stroke: '#F3C969', strokeWidth: 2 } });
    }
  }
  return nodes;
}

export function buildPlayerGloves(guard: number): readonly ArtworkNode[] {
  const y = 360 + (165 - 360) * guard, offset = 90 - 63 * guard;
  return [-1, 1].map(side => group({
    testID: `player-glove-${side < 0 ? 'left' : 'right'}`,
    transform: `translate(${140 + side * offset} ${y}) rotate(${-side * 12 * (1 - guard)}) scale(${-side * 1.18} 1.18)`,
  }, [
    path('M -15 38 L -22 86 L 22 86 L 16 38 Z', '#A96F54', ink),
    ...blueGlove,
  ]));
}

export type CoachMood = 'smirk' | 'interested' | 'surprised';
export const COACH_INTRO = { mood: 'smirk' as const, line: '열 번. 한 대도 안 맞으면 인정하지.', note: '관장이 지켜봅니다. 열 번을 막고 인정을 받아내세요.' };
export function coachVerdict(counts: Readonly<{ PERFECT: number; SAFE: number; HIT: number }>) {
  if (counts.PERFECT === 10) return { mood: 'surprised' as const, line: '……어? 한 대도 안 맞았어?', note: '열 번 모두 완벽 회피. 관장이 팔짱을 풀었습니다.' };
  if (counts.HIT === 0) return { mood: 'interested' as const, line: '빈틈이 없군. 제법이야.', note: '열 번 모두 방어. 다음엔 회피도 노려보세요.' };
  if (counts.PERFECT + counts.SAFE >= 7) return { mood: 'interested' as const, line: '흠. 우연은 아닌 모양이군.', note: '놓친 공격을 기억하고, 한 번 더 보여주세요.' };
  return { mood: 'smirk' as const, line: '허, 주먹 구경하러 왔나?', note: '움직이기 시작할 때, 버튼을 한 번 눌러보세요.' };
}

/** Original P0 coach: an unimpressed old neighbourhood-gym veteran, arms folded. */
export function buildCoachArtwork(mood: CoachMood): readonly ArtworkNode[] {
  const surprised = mood === 'surprised';
  return [
    path('M 23 160 L 26 110 Q 29 89 53 87 L 83 87 Q 107 91 111 112 L 115 160 Z', '#395757', ink),
    path('M 54 73 L 82 73 L 85 98 Q 67 110 51 96 Z', '#BE8965', ink),
    path('M 52 89 L 63 109 L 54 145 L 39 96 M 83 89 L 74 110 L 85 146 L 97 99', '#E8D9AF', ink),
    path('M 46 99 L 53 139 M 89 100 L 82 139', 'none', { stroke: '#B7A786', strokeWidth: 2 }),
    ellipse(38, 57, 7, 11, '#D2A17A'), ellipse(97, 57, 7, 11, '#C18A68'),
    path('M 39 31 Q 47 12 71 15 Q 97 16 97 38 L 94 71 Q 83 89 67 90 Q 47 85 40 70 Z', '#DCB084', ink),
    path('M 84 25 Q 104 40 92 73 Q 79 91 64 88 L 64 81 Q 82 76 82 59 Z', '#C4916D'),
    path('M 38 53 L 32 30 L 38 17 L 48 14 L 47 24 Q 67 9 88 23 L 87 12 L 98 19 L 104 32 L 97 53 L 91 35 Q 67 22 46 37 L 44 53 Z', '#B7B8AA', ink),
    path('M 42 23 L 42 32 M 92 24 L 97 35 M 53 32 Q 70 27 82 33 M 53 38 Q 69 34 81 38', 'none', { stroke: '#917B65', strokeWidth: 1.3 }),
    path(surprised ? 'M 46 42 L 60 39 M 76 39 L 90 42' : mood === 'interested' ? 'M 46 47 L 61 46 M 75 44 L 90 42' : 'M 46 48 L 61 51 M 75 46 L 90 42', 'none', { stroke: '#515049', strokeWidth: 5, strokeLinecap: 'round' }),
    ellipse(55, 55, 7, surprised ? 6 : 2.5, '#F5E7CF'), ellipse(82, 53, 7, surprised ? 6 : 2.5, '#F5E7CF'),
    ellipse(56, 55, 2, surprised ? 3.7 : 2, '#37332D'), ellipse(81, 53, 2, surprised ? 3.7 : 2, '#37332D'),
    path('M 68 49 L 62 65 Q 67 69 74 64', 'none', { stroke: '#9C634E', strokeWidth: 2, strokeLinecap: 'round' }),
    path('M 67 67 Q 60 64 52 71 L 48 76 Q 60 78 68 73 Q 78 79 88 74 L 82 69 Q 75 65 67 67 Z', '#686255'),
    path(surprised ? 'M 61 79 Q 68 72 75 79 L 73 85 Q 66 89 61 83 Z' : 'M 58 80 Q 72 84 81 77', surprised ? '#604336' : 'none', { stroke: '#81543E', strokeWidth: 1.8, strokeLinecap: 'round' }),
    ...(surprised ? [
      path('M 30 106 Q 15 130 23 154 L 41 158 L 45 119 M 105 109 Q 120 134 112 155 L 96 158 L 91 119', '#456664', ink),
    ] : [
      path('M 33 103 Q 16 111 23 136 Q 32 147 48 143 L 96 119 L 86 106 L 43 123 Z', '#476A67', ink),
      path('M 92 116 L 102 113 Q 111 115 105 123 L 94 131 L 85 129 Z', '#D7A47C', ink),
      path('M 102 104 Q 119 118 107 137 Q 96 147 82 142 L 38 128 L 44 111 L 89 122 Z', '#547873', ink),
      path('M 42 116 L 33 110 Q 27 111 29 119 L 39 130 L 48 129 Z', '#DBAB82', ink),
      path('M 57 127 L 84 136', 'none', { stroke: '#87A099', strokeWidth: 2 }),
    ]),
    path('M 67 110 L 67 120', 'none', { stroke: '#C8B37C', strokeWidth: 2 }),
  ];
}

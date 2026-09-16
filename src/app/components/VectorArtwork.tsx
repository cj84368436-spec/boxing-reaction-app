import React from 'react';
import { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import type { ArtworkNode } from '../motion/boxingArtwork';

const shapes = { g: G, path: Path, ellipse: Ellipse, circle: Circle, rect: Rect, line: Line };
export function VectorArtwork({ nodes }: { readonly nodes: readonly ArtworkNode[] }) {
  return <>{nodes.map((node, index) => {
    const Shape = shapes[node.tag];
    return <Shape key={index} {...node.attrs}>
      {node.children ? <VectorArtwork nodes={node.children} /> : null}
    </Shape>;
  })}</>;
}

import { poseidon } from './poseidon.js';
import { toBigInt } from './field.js';
import type { FieldLike, MerklePath } from './types.js';

// Empty leaf value. A real beneficiary leaf is Poseidon(7 attributes), which is
// never 0, so empty slots never collide with a registered beneficiary.
export const ZERO_LEAF = 0n;

// Fixed-depth binary Merkle tree hashed with Poseidon(2), matching merkle.circom.
// Only the filled prefix is materialized; the rest of the tree is folded in via
// precomputed zero-subtree roots, so a depth-16 tree with 50 leaves is cheap.
export class PoseidonMerkleTree {
  readonly depth: number;
  zeros: bigint[] = [];
  layers: bigint[][] = [[]];

  constructor(depth: number) {
    this.depth = depth;
  }

  static async build(leaves: FieldLike[], depth: number): Promise<PoseidonMerkleTree> {
    const t = new PoseidonMerkleTree(depth);
    await t.initZeros();
    await t.buildLayers(leaves.map(toBigInt));
    return t;
  }

  private async initZeros(): Promise<void> {
    this.zeros = [ZERO_LEAF];
    for (let i = 0; i < this.depth; i++) {
      this.zeros.push(await poseidon([this.zeros[i], this.zeros[i]]));
    }
  }

  private async buildLayers(leaves: bigint[]): Promise<void> {
    this.layers = [leaves.slice()];
    for (let level = 0; level < this.depth; level++) {
      const cur = this.layers[level];
      const next: bigint[] = [];
      for (let i = 0; i < cur.length; i += 2) {
        const left = cur[i];
        const right = i + 1 < cur.length ? cur[i + 1] : this.zeros[level];
        next.push(await poseidon([left, right]));
      }
      if (next.length === 0) next.push(this.zeros[level + 1]);
      this.layers.push(next);
    }
  }

  root(): bigint {
    const top = this.layers[this.depth];
    return top.length ? top[0] : this.zeros[this.depth];
  }

  // Authentication path for a leaf: sibling at each level plus the position bit
  // (0 = current node is the left child). Mirrors the circuit's DualMux ordering.
  proof(index: number): MerklePath {
    const leafCount = this.layers[0].length;
    if (index < 0 || index >= leafCount) {
      throw new Error(`leaf index ${index} out of range (have ${leafCount} leaves)`);
    }
    const pathElements: bigint[] = [];
    const pathIndices: bigint[] = [];
    let idx = index;
    for (let level = 0; level < this.depth; level++) {
      const layer = this.layers[level];
      const isRight = idx % 2;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      const sibling = siblingIdx < layer.length ? layer[siblingIdx] : this.zeros[level];
      pathElements.push(sibling);
      pathIndices.push(BigInt(isRight));
      idx = Math.floor(idx / 2);
    }
    return { pathElements, pathIndices, root: this.root(), leafIndex: index };
  }
}

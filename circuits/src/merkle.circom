pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";

// Poseidon hash of an ordered (left, right) pair — one Merkle tree node.
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    hash <== h.out;
}

// If the path bit s == 0, the current hash is the LEFT child and the
// sibling is the RIGHT child; if s == 1 they are swapped. Booleanity of s
// is enforced so a prover cannot smuggle an out-of-range selector.
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Recompute a Merkle root from a leaf and its authentication path.
// `pathIndices[i]` is the position bit at level i (0 = leaf on the left).
template MerkleProof(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component selectors[depth];
    component hashers[depth];

    signal levelHash[depth + 1];
    levelHash[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== levelHash[i];
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];

        levelHash[i + 1] <== hashers[i].hash;
    }

    root <== levelHash[depth];
}

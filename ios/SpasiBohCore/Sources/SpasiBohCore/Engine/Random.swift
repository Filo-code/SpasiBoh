import Foundation

/// A small, fast, *seedable* PRNG.
///
/// Seedability is the point: session composition must be reproducible in tests.
/// `SystemRandomNumberGenerator` cannot be seeded, so asserting "this seed
/// picks exactly these items" would be impossible and the scheduler would only
/// ever be testable statistically.
///
/// This is mulberry32, ported from the web engine so both implementations draw
/// the same sequence from the same seed. The `&*` / `&+` operators are wrapping
/// arithmetic — the JS original relies on `Math.imul` and uint32 overflow, and
/// non-wrapping Swift operators would trap instead.
public struct SeededGenerator: RandomNumberGenerator, Sendable {
    private var state: UInt32

    public init(seed: UInt32) {
        // A zero seed makes mulberry32 degenerate; nudge it off zero.
        self.state = seed == 0 ? 0x9E37_79B9 : seed
    }

    public init(seed: String) {
        self.init(seed: Self.fnv1a(seed))
    }

    /// FNV-1a over the string's UTF-8 bytes. Stable across runs and platforms,
    /// which `String.hashValue` explicitly is not — Swift seeds its hasher
    /// randomly per process, so it can never be used for reproducible seeding.
    public static func fnv1a(_ string: String) -> UInt32 {
        var hash: UInt32 = 0x811C_9DC5
        for byte in string.utf8 {
            hash ^= UInt32(byte)
            hash = hash &* 0x0100_0193
        }
        return hash
    }

    private mutating func nextUInt32() -> UInt32 {
        state = state &+ 0x6D2B_79F5
        var t = state
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ (t ^ (t >> 7)) &* (t | 61)
        return t ^ (t >> 14)
    }

    public mutating func next() -> UInt64 {
        UInt64(nextUInt32()) << 32 | UInt64(nextUInt32())
    }

    /// Uniform in [0, 1).
    public mutating func nextDouble() -> Double {
        Double(nextUInt32()) / Double(UInt32.max) * (1 - .ulpOfOne)
    }

    /// Uniform integer in `0..<bound`. Returns 0 for a non-positive bound.
    public mutating func nextInt(below bound: Int) -> Int {
        guard bound > 0 else { return 0 }
        return Int(nextDouble() * Double(bound))
    }
}

public extension Array {
    /// Fisher-Yates using a seeded generator.
    func shuffled(using generator: inout SeededGenerator) -> [Element] {
        var copy = self
        guard copy.count > 1 else { return copy }
        for i in stride(from: copy.count - 1, to: 0, by: -1) {
            let j = generator.nextInt(below: i + 1)
            copy.swapAt(i, j)
        }
        return copy
    }

    /// Take `count` random elements without replacement.
    func sample(_ count: Int, using generator: inout SeededGenerator) -> [Element] {
        guard count > 0 else { return [] }
        guard count < self.count else { return shuffled(using: &generator) }
        return Array(shuffled(using: &generator).prefix(count))
    }

    /// Weighted roulette draw. Returns nil if every weight is <= 0, rather than
    /// silently falling back to a uniform pick — a caller with all-zero weights
    /// has a bug, and hiding it would make the scheduler's behaviour a mystery.
    func weightedChoice(
        using generator: inout SeededGenerator,
        weight: (Element) -> Double
    ) -> Element? {
        let weights = map { Swift.max(0, weight($0)) }
        let total = weights.reduce(0, +)
        guard total > 0 else { return nil }
        var roll = generator.nextDouble() * total
        for (element, w) in zip(self, weights) {
            roll -= w
            if roll <= 0 { return element }
        }
        return last
    }
}

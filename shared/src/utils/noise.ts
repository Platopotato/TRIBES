// A standard implementation of the Perlin Noise algorithm.
// This is used to generate natural-looking, non-random patterns for terrain.
export class Perlin {
    private p: number[] = [];

    constructor(seed?: number) {
        const random = seed ? this.seededRandom(seed) : Math.random;
        const permutation: number[] = [];
        for (let i = 0; i < 256; i++) {
            permutation.push(i);
        }

        // Shuffle the permutation array
        for (let i = permutation.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }
        
        // Duplicate the permutation array to avoid buffer overflows
        this.p = permutation.concat(permutation);
    }
    
    // Simple seeded random number generator
    private seededRandom(seed: number) {
        let s = seed;
        return () => {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
        };
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number): number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    public noise(x: number, y: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const p = this.p;
        const A = p[X] + Y;
        const B = p[X + 1] + Y;

        return this.lerp(v,
            this.lerp(u, this.grad(p[A], x, y), this.grad(p[B], x - 1, y)),
            this.lerp(u, this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1))
        );
    }
}

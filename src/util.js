import * as THREE from "three";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, f) => a + (b - a) * f;
const CUB = 0.46; // figure cards are drawn in cubit units, 1 cubit = 0.46 m
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export { TAU, clamp, lerp, CUB, reduceMotion, rngFrom, THREE };

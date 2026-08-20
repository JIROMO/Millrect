"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

test("Worker Boolean core subtracts 100 holes without mutating its exact inputs", () => {
  const app = bootApp();
  const ring = (cx, cy, radius, count = 128) =>
    Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * 2 * index) / count;
      return [
        cx + Math.cos(angle) * radius,
        cy + Math.sin(angle) * radius,
      ];
    });
  const base = [
    [
      [
        [-5, -5],
        [68, -5],
        [68, 68],
        [-5, 68],
      ],
    ],
  ];
  const cuts = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      cuts.push([[ring(col * 7, row * 7, 1.6)]]);
    }
  }
  const polys = [base, ...cuts];
  const before = JSON.stringify(polys);

  const result = app.runBooleanClipOperation("subtract", polys, {
    baseCount: 1,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].length, 101);
  assert.equal(JSON.stringify(polys), before);
});

# Complete-look integration history

**Historical / 历史记录:** The garment-then-makeup increment was integrated and
captured in PR #5. This file is not an open assignment. For current work, use the
[bilingual partner guide](partner-guide.md).

服装试穿后再上妆的功能已在 PR #5 中整合并完成结果采集。本文不是待办任务。
当前协作请参阅[中英双语合作开发指南](partner-guide.md)。

The retained implementation contract is:

1. Clothes VTO receives the portrait and garment reference.
2. The server downloads its result and supplies those bytes to Makeup VTO.
3. Each garment succeeds or fails independently.
4. Only the output of that sequence is labelled a complete look.

The implementation is in `server/src/youcam/completeLook.ts`; sequencing and
partial-failure coverage is in its adjacent test file. Historical checks are in
[verification.md](verification.md). Private inputs and credentials are not part
of the repository.

The later full-body flow adds one shared trousers step before two top-and-makeup
sequences. See the [README](../README.md) for current behavior and costs.

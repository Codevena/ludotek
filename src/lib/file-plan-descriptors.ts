import path from "node:path";
import { parseScanDescriptor, type ScannedDescriptorReference } from "@/lib/scanner";

export interface PlanSelection {
  sourceDeviceId: number;
  sourcePath: string;
  action: "copy" | "move" | "delete" | "rewrite";
  targetDeviceId?: number;
  targetPath?: string;
  generated: boolean;
  rewritten?: Buffer;
}
export interface PlanDescriptor {
  deviceId: number;
  filename: string;
  contents: string;
  references: { filename: string; token: ScannedDescriptorReference }[];
}
export const fileKey = (deviceId: number, filename: string) => `${deviceId}:${filename}`;
export const descriptorKind = (filename: string) => [".cue", ".gdi", ".m3u"].includes(path.posix.extname(filename).toLowerCase()) ? path.posix.extname(filename).toLowerCase() : null;

/** Pure graph transformation. The caller provides verified bounded actual bytes and manifest identities. */
export function expandDescriptorSelections(seeds: PlanSelection[], descriptors: Map<string, PlanDescriptor>, options: { closedMappings?: boolean } = {}): PlanSelection[] {
  const selected = new Map<string, PlanSelection>();
  const parents = new Map<string, Set<string>>();
  for (const [key, descriptor] of descriptors) for (const reference of descriptor.references) {
    const child = fileKey(descriptor.deviceId, reference.filename);
    const entries = parents.get(child) ?? new Set<string>();
    entries.add(key); parents.set(child, entries);
  }
  // A cyclic descriptor set cannot be declared emulator-resolvable.
  const indegrees = new Map([...descriptors.keys()].map((key) => [key, 0]));
  for (const descriptor of descriptors.values()) for (const reference of descriptor.references) {
    const child = fileKey(descriptor.deviceId, reference.filename);
    if (indegrees.has(child)) indegrees.set(child, indegrees.get(child)! + 1);
  }
  const acyclic = [...indegrees].filter(([, count]) => count === 0).map(([key]) => key);
  let visited = 0;
  for (let index = 0; index < acyclic.length; index++) {
    visited++;
    const descriptor = descriptors.get(acyclic[index])!;
    for (const reference of descriptor.references) {
      const key = fileKey(descriptor.deviceId, reference.filename);
      if (!indegrees.has(key)) continue;
      const next = indegrees.get(key)! - 1; indegrees.set(key, next);
      if (!next) acyclic.push(key);
    }
  }
  if (visited !== descriptors.size) throw new Error("Descriptor reference cycle is unsupported");
  const add = (selection: PlanSelection) => {
    const key = fileKey(selection.sourceDeviceId, selection.sourcePath);
    const previous = selected.get(key);
    if (previous) {
      if (selection.action === "rewrite" || (previous.action === selection.action && previous.targetDeviceId === selection.targetDeviceId && previous.targetPath === selection.targetPath)) return;
      if (previous.action !== "rewrite") throw new Error("Descriptor dependency has conflicting target mappings");
    }
    selected.set(key, selection);
    if (selected.size > 100) throw new Error("Expanded descriptor plan exceeds 100 operations");
  };
  for (const seed of seeds) add(seed);
  for (const seed of options.closedMappings ? [] : seeds) {
    const start = fileKey(seed.sourceDeviceId, seed.sourcePath);
    const connected = seed.action === "delete" || (seed.action === "move" && seed.targetDeviceId !== seed.sourceDeviceId);
    const pending = [start];
    const seen = new Set<string>();
    for (let index = 0; index < pending.length; index++) {
      const key = pending[index];
      if (seen.has(key)) continue; seen.add(key);
      const descriptor = descriptors.get(key);
      const children = descriptor?.references.map((entry) => fileKey(seed.sourceDeviceId, entry.filename)) ?? [];
      const related = connected ? [...children, ...parents.get(key) ?? []] : children;
      for (const relatedKey of related) {
        const filename = relatedKey.slice(relatedKey.indexOf(":") + 1);
        const targetPath = seed.targetPath ? path.posix.resolve(path.posix.dirname(seed.targetPath), path.posix.relative(path.posix.dirname(seed.sourcePath), filename)) : undefined;
        add({ sourceDeviceId: seed.sourceDeviceId, sourcePath: filename, action: seed.action, targetDeviceId: seed.targetDeviceId, targetPath, generated: true });
        pending.push(relatedKey);
      }
    }
  }
  // Any same-device move changes references in every transitive parent.
  const pendingParents = [...selected].filter(([, selection]) => selection.action === "move").map(([key]) => key);
  const seenParents = new Set<string>();
  for (let index = 0; index < pendingParents.length; index++) {
    const child = pendingParents[index];
    if (seenParents.has(child)) continue; seenParents.add(child);
    for (const parentKey of parents.get(child) ?? []) {
      const descriptor = descriptors.get(parentKey)!;
      if (!selected.has(parentKey)) add({ sourceDeviceId: descriptor.deviceId, sourcePath: descriptor.filename, action: "rewrite", targetDeviceId: descriptor.deviceId, targetPath: descriptor.filename, generated: true });
      pendingParents.push(parentKey);
    }
  }
  for (const [key, selection] of selected) {
    const descriptor = descriptors.get(key);
    if (!descriptor || selection.action === "delete") continue;
    if (!selection.targetPath || !selection.targetDeviceId) throw new Error("Descriptor has no target mapping");
    if (descriptorKind(selection.targetPath) !== descriptorKind(selection.sourcePath)) throw new Error("Descriptor format cannot be changed by a file-path operation");
    const replacements = descriptor.references.map(({ filename, token }) => {
      const dependency = selected.get(fileKey(descriptor.deviceId, filename));
      if (options.closedMappings && !dependency) throw new Error("Closed source set is missing a descriptor dependency");
      if (dependency?.action === "delete") throw new Error("Descriptor would reference a deleted dependency");
      const targetDeviceId = dependency?.targetDeviceId ?? descriptor.deviceId;
      const targetPath = dependency?.targetPath ?? filename;
      if (targetDeviceId !== selection.targetDeviceId) throw new Error("Descriptor would retain references to another device");
      const reference = path.posix.relative(path.posix.dirname(selection.targetPath!), targetPath);
      if (!reference || reference.includes("\\") || /[\x00-\x1f\x7f]/.test(reference)) throw new Error("Unsafe rewritten descriptor reference");
      let value = reference;
      if (descriptorKind(selection.sourcePath) !== ".m3u") {
        const quote = token.quote && !reference.includes(token.quote) ? token.quote : '"';
        if (reference.includes(quote)) throw new Error("Descriptor reference cannot be safely quoted");
        value = `${quote}${reference}${quote}`;
      } else if (reference.trim() !== reference) throw new Error("Playlist reference has ambiguous whitespace");
      return { ...token, value, targetPath };
    });
    let rewritten = descriptor.contents;
    for (const replacement of [...replacements].sort((a, b) => b.start - a.start)) rewritten = rewritten.slice(0, replacement.start) + replacement.value + rewritten.slice(replacement.end);
    const reparsed = parseScanDescriptor(rewritten, descriptorKind(selection.sourcePath)!);
    if (!reparsed || reparsed.length !== replacements.length || reparsed.some((entry, index) => path.posix.resolve(path.posix.dirname(selection.targetPath!), entry.reference) !== replacements[index].targetPath)) {
      throw new Error("Rewritten descriptor does not preserve all resolvable references");
    }
    selection.rewritten = Buffer.from(rewritten);
  }
  return [...selected.values()].sort((a, b) => Number(!!a.rewritten) - Number(!!b.rewritten) || a.sourcePath.localeCompare(b.sourcePath));
}

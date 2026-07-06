"use strict";

// 3MF エクスポート（最小サブセット）。STL と異なり単位情報（mm）を持てるため、
// スライサー側でのスケール事故を防げる。ZIP は外部依存を避け、無圧縮(STORED)の
// 最小実装を自前で書く（3MF 仕様上、圧縮は必須ではない）。

// ── CRC32 ────────────────────────────────────────────────────
let _crc32Table = null;
function _crc32(bytes) {
  if (!_crc32Table) {
    _crc32Table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      _crc32Table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = _crc32Table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── 無圧縮 ZIP ライター ────────────────────────────────────────
// files: [{ name: string, data: Uint8Array }]
function _buildZipStore(files) {
  const chunks = [];
  const centralEntries = [];
  let offset = 0;

  const u16 = (n) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  };
  const u32 = (n) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  };
  const push = (arr) => {
    chunks.push(arr);
    offset += arr.length;
  };

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const data = file.data;
    const crc = _crc32(data);
    const localOffset = offset;

    push(u32(0x04034b50)); // local file header signature
    push(u16(20)); // version needed
    push(u16(0)); // flags
    push(u16(0)); // method = store
    push(u16(0)); // mod time
    push(u16(0)); // mod date
    push(u32(crc));
    push(u32(data.length)); // compressed size
    push(u32(data.length)); // uncompressed size
    push(u16(nameBytes.length));
    push(u16(0)); // extra length
    push(nameBytes);
    push(data);

    centralEntries.push({ nameBytes, crc, size: data.length, localOffset });
  }

  const centralDirStart = offset;
  for (const e of centralEntries) {
    push(u32(0x02014b50)); // central directory header signature
    push(u16(20)); // version made by
    push(u16(20)); // version needed
    push(u16(0)); // flags
    push(u16(0)); // method
    push(u16(0)); // mod time
    push(u16(0)); // mod date
    push(u32(e.crc));
    push(u32(e.size)); // compressed size
    push(u32(e.size)); // uncompressed size
    push(u16(e.nameBytes.length));
    push(u16(0)); // extra length
    push(u16(0)); // comment length
    push(u16(0)); // disk number start
    push(u16(0)); // internal attrs
    push(u32(0)); // external attrs
    push(u32(e.localOffset));
    push(e.nameBytes);
  }
  const centralDirSize = offset - centralDirStart;

  push(u32(0x06054b50)); // end of central directory signature
  push(u16(0)); // disk number
  push(u16(0)); // disk with central dir
  push(u16(centralEntries.length)); // entries on this disk
  push(u16(centralEntries.length)); // total entries
  push(u32(centralDirSize));
  push(u32(centralDirStart));
  push(u16(0)); // comment length

  const total = new Uint8Array(offset);
  let pos = 0;
  for (const c of chunks) {
    total.set(c, pos);
    pos += c.length;
  }
  return total;
}

const _3MF_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;

const _3MF_RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

// meshPayloads: [{ position: Float32Array }]（非インデックス・3頂点ごとに1三角形）
function _build3MFModelXML(meshPayloads) {
  const objects = [];
  const items = [];
  let objectId = 1;
  for (const payload of meshPayloads) {
    const pos = payload.position;
    const vertexLines = [];
    const triLines = [];
    const vertCount = pos.length / 3;
    for (let i = 0; i < vertCount; i++) {
      vertexLines.push(
        `<vertex x="${pos[i * 3]}" y="${pos[i * 3 + 1]}" z="${pos[i * 3 + 2]}"/>`,
      );
    }
    for (let i = 0; i < vertCount; i += 3) {
      triLines.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`);
    }
    objects.push(
      `<object id="${objectId}" type="model"><mesh><vertices>${vertexLines.join("")}</vertices><triangles>${triLines.join("")}</triangles></mesh></object>`,
    );
    items.push(`<item objectid="${objectId}"/>`);
    objectId++;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>${objects.join("")}</resources>
  <build>${items.join("")}</build>
</model>
`;
}

function build3MF(meshPayloads) {
  const enc = new TextEncoder();
  const files = [
    { name: "[Content_Types].xml", data: enc.encode(_3MF_CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(_3MF_RELS) },
    {
      name: "3D/3dmodel.model",
      data: enc.encode(_build3MFModelXML(meshPayloads)),
    },
  ];
  return _buildZipStore(files);
}

function _download3MF(bytes) {
  const blob = new Blob([bytes], { type: "model/3mf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download =
    (document.getElementById("project-name")?.value || "model") + ".3mf";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function export3MF() {
  await _ensureMeshesForExport();
  if (!_3meshes.length) {
    alert(_3dStatus.message || t("view3d.noMesh"));
    return;
  }

  const cleanMeshes = _3meshes.map(_makeCleanExportMesh);
  try {
    const validation = validateMeshesForExport(cleanMeshes);
    if (!validation.ok) {
      alert(validation.message);
      return;
    }
    if (validation.message) {
      const proceed = confirm(
        t("view3d.stlWarningConfirm", { message: validation.message }),
      );
      if (!proceed) return;
    }

    // 3MF は mm 単位。頂点座標は Three.js のワールド座標がそのまま mm
    // （アプリの 3D シーンは real units / REAL_PER_MM ではなく mm スケールで構築されている）。
    const payloads = cleanMeshes.map(_meshPayloadFromMesh);
    const bytes = build3MF(payloads);
    _download3MF(bytes);
  } finally {
    for (const m of cleanMeshes) {
      m.geometry?.dispose();
      m.material?.dispose?.();
    }
  }
}

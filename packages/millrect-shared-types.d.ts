// Millrect 共有型 — packages 間で再利用するドキュメントモデルの ambient 型。
//
// これらは import/export を持たない ambient 宣言なので、script スコープの
// packages/*.ts（global を共有する）から import なしで参照できる。実行時 JS は
// 生成しない（.d.ts のため emit なし）。新しい共有型はここに追記する。

// ── 幾何プリミティブ（polygon-clipping 形式）─────────────────────
type MillrectPoint = [number, number];
type MillrectRing = MillrectPoint[];
/** 外周 + ホール群。rings[0]=外周, rings[1..]=穴 */
type MillrectPolygon = MillrectRing[];

// ── ビュー定義（正投影 6 面 + section/detail）─────────────────────
type MillrectViewType =
  | "top"
  | "bottom"
  | "front"
  | "back"
  | "right"
  | "left"
  | "section"
  | "detail";

interface MillrectViewDefinition {
  type: MillrectViewType | null;
  normal: [number, number, number] | null;
  up: [number, number, number] | null;
}

// ── ドキュメントモデル（Undo/エクスポート対象）───────────────────
type MillrectStrokeWidth = "thin" | "medium" | "thick";

interface MillrectScale {
  numerator: number;
  denominator: number;
}

/** 共通 Shape。種類ごとの座標プロパティは index signature で許容する。 */
interface MillrectShape {
  id: string;
  type: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: MillrectStrokeWidth;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  ghost?: boolean;
  [key: string]: unknown;
}

interface MillrectLayer {
  id: string;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  shapes: MillrectShape[];
}

interface MillrectPage {
  id: string;
  name?: string;
  paper?: string;
  orientation?: "landscape" | "portrait";
  scale?: MillrectScale;
  viewDefinition?: MillrectViewDefinition;
  dimensions?: unknown[];
  constraints?: unknown[];
  referenceImage?: unknown;
  layers: MillrectLayer[];
}

interface MillrectProjectJson {
  projectName?: string;
  unit?: string;
  fonts?: unknown[];
  pages: MillrectPage[];
  [key: string]: unknown;
}

// ── Profile（State 保存なしの派生データ）─────────────────────────
interface MillrectProfile {
  id: string;
  sourceId: string;
  pageId: string;
  rings: MillrectRing[];
  bbox: { x: number; y: number; w: number; h: number };
  area: number;
}

// ── 検証結果（schema バリデータ共通）────────────────────────────
interface MillrectValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// ── Model IR / Geometry data（3D 派生パイプライン）──────────────
// operation / IR profile は種類ごとにフィールドが異なるため、既知の必須キー
// だけ固定し残りは index signature で許容する（厳密 union は将来）。
interface MillrectMaterial {
  color: string;
  source?: string;
}

interface MillrectModelOperation {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface MillrectIrProfile {
  id: string;
  sourceId?: string | null;
  pageId?: string;
  viewType?: string;
  rings: MillrectRing[];
  bbox?: { x: number; y: number; w: number; h: number; [key: string]: number };
  area?: number;
  material?: MillrectMaterial;
  [key: string]: unknown;
}

interface MillrectModelDimensions {
  width: number;
  depth: number;
  height: number;
}

interface MillrectModelIr {
  kind?: string;
  schemaVersion?: number;
  units?: string;
  source?: Record<string, unknown>;
  dimensions?: Partial<MillrectModelDimensions>;
  axes?: string[];
  profiles?: MillrectIrProfile[];
  operations?: MillrectModelOperation[];
  warnings?: string[];
  logs?: unknown[];
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface MillrectMesh {
  id: string;
  role?: string;
  vertices: number[][];
  faces: number[][];
  material?: MillrectMaterial;
}

interface MillrectGeometryData {
  kind: string;
  schemaVersion: number;
  units: string;
  meshes: MillrectMesh[];
  [key: string]: unknown;
}

// バリデータ呼び出し + 派生データを返す共通パイプライン結果。
interface MillrectGeometryResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  logs: unknown[];
  data: MillrectGeometryData | null;
}

interface MillrectModelIrResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  logs: unknown[];
  ir: MillrectModelIr | null;
}

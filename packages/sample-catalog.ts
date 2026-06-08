"use strict";

type SampleType = "moduleJoint1" | "multiview" | "partDsl";
type SampleFitView = "page" | "multiview";
type PaperSize = "A4";
type PaperOrientation = "portrait" | "landscape";
type PartDslPart = "box" | "l_bracket" | "enclosure" | "panel";
type PartDslView = "top" | "front" | "right" | "left" | "back" | "bottom";

interface SampleDefaultForm {
  paper: PaperSize;
  orientation: PaperOrientation;
  scale: {
    numerator: number;
    denominator: number;
  };
}

interface HoleGridFeature {
  type: "hole_grid";
  view: PartDslView;
  count: [number, number];
  diameter_mm: number;
  inset_mm: number;
}

interface SamplePartDsl {
  version: 1;
  part: PartDslPart;
  params: Record<string, number>;
  views: PartDslView[];
  features: HoleGridFeature[];
}

interface SampleCatalogEntry {
  id: string;
  type: SampleType;
  tagKey: string;
  nameKey: string;
  descKey: string;
  hintKey: string;
  defaultProjectNameKey: string;
  fitView: SampleFitView;
  defaultForm?: SampleDefaultForm;
  options?: {
    includeSideView: boolean;
  };
  dsl?: SamplePartDsl;
}

/**
 * 初見ユーザー向けサンプルプロジェクト定義。
 * 起動ダイアログ・samples/*.json 生成・README で共有。
 */
const SAMPLE_CATALOG: SampleCatalogEntry[] = [
  {
    id: "module-joint-1",
    type: "moduleJoint1",
    tagKey: "samples.tag.2d",
    nameKey: "samples.moduleJoint1.name",
    descKey: "samples.moduleJoint1.desc",
    hintKey: "samples.moduleJoint1.hint",
    defaultProjectNameKey: "samples.moduleJoint1.defaultName",
    fitView: "page",
    defaultForm: {
      paper: "A4",
      orientation: "portrait",
      scale: { numerator: 1, denominator: 1 },
    },
  },
  {
    id: "starter-box",
    type: "multiview",
    tagKey: "samples.tag.3d",
    nameKey: "samples.starterBox.name",
    descKey: "samples.starterBox.desc",
    hintKey: "samples.starterBox.hint",
    defaultProjectNameKey: "samples.starterBox.defaultName",
    fitView: "multiview",
    options: {
      includeSideView: false,
    },
  },
  {
    id: "mounting-plate",
    type: "partDsl",
    tagKey: "samples.tag.3d",
    nameKey: "samples.mountingPlate.name",
    descKey: "samples.mountingPlate.desc",
    hintKey: "samples.mountingPlate.hint",
    defaultProjectNameKey: "samples.mountingPlate.defaultName",
    fitView: "page",
    dsl: {
      version: 1,
      part: "box",
      params: { W: 100, D: 60, H: 20 },
      views: ["top", "front"],
      features: [
        {
          type: "hole_grid",
          view: "top",
          count: [2, 2],
          diameter_mm: 4,
          inset_mm: 8,
        },
      ],
    },
  },
  {
    id: "l-bracket",
    type: "partDsl",
    tagKey: "samples.tag.3d",
    nameKey: "samples.lBracket.name",
    descKey: "samples.lBracket.desc",
    hintKey: "samples.lBracket.hint",
    defaultProjectNameKey: "samples.lBracket.defaultName",
    fitView: "page",
    dsl: {
      version: 1,
      part: "l_bracket",
      params: { A: 80, B: 60, T: 5, H: 40 },
      views: ["top", "front"],
      features: [],
    },
  },
  {
    id: "enclosure",
    type: "partDsl",
    tagKey: "samples.tag.3d",
    nameKey: "samples.enclosure.name",
    descKey: "samples.enclosure.desc",
    hintKey: "samples.enclosure.hint",
    defaultProjectNameKey: "samples.enclosure.defaultName",
    fitView: "multiview",
    dsl: {
      version: 1,
      part: "enclosure",
      params: { W: 120, D: 80, H: 50, T: 3 },
      views: ["top", "front", "right"],
      features: [],
    },
  },
  {
    id: "laser-panel",
    type: "partDsl",
    tagKey: "samples.tag.2d",
    nameKey: "samples.laserPanel.name",
    descKey: "samples.laserPanel.desc",
    hintKey: "samples.laserPanel.hint",
    defaultProjectNameKey: "samples.laserPanel.defaultName",
    fitView: "page",
    dsl: {
      version: 1,
      part: "panel",
      params: { W: 200, H: 150 },
      views: ["top"],
      features: [
        {
          type: "hole_grid",
          view: "top",
          count: [3, 2],
          diameter_mm: 3,
          inset_mm: 12,
        },
      ],
    },
  },
];

function getSampleCatalogEntry(id: string): SampleCatalogEntry | null {
  return SAMPLE_CATALOG.find((entry) => entry.id === id) || null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SAMPLE_CATALOG, getSampleCatalogEntry };
}

if (typeof window !== "undefined") {
  Object.assign(window, { SAMPLE_CATALOG, getSampleCatalogEntry });
}

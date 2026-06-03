import CoreText
import CoreGraphics
import Foundation

// MARK: - JSON models

struct Scale: Codable {
    let numerator: Double
    let denominator: Double
}

struct ShapePayload: Codable {
    let text: String
    let fontSize: Double?
    let fontFamily: String?
    let fontWeight: String?
    let textAlign: String?
    let lineHeight: Double?
    let stroke: String?
    let strokeWidth: String?
}

struct LinePayload: Codable {
    let text: String
    let lineIndex: Int
    let xPaper: Double
    let yTopPaper: Double?
    let yBaselinePaper: Double?
}

struct LayoutPaper: Codable {
    let insetTop: Double
    let insetLeft: Double
}

struct LayoutPaperFull: Codable {
    let w: Double
    let h: Double
    let insetTop: Double
    let insetLeft: Double
}

struct AnchorPaper: Codable {
    let x: Double
    let y: Double
}

struct InputPayload: Codable {
    let mode: String?
    let shape: ShapePayload
    let scale: Scale
    let layoutPaper: LayoutPaper?
    let anchorPaper: AnchorPaper
    let lines: [LinePayload]?
    let fontCandidates: [String]?
    let paperWidth: Double?
}

struct LayoutResultPayload: Codable {
    let layoutPaper: LayoutPaperFull
    let anchorPaper: AnchorPaper
    let lines: [LinePayload]
}

struct PathChild: Codable {
    let type: String
    let contours: [[[[Double]]]]
    let stroke: String
    let fill: String
    let strokeWidth: String
}

struct OutputPayload: Codable {
    let children: [PathChild]?
    let layout: LayoutResultPayload?
    let error: String?
}

// MARK: - Geometry helpers

private let bezierSteps = 8

private func ringSignedArea(_ ring: [[Double]]) -> Double {
    var area = 0.0
    guard ring.count > 2 else { return 0 }
    for i in 0..<ring.count {
        let j = (i + 1) % ring.count
        area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
    }
    return area / 2.0
}

private func pointInRing(_ x: Double, _ y: Double, _ ring: [[Double]]) -> Bool {
    var inside = false
    var j = ring.count - 1
    for i in 0..<ring.count {
        let xi = ring[i][0], yi = ring[i][1]
        let xj = ring[j][0], yj = ring[j][1]
        let intersect = ((yi > y) != (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi)
        if intersect { inside.toggle() }
        j = i
    }
    return inside
}

private func ringCenter(_ ring: [[Double]]) -> (Double, Double) {
    var x = 0.0
    var y = 0.0
    for pt in ring {
        x += pt[0]
        y += pt[1]
    }
    let n = Double(ring.count)
    return (x / n, y / n)
}

private func normalizeRingByDepth(_ ring: [[Double]], depth: Int) -> [[Double]] {
    let ccw = ringSignedArea(ring) > 0
    let wantCcw = depth % 2 == 0
    if ccw == wantCcw { return ring }
    return ring.reversed()
}

private func groupRingsIntoPolygons(_ rings: [[[Double]]]) -> [[[[Double]]]] {
    // Keep in sync with packages/text-contour-grouping.js (npm run verify:contours).
    if rings.isEmpty { return [] }
    if rings.count == 1 {
        return [[normalizeRingByDepth(rings[0], depth: 0)]]
    }

    let meta = rings.enumerated().map { (index, ring) in
        (index: index, area: abs(ringSignedArea(ring)))
    }
    var parent = Array(repeating: -1, count: rings.count)

    for i in 0..<rings.count {
        let (cx, cy) = ringCenter(rings[i])
        var best = -1
        var bestArea = Double.infinity
        for j in 0..<rings.count where j != i {
            if meta[j].area <= meta[i].area { continue }
            if pointInRing(cx, cy, rings[j]) {
                if meta[j].area < bestArea {
                    bestArea = meta[j].area
                    best = j
                }
            }
        }
        parent[i] = best
    }

    var children = Array(repeating: [Int](), count: rings.count)
    for i in 0..<rings.count where parent[i] >= 0 {
        children[parent[i]].append(i)
    }

    func collect(_ idx: Int, depth: Int, _ out: inout [[[Double]]]) {
        out.append(normalizeRingByDepth(rings[idx], depth: depth))
        for child in children[idx] {
            collect(child, depth: depth + 1, &out)
        }
    }

    var polys: [[[[Double]]]] = []
    for i in 0..<rings.count where parent[i] < 0 {
        var poly: [[[Double]]] = []
        collect(i, depth: 0, &poly)
        polys.append(poly)
    }
    return polys
}

private let realPerMm: Double = 10

private func paperToReal(_ x: Double, _ y: Double, scale: Scale) -> [Double] {
    let f = realPerMm * scale.denominator / scale.numerator
    return [x * f, y * f]
}

private class PathCollector {
    var rings: [[[Double]]] = []
    private var current: [[Double]] = []

    func moveTo(_ x: Double, _ y: Double) {
        if current.count > 2 { rings.append(current) }
        current = [[x, y]]
    }

    func lineTo(_ x: Double, _ y: Double) {
        current.append([x, y])
    }

    func closePath() {
        guard current.count > 2 else {
            current = []
            return
        }
        if let first = current.first {
            current.append(first)
        }
        rings.append(current)
        current = []
    }

    func finish() {
        if current.count > 2 { rings.append(current) }
        current = []
    }
}

private func sampleCubic(
    _ x0: Double, _ y0: Double,
    _ x1: Double, _ y1: Double,
    _ x2: Double, _ y2: Double,
    _ x3: Double, _ y3: Double,
    _ emit: (Double, Double) -> Void
) {
    for i in 1...bezierSteps {
        let t = Double(i) / Double(bezierSteps)
        let mt = 1 - t
        let x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3
        let y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3
        emit(x, y)
    }
}

private func flattenPath(_ path: CGPath, transform: CGAffineTransform) -> [[[Double]]] {
    var cx = 0.0, cy = 0.0
    var sx = 0.0, sy = 0.0
    let collector = PathCollector()

    path.applyWithBlock { element in
        let pts = element.pointee.points
        switch element.pointee.type {
        case .moveToPoint:
            let p = CGPoint(x: pts[0].x, y: pts[0].y).applying(transform)
            cx = p.x; cy = p.y; sx = cx; sy = cy
            collector.moveTo(cx, cy)
        case .addLineToPoint:
            let p = CGPoint(x: pts[0].x, y: pts[0].y).applying(transform)
            cx = p.x; cy = p.y
            collector.lineTo(cx, cy)
        case .addQuadCurveToPoint:
            let p0 = CGPoint(x: cx, y: cy)
            let p1 = CGPoint(x: pts[0].x, y: pts[0].y).applying(transform)
            let p2 = CGPoint(x: pts[1].x, y: pts[1].y).applying(transform)
            sampleCubic(p0.x, p0.y, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y) { x, y in
                collector.lineTo(x, y)
            }
            cx = p2.x; cy = p2.y
        case .addCurveToPoint:
            let p0 = CGPoint(x: cx, y: cy)
            let p1 = CGPoint(x: pts[0].x, y: pts[0].y).applying(transform)
            let p2 = CGPoint(x: pts[1].x, y: pts[1].y).applying(transform)
            let p3 = CGPoint(x: pts[2].x, y: pts[2].y).applying(transform)
            sampleCubic(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y) { x, y in
                collector.lineTo(x, y)
            }
            cx = p3.x; cy = p3.y
        case .closeSubpath:
            collector.closePath()
            cx = sx; cy = sy
        @unknown default:
            break
        }
    }
    collector.finish()
    return collector.rings
}

// MARK: - Font resolution

private func expandCandidates(_ shape: ShapePayload, explicit: [String]?) -> [String] {
    var out: [String] = []
    var seen = Set<String>()
    func add(_ name: String) {
        let k = name.lowercased()
        guard !name.isEmpty, !seen.contains(k) else { return }
        seen.insert(k)
        out.append(name)
    }
    for f in explicit ?? [] { add(f) }
    let raw = (shape.fontFamily ?? "Helvetica,Arial,sans-serif")
        .split(separator: ",")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "'\"")) }
    for f in raw where !f.isEmpty && !["sans-serif", "serif", "monospace"].contains(f.lowercased()) {
        add(String(f))
        if f.localizedCaseInsensitiveContains("helvetica") {
            add("Helvetica Neue"); add("Helvetica"); add("Arial")
        } else if f.localizedCaseInsensitiveContains("hiragino") || f.contains("ヒラギノ") {
            add("Hiragino Sans"); add("Hiragino Kaku Gothic ProN")
        }
    }
    add("Helvetica Neue")
    add("Helvetica")
    add("Hiragino Sans")
    add("Arial")
    return out
}

private func resolveFont(candidates: [String], size: CGFloat, bold: Bool) -> CTFont {
    for name in candidates {
        let base = CTFontCreateWithName(name as CFString, size, nil)
        if CTFontCopyPostScriptName(base) as String? == ".LastResort" { continue }
        if bold {
            let desc = CTFontCopyFontDescriptor(base)
            if let boldDesc = CTFontDescriptorCreateCopyWithSymbolicTraits(
                desc, .traitBold, .traitBold
            ) {
                return CTFontCreateWithFontDescriptor(boldDesc, size, nil)
            }
        }
        return base
    }
    return CTFontCreateWithName("Helvetica" as CFString, size, nil)
}

// MARK: - Layout (Core Text)

private func createAttributedString(_ text: String, font: CTFont) -> NSAttributedString {
    let attrs: [NSAttributedString.Key: Any] = [
        kCTFontAttributeName as NSAttributedString.Key: font,
    ]
    return NSAttributedString(string: text, attributes: attrs)
}

private func wrapParagraph(_ text: String, font: CTFont, maxWidth: CGFloat?) -> [String] {
    if text.isEmpty { return [""] }
    guard let maxWidth = maxWidth, maxWidth > 0 else { return [text] }

    let attr = createAttributedString(text, font: font)
    let typesetter = CTTypesetterCreateWithAttributedString(attr)
    var lines: [String] = []
    var start = 0
    let len = attr.length

    while start < len {
        var count = CTTypesetterSuggestLineBreak(typesetter, start, Double(maxWidth))
        if count <= 0 { count = 1 }
        let end = min(start + count, len)
        let slice = attr.attributedSubstring(from: NSRange(location: start, length: end - start)).string
        lines.append(slice)
        start = end
    }
    return lines.isEmpty ? [""] : lines
}

private func lineTypographicWidth(_ text: String, font: CTFont) -> Double {
    if text.isEmpty { return 0 }
    let attr = createAttributedString(text, font: font)
    let line = CTLineCreateWithAttributedString(attr)
    var ascent: CGFloat = 0, descent: CGFloat = 0, leading: CGFloat = 0
    return Double(CTLineGetTypographicBounds(line, &ascent, &descent, &leading))
}

private func alignedX(
    lineWidth: Double,
    frameWidth: Double,
    anchorX: Double,
    align: String
) -> Double {
    switch align {
    case "center":
        return anchorX + max(0, (frameWidth - lineWidth) / 2)
    case "right":
        return anchorX + max(0, frameWidth - lineWidth)
    default:
        return anchorX
    }
}

private func computeTextLayout(_ input: InputPayload) throws -> LayoutResultPayload {
    let shape = input.shape
    let text = shape.text
    let fontSize = shape.fontSize ?? 3.5
    let lineHeightMult = shape.lineHeight ?? 1
    let lineHeight = fontSize * lineHeightMult
    let align = shape.textAlign ?? "left"
    let anchor = input.anchorPaper
    let paperWidth = input.paperWidth

    let candidates = expandCandidates(shape, explicit: input.fontCandidates)
    let font = resolveFont(
        candidates: candidates,
        size: CGFloat(fontSize),
        bold: shape.fontWeight == "bold"
    )

    if text.isEmpty {
        let w = max(fontSize * 0.25, 1)
        let h = fontSize * lineHeightMult
        return LayoutResultPayload(
            layoutPaper: LayoutPaperFull(w: w, h: h, insetTop: 0, insetLeft: 0),
            anchorPaper: anchor,
            lines: []
        )
    }

    let paragraphs = text.components(separatedBy: "\n")
    var visualLines: [(text: String, lineIndex: Int)] = []
    var globalIndex = 0
    for para in paragraphs {
        let wrapped = wrapParagraph(
            para,
            font: font,
            maxWidth: paperWidth.map { CGFloat($0) }
        )
        for wLine in wrapped {
            visualLines.append((text: wLine, lineIndex: globalIndex))
            globalIndex += 1
        }
    }

    var maxLineWidth = 0.0
    var linePayloads: [LinePayload] = []

    for (idx, vLine) in visualLines.enumerated() {
        let lw = lineTypographicWidth(vLine.text, font: font)
        maxLineWidth = max(maxLineWidth, lw)
        let fw = paperWidth ?? lw
        let xPaper = alignedX(
            lineWidth: lw,
            frameWidth: fw,
            anchorX: anchor.x,
            align: align
        )
        let yTop = anchor.y + Double(idx) * lineHeight
        linePayloads.append(LinePayload(
            text: vLine.text,
            lineIndex: vLine.lineIndex,
            xPaper: xPaper,
            yTopPaper: yTop,
            yBaselinePaper: nil
        ))
    }

    let pad = max(0.5, fontSize * 0.06)
    let layoutW = paperWidth ?? max(maxLineWidth + pad, 1)
    let layoutH = max(Double(visualLines.count) * lineHeight, lineHeight)

    return LayoutResultPayload(
        layoutPaper: LayoutPaperFull(w: layoutW, h: layoutH, insetTop: 0, insetLeft: 0),
        anchorPaper: anchor,
        lines: linePayloads
    )
}

// MARK: - Outline

private func outlinePayload(_ input: InputPayload) throws -> OutputPayload {
    let layout: LayoutResultPayload
    let outlineLines: [LinePayload]
    if let lines = input.lines, !lines.isEmpty {
        layout = try computeTextLayout(input)
        outlineLines = lines
    } else {
        layout = try computeTextLayout(input)
        outlineLines = layout.lines
    }

    let shape = input.shape
    let fontSize = CGFloat(shape.fontSize ?? 3.5)
    let lineHeight = CGFloat(shape.lineHeight ?? 1)
    let bold = shape.fontWeight == "bold"
    let fillColor = shape.stroke ?? "#1a1a2e"
    let realScale = input.scale

    let candidates = expandCandidates(shape, explicit: input.fontCandidates)
    let font = resolveFont(candidates: candidates, size: fontSize, bold: bold)
    let ascent = CTFontGetAscent(font)

    var children: [PathChild] = []

    for line in outlineLines {
        guard !line.text.isEmpty else { continue }

        let attrs: [NSAttributedString.Key: Any] = [
            kCTFontAttributeName as NSAttributedString.Key: font,
        ]
        let attrString = NSAttributedString(string: line.text, attributes: attrs)
        let ctLine = CTLineCreateWithAttributedString(attrString)

        let xStart = line.xPaper
        let yBaseline: Double
        if let yTop = line.yTopPaper {
            yBaseline = yTop + Double(CTFontGetAscent(font))
        } else if let measured = line.yBaselinePaper {
            yBaseline = measured
        } else {
            yBaseline = input.anchorPaper.y + Double(ascent)
                + Double(line.lineIndex) * Double(fontSize) * Double(lineHeight)
        }

        let runs = CTLineGetGlyphRuns(ctLine) as! [CTRun]
        for run in runs {
            let runAttrs = CTRunGetAttributes(run) as NSDictionary
            let runFont = runAttrs[kCTFontAttributeName] as! CTFont
            let runBaseline: Double
            if line.yTopPaper != nil {
                runBaseline = line.yTopPaper! + Double(CTFontGetAscent(runFont))
            } else {
                runBaseline = yBaseline
            }
            let glyphCount = CTRunGetGlyphCount(run)
            var glyphs = [CGGlyph](repeating: 0, count: glyphCount)
            var positions = [CGPoint](repeating: .zero, count: glyphCount)
            CTRunGetGlyphs(run, CFRange(location: 0, length: glyphCount), &glyphs)
            CTRunGetPositions(run, CFRange(location: 0, length: glyphCount), &positions)

            for i in 0..<glyphCount {
                guard let glyphPath = CTFontCreatePathForGlyph(runFont, glyphs[i], nil) else {
                    continue
                }
                let px = xStart + Double(positions[i].x)
                let py = runBaseline
                let transform = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: px, ty: py)
                let rings = flattenPath(glyphPath, transform: transform)
                guard !rings.isEmpty else { continue }

                // 各 subpath をそのまま保持（ネスト grouping は CJK stroke の向きを壊す）
                let contours: [[[[Double]]]] = rings.map { ring in
                    let converted = ring.map { pt in
                        paperToReal(pt[0], pt[1], scale: realScale)
                    }
                    return [converted]
                }

                let hasArea = contours.contains { poly in
                    poly.contains { ring in ring.count > 2 && abs(ringSignedArea(ring)) > 0.01 }
                }
                guard hasArea else { continue }

                children.append(PathChild(
                    type: "path",
                    contours: contours,
                    stroke: "none",
                    fill: fillColor,
                    strokeWidth: "thin"
                ))
            }
        }
    }

    if children.isEmpty {
        throw NSError(domain: "outline-text", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "アウトライン化できるグリフがありませんでした"])
    }
    return OutputPayload(children: children, layout: layout, error: nil)
}

// MARK: - Entry

let data = FileHandle.standardInput.readDataToEndOfFile()
guard !data.isEmpty else {
    let err = OutputPayload(children: nil, layout: nil, error: "stdin が空です")
    let out = try! JSONEncoder().encode(err)
    FileHandle.standardOutput.write(out)
    exit(1)
}

do {
    let input = try JSONDecoder().decode(InputPayload.self, from: data)
    let mode = input.mode ?? "outline"
    let result: OutputPayload
    if mode == "layout" {
        let layout = try computeTextLayout(input)
        result = OutputPayload(children: nil, layout: layout, error: nil)
    } else {
        result = try outlinePayload(input)
    }
    let out = try JSONEncoder().encode(result)
    FileHandle.standardOutput.write(out)
} catch {
    let err = OutputPayload(children: nil, layout: nil, error: error.localizedDescription)
    let out = try! JSONEncoder().encode(err)
    FileHandle.standardOutput.write(out)
    exit(1)
}

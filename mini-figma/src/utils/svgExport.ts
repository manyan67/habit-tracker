import type { Shape } from "../types/shape"

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function escapeXml(value: string): string {
  // XML-спецсимволы; амперсанд собираем по коду, чтобы не писать entity в исходнике
  const amp = String.fromCharCode(38)
  return value
    .replace(/&/g, amp + "amp;")
    .replace(/</g, amp + "lt;")
    .replace(/>/g, amp + "gt;")
    .replace(/"/g, amp + "quot;")
}

function strokeAttrs(shape: Shape): string {
  const weight = shape.strokeWeight ?? 0
  if (weight <= 0 || shape.stroke === "transparent" || !HEX_RE.test(shape.stroke)) {
    return ""
  }
  return ` stroke="${shape.stroke}" stroke-width="${weight}"`
}

/** Экспорт фигур в SVG-строку (viewBox 0 0 1440 900); скрытые фигуры пропускаются. */
export function exportShapesToSvg(shapes: Shape[]): string {
  const parts: string[] = []
  for (const shape of shapes) {
    if (shape.visible === false) continue
    const rotation = shape.rotation
      ? ` transform="rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})"`
      : ""
    if (shape.kind === "rectangle") {
      parts.push(
        `  <rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${escapeXml(shape.fill)}"${strokeAttrs(shape)}${rotation}/>`,
      )
    } else if (shape.kind === "ellipse") {
      parts.push(
        `  <ellipse cx="${shape.x + shape.width / 2}" cy="${shape.y + shape.height / 2}" rx="${shape.width / 2}" ry="${shape.height / 2}" fill="${escapeXml(shape.fill)}"${strokeAttrs(shape)}${rotation}/>`,
      )
    } else {
      const fontSize = shape.fontSize ?? 16
      parts.push(
        `  <text x="${shape.x}" y="${shape.y + fontSize * 0.9}" font-size="${fontSize}" fill="${escapeXml(shape.fill)}">${escapeXml(shape.text ?? "")}</text>`,
      )
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">\n${parts.join("\n")}\n</svg>`
}

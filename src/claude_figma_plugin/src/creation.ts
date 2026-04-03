// Node creation functions for the Figma plugin.
// Extracted from code.js — pure structural refactor.

import { appendOrInsertChild, hexToFigmaColor, fontWeightToStyle, applyColorPaint } from './utils';
import { setCharacters } from './text';

export async function createRectangle(params: any) {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    name = "Rectangle",
    parentId,
    fillColor,
  } = params || {};

  const rect = figma.createRectangle();
  rect.x = x;
  rect.y = y;
  rect.resize(width, height);
  rect.name = name;

  // Set corner radius if provided
  if (params.cornerRadius !== undefined) {
    rect.cornerRadius = params.cornerRadius;
  }

  // Set fill color if provided
  if (fillColor) {
    applyColorPaint(rect, "fills", fillColor);
  }

  // Set stroke color and weight if provided
  if (params.strokeColor) {
    applyColorPaint(rect, "strokes", params.strokeColor);
  }
  if (params.strokeWeight !== undefined) {
    rect.strokeWeight = params.strokeWeight;
  }

  // Set opacity if provided
  if (params.opacity !== undefined) {
    rect.opacity = params.opacity;
  }

  await appendOrInsertChild(rect, parentId, params.insertAt);

  return {
    id: rect.id,
    name: rect.name,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    parentId: rect.parent ? rect.parent.id : undefined,
  };
}

export async function createFrame(params: any, firstOnTop: boolean = true) {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    name = "Frame",
    parentId,
    fillColor,
    strokeColor,
    strokeWeight,
    layoutMode = "NONE",
    layoutWrap = "NO_WRAP",
    paddingTop = 10,
    paddingRight = 10,
    paddingBottom = 10,
    paddingLeft = 10,
    primaryAxisAlignItems = "MIN",
    counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED",
    layoutSizingVertical = "FIXED",
    itemSpacing = 0,
  } = params || {};

  const frame = figma.createFrame();
  frame.x = x;
  frame.y = y;
  frame.resize(width, height);
  frame.name = name;

  // Set clipsContent if provided
  if (params.clipsContent !== undefined) {
    frame.clipsContent = !!params.clipsContent;
  }

  // Set corner radius if provided
  if (params.cornerRadius !== undefined) {
    frame.cornerRadius = params.cornerRadius;
  }

  // Set opacity if provided
  if (params.opacity !== undefined) {
    frame.opacity = params.opacity;
  }

  // Set layout mode if provided
  if (layoutMode !== "NONE") {
    frame.layoutMode = layoutMode;
    frame.layoutWrap = layoutWrap;

    // Apply first-on-top stacking default (can be overridden per-call)
    if (params.itemReverseZIndex !== undefined) {
      frame.itemReverseZIndex = !!params.itemReverseZIndex;
    } else if (firstOnTop) {
      frame.itemReverseZIndex = true;
    }

    // Set padding values only when layoutMode is not NONE
    frame.paddingTop = paddingTop;
    frame.paddingRight = paddingRight;
    frame.paddingBottom = paddingBottom;
    frame.paddingLeft = paddingLeft;

    // Set axis alignment only when layoutMode is not NONE
    frame.primaryAxisAlignItems = primaryAxisAlignItems;
    frame.counterAxisAlignItems = counterAxisAlignItems;

    // Set layout sizing (defer FILL until after parenting — it requires an auto-layout parent)
    if (layoutSizingHorizontal !== "FILL" && layoutSizingVertical !== "FILL") {
      frame.layoutSizingHorizontal = layoutSizingHorizontal;
      frame.layoutSizingVertical = layoutSizingVertical;
    }

    // Set item spacing only when layoutMode is not NONE
    frame.itemSpacing = itemSpacing;

    // Set counter axis spacing when wrapping
    if (params.counterAxisSpacing !== undefined && layoutWrap === "WRAP") {
      frame.counterAxisSpacing = params.counterAxisSpacing;
    }
  }

  // Set fill color if provided
  if (fillColor) {
    applyColorPaint(frame, "fills", fillColor);
  }

  // Set stroke color and weight if provided
  if (strokeColor) {
    applyColorPaint(frame, "strokes", strokeColor);
  }

  // Set stroke weight if provided
  if (strokeWeight !== undefined) {
    frame.strokeWeight = strokeWeight;
  }

  await appendOrInsertChild(frame, parentId, params.insertAt);

  // Now set FILL sizing after the frame has been parented (FILL requires auto-layout parent)
  if (layoutMode !== "NONE") {
    if (layoutSizingHorizontal === "FILL" || layoutSizingVertical === "FILL") {
      try {
        frame.layoutSizingHorizontal = layoutSizingHorizontal;
        frame.layoutSizingVertical = layoutSizingVertical;
      } catch (e) {
        // FILL may fail if parent is not auto-layout — fall back to FIXED
        if (layoutSizingHorizontal === "FILL") {
          try { frame.layoutSizingHorizontal = "FILL"; } catch (e2) { frame.layoutSizingHorizontal = "FIXED"; }
        }
        if (layoutSizingVertical === "FILL") {
          try { frame.layoutSizingVertical = "FILL"; } catch (e2) { frame.layoutSizingVertical = "FIXED"; }
        }
      }
    }
  }

  return {
    id: frame.id,
    name: frame.name,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    fills: frame.fills,
    strokes: frame.strokes,
    strokeWeight: frame.strokeWeight,
    layoutMode: frame.layoutMode,
    layoutWrap: frame.layoutWrap,
    itemReverseZIndex: frame.itemReverseZIndex,
    parentId: frame.parent ? frame.parent.id : undefined,
  };
}

export async function createText(params: any) {
  const {
    x = 0,
    y = 0,
    text = "Text",
    fontSize = 14,
    fontWeight = 400,
    fontColor = { r: 0, g: 0, b: 0, a: 1 }, // Default to black
    name = "",
    parentId,
    width,
  } = params || {};

  // Accept optional fontFamily and fontStyle params
  const userFontFamily = params.fontFamily || "Inter";
  const userFontStyle = params.fontStyle || fontWeightToStyle(fontWeight);

  const textNode = figma.createText();
  textNode.x = x;
  textNode.y = y;
  textNode.name = name || text;
  try {
    await figma.loadFontAsync({
      family: userFontFamily,
      style: userFontStyle,
    });
    textNode.fontName = { family: userFontFamily, style: userFontStyle };
    textNode.fontSize = parseInt(fontSize);
  } catch (error) {
    console.error("Error setting font", error);
    // Fallback to Inter if the requested font is not available
    try {
      await figma.loadFontAsync({ family: "Inter", style: fontWeightToStyle(fontWeight) });
      textNode.fontName = { family: "Inter", style: fontWeightToStyle(fontWeight) };
      textNode.fontSize = parseInt(fontSize);
    } catch (fallbackError) {
      console.error("Error setting fallback font", fallbackError);
    }
  }
  await setCharacters(textNode, text);

  // Set text color
  applyColorPaint(textNode, "fills", fontColor);

  // Set text alignment if provided
  if (params.textAlignHorizontal) {
    textNode.textAlignHorizontal = params.textAlignHorizontal;
  }

  // Set line height if provided
  if (params.lineHeight !== undefined) {
    textNode.lineHeight = { value: params.lineHeight, unit: "PIXELS" };
  }

  // Set letter spacing if provided
  if (params.letterSpacing !== undefined) {
    textNode.letterSpacing = { value: params.letterSpacing, unit: "PIXELS" };
  }

  // Set text case if provided
  if (params.textCase) {
    textNode.textCase = params.textCase;
  }

  // Set opacity if provided
  if (params.opacity !== undefined) {
    textNode.opacity = params.opacity;
  }

  // If width is specified, set fixed width with auto-height (text wraps at this width)
  if (width) {
    textNode.resize(width, textNode.height);
    textNode.textAutoResize = "HEIGHT";
  }

  await appendOrInsertChild(textNode, parentId, params.insertAt);

  return {
    id: textNode.id,
    name: textNode.name,
    x: textNode.x,
    y: textNode.y,
    width: textNode.width,
    height: textNode.height,
    characters: textNode.characters,
    fontSize: textNode.fontSize,
    fontWeight: fontWeight,
    fontColor: fontColor,
    fontName: textNode.fontName,
    fills: textNode.fills,
    parentId: textNode.parent ? textNode.parent.id : undefined,
  };
}

export async function createEllipse(params: any) {
  var x = params.x || 0;
  var y = params.y || 0;
  var width = params.width || 100;
  var height = params.height || 100;
  var name = params.name || "Ellipse";
  var parentId = params.parentId;

  var ellipse = figma.createEllipse();
  ellipse.x = x;
  ellipse.y = y;
  ellipse.resize(width, height);
  ellipse.name = name;

  // Set fill color if provided
  if (params.fillColor) {
    var fc: any = params.fillColor;
    if (typeof fc === "string") {
      fc = hexToFigmaColor(fc) || { r: 0.85, g: 0.85, b: 0.85, a: 1 };
    }
    applyColorPaint(ellipse, "fills", fc);
  }

  // Set stroke color and weight if provided
  if (params.strokeColor) {
    var sc: any = params.strokeColor;
    if (typeof sc === "string") {
      sc = hexToFigmaColor(sc) || { r: 0, g: 0, b: 0, a: 1 };
    }
    applyColorPaint(ellipse, "strokes", sc);
  }
  if (params.strokeWeight !== undefined) {
    ellipse.strokeWeight = params.strokeWeight;
  }

  // Set arc data if provided (for arcs/donuts)
  if (params.arcData) {
    ellipse.arcData = {
      startingAngle: params.arcData.startingAngle || 0,
      endingAngle: params.arcData.endingAngle || 6.2831853,
      innerRadius: params.arcData.innerRadius || 0,
    };
  }

  await appendOrInsertChild(ellipse, parentId, params.insertAt);

  return {
    id: ellipse.id,
    name: ellipse.name,
    x: ellipse.x,
    y: ellipse.y,
    width: ellipse.width,
    height: ellipse.height,
  };
}

export async function createSection(params: any) {
  const { name = "Section", x = 0, y = 0, width = 1000, height = 1000, childIds } = params || {};

  const section = figma.createSection();
  section.name = name;
  section.x = x;
  section.y = y;
  section.resizeWithoutConstraints(width, height);

  // Move children into the section if provided
  let childCount = 0;
  if (childIds && Array.isArray(childIds)) {
    for (const childId of childIds) {
      const childNode = await figma.getNodeByIdAsync(childId);
      if (childNode) {
        section.appendChild(childNode);
        childCount++;
      }
    }
  }

  figma.currentPage.appendChild(section);

  return {
    id: section.id,
    name: section.name,
    childCount: childCount,
  };
}

export async function createSvg(params: any) {
  var svgString = params.svg;
  var frame = figma.createNodeFromSvg(svgString);

  if (params.name) frame.name = params.name;
  if (params.x !== undefined) frame.x = params.x;
  if (params.y !== undefined) frame.y = params.y;
  if (params.width && params.height) frame.resize(params.width, params.height);

  await appendOrInsertChild(frame, params.parentId, params.insertAt);

  return {
    id: frame.id,
    name: frame.name,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    childCount: frame.children.length,
  };
}

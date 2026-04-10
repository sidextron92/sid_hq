/**
 * Runtime displacement map & specular highlight generator for liquid glass effects.
 *
 * Ported from kube.io's liquid-glass-css-svg implementation.
 * Generates physics-based refraction maps using Snell's law on a convex squircle surface,
 * producing per-component displacement maps tuned to exact dimensions & corner radii.
 */

/** Surface profile: convex squircle y = (1-(1-x)^4)^(1/4) */
const convexSquircle = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4);

/**
 * 1D displacement profile via Snell's law ray tracing.
 *
 * @param glassThickness  Optical thickness of the glass (affects refraction offset)
 * @param bezelWidth      Width of the refractive bezel ring in px
 * @param refractiveIndex Refractive index (1.0 = air, 1.45 = glass)
 * @param samples         Number of samples along the bezel (default 128)
 * @returns Array of displacement magnitudes (one per sample)
 */
function calculateDisplacementMap1D(
  glassThickness: number,
  bezelWidth: number,
  refractiveIndex: number,
  samples = 128
): number[] {
  const eta = 1 / refractiveIndex;
  const result: number[] = [];

  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const y = convexSquircle(x);

    // Surface normal via finite difference derivative
    const dx = x < 1 ? 0.0001 : -0.0001;
    const derivative =
      (convexSquircle(Math.max(0, Math.min(1, x + dx))) - y) / dx;
    const magnitude = Math.sqrt(derivative * derivative + 1);
    const normal = [-derivative / magnitude, -1 / magnitude];

    // Snell's law: compute refracted ray
    const cosTheta = normal[1];
    const k = 1 - eta * eta * (1 - cosTheta * cosTheta);

    if (k < 0) {
      // Total internal reflection
      result.push(0);
    } else {
      const refracted = [
        -(eta * cosTheta + Math.sqrt(k)) * normal[0],
        eta - (eta * cosTheta + Math.sqrt(k)) * normal[1],
      ];
      // Displacement = horizontal offset at glass exit
      result.push(refracted[0] * ((y * bezelWidth + glassThickness) / refracted[1]));
    }
  }

  return result;
}

/**
 * 2D displacement map from 1D profile, mapped radially around a rounded rectangle.
 *
 * @param canvasW   Output image width
 * @param canvasH   Output image height
 * @param objectW   Object width (the glass element)
 * @param objectH   Object height
 * @param radius    Corner radius of the rounded rectangle
 * @param bezelWidth Width of the refractive bezel
 * @param maxDisp   Maximum displacement value (for normalization)
 * @param profile   1D displacement profile from calculateDisplacementMap1D
 * @returns ImageData with R=X displacement, G=Y displacement (128 = neutral)
 */
function calculateDisplacementMap2D(
  canvasW: number,
  canvasH: number,
  objectW: number,
  objectH: number,
  radius: number,
  bezelWidth: number,
  maxDisp: number,
  profile: number[]
): ImageData {
  const img = new ImageData(canvasW, canvasH);

  // Fill with neutral (128, 128) = no displacement
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 128;
    img.data[i + 1] = 128;
    img.data[i + 3] = 255;
  }

  const rSq = radius * radius;
  const rp1Sq = (radius + 1) ** 2;
  const rmBwSq = Math.max(0, radius - bezelWidth) ** 2;
  const wBody = objectW - radius * 2;
  const hBody = objectH - radius * 2;
  const offsetX = (canvasW - objectW) / 2;
  const offsetY = (canvasH - objectH) / 2;

  for (let y1 = 0; y1 < objectH; y1++) {
    for (let x1 = 0; x1 < objectW; x1++) {
      const idx = ((offsetY + y1) * canvasW + offsetX + x1) * 4;

      // Distance to nearest rounded-rect edge
      const x =
        x1 < radius ? x1 - radius : x1 >= objectW - radius ? x1 - radius - wBody : 0;
      const y =
        y1 < radius ? y1 - radius : y1 >= objectH - radius ? y1 - radius - hBody : 0;
      const dSq = x * x + y * y;

      if (dSq <= rp1Sq && dSq >= rmBwSq) {
        const dist = Math.sqrt(dSq);
        const opacity =
          dSq < rSq ? 1 : 1 - (dist - radius) / (Math.sqrt(rp1Sq) - radius);

        // Look up displacement from 1D profile
        const bezelIdx = Math.floor(
          Math.max(0, Math.min(1, (radius - dist) / bezelWidth)) * profile.length
        );
        const dispVal = profile[Math.max(0, Math.min(bezelIdx, profile.length - 1))] || 0;

        // Convert to radial displacement vector
        const dX = maxDisp > 0 ? (-(dist > 0 ? x / dist : 0) * dispVal) / maxDisp : 0;
        const dY = maxDisp > 0 ? (-(dist > 0 ? y / dist : 0) * dispVal) / maxDisp : 0;

        // Encode as pixel values (128 = neutral, 0 = max negative, 255 = max positive)
        img.data[idx] = Math.max(0, Math.min(255, 128 + dX * 127 * opacity));
        img.data[idx + 1] = Math.max(0, Math.min(255, 128 + dY * 127 * opacity));
      }
    }
  }

  return img;
}

/**
 * Specular highlight image based on surface curvature and a fixed light direction.
 *
 * @param objectW Object width
 * @param objectH Object height
 * @param radius  Corner radius
 * @param bezelWidth Width of the specular ring
 * @returns ImageData with white specular highlights
 */
function calculateSpecularHighlight(
  objectW: number,
  objectH: number,
  radius: number,
  bezelWidth: number
): ImageData {
  const img = new ImageData(objectW, objectH);

  // Light direction (upper-right at 60°)
  const lightVec = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)];
  const rSq = radius * radius;
  const rp1Sq = (radius + 1) ** 2;
  const rmSSq = Math.max(0, (radius - 1.5) ** 2);

  for (let y1 = 0; y1 < objectH; y1++) {
    for (let x1 = 0; x1 < objectW; x1++) {
      const x =
        x1 < radius
          ? x1 - radius
          : x1 >= objectW - radius
            ? x1 - radius - (objectW - radius * 2)
            : 0;
      const y =
        y1 < radius
          ? y1 - radius
          : y1 >= objectH - radius
            ? y1 - radius - (objectH - radius * 2)
            : 0;
      const dSq = x * x + y * y;

      if (dSq <= rp1Sq && dSq >= rmSSq) {
        const dist = Math.sqrt(dSq);
        const opacity =
          dSq < rSq ? 1 : 1 - (dist - radius) / (Math.sqrt(rp1Sq) - radius);

        // Dot product with light direction
        const dotProduct = Math.abs(
          (dist > 0 ? x / dist : 0) * lightVec[0] +
            (dist > 0 ? -y / dist : 0) * lightVec[1]
        );

        // Curvature falloff
        const curveFactor =
          dotProduct *
          Math.sqrt(
            1 - (1 - Math.max(0, Math.min(1, (radius - dist) / 1.5))) ** 2
          );

        const c = Math.min(255, 255 * curveFactor);
        const idx = (y1 * objectW + x1) * 4;

        img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = c;
        img.data[idx + 3] = Math.min(255, c * curveFactor * opacity);
      }
    }
  }

  return img;
}

/**
 * Convert ImageData to a data URL for use in SVG feImage href.
 */
function imageDataToDataURL(img: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d")!.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export interface GlassMapConfig {
  /** Element width in px */
  width: number;
  /** Element height in px */
  height: number;
  /** Corner radius in px */
  radius: number;
  /** Width of the refractive bezel ring in px (default 16) */
  bezelWidth?: number;
  /** Optical glass thickness — affects refraction offset (default 80) */
  glassThickness?: number;
  /** Refractive index: 1.0 = air, 1.45 = glass (default 1.45) */
  refractiveIndex?: number;
}

export interface GlassMapResult {
  /** Data URL of the displacement map */
  displacementMap: string;
  /** Data URL of the specular highlight */
  specularMap: string;
  /** Maximum displacement magnitude (used as feDisplacementMap scale) */
  maxDisplacement: number;
}

/**
 * Generate displacement + specular maps for a glass element.
 * Call once at mount time; the result is a pair of data URLs for SVG feImage hrefs.
 */
export function generateGlassMaps(config: GlassMapConfig): GlassMapResult {
  const {
    width,
    height,
    radius,
    bezelWidth = 16,
    glassThickness = 80,
    refractiveIndex = 1.45,
  } = config;

  const profile = calculateDisplacementMap1D(glassThickness, bezelWidth, refractiveIndex);
  const maxDisp = Math.max(...profile.map(Math.abs));

  const displacementImg = calculateDisplacementMap2D(
    width, height, width, height, radius, bezelWidth, maxDisp || 1, profile
  );
  const specularImg = calculateSpecularHighlight(width, height, radius, bezelWidth);

  return {
    displacementMap: imageDataToDataURL(displacementImg),
    specularMap: imageDataToDataURL(specularImg),
    maxDisplacement: maxDisp,
  };
}

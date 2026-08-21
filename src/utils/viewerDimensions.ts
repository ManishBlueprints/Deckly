export interface ViewerDimensions {
  width: number;
  height: number;
}

export function getAspectRatio(
  width?: number | null,
  height?: number | null,
): number | null {
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}

export function fitAspectRatioWithinBounds(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number,
): ViewerDimensions {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    !Number.isFinite(aspectRatio) ||
    aspectRatio <= 0
  ) {
    return { width: 0, height: 0 };
  }

  if (containerWidth / containerHeight > aspectRatio) {
    return {
      width: containerHeight * aspectRatio,
      height: containerHeight,
    };
  }

  return {
    width: containerWidth,
    height: containerWidth / aspectRatio,
  };
}

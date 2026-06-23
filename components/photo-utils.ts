import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
export { MAX_PHOTOS_PER_PERSON, MAX_PHOTO_BYTES } from './photo-constants';
import { MAX_PHOTO_BYTES } from './photo-constants';

const MAX_PHOTO_DIMENSION = 1600;
const MIN_COMPRESS_QUALITY = 0.35;
const COMPRESS_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42, MIN_COMPRESS_QUALITY];

type PreparePhotoOptions = {
  cropToSquare?: boolean;
};

export type PreparedPhotoResult = {
  uri: string;
  sizeBytes: number;
};

async function getUriSizeBytes(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob.size;
}

function buildResizeAction(width: number, height: number) {
  const largestDimension = Math.max(width, height);
  if (largestDimension <= MAX_PHOTO_DIMENSION) {
    return null;
  }

  if (width >= height) {
    return { resize: { width: MAX_PHOTO_DIMENSION } };
  }

  return { resize: { height: MAX_PHOTO_DIMENSION } };
}

function buildSquareCropAction(width: number, height: number) {
  const side = Math.min(width, height);
  if (side <= 0 || width === height) {
    return null;
  }

  return {
    crop: {
      originX: Math.max(0, Math.floor((width - side) / 2)),
      originY: Math.max(0, Math.floor((height - side) / 2)),
      width: side,
      height: side,
    },
  };
}

export async function preparePhotoForUpload(
  asset: Pick<ImagePicker.ImagePickerAsset, 'uri' | 'width' | 'height'>,
  options: PreparePhotoOptions = {},
): Promise<PreparedPhotoResult> {
  const actions = [];

  if (options.cropToSquare) {
    const cropAction = buildSquareCropAction(asset.width, asset.height);
    if (cropAction) {
      actions.push(cropAction);
    }
  }

  const resizeAction = buildResizeAction(asset.width, asset.height);
  if (resizeAction) {
    actions.push(resizeAction);
  }

  let candidateUri = asset.uri;

  if (actions.length > 0) {
    const manipulated = await manipulateAsync(asset.uri, actions, {
      compress: COMPRESS_QUALITY_STEPS[0],
      format: SaveFormat.JPEG,
    });
    candidateUri = manipulated.uri;
  }

  let sizeBytes = await getUriSizeBytes(candidateUri);
  if (sizeBytes <= MAX_PHOTO_BYTES) {
    return { uri: candidateUri, sizeBytes };
  }

  for (const compress of COMPRESS_QUALITY_STEPS) {
    const manipulated = await manipulateAsync(candidateUri, [], {
      compress,
      format: SaveFormat.JPEG,
    });
    candidateUri = manipulated.uri;
    sizeBytes = await getUriSizeBytes(candidateUri);

    if (sizeBytes <= MAX_PHOTO_BYTES) {
      break;
    }
  }

  return { uri: candidateUri, sizeBytes };
}

export async function cropPhotoForPreferredDisplay(uri: string): Promise<PreparedPhotoResult> {
  const baseline = await manipulateAsync(uri, [], {
    compress: 1,
    format: SaveFormat.JPEG,
  });

  const cropAction = buildSquareCropAction(baseline.width, baseline.height);
  if (!cropAction) {
    const sizeBytes = await getUriSizeBytes(baseline.uri);
    return { uri: baseline.uri, sizeBytes };
  }

  const cropped = await manipulateAsync(baseline.uri, [cropAction], {
    compress: COMPRESS_QUALITY_STEPS[0],
    format: SaveFormat.JPEG,
  });

  let candidateUri = cropped.uri;
  let sizeBytes = await getUriSizeBytes(candidateUri);

  if (sizeBytes <= MAX_PHOTO_BYTES) {
    return { uri: candidateUri, sizeBytes };
  }

  for (const compress of COMPRESS_QUALITY_STEPS) {
    const recompressed = await manipulateAsync(candidateUri, [], {
      compress,
      format: SaveFormat.JPEG,
    });
    candidateUri = recompressed.uri;
    sizeBytes = await getUriSizeBytes(candidateUri);

    if (sizeBytes <= MAX_PHOTO_BYTES) {
      break;
    }
  }

  return { uri: candidateUri, sizeBytes };
}

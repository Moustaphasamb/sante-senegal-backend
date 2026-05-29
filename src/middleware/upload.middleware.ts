import multer from 'multer';
import { BadRequestError } from '../utils/errors';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_PHOTO_SIZE_MB = 5;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

// Stockage en mémoire — le buffer est passé à Cloudinary
const memoryStorage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(new BadRequestError(`Format non supporté. Formats acceptés : JPEG, PNG, WebP`));
    return;
  }
  cb(null, true);
};

export const uploadPhotoMiddleware = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
  fileFilter,
}).single('photo');

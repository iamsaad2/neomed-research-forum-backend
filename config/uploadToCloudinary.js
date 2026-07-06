const cloudinary = require("./cloudinary");

/**
 * Upload an in-memory file buffer to Cloudinary and resolve with the result.
 * Used for both recap photos (images) and abstract PDFs (raw files), so nothing
 * is written to Railway's ephemeral disk.
 *
 * @param {Buffer} buffer   file bytes (from multer memoryStorage)
 * @param {Object} options  Cloudinary upload options (folder, resource_type, ...)
 */
module.exports = function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) =>
      error ? reject(error) : resolve(result)
    );
    stream.end(buffer);
  });
};

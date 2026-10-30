const { v2: cloudinary } = require('cloudinary');

const configured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function uploadBuffer(buffer, options = {}) {
  if (!configured) return Promise.reject(new Error('Cloudinary is not configured.'));
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error); else resolve(result);
    });
    stream.end(buffer);
  });
}

async function destroy(publicId, resourceType='image') {
  if (!configured || !publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}

module.exports = { cloudinary, configured, uploadBuffer, destroy };

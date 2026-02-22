import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const ImageManager = {
    /**
     * Save a base64 image to the filesystem.
     * @param {string} base64Data - The base64 string of the image.
     * @param {string} type - 'user' or 'bike' to organize files (prefix).
     * @returns {Promise<string>} - The filename of the saved image.
     */
    async saveImage(base64Data, type = 'img') {
        const fileName = `${type}_${new Date().getTime()}.jpeg`;
        try {
            await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Data
            });
            console.log(`Image saved: ${fileName}`);
            return fileName;
        } catch (e) {
            console.error('Error saving image', e);
            throw e;
        }
    },

    /**
     * Get the displayable source (URL) for an image file.
     * @param {string} fileName - The name of the file in the Data directory.
     * @returns {Promise<string>} - The WebView-compatible URL.
     */
    async getImageSrc(fileName) {
        if (!fileName) return '';

        // If it's already a base64 string (legacy support), return it
        if (fileName.startsWith('data:image')) return fileName;

        try {
            const uri = await Filesystem.getUri({
                path: fileName,
                directory: Directory.Data
            });
            return Capacitor.convertFileSrc(uri.uri);
        } catch (e) {
            console.error('Error getting image URI', e);
            return ''; // Return empty to show placeholder
        }
    },

    /**
     * Delete an image file.
     * @param {string} fileName 
     */
    async deleteImage(fileName) {
        if (!fileName || fileName.startsWith('data:image')) return;
        try {
            await Filesystem.deleteFile({
                path: fileName,
                directory: Directory.Data
            });
            console.log(`Image deleted: ${fileName}`);
        } catch (e) {
            console.warn('Error deleting image (might not exist)', e);
        }
    }
};

export default ImageManager;

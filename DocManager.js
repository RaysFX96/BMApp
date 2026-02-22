import ImageManager from './ImageManager.js';

/**
 * DocManager.js
 * Handles document photo storage (License, Libretto, etc.)
 */
const DocManager = {
    /**
     * Save a document photo.
     * @param {string} base64Data 
     * @param {string} docType - 'patente', 'libretto', 'assicurazione', etc.
     * @returns {Promise<string>} - The filename.
     */
    async saveDoc(base64Data, docType) {
        return await ImageManager.saveImage(base64Data, `doc_${docType}`);
    },

    /**
     * Delete a document photo.
     * @param {string} fileName 
     */
    async deleteDoc(fileName) {
        return await ImageManager.deleteImage(fileName);
    },

    /**
     * Get the source for a document image.
     * @param {string} fileName 
     * @returns {Promise<string>}
     */
    async getDocSrc(fileName) {
        return await ImageManager.getImageSrc(fileName);
    }
};

export default DocManager;

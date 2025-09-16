/**
 * 图片处理相关工具函数
 */
const { getLayerBounds, getSmartObjectTransform } = require('./layerUtils');
const { exportLayerAsBase64 } = require('./exportUtils');

/**
 * 获取图片信息
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 图片信息对象
 */
async function getImageInfo(layer) {
    try {
        // 检查是否是图像图层
        if (layer.kind === 'smartObject' || layer.kind === 'normal' || layer.typename === 'ArtLayer') {
            const imageInfo = {
                isImage: true,
                hasPixels: layer.hasPixels || false,
                isSmartObject: layer.kind === 'smartObject',
                
                // 图像属性
                pixelCount: null,
                colorDepth: null,
                colorProfile: null,
                
                // Base64数据
                base64Data: null,
                mimeType: 'image/png',
                
                // 智能对象信息
                smartObjectInfo: null
            };
            
            // 如果是智能对象，尝试获取更多信息
            if (layer.kind === 'smartObject') {
                imageInfo.smartObjectInfo = {
                    embedded: true,
                    linkedFile: layer.linkedFile || null,
                    transform: getSmartObjectTransform(layer)
                };
            }
            
            // 尝试获取图像尺寸信息
            const bounds = getLayerBounds(layer);
            if (bounds) {
                imageInfo.originalDimensions = {
                    width: bounds.width,
                    height: bounds.height
                };
            }
            
            // 导出图层为base64
            try {
                imageInfo.base64Data = await exportLayerAsBase64(layer);
            } catch (error) {
                console.error("导出图层base64失败:", error);
                imageInfo.base64Data = null;
                imageInfo.exportError = error.message;
            }
            
            return imageInfo;
        }
        
        return null;
    } catch (error) {
        console.error("获取图片信息失败:", error);
        return null;
    }
}

module.exports = {
    getImageInfo
};

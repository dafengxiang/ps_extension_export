/**
 * 图片处理相关工具函数
 */
const { getLayerBounds, getSmartObjectTransform } = require('./layerUtils');
const { saveLayerAsImage } = require('./exportUtils');

/**
 * 获取图片信息
 * @param {Object} layer - PS图层对象
 * @param {string} outputDir - 输出目录路径（可选）
 * @param {string} filename - 文件名（可选）
 * @returns {Object|null} 图片信息对象
 */
async function getImageInfo(layer, outputDir = null, filename = null) {
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
                
                // 图片路径
                imagePath: null,
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
            
            // 保存图片到本地并返回绝对路径
            try {
                imageInfo.imagePath = await saveLayerAsImage(layer, outputDir, filename);
                console.log(`图片已保存到本地: ${imageInfo.imagePath}`);
            } catch (error) {
                console.error("保存图片到本地失败:", error);
                imageInfo.imagePath = null;
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

/**
 * CSS生成相关工具函数
 */
const { getLayerBounds } = require('./layerUtils');

/**
 * 生成CSS属性
 * @param {Object} layer - PS图层对象
 * @returns {Object} CSS属性对象
 */
function generateCSSProperties(layer) {
    try {
        const bounds = getLayerBounds(layer);
        const css = {};
        
        if (bounds) {
            css.position = 'absolute';
            css.left = `${bounds.left}px`;
            css.top = `${bounds.top}px`;
            css.width = `${bounds.width}px`;
            css.height = `${bounds.height}px`;
        }
        
        css.opacity = (layer.opacity || 100) / 100;
        css.visibility = layer.visible ? 'visible' : 'hidden';
        
        if (layer.blendMode) {
            css.mixBlendMode = convertBlendMode(layer.blendMode);
        }
        
        if (layer.rotation) {
            css.transform = `rotate(${layer.rotation}deg)`;
        }
        
        return css;
    } catch (error) {
        console.error("生成CSS属性失败:", error);
        return {};
    }
}

/**
 * 转换PS混合模式为CSS混合模式
 * @param {string} psBlendMode - PS混合模式
 * @returns {string} CSS混合模式
 */
function convertBlendMode(psBlendMode) {
    const blendModeMap = {
        'normal': 'normal',
        'multiply': 'multiply',
        'screen': 'screen',
        'overlay': 'overlay',
        'softLight': 'soft-light',
        'hardLight': 'hard-light',
        'colorDodge': 'color-dodge',
        'colorBurn': 'color-burn',
        'darken': 'darken',
        'lighten': 'lighten',
        'difference': 'difference',
        'exclusion': 'exclusion'
    };
    return blendModeMap[psBlendMode] || 'normal';
}

module.exports = {
    generateCSSProperties,
    convertBlendMode
};

/**
 * 图层信息获取相关工具函数
 */

/**
 * 获取图层边界
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 边界信息对象
 */
function getLayerBounds(layer) {
    try {
        if (layer.bounds) {
            return {
                left: layer.bounds.left,
                top: layer.bounds.top,
                right: layer.bounds.right,
                bottom: layer.bounds.bottom,
                width: layer.bounds.right - layer.bounds.left,
                height: layer.bounds.bottom - layer.bounds.top
            };
        }
        return null;
    } catch (error) {
        console.error("获取图层边界失败:", error);
        return null;
    }
}

/**
 * 获取图层尺寸
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 尺寸信息对象
 */
function getLayerDimensions(layer) {
    try {
        const bounds = getLayerBounds(layer);
        if (bounds) {
            return {
                width: bounds.width,
                height: bounds.height,
                aspectRatio: bounds.height !== 0 ? bounds.width / bounds.height : 0
            };
        }
        return null;
    } catch (error) {
        console.error("获取图层尺寸失败:", error);
        return null;
    }
}

/**
 * 获取图层变换信息
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 变换信息对象
 */
function getLayerTransform(layer) {
    try {
        return {
            rotation: layer.rotation || 0,
            scaleX: layer.scaleX || 100,
            scaleY: layer.scaleY || 100,
            skewX: layer.skewX || 0,
            skewY: layer.skewY || 0
        };
    } catch (error) {
        console.error("获取图层变换信息失败:", error);
        return null;
    }
}

/**
 * 获取图层层级信息
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 层级信息对象
 */
function getLayerHierarchy(layer) {
    try {
        const hierarchy = {
            depth: 0,
            parent: null,
            index: 0,
            path: layer.name
        };
        
        // 尝试获取父图层信息
        try {
            if (layer.parent) {
                hierarchy.parent = {
                    name: layer.parent.name,
                    id: layer.parent.id,
                    type: layer.parent.kind || layer.parent.typename
                };
                hierarchy.path = layer.parent.name + " > " + layer.name;
            }
        } catch (e) {
            // 某些图层可能没有parent属性
        }
        
        // 尝试获取图层索引
        try {
            hierarchy.index = layer.itemIndex || 0;
        } catch (e) {
            // 某些图层可能没有itemIndex属性
        }
        
        return hierarchy;
    } catch (error) {
        console.error("获取图层层级信息失败:", error);
        return null;
    }
}

/**
 * 获取图层效果
 * @param {Object} layer - PS图层对象
 * @returns {Object} 效果信息对象
 */
async function getLayerEffects(layer) {
    try {
        const effects = {};
        
        // 尝试获取图层效果
        if (layer.layerEffects) {
            effects.dropShadow = layer.layerEffects.dropShadow || null;
            effects.innerShadow = layer.layerEffects.innerShadow || null;
            effects.outerGlow = layer.layerEffects.outerGlow || null;
            effects.innerGlow = layer.layerEffects.innerGlow || null;
            effects.bevelEmboss = layer.layerEffects.bevelEmboss || null;
            effects.stroke = layer.layerEffects.stroke || null;
        }
        
        return effects;
    } catch (error) {
        console.error("获取图层效果失败:", error);
        return {};
    }
}

/**
 * 获取智能对象变换信息
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 智能对象变换信息
 */
function getSmartObjectTransform(layer) {
    try {
        return {
            scaleX: layer.scaleX || 100,
            scaleY: layer.scaleY || 100,
            rotation: layer.rotation || 0,
            skewX: layer.skewX || 0,
            skewY: layer.skewY || 0
        };
    } catch (error) {
        console.error("获取智能对象变换信息失败:", error);
        return null;
    }
}

module.exports = {
    getLayerBounds,
    getLayerDimensions,
    getLayerTransform,
    getLayerHierarchy,
    getLayerEffects,
    getSmartObjectTransform
};

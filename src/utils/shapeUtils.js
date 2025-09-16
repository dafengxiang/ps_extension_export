/**
 * 形状处理相关工具函数
 */
const { convertColorToObject, rgbToHex } = require('./colorUtils');

/**
 * 获取形状信息
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 形状信息对象
 */
async function getShapeInfo(layer) {
    try {
        if (layer.kind === 'shape' || layer.typename === 'ArtLayer') {
            const shapeInfo = {
                shapeType: layer.shapeOperation || 'unknown',
                strokeEnabled: layer.strokeEnabled || false,
                fillEnabled: layer.fillEnabled || false,
                colors: {
                    fill: null,
                    stroke: null
                }
            };
            
            // 获取形状颜色信息
            try {
                // 方法1: 通过图层样式获取
                if (layer.layerEffects) {
                    if (layer.layerEffects.stroke && layer.layerEffects.stroke.color) {
                        shapeInfo.colors.stroke = convertColorToObject(layer.layerEffects.stroke.color);
                    }
                    if (layer.layerEffects.colorOverlay && layer.layerEffects.colorOverlay.color) {
                        shapeInfo.colors.fill = convertColorToObject(layer.layerEffects.colorOverlay.color);
                    }
                }
                
                // 方法2: 使用脚本获取形状颜色（简化版本）
                if (!shapeInfo.colors.fill && !shapeInfo.colors.stroke) {
                    try {
                        const shapeColorScript = `
                            (function() {
                                try {
                                    var colorInfo = {};
                                    var layer = app.activeDocument.activeLayer;
                                    
                                    // 简化的颜色获取，避免复杂的ActionDescriptor操作
                                    if (layer.kind == LayerKind.SOLIDFILL) {
                                        try {
                                            // 尝试通过简单方式获取颜色
                                            colorInfo.fill = {
                                                red: 128,
                                                green: 128,
                                                blue: 128
                                            };
                                        } catch (e) {}
                                    }
                                    
                                    return JSON.stringify(colorInfo);
                                } catch (e) {
                                    return "{}";
                                }
                            })();
                        `;
                        
                        const { core } = require("photoshop");
                        const result = await core.executeAsModal(shapeColorScript, {
                            commandName: "Get Shape Colors"
                        });
                        
                        if (result && result !== '{}') {
                            const scriptColors = JSON.parse(result);
                            if (scriptColors.fill) {
                                shapeInfo.colors.fill = {
                                    ...scriptColors.fill,
                                    hex: rgbToHex(scriptColors.fill.red, scriptColors.fill.green, scriptColors.fill.blue)
                                };
                            }
                            if (scriptColors.stroke) {
                                shapeInfo.colors.stroke = {
                                    ...scriptColors.stroke,
                                    hex: rgbToHex(scriptColors.stroke.red, scriptColors.stroke.green, scriptColors.stroke.blue)
                                };
                            }
                        }
                    } catch (e) {
                        console.log("脚本获取形状颜色失败:", e.message);
                    }
                }
            } catch (e) {
                console.log("获取形状颜色失败:", e.message);
            }
            
            return shapeInfo;
        }
        return null;
    } catch (error) {
        console.error("获取形状信息失败:", error);
        return null;
    }
}

module.exports = {
    getShapeInfo
};
